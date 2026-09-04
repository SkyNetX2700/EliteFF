import { Router } from "express";
import { desc } from "drizzle-orm";
import { getAuthMiddleware, getHostMiddleware } from "./auth";
import { dataClient, camels } from "../lib/data";

const router = Router();
const auth = getAuthMiddleware();
const hostOnly = getHostMiddleware();

router.post("/feedback", async (req: any, res) => {
  try {
    const { name, message, rating } = req.body;
    if (!name || !message) { res.status(400).json({ message: "Name and message required" }); return; }
    const { error } = await dataClient().from("feedback").insert({
      user_id: req.userId ?? null, name, email: req.userEmail ?? null, message, rating: rating || null,
    });
    if (error) throw error;
    res.status(201).json({ message: "Feedback submitted successfully" });
  } catch (err) {
    req.log.error({ err }, "Submit feedback error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/feedback", auth, hostOnly, async (req, res) => {
  try {
    const { data, error } = await dataClient().from("feedback").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    res.json(camels(data));
  } catch (err) {
    req.log.error({ err }, "Get feedback error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/contact", async (req: any, res) => {
  try {
    const { name, email, message, via } = req.body;
    if (!name || !message || !via) { res.status(400).json({ message: "Name, message, and via required" }); return; }
    const { error } = await dataClient().from("contacts").insert({ name, email: email || null, message, via });
    if (error) throw error;
    res.status(201).json({ message: "Message sent successfully" });
  } catch (err) {
    req.log.error({ err }, "Submit contact error");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;