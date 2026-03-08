import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ResumeProfile {
  filename: string;
  skills: string[];
  titles: string[];
  yearsOfExperience: number;
}

export interface MergedProfile {
  skills: string[];
  titles: string[];
  yearsOfExperience: number;
}

export async function parseResumeBase64(filename: string, base64: string): Promise<ResumeProfile> {
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
    // fall through with defaults
  }

  if (!parsed.isResume) {
    throw new Error(`"${filename}" does not appear to be a standard resume or CV. Please upload a valid resume.`);
  }

  return {
    filename,
    skills: Array.isArray(parsed.skills) ? parsed.skills.map(String) : [],
    titles: Array.isArray(parsed.titles) ? parsed.titles.map(String) : [],
    yearsOfExperience: Math.min(Math.max(0, parsed.yearsOfExperience), 20),
  };
}

export function mergeProfiles(profiles: ResumeProfile[]): MergedProfile {
  return {
    skills: [...new Set(profiles.flatMap((r) => r.skills))],
    titles: [...new Set(profiles.flatMap((r) => r.titles))].slice(0, 5),
    yearsOfExperience: Math.max(...profiles.map((r) => r.yearsOfExperience)),
  };
}

export function buildResumePromptSections(profiles: ResumeProfile[]): {
  resumeSection: string;
  resumeMatchInstruction: string;
} {
  if (profiles.length === 0) return { resumeSection: "", resumeMatchInstruction: "" };

  const resumeSection = `\nResume Profiles:\n${profiles.map((r) =>
    `[${r.filename}]\nSkills: ${r.skills.join(", ")}\nTarget Titles: ${r.titles.join(", ")}`
  ).join("\n\n")}\n`;

  const resumeMatchInstruction =
    `6. Best Resume Match: state which uploaded resume filename best fits this role\n` +
    `7. Resume Tips: 2-3 specific suggestions for that resume based on the JD (what to add, strengthen, or de-emphasize)`;

  return { resumeSection, resumeMatchInstruction };
}