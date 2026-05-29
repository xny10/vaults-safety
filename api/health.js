/**
 * Simple health/readiness check. Reports which env vars are configured
 * (without leaking their values).
 */
export default function handler(req, res) {
  const checks = {
    TELEGRAM_BOT_TOKEN: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    TELEGRAM_ADMIN_IDS: Boolean(process.env.TELEGRAM_ADMIN_IDS),
    UPSTASH_REDIS_REST_URL: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    UPSTASH_REDIS_REST_TOKEN: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    ENCRYPTION_SECRET:
      Boolean(process.env.ENCRYPTION_SECRET) &&
      (process.env.ENCRYPTION_SECRET || "").length >= 32,
    WEBHOOK_SECRET: Boolean(process.env.WEBHOOK_SECRET),
  };

  const ready = Object.values(checks).every(Boolean);

  res.status(200).json({
    ok: true,
    service: "telegram-account-panel",
    ready,
    env: checks,
    time: new Date().toISOString(),
  });
}
