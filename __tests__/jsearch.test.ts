import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

vi.mock("axios");

import { fetchJobs, deduplicateJobs } from "@/lib/jsearch";

const mockJob = {
  job_id: "abc123",
  job_title: "Software Engineer",
  employer_name: "Acme Corp",
  job_city: "Boston",
  job_state: "MA",
  job_is_remote: false,
  job_posted_at_datetime_utc: "2026-03-06T00:00:00Z",
  job_description: "Build cool stuff",
  job_apply_link: "https://example.com/apply",
  job_min_salary: null,
  job_max_salary: null,
  job_salary_currency: null,
  job_salary_period: null,
};

describe("deduplicateJobs", () => {
  it("removes duplicates with the same job_id", () => {
    const jobs = [mockJob, { ...mockJob }];
    expect(deduplicateJobs(jobs)).toHaveLength(1);
  });

  it("removes cross-site duplicates with different job_id but same title/company/city", () => {
    const linkedInJob = { ...mockJob, job_id: "linkedin-123" };
    const indeedJob = { ...mockJob, job_id: "indeed-456" };
    expect(deduplicateJobs([linkedInJob, indeedJob])).toHaveLength(1);
  });

  it("keeps jobs that differ by company", () => {
    const job1 = { ...mockJob, job_id: "a1" };
    const job2 = { ...mockJob, job_id: "b2", employer_name: "Other Corp" };
    expect(deduplicateJobs([job1, job2])).toHaveLength(2);
  });

  it("keeps jobs that differ by city", () => {
    const job1 = { ...mockJob, job_id: "a1" };
    const job2 = { ...mockJob, job_id: "b2", job_city: "Cambridge" };
    expect(deduplicateJobs([job1, job2])).toHaveLength(2);
  });

  it("is case-insensitive when matching title/company/city", () => {
    const job1 = { ...mockJob, job_id: "a1", job_title: "Software Engineer", employer_name: "Acme Corp", job_city: "Boston" };
    const job2 = { ...mockJob, job_id: "b2", job_title: "software engineer", employer_name: "ACME CORP", job_city: "BOSTON" };
    expect(deduplicateJobs([job1, job2])).toHaveLength(1);
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateJobs([])).toEqual([]);
  });
});

describe("fetchJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns jobs from API response", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { data: [mockJob] } });
    const jobs = await fetchJobs("Software Engineer", "Massachusetts");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].job_title).toBe("Software Engineer");
  });

  it("returns empty array when API returns no data field", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: {} });
    const jobs = await fetchJobs("Software Engineer", "Massachusetts");
    expect(jobs).toEqual([]);
  });

  it("calls API with correct query params", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { data: [] } });
    await fetchJobs("Java Developer", "Massachusetts");
    expect(axios.get).toHaveBeenCalledWith(
      "https://jsearch.p.rapidapi.com/search",
      expect.objectContaining({
        params: expect.objectContaining({
          query: "Java Developer in Massachusetts",
          date_posted: "week",
        }),
      })
    );
  });

  it("retries once on failure and returns jobs on second attempt", async () => {
    vi.useFakeTimers();
    vi.mocked(axios.get)
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ data: { data: [mockJob] } });

    const promise = fetchJobs("Software Engineer", "Massachusetts");
    await vi.runAllTimersAsync();
    const jobs = await promise;

    expect(jobs).toHaveLength(1);
    expect(axios.get).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("returns empty array after all retries fail", async () => {
    vi.useFakeTimers();
    vi.mocked(axios.get)
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"));

    const promise = fetchJobs("Software Engineer", "Massachusetts");
    await vi.runAllTimersAsync();
    const jobs = await promise;

    expect(jobs).toEqual([]);
    expect(axios.get).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("does not retry when attempt is already 2", async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error("timeout"));
    const jobs = await fetchJobs("Software Engineer", "Massachusetts", 2);
    expect(jobs).toEqual([]);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});