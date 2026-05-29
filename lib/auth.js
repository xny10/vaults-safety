/**
 * Admin allow-list (spec section 15).
 * Only Telegram user IDs in TELEGRAM_ADMIN_IDS may use the panel.
 */
export function isAdmin(userId) {
  const raw = process.env.TELEGRAM_ADMIN_IDS || "";
  const adminIds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return adminIds.includes(String(userId));
}

/**
 * Validate the webhook secret. Telegram sends the configured secret in the
 * `X-Telegram-Bot-Api-Secret-Token` header; we also accept ?secret= for
 * setups that put it in the URL.
 */
export function isValidWebhook(req) {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return true; // not configured -> skip check

  // Case-insensitive header lookup
  const headers = req.headers || {};
  const headerToken =
    headers["x-telegram-bot-api-secret-token"] ||
    headers["X-Telegram-Bot-Api-Secret-Token"];
  if (headerToken && headerToken === expected) return true;

  try {
    const url = new URL(req.url, "http://localhost");
    if (url.searchParams.get("secret") === expected) return true;
  } catch {
    /* ignore */
  }

  return false;
}
