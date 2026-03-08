import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/usage";
import { parseResumeBase64, mergeProfiles } from "@/lib/resume";

export const maxDuration = 60;

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

  try {
    const profiles = await Promise.all(
      files.map(async (file) => {
        const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
        return parseResumeBase64(file.name, base64);
      })
    );
    return NextResponse.json({ profiles, merged: mergeProfiles(profiles) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}