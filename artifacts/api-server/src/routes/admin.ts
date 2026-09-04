import { Router } from "express";
import { db, bestPlayerExclusionsTable, contactTable, feedbackTable, historyTable, matchResultsTable, notificationsTable, registrationsTable, scoreboardTable, tournamentsTable, usersTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { getAuthMiddleware, getHostMiddleware } from "./auth";

const router = Router();
const auth = getAuthMiddleware();
const hostOnly = getHostMiddleware();

router.delete("/clear-all-data", auth, hostOnly, async (req: any, res) => {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(scoreboardTable);
      await tx.delete(matchResultsTable);
      await tx.delete(bestPlayerExclusionsTable);
      await tx.delete(notificationsTable);
      await tx.delete(registrationsTable);
      await tx.delete(tournamentsTable);
      await tx.delete(historyTable);
      await tx.delete(feedbackTable);
      await tx.delete(contactTable);
      await tx.update(usersTable).set({
        points: 0,
        rank: "Blaze",
        prestigeStars: 0,
        totalEarnings: 0,
        weeklyFairPlay: 0,
        lastFairPlayAt: null,
        toxicReportCount: 0,
        pointShifts: null,
        apexRewardGiven: false,
      }).where(ne(usersTable.role, "host"));
    });
    res.json({ ok: true, message: "All tournament and player data has been cleared." });
  } catch (err) {
    req.log.error({ err }, "Clear all app data error");
    res.status(500).json({ message: "Unable to clear app data. Nothing was changed." });
  }
});

export default router;