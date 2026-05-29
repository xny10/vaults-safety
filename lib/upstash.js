import { Redis } from "@upstash/redis";

/**
 * Single shared Upstash Redis client.
 *
 * The @upstash/redis client automatically JSON-serializes/deserializes
 * values, so objects can be stored and read back without manual JSON.parse.
 */

let client = null;

export function redis() {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set."
    );
  }

  client = new Redis({ url, token });
  return client;
}

/* ---------- Key builders (namespaced per user) ---------- */

export const keys = {
  websites: (userId) => `websites:${userId}`,
  website: (userId, websiteId) => `website:${userId}:${websiteId}`,
  accounts: (userId, websiteId) => `accounts:${userId}:${websiteId}`,
  account: (userId, accountId) => `account:${userId}:${accountId}`,
  emailIndex: (userId, email) =>
    `email_index:${userId}:${String(email).toLowerCase()}`,
  logs: (userId) => `logs:${userId}`,
  state: (userId) => `state:${userId}`,
};
