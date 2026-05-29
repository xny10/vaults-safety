import crypto from "node:crypto";
import { redis, keys } from "./upstash.js";
import { encrypt, decrypt } from "./crypto.js";
import { pushLog } from "./log.service.js";
import { getWebsite, updateWebsiteStats } from "./website.service.js";

/**
 * Account CRUD + auto-sync (spec sections 8, 9, 19, 20).
 *
 * Data model:
 *   account:{userId}:{accountId}      -> full account object
 *   accounts:{userId}:{websiteId}     -> array of accountId
 *   email_index:{userId}:{email}      -> accountId
 */

function newAccountId() {
  return "acc_" + crypto.randomBytes(6).toString("hex");
}

function todayDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function getAccount(userId, accountId) {
  return (await redis().get(keys.account(userId, accountId))) || null;
}

export async function getAccountsByWebsite(userId, websiteId) {
  const ids = (await redis().get(keys.accounts(userId, websiteId))) || [];
  if (!ids.length) return [];

  const accounts = await Promise.all(
    ids.map((id) => redis().get(keys.account(userId, id)))
  );
  return accounts.filter(Boolean);
}

/**
 * Create account with full auto-sync:
 *   1. encrypt password
 *   2. save account detail
 *   3. push accountId to website's account list
 *   4. set email index
 *   5. recalc website stats
 *   6. push activity log
 *
 * @param {string} userId
 * @param {{websiteId:string, email:string, password:string, createdDate?:string, note?:string, status?:string}} data
 */
export async function createAccount(userId, data) {
  const website = await getWebsite(userId, data.websiteId);
  if (!website) throw new Error("Website tidak ditemukan.");

  const id = newAccountId();
  const now = new Date().toISOString();

  const account = {
    id,
    websiteId: website.id,
    websiteName: website.name,
    email: String(data.email).trim(),
    passwordEncrypted: encrypt(data.password),
    createdDate: data.createdDate || todayDate(),
    status: data.status || "active",
    note: data.note && data.note !== "-" ? data.note : "",
    createdAt: now,
    updatedAt: now,
  };

  // 2. save detail
  await redis().set(keys.account(userId, id), account);

  // 3. push to website account list
  const list = (await redis().get(keys.accounts(userId, website.id))) || [];
  list.push(id);
  await redis().set(keys.accounts(userId, website.id), list);

  // 4. email index
  await redis().set(keys.emailIndex(userId, account.email), id);

  // 5. website stats
  await updateWebsiteStats(userId, website.id);

  // 6. log
  await pushLog(userId, {
    type: "CREATE_ACCOUNT",
    website: website.name,
    email: account.email,
    time: now,
  });

  return account;
}

/**
 * Update mutable fields. Re-encrypts when password changes,
 * re-indexes when email changes.
 *
 * @param {string} userId
 * @param {string} accountId
 * @param {{email?:string,password?:string,createdDate?:string,status?:string,note?:string,websiteId?:string}} changes
 */
export async function updateAccount(userId, accountId, changes) {
  const account = await getAccount(userId, accountId);
  if (!account) throw new Error("Account tidak ditemukan.");

  const oldEmail = account.email;
  const oldWebsiteId = account.websiteId;

  if (changes.email != null) account.email = String(changes.email).trim();
  if (changes.password != null) {
    account.passwordEncrypted = encrypt(changes.password);
  }
  if (changes.createdDate != null) account.createdDate = changes.createdDate;
  if (changes.status != null) account.status = changes.status;
  if (changes.note != null) {
    account.note = changes.note === "-" ? "" : changes.note;
  }

  // Optional website move (keeps lists + stats in sync)
  if (changes.websiteId != null && changes.websiteId !== oldWebsiteId) {
    const newWebsite = await getWebsite(userId, changes.websiteId);
    if (!newWebsite) throw new Error("Website tujuan tidak ditemukan.");
    account.websiteId = newWebsite.id;
    account.websiteName = newWebsite.name;

    const oldList =
      (await redis().get(keys.accounts(userId, oldWebsiteId))) || [];
    await redis().set(
      keys.accounts(userId, oldWebsiteId),
      oldList.filter((x) => x !== accountId)
    );

    const newList =
      (await redis().get(keys.accounts(userId, newWebsite.id))) || [];
    if (!newList.includes(accountId)) newList.push(accountId);
    await redis().set(keys.accounts(userId, newWebsite.id), newList);
  }

  account.updatedAt = new Date().toISOString();
  await redis().set(keys.account(userId, accountId), account);

  // Re-index email if it changed
  if (changes.email != null && changes.email !== oldEmail) {
    await redis().del(keys.emailIndex(userId, oldEmail));
    await redis().set(keys.emailIndex(userId, account.email), accountId);
  }

  // Refresh stats if website moved
  if (changes.websiteId != null && changes.websiteId !== oldWebsiteId) {
    await updateWebsiteStats(userId, oldWebsiteId);
    await updateWebsiteStats(userId, account.websiteId);
  }

  await pushLog(userId, {
    type: "UPDATE_ACCOUNT",
    website: account.websiteName,
    email: account.email,
    fields: Object.keys(changes),
    time: account.updatedAt,
  });

  return account;
}

/**
 * Delete account with full cleanup (spec section 12).
 */
export async function deleteAccount(userId, accountId) {
  const account = await getAccount(userId, accountId);
  if (!account) return null;

  // remove from website list
  const list =
    (await redis().get(keys.accounts(userId, account.websiteId))) || [];
  await redis().set(
    keys.accounts(userId, account.websiteId),
    list.filter((x) => x !== accountId)
  );

  await Promise.all([
    redis().del(keys.account(userId, accountId)),
    redis().del(keys.emailIndex(userId, account.email)),
  ]);

  await updateWebsiteStats(userId, account.websiteId);

  await pushLog(userId, {
    type: "DELETE_ACCOUNT",
    website: account.websiteName,
    email: account.email,
    time: new Date().toISOString(),
  });

  return account;
}

/**
 * Decrypt password for temporary display (spec section 3 / 16).
 * Logs the SHOW_PASSWORD event.
 */
export async function showPassword(userId, accountId) {
  const account = await getAccount(userId, accountId);
  if (!account) throw new Error("Account tidak ditemukan.");

  const password = decrypt(account.passwordEncrypted);

  await pushLog(userId, {
    type: "SHOW_PASSWORD",
    website: account.websiteName,
    email: account.email,
    time: new Date().toISOString(),
  });

  return password;
}

/**
 * Search by email/keyword across the email index first, then fall back
 * to scanning all accounts for partial email or website matches.
 */
export async function searchAccount(userId, keyword) {
  const term = String(keyword).trim().toLowerCase();
  if (!term) return [];

  // Exact email index hit
  const exactId = await redis().get(keys.emailIndex(userId, term));
  const results = new Map();

  if (exactId) {
    const acc = await getAccount(userId, exactId);
    if (acc) results.set(acc.id, acc);
  }

  // Fallback: scan all accounts across all websites
  const websiteIds = (await redis().get(keys.websites(userId))) || [];
  for (const wid of websiteIds) {
    const accounts = await getAccountsByWebsite(userId, wid);
    for (const acc of accounts) {
      const haystack = `${acc.email} ${acc.websiteName} ${acc.note}`.toLowerCase();
      if (haystack.includes(term)) results.set(acc.id, acc);
    }
  }

  return [...results.values()];
}
