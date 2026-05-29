import { redis, keys } from "./upstash.js";
import { getWebsites } from "./website.service.js";
import { getAccountsByWebsite } from "./account.service.js";

/**
 * Aggregate statistics (spec section 25).
 */
export async function getStats(userId) {
  const websites = await getWebsites(userId);

  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7); // YYYY-MM

  let totalAccounts = 0;
  let createdToday = 0;
  let createdThisMonth = 0;
  const perWebsite = [];

  for (const w of websites) {
    const accounts = await getAccountsByWebsite(userId, w.id);
    totalAccounts += accounts.length;

    for (const a of accounts) {
      const d = (a.createdDate || a.createdAt || "").slice(0, 10);
      if (d === today) createdToday++;
      if (d.startsWith(monthPrefix)) createdThisMonth++;
    }

    perWebsite.push({ name: w.name, count: accounts.length });
  }

  perWebsite.sort((a, b) => b.count - a.count);

  return {
    totalWebsites: websites.length,
    totalAccounts,
    createdToday,
    createdThisMonth,
    perWebsite,
  };
}
