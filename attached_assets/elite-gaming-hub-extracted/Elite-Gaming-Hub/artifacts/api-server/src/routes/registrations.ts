import { Router } from "express";
import { db } from "@workspace/db";
import { registrationsTable, tournamentsTable, notificationsTable, usersTable, historyTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getAuthMiddleware, getHostMiddleware } from "./auth";

const router = Router();
const auth = getAuthMiddleware();
const hostOnly = getHostMiddleware();

// Public status check for players (no auth needed)
router.get("/check", async (req, res) => {
  try {
    const { squadName, tournamentId } = req.query as Record<string, string>;
    if (!squadName || !tournamentId) {
      res.status(400).json({ message: "squadName and tournamentId required" });
      return;
    }
    const [reg] = await db.select({
      id: registrationsTable.id,
      status: registrationsTable.status,
      slotNumber: registrationsTable.slotNumber,
      squadName: registrationsTable.squadName,
      declineReason: registrationsTable.declineReason,
      tournamentId: registrationsTable.tournamentId,
    }).from(registrationsTable)
      .where(and(
        eq(registrationsTable.tournamentId, parseInt(tournamentId)),
        eq(registrationsTable.squadName, squadName)
      )).orderBy(desc(registrationsTable.createdAt)).limit(1);
    if (!reg) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(reg);
  } catch (err) {
    req.log.error({ err }, "Check registration error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/", auth, async (req: any, res) => {
  try {
    const { tournamentId, userId, status } = req.query as Record<string, string>;
    const conditions: any[] = [];
    if (tournamentId) conditions.push(eq(registrationsTable.tournamentId, parseInt(tournamentId)));
    if (userId) conditions.push(eq(registrationsTable.userId, parseInt(userId)));
    if (status) conditions.push(eq(registrationsTable.status, status));

    const regs = conditions.length > 0
      ? await db.select({
          id: registrationsTable.id,
          tournamentId: registrationsTable.tournamentId,
          userId: registrationsTable.userId,
          squadName: registrationsTable.squadName,
          playerNames: registrationsTable.playerNames,
          paymentScreenshotUrl: registrationsTable.paymentScreenshotUrl,
          utrNumber: registrationsTable.utrNumber,
          status: registrationsTable.status,
          slotNumber: registrationsTable.slotNumber,
          declineReason: registrationsTable.declineReason,
          createdAt: registrationsTable.createdAt,
          user: {
            id: usersTable.id,
            username: usersTable.username,
            email: usersTable.email,
            mobile: usersTable.mobile,
            role: usersTable.role,
            profilePic: usersTable.profilePic,
            createdAt: usersTable.createdAt,
          },
        }).from(registrationsTable)
          .leftJoin(usersTable, eq(registrationsTable.userId, usersTable.id))
          .where(and(...conditions))
          .orderBy(desc(registrationsTable.createdAt))
      : await db.select({
          id: registrationsTable.id,
          tournamentId: registrationsTable.tournamentId,
          userId: registrationsTable.userId,
          squadName: registrationsTable.squadName,
          playerNames: registrationsTable.playerNames,
          paymentScreenshotUrl: registrationsTable.paymentScreenshotUrl,
          utrNumber: registrationsTable.utrNumber,
          status: registrationsTable.status,
          slotNumber: registrationsTable.slotNumber,
          declineReason: registrationsTable.declineReason,
          createdAt: registrationsTable.createdAt,
          user: {
            id: usersTable.id,
            username: usersTable.username,
            email: usersTable.email,
            mobile: usersTable.mobile,
            role: usersTable.role,
            profilePic: usersTable.profilePic,
            createdAt: usersTable.createdAt,
          },
        }).from(registrationsTable)
          .leftJoin(usersTable, eq(registrationsTable.userId, usersTable.id))
          .orderBy(desc(registrationsTable.createdAt));

    if (req.userRole !== "host") {
      const filtered = regs.map(r => ({
        ...r,
        paymentScreenshotUrl: r.userId === req.userId ? r.paymentScreenshotUrl : null,
      }));
      res.json(filtered);
      return;
    }
    res.json(regs);
  } catch (err) {
    req.log.error({ err }, "Get registrations error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", async (req: any, res) => {
  try {
    const { tournamentId, squadName, playerNames, paymentScreenshotUrl, utrNumber, guestUsername } = req.body;
    if (!tournamentId || !squadName || !playerNames || !utrNumber) {
      res.status(400).json({ message: "Tournament ID, squad name, player names, and UTR number are required" });
      return;
    }

    // Resolve userId: from JWT if present, else look up by guestUsername, else use a fallback
    let userId = req.userId ?? null;
    if (!userId && guestUsername) {
      const [found] = await db.select({ id: usersTable.id }).from(usersTable)
        .where(eq(usersTable.username, guestUsername)).limit(1);
      if (found) userId = found.id;
    }
    // If still no userId, use a placeholder (guest slot)
    if (!userId) userId = 1;

    const existing = await db.select().from(registrationsTable).where(
      and(eq(registrationsTable.tournamentId, tournamentId), eq(registrationsTable.squadName, squadName))
    ).limit(1);
    if (existing.length > 0 && existing[0].status !== "cancelled") {
      res.status(400).json({ message: "Already registered for this tournament" });
      return;
    }
    const [reg] = await db.insert(registrationsTable).values({
      tournamentId,
      userId,
      squadName,
      playerNames,
      paymentScreenshotUrl: paymentScreenshotUrl || null,
      utrNumber,
      status: "pending",
    }).returning();

    await db.insert(historyTable).values({
      userId,
      tournamentId,
      tournamentName: (await db.select({ name: tournamentsTable.name }).from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId)).limit(1))[0]?.name || "Unknown",
      action: "registered",
    });

    const userRow = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (userRow[0]) {
      const { passwordHash: _, resetToken: __, resetTokenExpiry: ___, ...safeUser } = userRow[0];
      res.status(201).json({ ...reg, user: safeUser });
    } else {
      res.status(201).json(reg);
    }
  } catch (err) {
    req.log.error({ err }, "Create registration error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/mine", auth, async (req: any, res) => {
  try {
    const regs = await db.select({
      id: registrationsTable.id,
      tournamentId: registrationsTable.tournamentId,
      squadName: registrationsTable.squadName,
      playerNames: registrationsTable.playerNames,
      status: registrationsTable.status,
      slotNumber: registrationsTable.slotNumber,
      declineReason: registrationsTable.declineReason,
      createdAt: registrationsTable.createdAt,
      tournament: {
        id: tournamentsTable.id,
        name: tournamentsTable.name,
        type: tournamentsTable.type,
        mode: tournamentsTable.mode,
        status: tournamentsTable.status,
        scheduledAt: tournamentsTable.scheduledAt,
        entryFee: tournamentsTable.entryFee,
        prizePool: tournamentsTable.prizePool,
        booyahPrize: tournamentsTable.booyahPrize,
      },
    }).from(registrationsTable)
      .leftJoin(tournamentsTable, eq(registrationsTable.tournamentId, tournamentsTable.id))
      .where(eq(registrationsTable.userId, req.userId))
      .orderBy(desc(registrationsTable.createdAt));
    res.json(regs);
  } catch (err) {
    req.log.error({ err }, "Get my registrations error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", auth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const [reg] = await db.select({
      id: registrationsTable.id,
      tournamentId: registrationsTable.tournamentId,
      userId: registrationsTable.userId,
      squadName: registrationsTable.squadName,
      playerNames: registrationsTable.playerNames,
      paymentScreenshotUrl: registrationsTable.paymentScreenshotUrl,
      utrNumber: registrationsTable.utrNumber,
      status: registrationsTable.status,
      slotNumber: registrationsTable.slotNumber,
      declineReason: registrationsTable.declineReason,
      createdAt: registrationsTable.createdAt,
      user: {
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        mobile: usersTable.mobile,
        role: usersTable.role,
        profilePic: usersTable.profilePic,
        createdAt: usersTable.createdAt,
      },
    }).from(registrationsTable)
      .leftJoin(usersTable, eq(registrationsTable.userId, usersTable.id))
      .where(eq(registrationsTable.id, id)).limit(1);
    if (!reg) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }
    if (req.userRole !== "host" && reg.userId !== req.userId) {
      res.status(403).json({ message: "Access denied" });
      return;
    }
    res.json(reg);
  } catch (err) {
    req.log.error({ err }, "Get registration error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/verify", auth, hostOnly, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const [reg] = await db.select().from(registrationsTable).where(eq(registrationsTable.id, id)).limit(1);
    if (!reg) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }
    const verifiedCount = await db.select().from(registrationsTable).where(
      and(eq(registrationsTable.tournamentId, reg.tournamentId), eq(registrationsTable.status, "verified"))
    );
    const slotNumber = verifiedCount.length + 1;

    const [updated] = await db.update(registrationsTable).set({
      status: "verified",
      slotNumber,
    }).where(eq(registrationsTable.id, id)).returning();

    await db.update(tournamentsTable).set({
      filledSlots: slotNumber,
    }).where(eq(tournamentsTable.id, reg.tournamentId));

    const [tournament] = await db.select({ name: tournamentsTable.name }).from(tournamentsTable).where(eq(tournamentsTable.id, reg.tournamentId)).limit(1);
    await db.insert(notificationsTable).values({
      userId: reg.userId,
      title: "Registration Verified!",
      message: `Your registration for ${tournament?.name || "the tournament"} has been verified! You are Slot #${slotNumber}.`,
      type: "verification_success",
      tournamentId: reg.tournamentId,
      registrationId: id,
    });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);
    const { passwordHash: _, resetToken: __, resetTokenExpiry: ___, ...safeUser } = user;
    res.json({ ...updated, user: safeUser });
  } catch (err) {
    req.log.error({ err }, "Verify registration error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/decline", auth, hostOnly, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    const [reg] = await db.select().from(registrationsTable).where(eq(registrationsTable.id, id)).limit(1);
    if (!reg) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }
    const [updated] = await db.update(registrationsTable).set({
      status: "declined",
      declineReason: reason,
    }).where(eq(registrationsTable.id, id)).returning();

    const [tournament] = await db.select({ name: tournamentsTable.name }).from(tournamentsTable).where(eq(tournamentsTable.id, reg.tournamentId)).limit(1);
    await db.insert(notificationsTable).values({
      userId: reg.userId,
      title: "Registration Declined",
      message: `Your registration for ${tournament?.name || "the tournament"} was declined. Reason: ${reason}`,
      type: "cancelled",
      tournamentId: reg.tournamentId,
      registrationId: id,
    });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);
    const { passwordHash: _, resetToken: __, resetTokenExpiry: ___, ...safeUser } = user;
    res.json({ ...updated, user: safeUser });
  } catch (err) {
    req.log.error({ err }, "Decline registration error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/cancel", auth, hostOnly, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const [reg] = await db.select().from(registrationsTable).where(eq(registrationsTable.id, id)).limit(1);
    if (!reg) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }
    if (reg.status === "verified") {
      await db.update(tournamentsTable).set({
        filledSlots: Math.max(0, (await db.select().from(registrationsTable).where(and(eq(registrationsTable.tournamentId, reg.tournamentId), eq(registrationsTable.status, "verified")))).length - 1),
      }).where(eq(tournamentsTable.id, reg.tournamentId));
    }
    const [updated] = await db.update(registrationsTable).set({ status: "cancelled" }).where(eq(registrationsTable.id, id)).returning();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);
    const { passwordHash: _, resetToken: __, resetTokenExpiry: ___, ...safeUser } = user;
    res.json({ ...updated, user: safeUser });
  } catch (err) {
    req.log.error({ err }, "Cancel registration error");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
