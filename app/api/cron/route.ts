import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import axios from "axios";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

const TITLES = [
  "Senior Software Engineer",
  "Full Stack Engineer",
  "Senior Full-Stack Engineer",
  "Senior Backend Engineer",
  "Staff Engineer",
  "Lead Software Engineer",
  "Engineering Lead",
  "Java Developer",
  "Backend Engineer",
];

const SKILLS = [
  "Java", "TypeScript", "JavaScript", "React",
  "Micro-frontend Architecture", "Code Splitting", "Virtualization",
  "Debouncing", "Web Vitals / Frontend Performance Optimization",
  "Node.js", "Spring Boot", "Microservices", "REST APIs",
  "AWS", "Kubernetes", "SQL", "Database Optimization",
  "Agentic AI", "Multi-Agent Systems", "LLM Tool-Calling",
  "Vercel AI SDK", "Gemini 1.5 Pro", "Tavily API", "Claude",
];

const LOCATIONS = ["Massachusetts"];
const TO_EMAIL = process.env.CRON_TO_EMAIL ?? "thushanthbengre22@gmail.com";

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

function formatEmailHtml(digest: string): string {
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
        <h1 style="color:#f8fafc;margin:0 0 4px;font-size:22px">Job Scout — Daily Digest</h1>
        <p style="color:#64748b;margin:0;font-size:14px">
          ${LOCATIONS.join(", ")} &nbsp;·&nbsp; Last 7 days &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>
      ${htmlLines.join("\n")}
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
        Sent by Job Scout · <a href="https://www.bengredev.com/ai-lab/job-search-agent" style="color:#3b82f6">Run a custom search</a>
      </div>
    </div>
  `;
}

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all job titles in parallel
    const pairs = TITLES.flatMap((title) =>
      LOCATIONS.map((location) => ({ title, location }))
    );
    const results = await Promise.all(
      pairs.map(({ title, location }) => fetchJobs(title, location))
    );

    const allJobs: Job[] = results.flat();
    const uniqueJobs = [...new Map(allJobs.map((j) => [j.job_id, j])).values()];

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

    // Analyze with Claude
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are a job search assistant. My skills: ${SKILLS.join(", ")}.

I am looking for roles in: ${LOCATIONS.join(", ")}, plus fully remote roles. No relocation outside these locations.
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

    const digest = message.content[0].type === "text" ? message.content[0].text : "";

    // Send email
    const { error: resendError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "Job Scout <onboarding@resend.dev>",
      to: TO_EMAIL,
      subject: `Job Scout — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`,
      html: formatEmailHtml(digest),
    });

    if (resendError) {
      throw new Error(`Resend error: ${resendError.message}`);
    }

    return NextResponse.json({
      ok: true,
      jobs: uniqueJobs.length,
      sentTo: TO_EMAIL,
    });
  } catch (err) {
    console.error("Cron job failed:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}