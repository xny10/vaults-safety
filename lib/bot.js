/**
 * Thin Telegram Bot API wrapper using fetch (Node 18+).
 * No external deps. Each function returns the parsed Telegram response.
 */

function apiBase() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  return `https://api.telegram.org/bot${token}`;
}

async function call(method, payload) {
  const res = await fetch(`${apiBase()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    console.error(`Telegram API ${method} failed:`, data);
  }
  return data;
}

export function sendMessage(chatId, text, replyMarkup) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export function editMessageText(chatId, messageId, text, replyMarkup) {
  return call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export function answerCallbackQuery(callbackQueryId, text, showAlert = false) {
  return call("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
    show_alert: showAlert,
  });
}

export function deleteMessage(chatId, messageId) {
  return call("deleteMessage", {
    chat_id: chatId,
    message_id: messageId,
  });
}

export function getFile(fileId) {
  return call("getFile", { file_id: fileId });
}

/** Escape text for Telegram HTML parse mode. */
export function esc(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
