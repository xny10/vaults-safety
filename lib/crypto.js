import crypto from "node:crypto";

/**
 * AES-256-GCM password encryption.
 *
 * Stored format: "iv:authTag:cipherText" (all hex).
 * The 32-byte key is derived from ENCRYPTION_SECRET using scrypt with a
 * fixed app salt so the same secret always yields the same key.
 */

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV is recommended for GCM
const KEY_SALT = "telegram-account-panel:v1";

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;

  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ENCRYPTION_SECRET is missing or too short (minimum 32 characters)."
    );
  }

  cachedKey = crypto.scryptSync(secret, KEY_SALT, 32);
  return cachedKey;
}

/**
 * Encrypt a plaintext string.
 * @param {string} plainText
 * @returns {string} "iv:authTag:cipherText" in hex
 */
export function encrypt(plainText) {
  if (plainText == null) plainText = "";
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Decrypt a string produced by encrypt().
 * @param {string} payload "iv:authTag:cipherText"
 * @returns {string} plaintext
 */
export function decrypt(payload) {
  if (!payload || typeof payload !== "string") return "";

  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format.");
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const cipherText = Buffer.from(cipherHex, "hex");

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(cipherText),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Mask a password for display in lists / details.
 * @returns {string}
 */
export function maskPassword() {
  return "********";
}
