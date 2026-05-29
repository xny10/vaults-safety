/**
 * Webhook management helper.
 *
 * Usage:
 *   node scripts/set-webhook.js                 # set webhook
 *   node scripts/set-webhook.js --info          # show current webhook info
 *   node scripts/set-webhook.js --delete        # delete webhook
 *
 * Required env:
 *   TELEGRAM_BOT_TOKEN
 *   PUBLIC_URL    e.g. https://your-app.vercel.app
 *   WEBHOOK_SECRET (optional but recommended)
 *
 * Tip: load a local .env with `node --env-file=.env scripts/set-webhook.js`
 * on Node 20+, or set the vars in your shell.
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const publicUrl = process.env.PUBLIC_URL;
const secret = process.env.WEBHOOK_SECRET;

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required.");
  process.exit(1);
}

const api = `https://api.telegram.org/bot${token}`;
const arg = process.argv[2];

async function main() {
  if (arg === "--info") {
    const r = await fetch(`${api}/getWebhookInfo`);
    console.log(JSON.stringify(await r.json(), null, 2));
    return;
  }

  if (arg === "--delete") {
    const r = await fetch(`${api}/deleteWebhook`);
    console.log(JSON.stringify(await r.json(), null, 2));
    return;
  }

  if (!publicUrl) {
    console.error("PUBLIC_URL is required to set the webhook.");
    process.exit(1);
  }

  const webhookUrl = `${publicUrl.replace(/\/$/, "")}/api/telegram${
    secret ? `?secret=${encodeURIComponent(secret)}` : ""
  }`;

  const body = {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  };
  if (secret) body.secret_token = secret;

  const r = await fetch(`${api}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log("Webhook URL:", webhookUrl);
  console.log(JSON.stringify(await r.json(), null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
