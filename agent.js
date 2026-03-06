import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const CRON_TO_EMAIL = process.env.CRON_TO_EMAIL ?? "thushanthbengre22@gmail.com";

// ===== YOUR CONFIGURATION =====
// Edit these to match your target job titles and skills
const MY_TITLES = [
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

const MY_SKILLS = [
  "Java",
  "TypeScript",
  "JavaScript",
  "React",
  "Micro-frontend Architecture",
  "Code Splitting",
  "Virtualization",
  "Debouncing",
  "Web Vitals / Frontend Performance Optimization",
  "Node.js",
  "Spring Boot",
  "Microservices",
  "REST APIs",
  "AWS",
  "Kubernetes",
  "SQL",
  "Database Optimization",
  "Agentic AI",
  "Multi-Agent Systems",
  "LLM Tool-Calling",
  "Vercel AI SDK",
  "Gemini 2.5 Flash",
  "Tavily API",
  "Claude",
];

const LOCATIONS = ["Massachusetts"];
// ==============================

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function fetchJobs(title, location) {
  const response = await axios.get("https://jsearch.p.rapidapi.com/search", {
    params: {
      query: `${title} in ${location}`,
      page: "1",
      num_pages: "2",
      date_posted: "week",
      remote_jobs_only: "false", // include all types (remote, hybrid, in-office)
    },
    headers: {
      "X-RapidAPI-Key": process.env.JSEARCH_API_KEY,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
  });
  return response.data.data || [];
}

async function analyzeJobsWithClaude(jobs) {
  const jobList = jobs
    .slice(0, 20) // limit to top 20 to control costs
    .map(
      (j, i) =>
        `Job ${i + 1}:
Title: ${j.job_title}
Company: ${j.employer_name}
Location: ${j.job_city}, ${j.job_state} | Remote: ${j.job_is_remote}
Posted: ${j.job_posted_at_datetime_utc}
Description snippet: ${j.job_description?.slice(0, 300)}
Apply URL: ${j.job_apply_link}`
    )
    .join("\n\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `You are a job search assistant. Here are my skills: ${MY_SKILLS.join(", ")}.

I am looking for roles anywhere in Massachusetts, plus any fully remote roles. No relocation outside Massachusetts required.
Only show jobs posted in the last 7 days.

Analyze these job listings and:
1. Filter out jobs posted more than 7 days ago
2. Filter out jobs requiring relocation outside Massachusetts/remote
3. Score each remaining job 1-10 based on match to my skills
4. Include any job with a score of 6 or higher (do not exclude partial matches — a 60% skill overlap is worth showing)
5. Return a clean digest with: Job Title, Company, Location/Remote status, Match Score, Skills matched, Skills missing, Apply URL

Jobs to analyze:
${jobList}

Format as a clean, readable summary grouped by match score (highest to lowest).`,
      },
    ],
  });

  return message.content[0].text;
}

export async function runJobSearchAgent() {
  console.log(`Running job search agent — ${new Date().toLocaleString()}\n`);

  let allJobs = [];
  for (const title of MY_TITLES) {
    for (const location of LOCATIONS) {
      console.log(`Fetching: ${title} in ${location}...`);
      const jobs = await fetchJobs(title, location);
      allJobs = [...allJobs, ...jobs];
    }
  }

  // Deduplicate by job ID
  const uniqueJobs = [...new Map(allJobs.map((j) => [j.job_id, j])).values()];
  console.log(`\nFound ${uniqueJobs.length} unique listings. Analyzing...\n`);

  const digest = await analyzeJobsWithClaude(uniqueJobs);
  console.log("=".repeat(60));
  console.log("YOUR JOB DIGEST");
  console.log("=".repeat(60));
  console.log(digest);

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "Job Scout <onboarding@resend.dev>",
    to: CRON_TO_EMAIL,
    subject: `Job Scout — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`,
    text: digest,
  });

  if (error) {
    console.error("Failed to send email:", error.message);
  } else {
    console.log(`\nDigest emailed to ${CRON_TO_EMAIL}`);
  }

  return digest;
}

// Only run when invoked directly (not when imported)
const isMain = process.argv[1]?.endsWith("agent.js");
if (isMain) runJobSearchAgent().catch(console.error);