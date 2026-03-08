import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Must mock before importing the module so Redis.fromEnv() doesn't throw
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => ({}) },
}));

import { getMonthlyKey } from "@/lib/usage";

describe("getMonthlyKey", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns key in correct format", () => {
    vi.setSystemTime(new Date("2026-03-15T10:00:00Z"));
    expect(getMonthlyKey()).toBe("job-scout:jsearch-calls:2026-03");
  });

  it("zero-pads single-digit months", () => {
    vi.setSystemTime(new Date("2026-07-01T00:00:00Z"));
    expect(getMonthlyKey()).toBe("job-scout:jsearch-calls:2026-07");
  });

  it("handles December correctly", () => {
    vi.setSystemTime(new Date("2026-12-31T23:59:59Z"));
    expect(getMonthlyKey()).toBe("job-scout:jsearch-calls:2026-12");
  });

  it("handles January correctly", () => {
    vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
    expect(getMonthlyKey()).toBe("job-scout:jsearch-calls:2027-01");
  });

  it("uses UTC date, not local time", () => {
    // UTC is still March even if local time might be a different date
    vi.setSystemTime(new Date("2026-03-31T23:30:00Z"));
    expect(getMonthlyKey()).toBe("job-scout:jsearch-calls:2026-03");
  });
});