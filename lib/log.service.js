import { redis, keys } from "./upstash.js";

/**
 * Activity log (spec section 4 / 15).
 * Stored as a capped Redis list at logs:{userId}.
 */

const MAX_LOGS = 200;

export async function pushLog(userId, entry) {
  const record = { ...entry, time: entry.time || new Date().toISOString() };
  try {
    await redis().lpush(keys.logs(userId), record);
    await redis().ltrim(keys.logs(userId), 0, MAX_LOGS - 1);
  } catch (err) {
    // Logging must never break the main flow.
    console.error("pushLog failed:", err);
  }
}

export async function getLogs(userId, limit = 20) {
  return (await redis().lrange(keys.logs(userId), 0, limit - 1)) || [];
}
