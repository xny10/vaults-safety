import { redis, keys } from "./upstash.js";
import { pushLog } from "./log.service.js";

/**
 * Website CRUD + stats.
 *
 * Data model (spec section 4):
 *   websites:{userId}            -> array of websiteId (slugs)
 *   website:{userId}:{websiteId} -> { id, name, createdAt, totalAccounts }
 *   accounts:{userId}:{websiteId}-> array of accountId
 */

/** Turn "Shopee" / "My Site!" into a safe short slug like "shopee" / "my-site". */
export function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function getWebsites(userId) {
  const ids = (await redis().get(keys.websites(userId))) || [];
  if (!ids.length) return [];

  const details = await Promise.all(
    ids.map((id) => redis().get(keys.website(userId, id)))
  );

  return details
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getWebsite(userId, websiteId) {
  return (await redis().get(keys.website(userId, websiteId))) || null;
}

export async function createWebsite(userId, name) {
  const id = slugify(name);
  if (!id) throw new Error("Nama website tidak valid.");

  const existing = await getWebsite(userId, id);
  if (existing) {
    return { website: existing, alreadyExists: true };
  }

  const website = {
    id,
    name: name.trim(),
    createdAt: new Date().toISOString(),
    totalAccounts: 0,
  };

  const ids = (await redis().get(keys.websites(userId))) || [];
  if (!ids.includes(id)) ids.push(id);

  await Promise.all([
    redis().set(keys.websites(userId), ids),
    redis().set(keys.website(userId, id), website),
  ]);

  await pushLog(userId, {
    type: "CREATE_WEBSITE",
    website: website.name,
    time: website.createdAt,
  });

  return { website, alreadyExists: false };
}

export async function deleteWebsite(userId, websiteId) {
  const ids = (await redis().get(keys.websites(userId))) || [];
  const next = ids.filter((id) => id !== websiteId);

  await Promise.all([
    redis().set(keys.websites(userId), next),
    redis().del(keys.website(userId, websiteId)),
    redis().del(keys.accounts(userId, websiteId)),
  ]);

  await pushLog(userId, {
    type: "DELETE_WEBSITE",
    website: websiteId,
    time: new Date().toISOString(),
  });
}

/** Recalculate totalAccounts from the actual account list. */
export async function updateWebsiteStats(userId, websiteId) {
  const website = await getWebsite(userId, websiteId);
  if (!website) return null;

  const accountIds = (await redis().get(keys.accounts(userId, websiteId))) || [];
  website.totalAccounts = accountIds.length;

  await redis().set(keys.website(userId, websiteId), website);
  return website;
}
