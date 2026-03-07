import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

export const JSEARCH_MONTHLY_LIMIT = Number(process.env.JSEARCH_MONTHLY_LIMIT ?? 9800);

export function getMonthlyKey() {
  const now = new Date();
  return `job-scout:jsearch-calls:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function checkAndIncrementUsage(count: number): Promise<boolean> {
  const key = getMonthlyKey();
  const current = Number(await redis.get(key) ?? 0);
  if (current + count > JSEARCH_MONTHLY_LIMIT) return false;
  await redis.incrby(key, count);
  return true;
}