import { esc } from "./bot.js";
import { maskPassword } from "./crypto.js";

/**
 * Text renderers for messages (HTML parse mode).
 */

export function mainMenuText(stats) {
  return (
    `🏠 <b>Account Manager Panel</b>\n\n` +
    `Total Website: <b>${stats.totalWebsites}</b>\n` +
    `Total Account: <b>${stats.totalAccounts}</b>\n\n` +
    `Pilih menu:`
  );
}

export function websiteListText(count) {
  if (!count) {
    return "📁 <b>List Website</b>\n\nBelum ada website. Tambahkan dulu lewat tombol di bawah.";
  }
  return "📁 <b>Pilih Website:</b>";
}

export function websiteDetailText(website, activeCount, inactiveCount) {
  return (
    `📁 <b>${esc(website.name)}</b>\n\n` +
    `Total Account: <b>${website.totalAccounts}</b>\n` +
    `Active: <b>${activeCount}</b>\n` +
    `Inactive: <b>${inactiveCount}</b>`
  );
}

export function accountListText(websiteName, accounts) {
  if (!accounts.length) {
    return `📋 <b>${esc(websiteName)} Accounts</b>\n\nBelum ada account.`;
  }
  const lines = accounts
    .map((a, i) => `${i + 1}. ${esc(a.email)}`)
    .join("\n");
  return `📋 <b>${esc(websiteName)} Accounts:</b>\n\n${lines}\n\nKlik nomor untuk lihat detail.`;
}

export function accountDetailText(account, plainPassword) {
  const pw = plainPassword != null ? esc(plainPassword) : maskPassword();
  return (
    `👤 <b>Account Detail</b>\n\n` +
    `Website: <b>${esc(account.websiteName)}</b>\n` +
    `Email: <code>${esc(account.email)}</code>\n` +
    `Password: <code>${pw}</code>\n` +
    `Tanggal Dibuat: ${esc(account.createdDate)}\n` +
    `Status: ${account.status === "active" ? "✅ Active" : "⛔ Inactive"}\n` +
    `Note: ${esc(account.note) || "-"}`
  );
}

export function statsText(stats) {
  const lines = stats.perWebsite
    .map((w) => `${esc(w.name)}: ${w.count}`)
    .join("\n");
  return (
    `📊 <b>Statistik Account</b>\n\n` +
    `Total Website: <b>${stats.totalWebsites}</b>\n` +
    `Total Account: <b>${stats.totalAccounts}</b>\n\n` +
    `${lines || "(belum ada data)"}\n\n` +
    `Dibuat Hari Ini: <b>${stats.createdToday}</b>\n` +
    `Dibuat Bulan Ini: <b>${stats.createdThisMonth}</b>`
  );
}

export function syncText(result) {
  return (
    `🔄 <b>Sync selesai ✅</b>\n\n` +
    `Website: ${result.websites}\n` +
    `Total Account: ${result.totalAccounts}\n` +
    `Index diperbarui: ${result.indexUpdated}\n` +
    `Orphan dibersihkan: ${result.orphansRemoved}\n` +
    `Error: ${result.errors}`
  );
}

export function searchResultText(keyword, results) {
  if (!results.length) {
    return `🔍 Tidak ada account yang cocok dengan "<b>${esc(keyword)}</b>".`;
  }
  const lines = results
    .map(
      (a, i) =>
        `${i + 1}. ${esc(a.email)}\n   Website: ${esc(a.websiteName)} | ${esc(
          a.createdDate
        )}`
    )
    .join("\n");
  return `🔍 Ditemukan <b>${results.length}</b> account:\n\n${lines}`;
}
