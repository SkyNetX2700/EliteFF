import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getAuthMiddleware, getHostMiddleware } from "./auth";

const router = Router();
const auth = getAuthMiddleware();
const hostOnly = getHostMiddleware();

router.get("/", auth, async (req: any, res) => {
  try {
    const notifications = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, req.userId))
      .orderBy(desc(notificationsTable.createdAt));
    res.json(notifications);
  } catch (err) {
    req.log.error({ err }, "Get notifications error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", auth, hostOnly, async (req: any, res) => {
  try {
    const { userId, title, message, type, tournamentId, registrationId, targetAll } = req.body;
    if (targetAll) {
      const users = await db.select().from(usersTable);
      for (const user of users) {
        await db.insert(notificationsTable).values({
          userId: user.id,
          title,
          message,
          type: type || "general",
          tournamentId: tournamentId || null,
          registrationId: registrationId || null,
        });
      }
      res.status(201).json({ message: "Notification sent to all users" });
      return;
    }
    if (!userId) {
      res.status(400).json({ message: "userId or targetAll required" });
      return;
    }
    const [notif] = await db.insert(notificationsTable).values({
      userId,
      title,
      message,
      type: type || "general",
      tournamentId: tournamentId || null,
      registrationId: registrationId || null,
    }).returning();
    res.status(201).json(notif);
  } catch (err) {
    req.log.error({ err }, "Create notification error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/read", auth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const [notif] = await db.update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.userId)))
      .returning();
    if (!notif) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }
    res.json(notif);
  } catch (err) {
    req.log.error({ err }, "Mark read error");
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", auth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(notificationsTable).where(
      and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.userId))
    );
    res.json({ message: "Notification deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete notification error");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
