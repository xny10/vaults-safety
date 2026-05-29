import { redis, keys } from "./upstash.js";

/**
 * Conversation state per user (spec section 14).
 *
 * Stored at state:{userId} with a TTL so abandoned flows clean themselves up.
 *
 * Shape:
 * {
 *   flow: "ADD_ACCOUNT" | "ADD_WEBSITE" | "SEARCH" | "EDIT_FIELD",
 *   step: "WAITING_EMAIL" | ...,
 *   payload: { ... }
 * }
 */

const STATE_TTL_SECONDS = 60 * 30; // 30 minutes

export async function setState(userId, state) {
  await redis().set(keys.state(userId), state, { ex: STATE_TTL_SECONDS });
}

export async function getState(userId) {
  return (await redis().get(keys.state(userId))) || null;
}

export async function clearState(userId) {
  await redis().del(keys.state(userId));
}
