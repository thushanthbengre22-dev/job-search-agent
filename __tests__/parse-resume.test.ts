import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

import { parseResumeBase64 } from "@/lib/resume";

function makeAnthropicResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

const validProfile = {
  isResume: true,
  skills: ["Java", "TypeScript", "React"],
  titles: ["Software Engineer", "Full Stack Engineer", "Backend Engineer", "Staff Engineer", "Java Developer"],
  yearsOfExperience: 6,
};

describe("parseResumeBase64", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses a valid resume response", async () => {
    mockCreate.mockResolvedValue(makeAnthropicResponse(JSON.stringify(validProfile)));
    const result = await parseResumeBase64("resume.pdf", "base64data");
    expect(result.filename).toBe("resume.pdf");
    expect(result.skills).toContain("Java");
    expect(result.titles).toContain("Software Engineer");
    expect(result.yearsOfExperience).toBe(6);
  });

  it("strips markdown code fences from response", async () => {
    const wrapped = "```json\n" + JSON.stringify(validProfile) + "\n```";
    mockCreate.mockResolvedValue(makeAnthropicResponse(wrapped));
    const result = await parseResumeBase64("resume.pdf", "base64data");
    expect(result.skills).toContain("Java");
  });

  it("throws when isResume is false", async () => {
    mockCreate.mockResolvedValue(
      makeAnthropicResponse(JSON.stringify({ isResume: false, skills: [], titles: [], yearsOfExperience: 0 }))
    );
    await expect(parseResumeBase64("invoice.pdf", "base64data")).rejects.toThrow(
      '"invoice.pdf" does not appear to be a standard resume or CV'
    );
  });

  it("caps yearsOfExperience at 20", async () => {
    mockCreate.mockResolvedValue(
      makeAnthropicResponse(JSON.stringify({ ...validProfile, yearsOfExperience: 35 }))
    );
    const result = await parseResumeBase64("resume.pdf", "base64data");
    expect(result.yearsOfExperience).toBe(20);
  });

  it("floors yearsOfExperience at 0", async () => {
    mockCreate.mockResolvedValue(
      makeAnthropicResponse(JSON.stringify({ ...validProfile, yearsOfExperience: -3 }))
    );
    const result = await parseResumeBase64("resume.pdf", "base64data");
    expect(result.yearsOfExperience).toBe(0);
  });

  it("returns empty arrays when skills or titles are missing", async () => {
    mockCreate.mockResolvedValue(
      makeAnthropicResponse(JSON.stringify({ isResume: true, yearsOfExperience: 2 }))
    );
    const result = await parseResumeBase64("resume.pdf", "base64data");
    expect(result.skills).toEqual([]);
    expect(result.titles).toEqual([]);
  });

  it("falls back to defaults when JSON is malformed", async () => {
    mockCreate.mockResolvedValue(makeAnthropicResponse("not valid json {{"));
    // isResume defaults to true so it should not throw, returns empty profile
    const result = await parseResumeBase64("resume.pdf", "base64data");
    expect(result.skills).toEqual([]);
    expect(result.yearsOfExperience).toBe(0);
  });

  it("passes the correct model to Anthropic", async () => {
    mockCreate.mockResolvedValue(makeAnthropicResponse(JSON.stringify(validProfile)));
    await parseResumeBase64("resume.pdf", "base64data");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-4-5-20251001" })
    );
  });
});