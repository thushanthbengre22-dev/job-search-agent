import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { checkAndIncrementUsage } from "@/lib/usage";
import { fetchJobs } from "@/lib/jsearch";
import { formatEmailHtml } from "@/lib/email";
import { parseResumeBase64, mergeProfiles, buildResumePromptSections, ResumeProfile } from "@/lib/resume";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

const LOCATIONS = ["Massachusetts"];
const TO_EMAIL = process.env.CRON_TO_EMAIL ?? "thushanthbengre22@gmail.com";

async function loadResumeProfiles(): Promise<{ profiles: ResumeProfile[]; titles: string[]; skills: string[]; yearsOfExperience: number }> {
  const blobUrls = [
    process.env.RESUME_BLOB_URL_1,
    process.env.RESUME_BLOB_URL_2,
    process.env.RESUME_BLOB_URL_3,
  ].filter(Boolean) as string[];

  if (blobUrls.length === 0) {
    // Fallback to hardcoded profile if no blobs configured
    return {
      profiles: [],
      titles: ["Software Engineer", "Staff Engineer", "Engineering Lead", "Java Developer", "Engineering Manager"],
      skills: [
        "Java", "TypeScript", "JavaScript", "React",
        "Micro-frontend Architecture", "Node.js", "Spring Boot",
        "Microservices", "REST APIs", "AWS", "Kubernetes",
        "Agentic AI", "Multi-Agent Systems", "LLM Tool-Calling",
      ],
      yearsOfExperience: 0,
    };
  }

  const profiles = await Promise.all(
    blobUrls.map(async (url) => {
      const filename = decodeURIComponent(url.split("/").pop() ?? "resume.pdf");
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch resume from blob: ${url}`);
      const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
      return parseResumeBase64(filename, base64);
    })
  );

  const merged = mergeProfiles(profiles);
  return { profiles, ...merged };
}

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { profiles, titles, skills, yearsOfExperience } = await loadResumeProfiles();

    const pairs = titles.flatMap((title) =>
      LOCATIONS.map((location) => ({ title, location }))
    );

    const withinLimit = await checkAndIncrementUsage(pairs.length);
    if (!withinLimit) {
      return NextResponse.json({ error: "Monthly JSearch limit reached. Cron skipped." }, { status: 429 });
    }

    const results = await Promise.all(
      pairs.map(({ title, location }) => fetchJobs(title, location))
    );

    const uniqueJobs = [...new Map(results.flat().map((j) => [j.job_id, j])).values()];

    const jobList = uniqueJobs
      .slice(0, 20)
      .map(
        (j, i) =>
          `Job ${i + 1}:\nTitle: ${j.job_title}\nCompany: ${j.employer_name}\nLocation: ${j.job_city}, ${j.job_state} | Remote: ${j.job_is_remote}\nPosted: ${j.job_posted_at_datetime_utc}\nDescription: ${j.job_description?.slice(0, 1500)}\nApply: ${j.job_apply_link}`
      )
      .join("\n\n");

    const { resumeSection, resumeMatchInstruction } = buildResumePromptSections(profiles);

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: `You are a job search assistant.\n\nCandidate Profile:\n- Years of Relevant Experience: ${yearsOfExperience}${yearsOfExperience >= 20 ? "+" : ""}\n- Skills: ${skills.join(", ")}\n${resumeSection}\nI am looking for roles in: ${LOCATIONS.join(", ")}, plus fully remote roles. No relocation outside these locations.\nOnly show jobs posted in the last 7 days.\n\nAnalyze these listings and:\n1. Filter out jobs posted more than 7 days ago\n2. Filter out jobs requiring relocation outside the specified locations/remote\n3. Score each remaining job 1-10 based on match to skills and experience level\n4. Include any job scoring 6 or higher (partial matches welcome)\n5. For each job include: Job Title, Company, Location/Remote, Match Score, Skills Matched, Skills Missing, Apply URL\n${resumeMatchInstruction}\n\nJobs:\n${jobList}\n\nFormat results clearly, grouped by match score (highest first). Use plain text with clear section breaks.`,
        },
      ],
    });

    const digest = message.content[0].type === "text" ? message.content[0].text : "";

    const { error: resendError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "Job Scout <onboarding@resend.dev>",
      to: TO_EMAIL,
      subject: `Job Scout — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`,
      html: formatEmailHtml(digest),
    });

    if (resendError) {
      throw new Error(`Resend error: ${resendError.message}`);
    }

    return NextResponse.json({ ok: true, jobs: uniqueJobs.length, sentTo: TO_EMAIL, resumesLoaded: profiles.length });
  } catch (err) {
    console.error("Cron job failed:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}