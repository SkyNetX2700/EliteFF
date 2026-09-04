import { Router } from "express";
import { db } from "@workspace/db";
import { feedbackTable, contactTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { getAuthMiddleware, getHostMiddleware } from "./auth";

const router = Router();
const auth = getAuthMiddleware();
const hostOnly = getHostMiddleware();

router.post("/feedback", async (req: any, res) => {
  try {
    const { name, message, rating } = req.body;
    if (!name || !message) {
      res.status(400).json({ message: "Name and message required" });
      return;
    }
    await db.insert(feedbackTable).values({ name, message, rating: rating || null });
    res.status(201).json({ message: "Feedback submitted successfully" });
  } catch (err) {
    req.log.error({ err }, "Submit feedback error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/feedback", async (req, res) => {
  try {
    const feedback = await db.select().from(feedbackTable).orderBy(desc(feedbackTable.createdAt)).limit(20);
    res.json(feedback);
  } catch (err) {
    req.log.error({ err }, "Get feedback error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/contact", async (req: any, res) => {
  try {
    const { name, email, message, via } = req.body;
    if (!name || !message || !via) {
      res.status(400).json({ message: "Name, message, and via required" });
      return;
    }
    await db.insert(contactTable).values({ name, email: email || null, message, via });
    res.status(201).json({ message: "Message sent successfully" });
  } catch (err) {
    req.log.error({ err }, "Submit contact error");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
