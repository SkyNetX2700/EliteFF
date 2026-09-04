import { Router } from "express";
import { db } from "@workspace/db";
import { matchResultsTable, notificationsTable, registrationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getAuthMiddleware, getHostMiddleware } from "./auth";

const router = Router();
const auth = getAuthMiddleware();
const hostOnly = getHostMiddleware();

router.get("/", async (req: any, res) => {
  try {
    const { tournamentId } = req.query as Record<string, string>;
    const results = tournamentId
      ? await db.select().from(matchResultsTable)
          .where(eq(matchResultsTable.tournamentId, parseInt(tournamentId)))
          .orderBy(desc(matchResultsTable.createdAt))
      : await db.select().from(matchResultsTable).orderBy(desc(matchResultsTable.createdAt));
    const authHeader = req.headers.authorization;
    let currentUserId: number | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const { verifyToken } = await import("./auth");
        const payload = verifyToken(authHeader.slice(7));
        if (payload) currentUserId = payload.userId;
      } catch {}
    }
    const safeResults = await Promise.all(results.map(async (r) => {
      if (currentUserId) {
        const [reg] = await db.select().from(registrationsTable)
          .where(and(eq(registrationsTable.id, r.registrationId), eq(registrationsTable.userId, currentUserId)))
          .limit(1);
        if (reg) return r;
      }
      return { ...r, paymentScreenshotUrl: null, utrNumber: null };
    }));
    res.json(safeResults);
  } catch (err) {
    req.log.error({ err }, "Get results error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", auth, hostOnly, async (req: any, res) => {
  try {
    const body = req.body;
    const [result] = await db.insert(matchResultsTable).values({
      tournamentId: body.tournamentId,
      registrationId: body.registrationId,
      squadName: body.squadName,
      placement: body.placement || null,
      outcome: body.outcome || null,
      kills: body.kills || null,
      prize: body.prize || null,
      prizeType: body.prizeType || null,
      paymentScreenshotUrl: body.paymentScreenshotUrl || null,
      utrNumber: body.utrNumber || null,
      description: body.description || null,
    }).returning();

    const [reg] = await db.select().from(registrationsTable).where(eq(registrationsTable.id, body.registrationId)).limit(1);
    if (reg && body.outcome) {
      await db.insert(notificationsTable).values({
        userId: reg.userId,
        title: "Match Result Available",
        message: `Results for ${body.squadName}: ${body.outcome}${body.prize ? ` - Prize: ₹${body.prize}` : ""}`,
        type: "general",
        tournamentId: body.tournamentId,
        registrationId: body.registrationId,
      });
    }
    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "Create result error");
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", auth, hostOnly, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;
    const updates: Record<string, any> = {};
    if (body.placement !== undefined) updates.placement = body.placement;
    if (body.outcome !== undefined) updates.outcome = body.outcome;
    if (body.kills !== undefined) updates.kills = body.kills;
    if (body.prize !== undefined) updates.prize = body.prize;
    if (body.prizeType !== undefined) updates.prizeType = body.prizeType;
    if (body.paymentScreenshotUrl !== undefined) updates.paymentScreenshotUrl = body.paymentScreenshotUrl;
    if (body.utrNumber !== undefined) updates.utrNumber = body.utrNumber;
    if (body.description !== undefined) updates.description = body.description;
    const [result] = await db.update(matchResultsTable).set(updates).where(eq(matchResultsTable.id, id)).returning();
    if (!result) {
      res.status(404).json({ message: "Result not found" });
      return;
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Update result error");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
