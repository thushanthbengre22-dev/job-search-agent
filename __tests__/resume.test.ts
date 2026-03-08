import { describe, it, expect } from "vitest";
import { mergeProfiles, buildResumePromptSections, ResumeProfile } from "@/lib/resume";

const profile1: ResumeProfile = {
  filename: "resume_a.pdf",
  skills: ["Java", "TypeScript", "React"],
  titles: ["Software Engineer", "Full Stack Engineer", "Backend Engineer", "Java Developer", "Staff Engineer"],
  yearsOfExperience: 6,
};

const profile2: ResumeProfile = {
  filename: "resume_b.pdf",
  skills: ["React", "Node.js", "AWS", "Kubernetes"],
  titles: ["Frontend Engineer", "Software Engineer", "Cloud Engineer", "DevOps Engineer", "Engineering Lead"],
  yearsOfExperience: 4,
};

const profile3: ResumeProfile = {
  filename: "resume_c.pdf",
  skills: ["Python", "Machine Learning", "TensorFlow"],
  titles: ["ML Engineer", "Data Scientist", "AI Engineer", "Software Engineer", "Research Engineer"],
  yearsOfExperience: 8,
};

describe("mergeProfiles", () => {
  it("deduplicates skills across profiles", () => {
    const merged = mergeProfiles([profile1, profile2]);
    const reactCount = merged.skills.filter((s) => s === "React").length;
    expect(reactCount).toBe(1);
  });

  it("includes all unique skills", () => {
    const merged = mergeProfiles([profile1, profile2]);
    expect(merged.skills).toContain("Java");
    expect(merged.skills).toContain("Node.js");
    expect(merged.skills).toContain("AWS");
  });

  it("caps titles at 5", () => {
    const merged = mergeProfiles([profile1, profile2, profile3]);
    expect(merged.titles.length).toBeLessThanOrEqual(5);
  });

  it("deduplicates titles across profiles", () => {
    // profile1, profile2, profile3 all contain "Software Engineer"
    const merged = mergeProfiles([profile1, profile2, profile3]);
    const seCount = merged.titles.filter((t) => t === "Software Engineer").length;
    expect(seCount).toBe(1);
  });

  it("takes the highest yearsOfExperience", () => {
    const merged = mergeProfiles([profile1, profile2, profile3]);
    expect(merged.yearsOfExperience).toBe(8);
  });

  it("handles a single profile", () => {
    const merged = mergeProfiles([profile1]);
    expect(merged.skills).toEqual(profile1.skills);
    expect(merged.titles).toEqual(profile1.titles);
    expect(merged.yearsOfExperience).toBe(6);
  });
});

describe("buildResumePromptSections", () => {
  it("returns empty strings when no profiles", () => {
    const { resumeSection, resumeMatchInstruction } = buildResumePromptSections([]);
    expect(resumeSection).toBe("");
    expect(resumeMatchInstruction).toBe("");
  });

  it("includes filename in resumeSection", () => {
    const { resumeSection } = buildResumePromptSections([profile1]);
    expect(resumeSection).toContain("resume_a.pdf");
  });

  it("includes skills in resumeSection", () => {
    const { resumeSection } = buildResumePromptSections([profile1]);
    expect(resumeSection).toContain("Java");
    expect(resumeSection).toContain("TypeScript");
  });

  it("includes target titles in resumeSection", () => {
    const { resumeSection } = buildResumePromptSections([profile1]);
    expect(resumeSection).toContain("Software Engineer");
  });

  it("includes all profiles when multiple provided", () => {
    const { resumeSection } = buildResumePromptSections([profile1, profile2]);
    expect(resumeSection).toContain("resume_a.pdf");
    expect(resumeSection).toContain("resume_b.pdf");
  });

  it("includes resume match instruction when profiles present", () => {
    const { resumeMatchInstruction } = buildResumePromptSections([profile1]);
    expect(resumeMatchInstruction).toContain("Best Resume Match");
    expect(resumeMatchInstruction).toContain("Resume Tips");
  });
});