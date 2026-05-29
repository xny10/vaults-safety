import { redis, keys } from "./upstash.js";
import { getWebsites, updateWebsiteStats } from "./website.service.js";
import { getAccountsByWebsite } from "./account.service.js";
import { pushLog } from "./log.service.js";

/**
 * Manual sync / integrity rebuild (spec section 24).
 *
 *   1. scan all websites
 *   2. recount accounts
 *   3. drop orphan account ids from website lists
 *   4. rebuild email index
 *   5. refresh website stats
 *   6. log the sync
 */
export async function runSync(userId) {
  const websites = await getWebsites(userId);

  let totalAccounts = 0;
  let indexUpdated = 0;
  let orphansRemoved = 0;
  let errors = 0;

  for (const w of websites) {
    try {
      const ids = (await redis().get(keys.accounts(userId, w.id))) || [];
      const validIds = [];

      for (const id of ids) {
        const acc = await redis().get(keys.account(userId, id));
        if (!acc) {
          orphansRemoved++;
          continue;
        }
        validIds.push(id);

        // rebuild email index
        await redis().set(keys.emailIndex(userId, acc.email), id);
        indexUpdated++;
      }

      // write back cleaned list if it changed
      if (validIds.length !== ids.length) {
        await redis().set(keys.accounts(userId, w.id), validIds);
      }

      totalAccounts += validIds.length;
      await updateWebsiteStats(userId, w.id);
    } catch (err) {
      console.error("sync error for website", w.id, err);
      errors++;
    }
  }

  const result = {
    websites: websites.length,
    totalAccounts,
    indexUpdated,
    orphansRemoved,
    errors,
  };

  await pushLog(userId, {
    type: "SYNC",
    ...result,
    time: new Date().toISOString(),
  });

  return result;
}
