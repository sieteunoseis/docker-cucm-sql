import { promises as fs, constants } from "node:fs";
import path from "node:path";
import { ActivityLog } from "./activityLog.js";
/** Startup checks and housekeeping; returns messages to print. Never throws. */
export async function startupTasks(config) {
    const messages = [];
    try {
        await fs.access(config.dataDir, constants.W_OK);
    }
    catch {
        const uid = process.getuid?.() ?? 1000;
        messages.push(`WARNING: data directory ${config.dataDir} is not writable by uid ${uid}; saving queries and the activity log will fail.`, `  0.x images ran as root. Fix ownership once, e.g.:`, `  docker run --rm -v cucm-sql-data:/d alpine chown -R 1000:1000 /d   (named volume)`, `  sudo chown -R 1000:1000 ./data                                      (bind mount)`);
        return messages;
    }
    try {
        const pruned = await new ActivityLog(path.join(config.dataDir, ".logs"), config.logRetentionMonths).prune();
        if (pruned.length)
            messages.push(`Activity log: removed ${pruned.join(", ")} (older than ${config.logRetentionMonths} months)`);
    }
    catch (err) {
        messages.push(`Activity log prune failed: ${err.message}`);
    }
    return messages;
}
//# sourceMappingURL=startup.js.map