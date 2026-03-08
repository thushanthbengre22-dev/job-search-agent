import { describe, it, expect } from "vitest";
import { formatEmailHtml } from "@/lib/email";

describe("formatEmailHtml", () => {
  describe("title and subtitle", () => {
    it("shows 'Job Scout Results' when locations are provided", () => {
      const html = formatEmailHtml("content", ["Massachusetts"]);
      expect(html).toContain("Job Scout Results");
    });

    it("shows 'Job Scout — Daily Digest' when no locations provided", () => {
      const html = formatEmailHtml("content");
      expect(html).toContain("Job Scout — Daily Digest");
    });

    it("includes location names in subtitle", () => {
      const html = formatEmailHtml("content", ["Massachusetts", "New York"]);
      expect(html).toContain("Massachusetts, New York");
    });

    it("shows 'Run another search' link when locations provided", () => {
      const html = formatEmailHtml("content", ["Massachusetts"]);
      expect(html).toContain("Run another search");
    });

    it("shows 'Run a custom search' link when no locations provided", () => {
      const html = formatEmailHtml("content");
      expect(html).toContain("Run a custom search");
    });
  });

  describe("markdown rendering", () => {
    it("converts ## to h2", () => {
      const html = formatEmailHtml("## Section Title");
      expect(html).toContain("<h2");
      expect(html).toContain("Section Title");
    });

    it("converts # to h1", () => {
      const html = formatEmailHtml("# Main Title");
      expect(html).toContain("<h1");
      expect(html).toContain("Main Title");
    });

    it("converts - list items to li", () => {
      const html = formatEmailHtml("- Item one");
      expect(html).toContain("<li");
      expect(html).toContain("Item one");
    });

    it("converts * list items to li", () => {
      const html = formatEmailHtml("* Item two");
      expect(html).toContain("<li");
      expect(html).toContain("Item two");
    });

    it("converts blank lines to br", () => {
      const html = formatEmailHtml("\n");
      expect(html).toContain("<br/>");
    });

    it("wraps plain text in p tags", () => {
      const html = formatEmailHtml("Just some text");
      expect(html).toContain("<p");
      expect(html).toContain("Just some text");
    });
  });

  describe("bold and italic rendering", () => {
    it("converts **text** to <strong>", () => {
      const html = formatEmailHtml("**Job Title:** Engineer");
      expect(html).toContain("<strong>Job Title:</strong>");
    });

    it("converts *text* to <em>", () => {
      const html = formatEmailHtml("*emphasis*");
      expect(html).toContain("<em>emphasis</em>");
    });

    it("converts ***text*** to <strong><em>", () => {
      const html = formatEmailHtml("***bold italic***");
      expect(html).toContain("<strong><em>bold italic</em></strong>");
    });

    it("renders bold inside headings", () => {
      const html = formatEmailHtml("## **Score:** 9/10");
      expect(html).toContain("<h2");
      expect(html).toContain("<strong>Score:</strong>");
    });

    it("renders bold inside list items", () => {
      const html = formatEmailHtml("- **Skills:** React, TypeScript");
      expect(html).toContain("<li");
      expect(html).toContain("<strong>Skills:</strong>");
    });
  });
});