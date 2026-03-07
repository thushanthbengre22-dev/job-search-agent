import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/usage";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 10 parse calls per IP per day (each call can include up to 3 files)
const ipRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "24 h"),
  prefix: "job-scout:parse-ip",
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: ipOk } = await ipRatelimit.limit(ip);
  if (!ipOk) {
    return NextResponse.json(
      { error: "Too many requests from your network. Try again tomorrow." },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files = formData.getAll("resumes") as File[];

  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  if (files.length > 3) {
    return NextResponse.json({ error: "Maximum 3 resumes allowed" }, { status: 400 });
  }

  for (const file of files) {
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: `${file.name} is not a PDF. Only PDF files are supported.` }, { status: 400 });
    }
    if (file.size > 1024 * 1024) {
      return NextResponse.json({ error: `${file.name} exceeds the 1MB size limit.` }, { status: 400 });
    }
  }

  let profiles: { filename: string; skills: string[]; titles: string[]; yearsOfExperience: number }[];
  try {
    profiles = await Promise.all(
    files.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 },
              },
              {
                type: "text",
                text: `Analyze this document and return ONLY valid JSON with no other text:
{
  "isResume": true,
  "skills": ["skill1", "skill2"],
  "titles": ["Job Title 1", "Job Title 2"],
  "yearsOfExperience": 0
}

- isResume: true if this is a professional resume or CV, false if it is any other type of document
- skills: all technical skills, tools, frameworks, and relevant competencies from the resume
- titles: exactly 5 job search query terms for this person, ranked by best fit. Make them broad and non-overlapping so each query targets a distinct role category (e.g. prefer "Software Engineer" over "Senior Software Engineer" and "Full Stack Engineer" separately, as broad terms catch more variants)
- yearsOfExperience: calculate from the work experience section only — sum the durations of individual roles, do not count gaps or career breaks between jobs, return as an integer (max 20)
- If isResume is false, you may leave skills, titles, and yearsOfExperience as empty/zero`,
              },
            ] as any,
          },
        ],
      });

      const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      let parsed = { isResume: true, skills: [] as string[], titles: [] as string[], yearsOfExperience: 0 };
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // return empty profile if parsing fails
      }

      if (!parsed.isResume) {
        throw new Error(`"${file.name}" does not appear to be a standard resume or CV. Please upload a valid resume.`);
      }

      return {
        filename: file.name,
        skills: Array.isArray(parsed.skills) ? parsed.skills.map(String) : [],
        titles: Array.isArray(parsed.titles) ? parsed.titles.map(String) : [],
        yearsOfExperience: Math.min(Math.max(0, parsed.yearsOfExperience), 20),
      };
    })
  );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const merged = {
    skills: [...new Set(profiles.flatMap((r) => r.skills))],
    titles: [...new Set(profiles.flatMap((r) => r.titles))].slice(0, 5),
    yearsOfExperience: Math.max(...profiles.map((r) => r.yearsOfExperience)),
  };

  return NextResponse.json({ profiles, merged });
}