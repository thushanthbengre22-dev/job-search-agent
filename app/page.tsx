"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { ArrowLeft, BriefcaseBusiness, X, Upload } from "lucide-react";

const DEFAULT_LOCATIONS = ["Massachusetts"];

interface ResumeProfile {
  filename: string;
  skills: string[];
  titles: string[];
  yearsOfExperience: number;
}

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
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function JobScoutPage() {
  const [locations, setLocations] = useState<string[]>(DEFAULT_LOCATIONS);
  const [titles, setTitles] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [successEmail, setSuccessEmail] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [isAndroid, setIsAndroid] = useState(false);
  const [resumes, setResumes] = useState<File[]>([]);
  const [resumeProfiles, setResumeProfiles] = useState<ResumeProfile[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  useEffect(() => {
    setIsAndroid(/android/i.test(navigator.userAgent));
  }, []);
  const [yearsOfExperience, setYearsOfExperience] = useState(0);
  const [authorizedWithoutSponsorship, setAuthorizedWithoutSponsorship] = useState(false);

  function addLocation(v: string) { if (!locations.includes(v) && locations.length < 1) setLocations((p) => [...p, v]); }
  function removeLocation(i: number) { setLocations((p) => p.filter((_, idx) => idx !== i)); }
  function addTitle(v: string) { if (!titles.includes(v) && titles.length < 5) setTitles((p) => [...p, v]); }
  function removeTitle(i: number) { setTitles((p) => p.filter((_, idx) => idx !== i)); }
  function addSkill(v: string) { if (!skills.includes(v)) setSkills((p) => [...p, v]); }
  function removeSkill(i: number) { setSkills((p) => p.filter((_, idx) => idx !== i)); }

  function handleFileChange(e: { target: HTMLInputElement }) {
    setError("");
    const files = Array.from(e.target.files || []);

    setResumes((prev) => {
      let updated = [...prev];
      for (const file of files) {
        if (file.type !== "application/pdf") {
          setError(`${file.name} is not a PDF. Only PDF files are supported.`);
          continue;
        }
        if (file.size > 1024 * 1024) {
          setError(`${file.name} exceeds the 1MB size limit.`);
          continue;
        }
        const existingIndex = updated.findIndex((r) => r.name === file.name);
        if (existingIndex >= 0) {
          updated = [...updated];
          updated[existingIndex] = file;
        } else if (updated.length < 3) {
          updated = [...updated, file];
        } else {
          setError("Maximum 3 resumes allowed.");
        }
      }
      return updated;
    });

    e.target.value = "";
  }

  function removeResume(name: string) {
    setResumes((p) => p.filter((r) => r.name !== name));
    setResumeProfiles((p) => p.filter((r) => r.filename !== name));
  }

  async function parseResumes() {
    setIsParsing(true);
    setParseError("");
    setError("");

    const formData = new FormData();
    resumes.forEach((file) => formData.append("resumes", file));

    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const res = await fetch(`${basePath}/api/parse-resume`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to parse resumes. Please try again.");
      }

      const data = await res.json();
      setResumeProfiles(data.profiles);
      setSkills(data.merged.skills);
      setTitles(data.merged.titles);
      setYearsOfExperience(Math.min(data.merged.yearsOfExperience, 20));
    } catch (err) {
      setParseError((err as Error).message);
    } finally {
      setIsParsing(false);
    }
  }

  async function runSearch() {
    setIsRunning(true);
    setSuccessEmail("");
    setError("");
    setInfo("");
    setStatus("Starting search...");

    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const response = await fetch(`${basePath}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles, skills, locations, email, resumeProfiles, yearsOfExperience, authorizedWithoutSponsorship }),
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
            const event = JSON.parse(line) as { type: string; message?: string; email?: string };
            if (event.type === "status" && event.message) setStatus(event.message);
            else if (event.type === "done" && event.email) {
              setSuccessEmail(event.email);
              setStatus("");
              setEmail("");
            } else if (event.type === "info" && event.message) {
              setInfo(event.message);
              setStatus("");
            } else if (event.type === "error" && event.message) setError(event.message);
          } catch { /* skip malformed line */ }
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
      {/* Sub-header */}
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

      {/* Main */}
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

          {/* Resume Upload */}
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Resumes</h2>

            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm">
              <p className="font-medium text-amber-400 mb-1">Privacy Notice</p>
              <p className="text-amber-300/70">
                Your resume content is sent to Anthropic&apos;s API for parsing. We do not save your resume — please keep a copy of any files you upload.
              </p>
            </div>

            <label className={`flex items-center gap-2 w-fit text-sm font-medium px-4 py-2 rounded-md border border-border transition-colors ${resumes.length >= 3 ? "opacity-40 cursor-not-allowed bg-secondary" : "cursor-pointer bg-secondary hover:bg-secondary/80 text-secondary-foreground"}`}>
              <Upload className="h-4 w-4" />
              Upload Resume
              <input
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileChange}
                className="hidden"
                disabled={resumes.length >= 3}
              />
            </label>
            <p className="text-xs text-muted-foreground -mt-2">
              Up to 3 resumes · PDF only · Max 1MB each · Same filename replaces existing
            </p>
            {isAndroid && (
              <p className="text-xs text-blue-400/80 -mt-1">
                Tip: In the file picker, tap <span className="font-medium">Browse</span> or the grid icon to select from Google Drive.
              </p>
            )}

            {resumes.length > 0 && (
              <div className="flex flex-col gap-2">
                {resumes.map((file) => (
                  <div key={file.name} className="flex items-center justify-between bg-secondary/50 rounded-md px-3 py-2 text-sm">
                    <span className="text-foreground">{file.name}</span>
                    <button
                      onClick={() => removeResume(file.name)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {resumes.length > 0 && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={parseResumes}
                  disabled={isParsing}
                  className="flex items-center gap-2 w-fit bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed font-semibold px-5 py-2 rounded-md transition-opacity text-sm"
                >
                  {isParsing && <Spinner />}
                  {isParsing ? "Parsing..." : "Parse Resumes"}
                </button>
                {parseError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-4 py-3 text-sm flex items-start justify-between gap-3">
                    <span>{parseError}</span>
                    <button
                      onClick={() => setParseError("")}
                      className="shrink-0 hover:opacity-70 transition-opacity mt-0.5"
                      aria-label="Dismiss error"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Config card */}
          <div className="flex flex-col gap-8 rounded-lg border border-border bg-card p-6">
            <TagInput
              label="Location (1 max)"
              tags={locations}
              onAdd={addLocation}
              onRemove={removeLocation}
              placeholder={locations.length >= 1 ? "Remove current location to change" : "Add a state and press Enter (e.g. New York)"}
            />
            <div className="h-[1px] bg-border" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <TagInput
                label="Job Titles (5 max)"
                tags={titles}
                onAdd={addTitle}
                onRemove={removeTitle}
                placeholder={titles.length >= 5 ? "5 title limit reached" : "Add a title and press Enter"}
              />
              <TagInput
                label="Skills"
                tags={skills}
                onAdd={addSkill}
                onRemove={removeSkill}
                placeholder="Add a skill and press Enter"
              />
            </div>
            <div className="h-[1px] bg-border" />

            {/* Years of experience slider */}
            <div className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Years of Relevant Experience
              </h2>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={yearsOfExperience}
                  onChange={(e) => setYearsOfExperience(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="text-sm font-semibold text-foreground w-10 text-right">
                  {yearsOfExperience === 20 ? "20+" : yearsOfExperience}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0 years</span>
                <span>20+ years</span>
              </div>
            </div>

            <div className="h-[1px] bg-border" />

            {/* Work authorization */}
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Work Authorization
              </h2>
              <label className="flex items-start gap-3 cursor-pointer group w-fit">
                <input
                  type="checkbox"
                  checked={authorizedWithoutSponsorship}
                  onChange={(e) => setAuthorizedWithoutSponsorship(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary cursor-pointer"
                />
                <span className="text-sm text-foreground leading-snug">
                  Authorized to work for any US Employer without sponsorship
                </span>
              </label>
              <p className="text-xs text-muted-foreground ml-7">
                {authorizedWithoutSponsorship
                  ? "All jobs will be shown — sponsorship restrictions will not be filtered."
                  : "Jobs that explicitly require US work authorization without sponsorship will be filtered out and noted in your email."}
              </p>
            </div>
          </div>

          {/* Email + Run */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors w-72"
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={runSearch}
                disabled={isRunning || titles.length === 0 || locations.length === 0 || !email}
                className="flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed font-semibold px-5 py-2.5 rounded-md transition-opacity text-sm whitespace-nowrap"
              >
                {isRunning && <Spinner />}
                {isRunning ? "Searching..." : "Run Search & Send Email"}
              </button>
              {!isRunning && (titles.length === 0 || locations.length === 0) && (
                <p className="text-xs text-muted-foreground">
                  {titles.length === 0 && locations.length === 0
                    ? "Add a location and at least one job title — type and press Enter"
                    : titles.length === 0
                    ? "Add at least one job title — type and press Enter"
                    : "Add a location — type and press Enter"}
                </p>
              )}
            </div>
            {status && (
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                {isRunning && <Spinner />}
                {status}
              </span>
            )}
          </div>

          {/* Info */}
          {info && (
            <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-sm flex items-start justify-between gap-3">
              <span className="text-blue-300">{info}</span>
              <button
                onClick={() => setInfo("")}
                className="shrink-0 text-blue-400 hover:opacity-70 transition-opacity mt-0.5"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-5 py-4 text-sm flex items-start justify-between gap-3">
              <span>{error}</span>
              <button
                onClick={() => setError("")}
                className="shrink-0 hover:opacity-70 transition-opacity mt-0.5"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
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