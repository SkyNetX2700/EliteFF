import { Router } from "express";
import { db } from "@workspace/db";
import { tournamentsTable, usersTable, registrationsTable, historyTable, scoreboardTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { getAuthMiddleware } from "./auth";

const router = Router();
const auth = getAuthMiddleware();

router.get("/summary", async (req, res) => {
  try {
    const [tournamentsCount] = await db.select({ count: count() }).from(tournamentsTable);
    const [activeTournamentsCount] = await db.select({ count: count() }).from(tournamentsTable).where(eq(tournamentsTable.status, "upcoming"));
    const [playersCount] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "player"));
    const [registrationsCount] = await db.select({ count: count() }).from(registrationsTable);
    res.json({
      totalTournaments: Number(tournamentsCount.count),
      activeTournaments: Number(activeTournamentsCount.count),
      totalPlayers: Number(playersCount.count),
      totalRegistrations: Number(registrationsCount.count),
    });
  } catch (err) {
    req.log.error({ err }, "Stats summary error");
    res.status(500).json({ message: "Server error" });
  }
});

export const historyRouter = Router();
historyRouter.use(auth);

historyRouter.get("/", async (req: any, res) => {
  try {
    const history = await db.select().from(historyTable)
      .where(eq(historyTable.userId, req.userId))
      .orderBy(desc(historyTable.createdAt));
    res.json(history);
  } catch (err) {
    req.log.error({ err }, "Get history error");
    res.status(500).json({ message: "Server error" });
  }
});

historyRouter.delete("/", async (req: any, res) => {
  try {
    await db.delete(historyTable).where(eq(historyTable.userId, req.userId));
    res.json({ message: "History cleared" });
  } catch (err) {
    req.log.error({ err }, "Delete history error");
    res.status(500).json({ message: "Server error" });
  }
});

historyRouter.delete("/:id", async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(historyTable).where(and(eq(historyTable.id, id), eq(historyTable.userId, req.userId)));
    res.json({ message: "History entry deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete history entry error");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
