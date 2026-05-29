/**
 * Inline keyboard builders.
 *
 * Callback data format (see spec section 13):
 *   menu:home
 *   website:list | website:add | website:view:<websiteId>
 *   account:list:<websiteId> | account:add | account:view:<accountId>
 *   account:edit:<accountId> | account:delete:<accountId>
 *   account:showpass:<accountId>
 *   search:start | sync:start | stats:view
 *
 * Telegram limits callback_data to 64 bytes, so website/account IDs are
 * kept short (slug / random id).
 */

function btn(text, data) {
  return { text, callback_data: data };
}

export function mainMenu() {
  return {
    inline_keyboard: [
      [btn("📁 Website", "website:list"), btn("➕ Add Website", "website:add")],
      [btn("➕ Add Account", "account:add"), btn("🔍 Search", "search:start")],
      [btn("📊 Stats", "stats:view"), btn("🔄 Sync", "sync:start")],
    ],
  };
}

/**
 * @param {Array<{id:string,name:string}>} websites
 */
export function websiteList(websites) {
  const rows = [];
  let row = [];
  websites.forEach((w, i) => {
    row.push(btn(w.name, `website:view:${w.id}`));
    if (row.length === 2 || i === websites.length - 1) {
      rows.push(row);
      row = [];
    }
  });
  rows.push([btn("➕ Tambah Website Baru", "website:add")]);
  rows.push([btn("🏠 Menu Utama", "menu:home")]);
  return { inline_keyboard: rows };
}

export function websiteDetail(websiteId) {
  return {
    inline_keyboard: [
      [
        btn("📋 List Account", `account:list:${websiteId}`),
        btn("➕ Add Account", `account:addto:${websiteId}`),
      ],
      [btn("🔍 Cari Account", `search:site:${websiteId}`)],
      [btn("⬅️ Kembali", "website:list")],
    ],
  };
}

/**
 * @param {string} websiteId
 * @param {Array<{id:string,email:string}>} accounts
 */
export function accountListKeyboard(websiteId, accounts) {
  const rows = [];
  let row = [];
  accounts.forEach((a, i) => {
    row.push(btn(String(i + 1), `account:view:${a.id}`));
    if (row.length === 5 || i === accounts.length - 1) {
      rows.push(row);
      row = [];
    }
  });
  rows.push([
    btn("➕ Add Account", `account:addto:${websiteId}`),
    btn("⬅️ Kembali", `website:view:${websiteId}`),
  ]);
  return { inline_keyboard: rows };
}

export function accountDetail(accountId, websiteId, revealed = false) {
  const pwBtn = revealed
    ? btn("🙈 Hide Password", `account:hidepass:${accountId}`)
    : btn("👁 Show Password", `account:showpass:${accountId}`);
  return {
    inline_keyboard: [
      [pwBtn, btn("✏️ Edit", `account:edit:${accountId}`)],
      [
        btn("🗑 Delete", `account:delete:${accountId}`),
        btn("⬅️ Back", `account:list:${websiteId}`),
      ],
    ],
  };
}

export function editFieldMenu(accountId) {
  return {
    inline_keyboard: [
      [
        btn("Email", `account:editfield:${accountId}:email`),
        btn("Password", `account:editfield:${accountId}:password`),
      ],
      [
        btn("Tanggal", `account:editfield:${accountId}:createdDate`),
        btn("Status", `account:editfield:${accountId}:status`),
      ],
      [btn("Catatan", `account:editfield:${accountId}:note`)],
      [btn("⬅️ Kembali", `account:view:${accountId}`)],
    ],
  };
}

export function statusPicker(accountId) {
  return {
    inline_keyboard: [
      [
        btn("✅ Active", `account:setstatus:${accountId}:active`),
        btn("⛔ Inactive", `account:setstatus:${accountId}:inactive`),
      ],
      [btn("⬅️ Kembali", `account:view:${accountId}`)],
    ],
  };
}

export function deleteConfirm(accountId, websiteId) {
  return {
    inline_keyboard: [
      [
        btn("✅ Ya, Hapus", `account:delconfirm:${accountId}`),
        btn("❌ Batal", `account:view:${accountId}`),
      ],
    ],
  };
}

export function selectWebsiteForAccount(websites) {
  const rows = [];
  let row = [];
  websites.forEach((w, i) => {
    row.push(btn(w.name, `account:pickweb:${w.id}`));
    if (row.length === 2 || i === websites.length - 1) {
      rows.push(row);
      row = [];
    }
  });
  rows.push([btn("⬅️ Batal", "menu:home")]);
  return { inline_keyboard: rows };
}

export function useTodayDate() {
  return {
    inline_keyboard: [[btn("📅 Pakai Tanggal Hari Ini", "account:datetoday")]],
  };
}

export function afterAccountSaved(websiteId) {
  return {
    inline_keyboard: [
      [
        btn("📋 Lihat Account", `account:list:${websiteId}`),
        btn("➕ Tambah Lagi", `account:addto:${websiteId}`),
      ],
      [btn("🏠 Menu Utama", "menu:home")],
    ],
  };
}

export function afterWebsiteSaved(websiteId) {
  return {
    inline_keyboard: [
      [
        btn("➕ Tambah Account", `account:addto:${websiteId}`),
        btn("📁 List Website", "website:list"),
      ],
    ],
  };
}

export function backToMenu() {
  return { inline_keyboard: [[btn("🏠 Menu Utama", "menu:home")]] };
}

export function backToAccount(accountId) {
  return {
    inline_keyboard: [[btn("⬅️ Kembali", `account:view:${accountId}`)]],
  };
}
