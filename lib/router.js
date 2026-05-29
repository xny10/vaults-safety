import {
  sendMessage,
  editMessageText,
  answerCallbackQuery,
} from "./bot.js";
import * as kb from "./keyboard.js";
import * as render from "./render.js";
import { getState, setState, clearState } from "./state.service.js";
import {
  getWebsites,
  getWebsite,
  createWebsite,
} from "./website.service.js";
import {
  getAccount,
  getAccountsByWebsite,
  createAccount,
  updateAccount,
  deleteAccount,
  showPassword,
  searchAccount,
} from "./account.service.js";
import { getStats } from "./stats.service.js";
import { runSync } from "./sync.service.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* =========================================================
 *  Entry points
 * =======================================================*/

export async function handleUpdate(update) {
  if (update.message) return handleMessage(update.message);
  if (update.callback_query) return handleCallback(update.callback_query);
}

/* =========================================================
 *  Message handler (commands + conversation steps)
 * =======================================================*/

async function handleMessage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = (message.text || "").trim();

  if (text === "/start" || text === "/menu") {
    await clearState(userId);
    const stats = await getStats(userId);
    await sendMessage(chatId, render.mainMenuText(stats), kb.mainMenu());
    return;
  }

  if (text === "/cancel") {
    await clearState(userId);
    await sendMessage(chatId, "Dibatalkan. Ketik /start untuk kembali ke menu.");
    return;
  }

  // Otherwise this might be input for an active conversation flow.
  const state = await getState(userId);
  if (!state) {
    await sendMessage(
      chatId,
      "Ketik /start untuk membuka panel.",
      kb.backToMenu()
    );
    return;
  }

  await handleStateInput(chatId, userId, state, text);
}

async function handleStateInput(chatId, userId, state, text) {
  switch (state.flow) {
    case "ADD_WEBSITE":
      return finishAddWebsite(chatId, userId, text);

    case "ADD_ACCOUNT":
      return handleAddAccountStep(chatId, userId, state, text);

    case "SEARCH":
      return finishSearch(chatId, userId, state, text);

    case "EDIT_FIELD":
      return finishEditField(chatId, userId, state, text);

    default:
      await clearState(userId);
      await sendMessage(chatId, "Sesi tidak dikenal. Ketik /start.");
  }
}

/* ---------- Add Website flow ---------- */

async function finishAddWebsite(chatId, userId, name) {
  if (!name || name === "-") {
    await sendMessage(chatId, "Nama website tidak boleh kosong. Coba lagi:");
    return;
  }
  const { website, alreadyExists } = await createWebsite(userId, name);
  await clearState(userId);

  const msg = alreadyExists
    ? `Website <b>${website.name}</b> sudah ada.`
    : `Website berhasil ditambahkan ✅\n\nNama: <b>${website.name}</b>`;
  await sendMessage(chatId, msg, kb.afterWebsiteSaved(website.id));
}

/* ---------- Add Account flow (step-by-step) ---------- */

async function handleAddAccountStep(chatId, userId, state, text) {
  const { step, payload } = state;

  switch (step) {
    case "WAITING_EMAIL": {
      if (!text || text === "-") {
        await sendMessage(chatId, "Email tidak boleh kosong. Masukkan email:");
        return;
      }
      payload.email = text;
      await setState(userId, {
        ...state,
        step: "WAITING_PASSWORD",
        payload,
      });
      await sendMessage(chatId, "Masukkan password:");
      return;
    }

    case "WAITING_PASSWORD": {
      if (!text) {
        await sendMessage(chatId, "Password tidak boleh kosong. Masukkan password:");
        return;
      }
      payload.password = text;
      await setState(userId, {
        ...state,
        step: "WAITING_CREATED_DATE",
        payload,
      });
      await sendMessage(
        chatId,
        "Masukkan tanggal dibuat.\nFormat: <b>YYYY-MM-DD</b>",
        kb.useTodayDate()
      );
      return;
    }

    case "WAITING_CREATED_DATE": {
      if (!DATE_RE.test(text)) {
        await sendMessage(
          chatId,
          "Format tanggal salah. Gunakan <b>YYYY-MM-DD</b> atau tombol di bawah:",
          kb.useTodayDate()
        );
        return;
      }
      payload.createdDate = text;
      await setState(userId, { ...state, step: "WAITING_NOTE", payload });
      await sendMessage(chatId, 'Tambahkan catatan?\nKirim "-" kalau kosong.');
      return;
    }

    case "WAITING_NOTE": {
      payload.note = text;
      await saveAccountFromPayload(chatId, userId, payload);
      return;
    }

    default:
      await clearState(userId);
      await sendMessage(chatId, "Sesi tidak dikenal. Ketik /start.");
  }
}

async function saveAccountFromPayload(chatId, userId, payload) {
  const account = await createAccount(userId, payload);
  await clearState(userId);

  const msg =
    `Account berhasil disimpan ✅\n\n` +
    `Website: <b>${account.websiteName}</b>\n` +
    `Email: <code>${account.email}</code>\n` +
    `Tanggal Dibuat: ${account.createdDate}`;
  await sendMessage(chatId, msg, kb.afterAccountSaved(account.websiteId));
}

/* ---------- Search flow ---------- */

async function finishSearch(chatId, userId, state, keyword) {
  await clearState(userId);
  let results = await searchAccount(userId, keyword);

  // If search was scoped to a website, filter to it.
  if (state.payload?.websiteId) {
    results = results.filter((a) => a.websiteId === state.payload.websiteId);
  }

  const text = render.searchResultText(keyword, results);
  const keyboard = buildSearchResultKeyboard(results);
  await sendMessage(chatId, text, keyboard);
}

function buildSearchResultKeyboard(results) {
  const rows = results
    .slice(0, 10)
    .map((a, i) => [
      { text: `👁 ${i + 1}. ${a.email}`, callback_data: `account:view:${a.id}` },
    ]);
  rows.push([{ text: "🏠 Menu Utama", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

/* ---------- Edit field flow ---------- */

async function finishEditField(chatId, userId, state, value) {
  const { accountId, field } = state.payload;

  if (field === "createdDate" && !DATE_RE.test(value)) {
    await sendMessage(chatId, "Format tanggal salah. Gunakan YYYY-MM-DD:");
    return;
  }

  await updateAccount(userId, accountId, { [field]: value });
  await clearState(userId);

  await sendMessage(
    chatId,
    `Field <b>${field}</b> berhasil diperbarui ✅`,
    kb.backToAccount(accountId)
  );
}

/* =========================================================
 *  Callback query handler
 * =======================================================*/

async function handleCallback(cq) {
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const userId = cq.from.id;
  const data = cq.data || "";

  // Always acknowledge so the loading spinner clears.
  const ack = (text, alert) => answerCallbackQuery(cq.id, text, alert);

  const parts = data.split(":");
  const domain = parts[0];

  try {
    if (domain === "menu") {
      await ack();
      const stats = await getStats(userId);
      return editMessageText(
        chatId,
        messageId,
        render.mainMenuText(stats),
        kb.mainMenu()
      );
    }

    if (domain === "website") {
      return handleWebsiteCallback(cq, parts, ack);
    }

    if (domain === "account") {
      return handleAccountCallback(cq, parts, ack);
    }

    if (domain === "search") {
      return handleSearchCallback(cq, parts, ack);
    }

    if (domain === "sync") {
      await ack("Sinkronisasi...");
      const result = await runSync(userId);
      return editMessageText(
        chatId,
        messageId,
        render.syncText(result),
        kb.backToMenu()
      );
    }

    if (domain === "stats") {
      await ack();
      const stats = await getStats(userId);
      return editMessageText(
        chatId,
        messageId,
        render.statsText(stats),
        kb.backToMenu()
      );
    }

    await ack();
  } catch (err) {
    console.error("callback error:", err);
    await ack("Terjadi error. Coba lagi.", true);
  }
}

/* ---------- Website callbacks ---------- */

async function handleWebsiteCallback(cq, parts, ack) {
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const userId = cq.from.id;
  const action = parts[1];

  if (action === "list") {
    await ack();
    const websites = await getWebsites(userId);
    return editMessageText(
      chatId,
      messageId,
      render.websiteListText(websites.length),
      kb.websiteList(websites)
    );
  }

  if (action === "add") {
    await ack();
    await setState(userId, { flow: "ADD_WEBSITE", step: "WAITING_NAME", payload: {} });
    return sendMessage(chatId, "Masukkan nama website:");
  }

  if (action === "view") {
    await ack();
    const websiteId = parts[2];
    const website = await getWebsite(userId, websiteId);
    if (!website) {
      return editMessageText(chatId, messageId, "Website tidak ditemukan.", kb.backToMenu());
    }
    const accounts = await getAccountsByWebsite(userId, websiteId);
    const active = accounts.filter((a) => a.status === "active").length;
    const inactive = accounts.length - active;
    return editMessageText(
      chatId,
      messageId,
      render.websiteDetailText(website, active, inactive),
      kb.websiteDetail(websiteId)
    );
  }
}

/* ---------- Account callbacks ---------- */

async function handleAccountCallback(cq, parts, ack) {
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const userId = cq.from.id;
  const action = parts[1];

  if (action === "list") {
    await ack();
    const websiteId = parts[2];
    const website = await getWebsite(userId, websiteId);
    const accounts = await getAccountsByWebsite(userId, websiteId);
    return editMessageText(
      chatId,
      messageId,
      render.accountListText(website?.name || websiteId, accounts),
      kb.accountListKeyboard(websiteId, accounts)
    );
  }

  if (action === "view") {
    await ack();
    const accountId = parts[2];
    const account = await getAccount(userId, accountId);
    if (!account) {
      return editMessageText(chatId, messageId, "Account tidak ditemukan.", kb.backToMenu());
    }
    return editMessageText(
      chatId,
      messageId,
      render.accountDetailText(account, null),
      kb.accountDetail(accountId, account.websiteId)
    );
  }

  if (action === "showpass") {
    const accountId = parts[2];
    const password = await showPassword(userId, accountId);
    // Show via alert popup so it isn't persisted in chat history.
    return ack(`Password: ${password}`, true);
  }

  if (action === "add") {
    await ack();
    const websites = await getWebsites(userId);
    if (!websites.length) {
      return sendMessage(
        chatId,
        "Belum ada website. Tambahkan website dulu.",
        kb.backToMenu()
      );
    }
    return sendMessage(chatId, "Pilih website:", kb.selectWebsiteForAccount(websites));
  }

  if (action === "addto") {
    await ack();
    const websiteId = parts[2];
    return startAddAccount(chatId, userId, websiteId);
  }

  if (action === "pickweb") {
    await ack();
    const websiteId = parts[2];
    return startAddAccount(chatId, userId, websiteId);
  }

  if (action === "datetoday") {
    await ack();
    const state = await getState(userId);
    if (
      !state ||
      state.flow !== "ADD_ACCOUNT" ||
      state.step !== "WAITING_CREATED_DATE"
    ) {
      return sendMessage(chatId, "Sesi sudah berakhir. Ketik /start.", kb.backToMenu());
    }
    const today = new Date().toISOString().slice(0, 10);
    state.payload.createdDate = today;
    await setState(userId, { ...state, step: "WAITING_NOTE" });
    return sendMessage(
      chatId,
      `Tanggal dibuat: <b>${today}</b>\n\nTambahkan catatan?\nKirim "-" kalau kosong.`
    );
  }

  if (action === "edit") {
    await ack();
    const accountId = parts[2];
    return editMessageText(
      chatId,
      messageId,
      "Mau edit apa?",
      kb.editFieldMenu(accountId)
    );
  }

  if (action === "editfield") {
    await ack();
    const accountId = parts[2];
    const field = parts[3];

    if (field === "status") {
      return editMessageText(
        chatId,
        messageId,
        "Pilih status:",
        kb.statusPicker(accountId)
      );
    }

    await setState(userId, {
      flow: "EDIT_FIELD",
      step: "WAITING_VALUE",
      payload: { accountId, field },
    });
    const prompts = {
      email: "Masukkan email baru:",
      password: "Masukkan password baru:",
      createdDate: "Masukkan tanggal baru (YYYY-MM-DD):",
      note: 'Masukkan catatan baru (kirim "-" untuk kosong):',
    };
    return sendMessage(chatId, prompts[field] || "Masukkan nilai baru:");
  }

  if (action === "setstatus") {
    await ack("Status diperbarui ✅");
    const accountId = parts[2];
    const status = parts[3];
    await updateAccount(userId, accountId, { status });
    const account = await getAccount(userId, accountId);
    return editMessageText(
      chatId,
      messageId,
      render.accountDetailText(account, null),
      kb.accountDetail(accountId, account.websiteId)
    );
  }

  if (action === "delete") {
    await ack();
    const accountId = parts[2];
    const account = await getAccount(userId, accountId);
    if (!account) {
      return editMessageText(chatId, messageId, "Account tidak ditemukan.", kb.backToMenu());
    }
    return editMessageText(
      chatId,
      messageId,
      `Yakin hapus account ini?\n\nEmail: <code>${account.email}</code>\nWebsite: <b>${account.websiteName}</b>`,
      kb.deleteConfirm(accountId, account.websiteId)
    );
  }

  if (action === "delconfirm") {
    await ack("Dihapus ✅");
    const accountId = parts[2];
    const account = await deleteAccount(userId, accountId);
    const websiteId = account?.websiteId;
    const accounts = websiteId ? await getAccountsByWebsite(userId, websiteId) : [];
    const website = websiteId ? await getWebsite(userId, websiteId) : null;
    return editMessageText(
      chatId,
      messageId,
      `Account berhasil dihapus ✅\n\n` +
        render.accountListText(website?.name || "", accounts),
      websiteId
        ? kb.accountListKeyboard(websiteId, accounts)
        : kb.backToMenu()
    );
  }
}

async function startAddAccount(chatId, userId, websiteId) {
  const website = await getWebsite(userId, websiteId);
  if (!website) {
    return sendMessage(chatId, "Website tidak ditemukan.", kb.backToMenu());
  }
  await setState(userId, {
    flow: "ADD_ACCOUNT",
    step: "WAITING_EMAIL",
    payload: { websiteId: website.id, websiteName: website.name },
  });
  return sendMessage(
    chatId,
    `Tambah account ke <b>${website.name}</b>.\n\nMasukkan email:`
  );
}

/* ---------- Search callbacks ---------- */

async function handleSearchCallback(cq, parts, ack) {
  const chatId = cq.message.chat.id;
  const userId = cq.from.id;
  const action = parts[1];

  if (action === "start") {
    await ack();
    await setState(userId, { flow: "SEARCH", step: "WAITING_KEYWORD", payload: {} });
    return sendMessage(chatId, "Kirim email / keyword website:");
  }

  if (action === "site") {
    await ack();
    const websiteId = parts[2];
    await setState(userId, {
      flow: "SEARCH",
      step: "WAITING_KEYWORD",
      payload: { websiteId },
    });
    return sendMessage(chatId, "Kirim keyword untuk dicari di website ini:");
  }
}
