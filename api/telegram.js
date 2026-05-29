import { isAdmin, isValidWebhook } from "../lib/auth.js";
import { handleUpdate } from "../lib/router.js";
import { sendMessage } from "../lib/bot.js";

/**
 * Main Telegram webhook (spec section 17 / 18).
 *
 * Flow:
 *   1. accept POST only
 *   2. validate webhook secret
 *   3. validate admin Telegram ID
 *   4. route the update
 *
 * Always responds 200 quickly so Telegram does not retry, even on internal
 * errors (which are logged server-side).
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!isValidWebhook(req)) {
    return res.status(401).json({ ok: false, error: "Invalid webhook secret" });
  }

  const update = req.body;
  if (!update || typeof update !== "object") {
    return res.status(200).json({ ok: true });
  }

  try {
    const from =
      update.message?.from ||
      update.callback_query?.from ||
      update.edited_message?.from;
    const userId = from?.id;

    // Admin allow-list. Non-admins get a polite refusal, no data access.
    if (!userId || !isAdmin(userId)) {
      const chatId =
        update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      if (chatId) {
        await sendMessage(
          chatId,
          "⛔ Akses ditolak. Panel ini khusus admin."
        );
      }
      return res.status(200).json({ ok: true });
    }

    await handleUpdate(update);
  } catch (err) {
    console.error("Webhook handler error:", err);
  }

  return res.status(200).json({ ok: true });
}
