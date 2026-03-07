import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { checkAndIncrementUsage } from "@/lib/usage";
import { fetchJobs } from "@/lib/jsearch";
import { formatEmailHtml } from "@/lib/email";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

const TITLES = [
  "Software Engineer",      // catches Senior SE, Full Stack SE, Backend SE, and variants
  "Staff Engineer",         // catches Staff + Principal level IC roles
  "Engineering Lead",       // catches Lead SE, Tech Lead, Engineering Lead
  "Java Developer",         // Java-specific roles not caught by SE queries
  "Engineering Manager",    // management track
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

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pairs = TITLES.flatMap((title) =>
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
          `Job ${i + 1}:\nTitle: ${j.job_title}\nCompany: ${j.employer_name}\nLocation: ${j.job_city}, ${j.job_state} | Remote: ${j.job_is_remote}\nPosted: ${j.job_posted_at_datetime_utc}\nDescription: ${j.job_description?.slice(0, 300)}\nApply: ${j.job_apply_link}`
      )
      .join("\n\n");

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are a job search assistant. My skills: ${SKILLS.join(", ")}.\n\nI am looking for roles in: ${LOCATIONS.join(", ")}, plus fully remote roles. No relocation outside these locations.\nOnly show jobs posted in the last 7 days.\n\nAnalyze these listings and:\n1. Filter out jobs posted more than 7 days ago\n2. Filter out jobs requiring relocation outside the specified locations/remote\n3. Score each remaining job 1-10 based on match to my skills\n4. Include any job scoring 6 or higher (partial matches welcome)\n5. For each job include: Job Title, Company, Location/Remote, Match Score, Skills Matched, Skills Missing, Apply URL\n\nJobs:\n${jobList}\n\nFormat results clearly, grouped by match score (highest first). Use plain text with clear section breaks.`,
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

    return NextResponse.json({ ok: true, jobs: uniqueJobs.length, sentTo: TO_EMAIL });
  } catch (err) {
    console.error("Cron job failed:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}