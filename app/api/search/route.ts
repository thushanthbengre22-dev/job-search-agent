import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { Ratelimit } from "@upstash/ratelimit";
import { redis, checkAndIncrementUsage } from "@/lib/usage";
import { fetchJobs, deduplicateJobs, Job } from "@/lib/jsearch";
import { formatEmailHtml } from "@/lib/email";
import { buildResumePromptSections, ResumeProfile } from "@/lib/resume";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

// 20 requests per IP per day (spam protection)
const ipRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "24 h"),
  prefix: "job-scout:ip",
});

// 2 searches per email address per day
const emailRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(2, "24 h"),
  prefix: "job-scout:email",
});

// 50 searches per day for the exempt email
const exemptEmailRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, "24 h"),
  prefix: "job-scout:exempt-email",
});

function encode(obj: object): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

export async function POST(req: NextRequest) {
  const LIMITS = { titles: 5, skills: 30, locations: 1 };

  let body: { titles: unknown; skills: unknown; locations: unknown; email: unknown; resumeProfiles: unknown; yearsOfExperience: unknown; authorizedWithoutSponsorship: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { titles, skills, locations, email, resumeProfiles, yearsOfExperience, authorizedWithoutSponsorship } = body;

  if (!Array.isArray(titles) || titles.length === 0) {
    return NextResponse.json({ error: "Add at least one job title before searching." }, { status: 400 });
  }
  if (!Array.isArray(locations) || locations.length === 0) {
    return NextResponse.json({ error: "Add a location before searching. Type a state and press Enter." }, { status: 400 });
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address to receive your results." }, { status: 400 });
  }

  // IP rate limit — 20 requests per IP per day (blocks spammers before any Redis lookup)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: ipOk } = await ipRatelimit.limit(ip);
  if (!ipOk) {
    return NextResponse.json(
      { error: "Too many requests from your network. Try again tomorrow." },
      { status: 429 }
    );
  }

  const exemptEmail = process.env.EXEMPT_EMAIL;

  // Check allowed email list (exempt email bypasses this)
  if (email !== exemptEmail) {
    const isAllowed = await redis.sismember("job-scout:allowed-emails", email as string);
    if (!isAllowed) {
      return NextResponse.json(
        { error: "Your email is not on the allowed list. Contact thushanthbengre22@gmail.com to request access." },
        { status: 403 }
      );
    }
  }

  // Rate limit by email — exempt email gets 50/day, everyone else gets 2/day
  const limiter = email === exemptEmail ? exemptEmailRatelimit : emailRatelimit;
  const { success: emailOk } = await limiter.limit(email as string);
  if (!emailOk) {
    const message = email === exemptEmail
      ? "Daily limit reached for this email."
      : "Too many searches. You can run up to 2 searches per day per email address.";
    return NextResponse.json({ error: message }, { status: 429 });
  }

  const safeTitles = titles.slice(0, LIMITS.titles).map((t) => String(t).slice(0, 100));
  const safeSkills = Array.isArray(skills) ? skills.slice(0, LIMITS.skills).map((s) => String(s).slice(0, 100)) : [];
  const safeLocations = locations.slice(0, LIMITS.locations).map((l) => String(l).slice(0, 100));
  const safeResumeProfiles: ResumeProfile[] = Array.isArray(resumeProfiles)
    ? (resumeProfiles as ResumeProfile[]).slice(0, 3)
    : [];
  const safeYearsOfExperience = typeof yearsOfExperience === "number"
    ? Math.min(Math.max(0, Math.round(yearsOfExperience)), 20)
    : 0;
  const safeAuthorizedWithoutSponsorship = authorizedWithoutSponsorship === true;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encode({ type: "status", message: `Step 1 of 3 — Searching job boards across ${safeLocations.join(", ")}...` })
        );

        const pairs = safeTitles.flatMap((title) =>
          safeLocations.map((location) => ({ title, location }))
        );

        const withinLimit = await checkAndIncrementUsage(pairs.length);
        if (!withinLimit) {
          controller.enqueue(
            encode({ type: "error", message: "Monthly search limit reached. Service will resume next month." })
          );
          controller.close();
          return;
        }

        const results: Job[][] = [];
        for (let i = 0; i < pairs.length; i += 2) {
          const batch = pairs.slice(i, i + 2);
          const batchTitles = batch.map((p) => p.title).join(" & ");
          controller.enqueue(
            encode({ type: "status", message: `Step 1 of 3 — Searching for: ${batchTitles}...` })
          );
          const batchResults = await Promise.all(
            batch.map(({ title, location }) => fetchJobs(title, location))
          );
          results.push(...batchResults);
          if (i + 2 < pairs.length) await new Promise((r) => setTimeout(r, 300));
        }

        const uniqueJobs = deduplicateJobs(results.flat());

        if (uniqueJobs.length === 0) {
          controller.enqueue(
            encode({ type: "info", message: "No results found for your current search parameters. You may have hit the API rate limit, or there are no matching jobs at this time. Try adjusting your titles or locations — if the issue persists, try again after 24 hours." })
          );
          controller.close();
          return;
        }

        controller.enqueue(
          encode({
            type: "status",
            message: `Step 2 of 3 — Found ${uniqueJobs.length} listings. Scoring and filtering with AI (this takes ~20–30s)...`,
          })
        );

        const jobList = uniqueJobs
          .slice(0, 20)
          .map(
            (j, i) =>
              `Job ${i + 1}:\nTitle: ${j.job_title}\nCompany: ${j.employer_name}\nLocation: ${j.job_city}, ${j.job_state} | Remote: ${j.job_is_remote}\nPosted: ${j.job_posted_at_datetime_utc}\nDescription: ${j.job_description?.slice(0, 1500)}\nApply: ${j.job_apply_link}`
          )
          .join("\n\n");

        const { resumeSection, resumeMatchInstruction } = buildResumePromptSections(safeResumeProfiles);

        let digest = "";
        const claudeStream = client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: `You are a job search assistant.\n\nCandidate Profile:\n- Years of Relevant Experience: ${safeYearsOfExperience}${safeYearsOfExperience >= 20 ? "+" : ""}\n- Skills: ${safeSkills.length > 0 ? safeSkills.join(", ") : "Not specified"}\n- Authorized to work without sponsorship: ${safeAuthorizedWithoutSponsorship ? "Yes" : "No"}\n${resumeSection}\nI am looking for roles in: ${safeLocations.join(", ")}, plus fully remote roles. No relocation outside these locations.\nOnly show jobs posted in the last 7 days.\n\nAnalyze these listings and:\n1. Filter out jobs posted more than 7 days ago\n2. Filter out jobs requiring relocation outside the specified locations/remote\n3. ${safeAuthorizedWithoutSponsorship ? "The candidate is authorized to work without sponsorship — no sponsorship filtering needed." : "The candidate requires visa sponsorship. If a job description explicitly states it will NOT sponsor visas, or requires candidates to be already authorized to work in the US without sponsorship (e.g. 'must be authorized to work in the US', 'no sponsorship available', 'US citizens or permanent residents only', 'will not sponsor work visas'), filter it out and include it in a clearly labeled 'Filtered Out — Sponsorship Required' section at the end of the email with the reason. If the job description does not mention sponsorship at all, do NOT filter it out."}\n4. Score each remaining job 1-10 based on match to skills and experience level\n5. Include any job scoring 6 or higher (partial matches welcome)\n6. For each job include: Job Title, Company, Location/Remote, Match Score, Skills Matched, Skills Missing, Apply URL\n${resumeMatchInstruction}\n\nJobs:\n${jobList}\n\nFormat results clearly, grouped by match score (highest first). Use plain text with clear section breaks.`,
            },
          ],
        });

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            digest += event.delta.text;
          }
        }

        controller.enqueue(
          encode({ type: "status", message: `Step 3 of 3 — Sending results to ${email}...` })
        );

        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "Job Scout <onboarding@resend.dev>",
          to: email,
          subject: `Job Scout Results — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`,
          html: formatEmailHtml(digest, safeLocations),
        });

        controller.enqueue(encode({ type: "done", email }));
        controller.close();
      } catch (err) {
        controller.enqueue(
          encode({ type: "error", message: (err as Error).message })
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}