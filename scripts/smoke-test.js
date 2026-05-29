/**
 * Local smoke test: verifies modules import and AES round-trips correctly.
 * Run: node --env-file=.env.test scripts/smoke-test.js  (Node 20+)
 * or set env vars manually.
 */
import assert from "node:assert";

process.env.ENCRYPTION_SECRET =
  process.env.ENCRYPTION_SECRET || "test_secret_at_least_32_characters_long_ok";

const { encrypt, decrypt, maskPassword } = await import("../lib/crypto.js");

// 1. crypto round-trip
const original = "Oxleas33@";
const enc = encrypt(original);
assert.ok(enc.split(":").length === 3, "encrypted format should be iv:tag:cipher");
assert.notStrictEqual(enc, original, "ciphertext must differ from plaintext");
assert.strictEqual(decrypt(enc), original, "decrypt must recover original");
assert.strictEqual(maskPassword(), "********");

// 2. two encryptions of same value differ (random IV)
assert.notStrictEqual(encrypt(original), encrypt(original), "IV must randomize ciphertext");

// 3. modules import without throwing
await import("../lib/keyboard.js");
await import("../lib/render.js");
await import("../lib/auth.js");
await import("../lib/bot.js");

// 4. slugify behaves
const { slugify } = await import("../lib/website.service.js");
assert.strictEqual(slugify("Shopee"), "shopee");
assert.strictEqual(slugify("My Site!"), "my-site");
assert.strictEqual(slugify("  TikTok  "), "tiktok");

// 5. admin check
process.env.TELEGRAM_ADMIN_IDS = "123,456";
const { isAdmin } = await import("../lib/auth.js");
assert.strictEqual(isAdmin(123), true);
assert.strictEqual(isAdmin("456"), true);
assert.strictEqual(isAdmin(999), false);

console.log("✅ Smoke test passed: crypto round-trip, imports, slugify, admin check.");
