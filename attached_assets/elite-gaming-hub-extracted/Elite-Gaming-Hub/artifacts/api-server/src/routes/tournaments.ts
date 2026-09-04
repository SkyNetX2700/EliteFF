import { Router } from "express";
import { db } from "@workspace/db";
import { tournamentsTable, notificationsTable, historyTable, registrationsTable, scoreboardTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getAuthMiddleware, getHostMiddleware } from "./auth";

const router = Router();
const auth = getAuthMiddleware();
const hostOnly = getHostMiddleware();

router.get("/", async (req, res) => {
  try {
    const { status, type } = req.query as Record<string, string>;
    let query = db.select().from(tournamentsTable);
    const conditions = [];
    if (status) conditions.push(eq(tournamentsTable.status, status));
    if (type) conditions.push(eq(tournamentsTable.type, type));
    const results = conditions.length > 0
      ? await db.select().from(tournamentsTable).where(and(...conditions)).orderBy(desc(tournamentsTable.scheduledAt))
      : await db.select().from(tournamentsTable).orderBy(desc(tournamentsTable.scheduledAt));
    const safeResults = results.map(t => ({ ...t, upiId: undefined }));
    res.json(safeResults);
  } catch (err) {
    req.log.error({ err }, "Get tournaments error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", auth, hostOnly, async (req: any, res) => {
  try {
    const body = req.body;
    const [tournament] = await db.insert(tournamentsTable).values({
      name: body.name,
      type: body.type,
      mode: body.mode,
      mapName: body.mapName || null,
      teamSize: body.teamSize,
      entryFee: body.entryFee || null,
      prizePool: body.prizePool || null,
      booyahPrize: body.booyahPrize || null,
      secondPrize: body.secondPrize || null,
      thirdPrize: body.thirdPrize || null,
      highestKillPrize: body.highestKillPrize || null,
      maxSlots: body.maxSlots,
      scheduledAt: new Date(body.scheduledAt),
      rules: body.rules || null,
      posterUrl: body.posterUrl || null,
      upiId: body.upiId || null,
      isPaid: body.isPaid ?? false,
      timerEnabled: body.timerEnabled ?? true,
      hostId: req.userId,
      status: "upcoming",
    }).returning();
    const { upiId: _, ...safe } = tournament;
    res.status(201).json(safe);
  } catch (err) {
    req.log.error({ err }, "Create tournament error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id)).limit(1);
    if (!tournament) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }
    res.json(tournament);
  } catch (err) {
    req.log.error({ err }, "Get tournament error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id/full", auth, hostOnly, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id)).limit(1);
    if (!tournament) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }
    res.json(tournament);
  } catch (err) {
    req.log.error({ err }, "Get tournament full error");
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", auth, hostOnly, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;
    const updates: Record<string, any> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.type !== undefined) updates.type = body.type;
    if (body.mode !== undefined) updates.mode = body.mode;
    if (body.mapName !== undefined) updates.mapName = body.mapName;
    if (body.teamSize !== undefined) updates.teamSize = body.teamSize;
    if (body.entryFee !== undefined) updates.entryFee = body.entryFee;
    if (body.prizePool !== undefined) updates.prizePool = body.prizePool;
    if (body.booyahPrize !== undefined) updates.booyahPrize = body.booyahPrize;
    if (body.secondPrize !== undefined) updates.secondPrize = body.secondPrize;
    if (body.thirdPrize !== undefined) updates.thirdPrize = body.thirdPrize;
    if (body.highestKillPrize !== undefined) updates.highestKillPrize = body.highestKillPrize;
    if (body.maxSlots !== undefined) updates.maxSlots = body.maxSlots;
    if (body.scheduledAt !== undefined) updates.scheduledAt = new Date(body.scheduledAt);
    if (body.rules !== undefined) updates.rules = body.rules;
    if (body.posterUrl !== undefined) updates.posterUrl = body.posterUrl;
    if (body.upiId !== undefined) updates.upiId = body.upiId;
    if (body.isPaid !== undefined) updates.isPaid = body.isPaid;
    if (body.timerEnabled !== undefined) updates.timerEnabled = body.timerEnabled;
    if (body.roomId !== undefined) updates.roomId = body.roomId;
    if (body.roomPassword !== undefined) updates.roomPassword = body.roomPassword;

    const [tournament] = await db.update(tournamentsTable).set(updates).where(eq(tournamentsTable.id, id)).returning();
    if (!tournament) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }
    const { upiId: _, ...safe } = tournament;
    res.json(safe);
  } catch (err) {
    req.log.error({ err }, "Update tournament error");
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", auth, hostOnly, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(tournamentsTable).where(eq(tournamentsTable.id, id));
    res.json({ message: "Tournament deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete tournament error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/cancel", auth, hostOnly, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    const [tournament] = await db.update(tournamentsTable)
      .set({ status: "cancelled", cancelReason: reason })
      .where(eq(tournamentsTable.id, id)).returning();
    if (!tournament) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }
    const registrations = await db.select().from(registrationsTable).where(
      and(eq(registrationsTable.tournamentId, id), eq(registrationsTable.status, "verified"))
    );
    for (const reg of registrations) {
      await db.insert(notificationsTable).values({
        userId: reg.userId,
        title: "Tournament Cancelled",
        message: `${tournament.name} has been cancelled. Reason: ${reason}. Refund will be processed.`,
        type: "cancelled",
        tournamentId: id,
      });
    }
    const { upiId: _, ...safe } = tournament;
    res.json(safe);
  } catch (err) {
    req.log.error({ err }, "Cancel tournament error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/delay", auth, hostOnly, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { newScheduledAt, reason } = req.body;
    const [tournament] = await db.update(tournamentsTable)
      .set({ status: "delayed", scheduledAt: new Date(newScheduledAt), delayInfo: reason })
      .where(eq(tournamentsTable.id, id)).returning();
    if (!tournament) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }
    const registrations = await db.select().from(registrationsTable).where(
      eq(registrationsTable.tournamentId, id)
    );
    for (const reg of registrations) {
      await db.insert(notificationsTable).values({
        userId: reg.userId,
        title: "Tournament Delayed",
        message: `${tournament.name} has been delayed. New time: ${new Date(newScheduledAt).toLocaleString()}. Reason: ${reason}`,
        type: "delayed",
        tournamentId: id,
      });
    }
    const { upiId: _, ...safe } = tournament;
    res.json(safe);
  } catch (err) {
    req.log.error({ err }, "Delay tournament error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/complete", auth, hostOnly, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const [tournament] = await db.update(tournamentsTable)
      .set({ status: "completed" })
      .where(eq(tournamentsTable.id, id)).returning();
    if (!tournament) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }
    const { upiId: _, ...safe } = tournament;
    res.json(safe);
  } catch (err) {
    req.log.error({ err }, "Complete tournament error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/room", auth, hostOnly, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { roomId, roomPassword } = req.body;
    const [tournament] = await db.update(tournamentsTable)
      .set({ roomId, roomPassword })
      .where(eq(tournamentsTable.id, id)).returning();
    if (!tournament) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }
    const registrations = await db.select().from(registrationsTable).where(
      and(eq(registrationsTable.tournamentId, id), eq(registrationsTable.status, "verified"))
    );
    for (const reg of registrations) {
      await db.insert(notificationsTable).values({
        userId: reg.userId,
        title: "Room ID & Password Available",
        message: `Room credentials for ${tournament.name} are now available. Check your tournament details.`,
        type: "room_id_shared",
        tournamentId: id,
      });
    }
    const { upiId: _, ...safe } = tournament;
    res.json(safe);
  } catch (err) {
    req.log.error({ err }, "Upload room error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id/scoreboard", async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    const entries = await db.select().from(scoreboardTable)
      .where(eq(scoreboardTable.tournamentId, tournamentId))
      .orderBy(scoreboardTable.rank);
    res.json(entries);
  } catch (err) {
    req.log.error({ err }, "Get scoreboard error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/scoreboard", auth, async (req: any, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    const { registrationId, squadName, kills, rank, points } = req.body;
    const existing = await db.select().from(scoreboardTable)
      .where(and(eq(scoreboardTable.tournamentId, tournamentId), eq(scoreboardTable.registrationId, registrationId)))
      .limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(scoreboardTable)
        .set({ kills, rank: rank || null, points, updatedAt: new Date() })
        .where(and(eq(scoreboardTable.tournamentId, tournamentId), eq(scoreboardTable.registrationId, registrationId)))
        .returning();
      res.json(updated);
      return;
    }
    const [entry] = await db.insert(scoreboardTable).values({
      tournamentId,
      registrationId,
      squadName,
      kills: kills || 0,
      rank: rank || null,
      points: points || 0,
    }).returning();
    res.status(201).json(entry);
  } catch (err) {
    req.log.error({ err }, "Update scoreboard error");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
