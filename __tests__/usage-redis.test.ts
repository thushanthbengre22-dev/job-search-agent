import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  incrby: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => mockRedis },
}));

import { checkAndIncrementUsage } from "@/lib/usage";

describe("checkAndIncrementUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.incrby.mockResolvedValue(undefined);
  });

  it("returns true and increments when within limit", async () => {
    mockRedis.get.mockResolvedValue(100);
    const result = await checkAndIncrementUsage(5);
    expect(result).toBe(true);
    expect(mockRedis.incrby).toHaveBeenCalledWith(expect.any(String), 5);
  });

  it("returns false and does not increment when limit would be exceeded", async () => {
    mockRedis.get.mockResolvedValue(9798);
    const result = await checkAndIncrementUsage(5); // 9798 + 5 = 9803 > 9800
    expect(result).toBe(false);
    expect(mockRedis.incrby).not.toHaveBeenCalled();
  });

  it("returns true when usage is exactly at the limit", async () => {
    mockRedis.get.mockResolvedValue(9795);
    const result = await checkAndIncrementUsage(5); // 9795 + 5 = 9800, not over
    expect(result).toBe(true);
    expect(mockRedis.incrby).toHaveBeenCalled();
  });

  it("returns false when usage is exactly one over the limit", async () => {
    mockRedis.get.mockResolvedValue(9796);
    const result = await checkAndIncrementUsage(5); // 9796 + 5 = 9801 > 9800
    expect(result).toBe(false);
    expect(mockRedis.incrby).not.toHaveBeenCalled();
  });

  it("treats null Redis value as 0", async () => {
    mockRedis.get.mockResolvedValue(null);
    const result = await checkAndIncrementUsage(1);
    expect(result).toBe(true);
    expect(mockRedis.incrby).toHaveBeenCalledWith(expect.any(String), 1);
  });
});