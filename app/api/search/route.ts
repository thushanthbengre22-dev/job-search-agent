import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import axios from "axios";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

const redis = Redis.fromEnv();

// 3 searches per email address per day
const emailRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "24 h"),
  prefix: "job-scout:email",
});

// 10 searches per IP per day
const ipRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "24 h"),
  prefix: "job-scout:ip",
});

interface Job {
  job_id: string;
  job_title: string;
  employer_name: string;
  job_city: string;
  job_state: string;
  job_is_remote: boolean;
  job_posted_at_datetime_utc: string;
  job_description: string;
  job_apply_link: string;
}

async function fetchJobs(title: string, location: string): Promise<Job[]> {
  try {
    const response = await axios.get("https://jsearch.p.rapidapi.com/search", {
      params: {
        query: `${title} in ${location}`,
        page: "1",
        num_pages: "1",
        date_posted: "week",
        remote_jobs_only: "false",
      },
      headers: {
        "X-RapidAPI-Key": process.env.JSEARCH_API_KEY!,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
      timeout: 8000,
    });
    return response.data.data || [];
  } catch {
    return [];
  }
}

function encode(obj: object): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

function formatEmailHtml(digest: string, locations: string[]): string {
  const lines = digest.split("\n");
  const htmlLines = lines.map((line) => {
    if (line.startsWith("##")) return `<h2 style="color:#e2e8f0;margin:24px 0 8px">${line.replace(/^#+\s*/, "")}</h2>`;
    if (line.startsWith("#")) return `<h1 style="color:#f8fafc;margin:0 0 16px">${line.replace(/^#+\s*/, "")}</h1>`;
    if (line.match(/^[-*]\s/)) return `<li style="margin:4px 0;color:#cbd5e1">${line.replace(/^[-*]\s/, "")}</li>`;
    if (line.trim() === "") return "<br/>";
    return `<p style="margin:4px 0;color:#cbd5e1">${line}</p>`;
  });

  return `
    <div style="font-family:system-ui,sans-serif;background:#0f172a;padding:32px;border-radius:12px;max-width:700px;margin:0 auto">
      <div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #1e293b">
        <h1 style="color:#f8fafc;margin:0 0 4px;font-size:22px">Job Scout Results</h1>
        <p style="color:#64748b;margin:0;font-size:14px">
          Locations: ${locations.join(", ")} &nbsp;·&nbsp; Last 7 days
        </p>
      </div>
      ${htmlLines.join("\n")}
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
        Sent by Job Scout · <a href="https://www.bengredev.com/ai-lab/job-search-agent" style="color:#3b82f6">Run another search</a>
      </div>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  const LIMITS = { titles: 10, skills: 30, locations: 5 };

  let body: { titles: unknown; skills: unknown; locations: unknown; email: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { titles, skills, locations, email } = body;

  if (
    !Array.isArray(titles) || titles.length === 0 ||
    !Array.isArray(skills) || skills.length === 0 ||
    !Array.isArray(locations) || locations.length === 0 ||
    typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Rate limit by IP — 10 searches per IP per 24 hours
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: ipOk } = await ipRatelimit.limit(ip);
  if (!ipOk) {
    return NextResponse.json(
      { error: "Too many searches from your network. Try again tomorrow." },
      { status: 429 }
    );
  }

  // Rate limit by email — 3 searches per email per 24 hours
  const { success: emailOk } = await emailRatelimit.limit(email as string);
  if (!emailOk) {
    return NextResponse.json(
      { error: "Too many searches. You can run up to 3 searches per day per email address." },
      { status: 429 }
    );
  }

  const safeTitles = titles.slice(0, LIMITS.titles).map(String);
  const safeSkills = skills.slice(0, LIMITS.skills).map(String);
  const safeLocations = locations.slice(0, LIMITS.locations).map(String);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encode({ type: "status", message: `Fetching ${safeTitles.length} job titles in parallel...` })
        );

        const pairs = safeTitles.flatMap((title) =>
          safeLocations.map((location) => ({ title, location }))
        );

        const results = await Promise.all(
          pairs.map(({ title, location }) => fetchJobs(title, location))
        );

        const allJobs: Job[] = results.flat();
        const uniqueJobs = [
          ...new Map(allJobs.map((j) => [j.job_id, j])).values(),
        ];

        controller.enqueue(
          encode({
            type: "status",
            message: `Found ${uniqueJobs.length} unique listings. Analyzing with Claude...`,
          })
        );

        const jobList = uniqueJobs
          .slice(0, 20)
          .map(
            (j, i) =>
              `Job ${i + 1}:
Title: ${j.job_title}
Company: ${j.employer_name}
Location: ${j.job_city}, ${j.job_state} | Remote: ${j.job_is_remote}
Posted: ${j.job_posted_at_datetime_utc}
Description: ${j.job_description?.slice(0, 300)}
Apply: ${j.job_apply_link}`
          )
          .join("\n\n");

        // Collect Claude output instead of streaming it to the UI
        let digest = "";
        const claudeStream = client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: `You are a job search assistant. My skills: ${safeSkills.join(", ")}.

I am looking for roles in: ${safeLocations.join(", ")}, plus fully remote roles. No relocation outside these locations.
Only show jobs posted in the last 7 days.

Analyze these listings and:
1. Filter out jobs posted more than 7 days ago
2. Filter out jobs requiring relocation outside the specified locations/remote
3. Score each remaining job 1-10 based on match to my skills
4. Include any job scoring 6 or higher (partial matches welcome)
5. For each job include: Job Title, Company, Location/Remote, Match Score, Skills Matched, Skills Missing, Apply URL

Jobs:
${jobList}

Format results clearly, grouped by match score (highest first). Use plain text with clear section breaks.`,
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
          encode({ type: "status", message: `Sending results to ${email}...` })
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