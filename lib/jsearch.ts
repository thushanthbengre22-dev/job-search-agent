import axios from "axios";

export interface Job {
  job_id: string;
  job_title: string;
  employer_name: string;
  job_city: string;
  job_state: string;
  job_is_remote: boolean;
  job_posted_at_datetime_utc: string;
  job_description: string;
  job_apply_link: string;
}

export function deduplicateJobs(jobs: Job[]): Job[] {
  // First pass: deduplicate by job_id
  const byId = [...new Map(jobs.map((j) => [j.job_id, j])).values()];

  // Second pass: deduplicate by (title + company + city) to catch the same
  // posting aggregated from multiple boards (LinkedIn, Indeed, Glassdoor, etc.)
  const seen = new Set<string>();
  return byId.filter((j) => {
    const key = [j.job_title, j.employer_name, j.job_city]
      .map((s) => (s ?? "").toLowerCase().trim())
      .join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function fetchJobs(title: string, location: string, attempt = 1): Promise<Job[]> {
  try {
    const response = await axios.get("https://jsearch.p.rapidapi.com/search", {
      params: {
        query: `${title} in ${location}`,
        page: "1",
        num_pages: "1",
        date_posted: "week",
        remote_jobs_only: "false",
      },
      headers: {
        "X-RapidAPI-Key": process.env.JSEARCH_API_KEY!,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
      timeout: 15000,
    });
    return response.data.data || [];
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000));
      return fetchJobs(title, location, attempt + 1);
    }
    console.error(`fetchJobs failed for "${title}" in "${location}":`, err);
    return [];
  }
}