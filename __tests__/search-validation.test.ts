import { describe, it, expect } from "vitest";

// Pure validation logic extracted from the route for testing
function validateSearchInput(body: {
  titles: unknown;
  locations: unknown;
  email: unknown;
}): string | null {
  if (!Array.isArray(body.titles) || body.titles.length === 0)
    return "Add at least one job title before searching.";
  if (!Array.isArray(body.locations) || body.locations.length === 0)
    return "Add a location before searching. Type a state and press Enter.";
  if (
    typeof body.email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
  )
    return "Enter a valid email address to receive your results.";
  return null;
}

describe("search input validation", () => {
  const validBody = {
    titles: ["Software Engineer"],
    locations: ["Massachusetts"],
    email: "user@example.com",
  };

  it("passes with valid input", () => {
    expect(validateSearchInput(validBody)).toBeNull();
  });

  it("fails when titles is empty array", () => {
    expect(validateSearchInput({ ...validBody, titles: [] })).toContain("job title");
  });

  it("fails when titles is not an array", () => {
    expect(validateSearchInput({ ...validBody, titles: "Software Engineer" })).toContain("job title");
  });

  it("fails when locations is empty array", () => {
    expect(validateSearchInput({ ...validBody, locations: [] })).toContain("location");
  });

  it("fails when locations is not an array", () => {
    expect(validateSearchInput({ ...validBody, locations: "Massachusetts" })).toContain("location");
  });

  it("fails when email has no @", () => {
    expect(validateSearchInput({ ...validBody, email: "notanemail" })).toContain("email");
  });

  it("fails when email has no domain", () => {
    expect(validateSearchInput({ ...validBody, email: "user@" })).toContain("email");
  });

  it("fails when email is empty string", () => {
    expect(validateSearchInput({ ...validBody, email: "" })).toContain("email");
  });

  it("fails when email is not a string", () => {
    expect(validateSearchInput({ ...validBody, email: 123 })).toContain("email");
  });

  it("validates titles before locations", () => {
    const error = validateSearchInput({ titles: [], locations: [], email: "x@x.com" });
    expect(error).toContain("job title");
  });

  it("validates locations before email", () => {
    const error = validateSearchInput({ titles: ["SE"], locations: [], email: "bad" });
    expect(error).toContain("location");
  });
});