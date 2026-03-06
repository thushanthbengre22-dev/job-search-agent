"use client";

import { useState, KeyboardEvent } from "react";
import { ArrowLeft, BriefcaseBusiness } from "lucide-react";

const DEFAULT_LOCATIONS = ["Massachusetts"];

const DEFAULT_TITLES = [
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

const DEFAULT_SKILLS = [
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
  "Gemini 1.5 Pro",
  "Tavily API",
  "Claude",
];

function TagInput({
  label,
  tags,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  tags: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      onAdd(input.trim().replace(/,$/, ""));
      setInput("");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        {label}
      </h2>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="flex items-center gap-1.5 bg-secondary text-secondary-foreground text-sm px-3 py-1 rounded-full border border-border"
          >
            {tag}
            <button
              onClick={() => onRemove(i)}
              className="text-muted-foreground hover:text-foreground transition-colors ml-0.5 leading-none"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="bg-input border border-border rounded-md px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
      />
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export default function JobScoutPage() {
  const [locations, setLocations] = useState<string[]>(DEFAULT_LOCATIONS);
  const [titles, setTitles] = useState<string[]>(DEFAULT_TITLES);
  const [skills, setSkills] = useState<string[]>(DEFAULT_SKILLS);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [successEmail, setSuccessEmail] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  function addLocation(v: string) {
    if (!locations.includes(v)) setLocations((prev) => [...prev, v]);
  }
  function removeLocation(i: number) {
    setLocations((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addTitle(v: string) {
    if (!titles.includes(v)) setTitles((prev) => [...prev, v]);
  }
  function removeTitle(i: number) {
    setTitles((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addSkill(v: string) {
    if (!skills.includes(v)) setSkills((prev) => [...prev, v]);
  }
  function removeSkill(i: number) {
    setSkills((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function runSearch() {
    setIsRunning(true);
    setSuccessEmail("");
    setError("");
    setStatus("Starting search...");

    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const response = await fetch(`${basePath}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles, skills, locations, email }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Something went wrong (${response.status}). Please try again.`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as {
              type: string;
              message?: string;
              email?: string;
            };
            if (event.type === "status" && event.message) {
              setStatus(event.message);
            } else if (event.type === "done" && event.email) {
              setSuccessEmail(event.email);
              setStatus("");
              setEmail("");
            } else if (event.type === "error" && event.message) {
              setError(event.message);
            }
          } catch {
            // skip malformed line
          }
        }
      }
    } catch (err) {
      setError((err as Error).message);
      setStatus("");
      setEmail("");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Sub-header — matches football chatbot exactly */}
      <div className="border-b border-border bg-background/80 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/ai-lab"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              AI Lab
            </a>
            <div className="h-4 w-[1px] bg-border" />
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <BriefcaseBusiness className="h-5 w-5 text-blue-500" />
              Job Scout
            </h1>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-4xl flex flex-col gap-8">
          {/* Description */}
          <p className="text-sm text-muted-foreground">
            Finds jobs posted in the last 7 days across your selected locations — in-office, hybrid, or remote.
            Searches <span className="text-foreground font-medium">LinkedIn</span>,{" "}
            <span className="text-foreground font-medium">Indeed</span>,{" "}
            <span className="text-foreground font-medium">Glassdoor</span>,{" "}
            <span className="text-foreground font-medium">ZipRecruiter</span>, and more via JSearch.
            Results are scored by Claude AI and delivered to your inbox.
          </p>

          {/* Config card */}
          <div className="flex flex-col gap-8 rounded-lg border border-border bg-card p-6">
            <TagInput
              label="Locations (States)"
              tags={locations}
              onAdd={addLocation}
              onRemove={removeLocation}
              placeholder="Add a state and press Enter (e.g. New York)"
            />
            <div className="h-[1px] bg-border" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <TagInput
                label="Job Titles"
                tags={titles}
                onAdd={addTitle}
                onRemove={removeTitle}
                placeholder="Add a title and press Enter"
              />
              <TagInput
                label="Skills"
                tags={skills}
                onAdd={addSkill}
                onRemove={removeSkill}
                placeholder="Add a skill and press Enter"
              />
            </div>
          </div>

          {/* Email input + Run button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors w-72"
            />
            <button
              onClick={runSearch}
              disabled={isRunning || titles.length === 0 || !email}
              className="flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed font-semibold px-5 py-2.5 rounded-md transition-opacity text-sm whitespace-nowrap"
            >
              {isRunning && <Spinner />}
              {isRunning ? "Searching..." : "Run Search & Send Email"}
            </button>
            {status && (
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                {isRunning && <Spinner />}
                {status}
              </span>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-5 py-4 text-sm">
              {error}
            </div>
          )}

          {/* Success */}
          {successEmail && (
            <div className="rounded-md border border-border bg-card px-5 py-4 text-sm text-foreground">
              Results sent to <span className="font-semibold">{successEmail}</span>. Check your inbox.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}