import { Router } from "express";
import { getAuthMiddleware, getHostMiddleware } from "./auth";
import { dataClient, camels, camel } from "../lib/data";

const router = Router();
const auth = getAuthMiddleware();
const hostOnly = getHostMiddleware();

router.get("/", auth, async (req: any, res) => {
  try {
    const { data, error } = await dataClient().from("notifications").select("*")
      .eq("user_id", req.userId).order("created_at", { ascending: false });
    if (error) throw error;
    res.json(camels(data));
  } catch (err) {
    req.log.error({ err }, "Get notifications error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", auth, hostOnly, async (req: any, res) => {
  try {
    const { userId, title, message, type, tournamentId, registrationId, targetAll } = req.body;
    const payload = (id: number) => ({
      user_id: id, title, message, type: type || "general",
      tournament_id: tournamentId || null, registration_id: registrationId || null,
    });
    if (targetAll) {
      const { data: users, error: usersError } = await dataClient().from("users").select("id");
      if (usersError) throw usersError;
      const { error } = await dataClient().from("notifications").insert((users ?? []).map((user: any) => payload(user.id)));
      if (error) throw error;
      res.status(201).json({ message: "Notification sent to all users" });
      return;
    }
    if (!userId) { res.status(400).json({ message: "userId or targetAll required" }); return; }
    const { data, error } = await dataClient().from("notifications").insert(payload(userId)).select("*").single();
    if (error) throw error;
    res.status(201).json(camel(data));
  } catch (err) {
    req.log.error({ err }, "Create notification error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/broadcast", auth, hostOnly, async (req: any, res) => {
  try {
    const { tournamentId, title, message, type } = req.body ?? {};
    const id = Number(tournamentId);
    if (!Number.isInteger(id) || !String(title ?? "").trim() || !String(message ?? "").trim()) {
      res.status(400).json({ message: "Tournament, title, and message are required" });
      return;
    }

    const { data: tournament, error: tournamentError } = await dataClient()
      .from("tournaments").select("*").eq("id", id).maybeSingle();
    if (tournamentError) throw tournamentError;
    if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }
    if (Number(tournament.host_id) !== Number(req.userId)) {
      res.status(403).json({ message: "You do not own this tournament" });
      return;
    }

    const { data: registrations, error: registrationsError } = await dataClient()
      .from("registrations").select("user_id").eq("tournament_id", id);
    if (registrationsError) throw registrationsError;
    const userIds = Array.from(new Set((registrations ?? []).map((row: any) => row.user_id).filter(Boolean)));
    if (userIds.length) {
      const { error } = await dataClient().from("notifications").insert(userIds.map(userId => ({
        user_id: userId,
        title: String(title).trim(),
        message: String(message).trim(),
        type: type || "general",
        tournament_id: id,
      })));
      if (error) throw error;
    }
    res.status(201).json({ sent: userIds.length });
  } catch (err) {
    req.log.error({ err }, "Broadcast notification error");
    res.status(500).json({ message: "Unable to send the broadcast right now" });
  }
});

router.post("/:id/read", auth, async (req: any, res) => {
  try {
    const { data, error } = await dataClient().from("notifications").update({ is_read: true })
      .eq("id", Number(req.params.id)).eq("user_id", req.userId).select("*").maybeSingle();
    if (error) throw error;
    if (!data) { res.status(404).json({ message: "Notification not found" }); return; }
    res.json(camel(data));
  } catch (err) {
    req.log.error({ err }, "Mark read error");
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", auth, async (req: any, res) => {
  try {
    const { error } = await dataClient().from("notifications").delete()
      .eq("id", Number(req.params.id)).eq("user_id", req.userId);
    if (error) throw error;
    res.json({ message: "Notification deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete notification error");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;