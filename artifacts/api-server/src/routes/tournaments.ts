import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db, matchResultsTable, notificationsTable, registrationsTable, scoreboardTable, historyTable, tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAuthMiddleware, getHostMiddleware } from "./auth";
import { dataClient, camel, camels } from "../lib/data";
import { publicTournament } from "../lib/data";

const router = Router();
const auth = getAuthMiddleware();
const hostOnly = getHostMiddleware();

function teamSizeForMode(mode: unknown) {
  if (mode === "Solo") return "1";
  if (mode === "Duo") return "2";
  return "4";
}

function parseDate(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalMoney(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const amount = Number(value);
  return Number.isInteger(amount) && amount >= 0 ? amount : null;
}

async function notifyUsers(tournamentId: number, title: string, message: string, type: string) {
  const { data: registrations, error } = await dataClient()
    .from("registrations").select("user_id").eq("tournament_id", tournamentId);
  if (error) throw error;
  const rows = (registrations ?? []).map((reg: any) => ({
    user_id: reg.user_id, title, message, type, tournament_id: tournamentId,
  }));
  if (rows.length) {
    const result = await dataClient().from("notifications").insert(rows);
    if (result.error) throw result.error;
  }
}

router.get("/", async (req, res) => {
  try {
    const { status, type } = req.query as Record<string, string>;
    let query = dataClient().from("tournaments").select("*").order("scheduled_at", { ascending: false });
    if (status) query = query.eq("status", status);
    if (type) query = query.eq("type", type);
    const { data, error } = await query;
    if (error) throw error;
    res.json((data ?? []).map(publicTournament));
  } catch (err) {
    req.log.error({ err }, "Get tournaments error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", auth, hostOnly, async (req: any, res) => {
  try {
    const body = req.body ?? {};
    const isPrivate = body.isPrivate ?? false;
    const scheduledAt = parseDate(body.scheduledAt);
    const maxSlots = Number(body.maxSlots);
    const hostId = Number(req.userId);
    if (!String(body.name ?? "").trim() || !String(body.type ?? "").trim() || !String(body.mode ?? "").trim()) {
      res.status(400).json({ message: "Name, type, and mode are required" });
      return;
    }
    if (!Number.isInteger(hostId) || hostId < 1) {
      res.status(401).json({ message: "A valid host session is required" });
      return;
    }
    if (!Number.isInteger(maxSlots) || maxSlots < 1) {
      res.status(400).json({ message: "Max teams must be at least 1" });
      return;
    }
    if (!scheduledAt) {
      res.status(400).json({ message: "A valid schedule time is required" });
      return;
    }
    const entryFee = parseOptionalMoney(body.entryFee);
    const prizePool = parseOptionalMoney(body.prizePool);
    if ((body.entryFee !== undefined && body.entryFee !== null && body.entryFee !== "" && entryFee === null)
      || (body.prizePool !== undefined && body.prizePool !== null && body.prizePool !== "" && prizePool === null)) {
      res.status(400).json({ message: "Entry fee and prize pool must be whole, non-negative amounts" });
      return;
    }
    const payload = {
      name: String(body.name).trim(),
      type: String(body.type),
      mode: String(body.mode),
      mapName: body.mapName || null,
      matchCount: Number.isInteger(Number(body.matchCount)) && Number(body.matchCount) > 0 ? Number(body.matchCount) : 1,
      maps: typeof body.maps === "string" ? body.maps : Array.isArray(body.maps) ? JSON.stringify(body.maps) : null,
      killPoints: Number.isInteger(Number(body.killPoints)) && Number(body.killPoints) >= 0 ? Number(body.killPoints) : 1,
      placements: typeof body.placements === "string" ? body.placements : Array.isArray(body.placements) ? JSON.stringify(body.placements) : null,
      prizeDistribution: typeof body.prizeDistribution === "string" ? body.prizeDistribution : body.prizeDistribution ? JSON.stringify(body.prizeDistribution) : null,
      teamSize: String(body.teamSize || teamSizeForMode(body.mode)),
      entryFee,
      prizePool,
      booyahPrize: parseOptionalMoney(body.booyahPrize),
      secondPrize: parseOptionalMoney(body.secondPrize),
      thirdPrize: parseOptionalMoney(body.thirdPrize),
      highestKillPrize: parseOptionalMoney(body.highestKillPrize),
      maxSlots,
      scheduledAt,
      rules: body.rules || null,
      posterUrl: body.posterUrl || null,
      upiId: body.upiId || null,
      isPaid: body.isPaid ?? false,
      timerEnabled: body.timerEnabled ?? true,
      hostId,
      status: "upcoming",
      isPrivate,
       inviteLink: isPrivate ? `${req.headers.origin || ""}/tournaments/${randomUUID().slice(0, 8)}` : null,
    };
    // Use the same adapter as the player-facing list so inserts and reads
    // share the exact same field conversion and database connection path.
    const { data, error } = await dataClient()
      .from("tournaments")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    if (!data) throw new Error("Tournament insert returned no row");
    res.status(201).json(publicTournament(data));
  } catch (err) {
    req.log.error({ err }, "Create tournament error");
    res.status(500).json({ message: "Unable to create the tournament right now. Please verify the API database configuration and try again." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { data, error } = await dataClient().from("tournaments").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) { res.status(404).json({ message: "Tournament not found" }); return; }
    if (data.status === "upcoming" && data.scheduled_at && new Date(data.scheduled_at) <= new Date()) {
      const updated = await dataClient().from("tournaments").update({ status: "live" }).eq("id", id).select("*").single();
      if (updated.error) throw updated.error;
      res.json(publicTournament(updated.data));
      return;
    }
    res.json(publicTournament(data));
  } catch (err) {
    req.log.error({ err }, "Get tournament error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id/full", auth, hostOnly, async (req, res) => {
  try {
    const { data, error } = await dataClient().from("tournaments").select("*").eq("id", Number(req.params.id)).maybeSingle();
    if (error) throw error;
    if (!data) { res.status(404).json({ message: "Tournament not found" }); return; }
    res.json(camel(data));
  } catch (err) {
    req.log.error({ err }, "Get full tournament error");
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", auth, hostOnly, async (req: any, res) => {
  try {
    const body = req.body;
    const updates: Record<string, any> = {};
    const fields: Record<string, string> = {
      name: "name", type: "type", mode: "mode", mapName: "map_name", teamSize: "team_size",
      entryFee: "entry_fee", prizePool: "prize_pool", booyahPrize: "booyah_prize",
      secondPrize: "second_prize", thirdPrize: "third_prize", highestKillPrize: "highest_kill_prize",
      matchCount: "match_count", maps: "maps", killPoints: "kill_points", placements: "placements",
      prizeDistribution: "prize_distribution",
      maxSlots: "max_slots", rules: "rules", posterUrl: "poster_url", upiId: "upi_id",
      isPaid: "is_paid", timerEnabled: "timer_enabled", roomId: "room_id", roomPassword: "room_password",
      isPrivate: "is_private", status: "status",
    };
    for (const [from, to] of Object.entries(fields)) if (body[from] !== undefined) updates[to] = body[from];
    for (const key of ["maps", "placements", "prizeDistribution"]) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      if (body[key] !== undefined && Array.isArray(body[key])) updates[snakeKey] = JSON.stringify(body[key]);
    }
    if (body.scheduledAt !== undefined) {
      const scheduledAt = parseDate(body.scheduledAt);
      if (!scheduledAt) {
        res.status(400).json({ message: "A valid schedule time is required" });
        return;
      }
      updates.scheduled_at = scheduledAt;
    }
    const { data, error } = await dataClient().from("tournaments").update(updates).eq("id", Number(req.params.id)).select("*").maybeSingle();
    if (error) throw error;
    if (!data) { res.status(404).json({ message: "Tournament not found" }); return; }
    res.json(publicTournament(data));
  } catch (err) {
    req.log.error({ err }, "Update tournament error");
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", auth, hostOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ message: "Invalid tournament ID" });
      return;
    }
    const deleted = await db.transaction(async (tx) => {
      // Delete dependants explicitly so this works with both old and new
      // databases whose foreign keys may not have ON DELETE CASCADE.
      await tx.delete(matchResultsTable).where(eq(matchResultsTable.tournamentId, id));
      await tx.delete(scoreboardTable).where(eq(scoreboardTable.tournamentId, id));
      await tx.delete(notificationsTable).where(eq(notificationsTable.tournamentId, id));
      await tx.delete(registrationsTable).where(eq(registrationsTable.tournamentId, id));
      await tx.delete(historyTable).where(eq(historyTable.tournamentId, id));
      const rows = await tx.delete(tournamentsTable)
        .where(eq(tournamentsTable.id, id))
        .returning({ id: tournamentsTable.id });
      return rows[0] ?? null;
    });
    if (!deleted) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }
    res.json({ message: "Tournament deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete tournament error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/cancel", auth, hostOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { data, error } = await dataClient().from("tournaments").update({ status: "cancelled", cancel_reason: req.body.reason }).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    if (!data) { res.status(404).json({ message: "Tournament not found" }); return; }
    await notifyUsers(id, "Tournament Cancelled", `${data.name} has been cancelled. Reason: ${req.body.reason}. Refund will be processed.`, "cancelled");
    res.json(publicTournament(data));
  } catch (err) {
    req.log.error({ err }, "Cancel tournament error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/delay", auth, hostOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { newScheduledAt, reason } = req.body;
    const scheduledAt = parseDate(newScheduledAt);
    if (!scheduledAt) {
      res.status(400).json({ message: "A valid new schedule time is required" });
      return;
    }
    const { data, error } = await dataClient().from("tournaments").update({
      status: "delayed", scheduled_at: scheduledAt, delay_info: reason,
    }).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    if (!data) { res.status(404).json({ message: "Tournament not found" }); return; }
    await notifyUsers(id, "Tournament Delayed", `${data.name} has been delayed. New time: ${new Date(newScheduledAt).toLocaleString()}. Reason: ${reason}`, "delayed");
    res.json(publicTournament(data));
  } catch (err) {
    req.log.error({ err }, "Delay tournament error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/complete", auth, hostOnly, async (req, res) => {
  try {
    const { data, error } = await dataClient().from("tournaments").update({ status: "completed" }).eq("id", Number(req.params.id)).select("*").maybeSingle();
    if (error) throw error;
    if (!data) { res.status(404).json({ message: "Tournament not found" }); return; }
    res.json(publicTournament(data));
  } catch (err) {
    req.log.error({ err }, "Complete tournament error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/room", auth, hostOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { data, error } = await dataClient().from("tournaments").update({
      room_id: req.body.roomId, room_password: req.body.roomPassword,
    }).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    if (!data) { res.status(404).json({ message: "Tournament not found" }); return; }
    await notifyUsers(id, "Room ID & Password Available", `Room credentials for ${data.name} are now available. Check your tournament details.`, "room_id_shared");
    res.json(publicTournament(data));
  } catch (err) {
    req.log.error({ err }, "Upload room error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id/scoreboard", async (req, res) => {
  try {
    const { data, error } = await dataClient().from("scoreboard").select("*").eq("tournament_id", Number(req.params.id)).order("rank", { ascending: true });
    if (error) throw error;
    res.json(camels(data));
  } catch (err) {
    req.log.error({ err }, "Get scoreboard error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/scoreboard", auth, async (req: any, res) => {
  try {
    const payload = {
      tournament_id: Number(req.params.id), registration_id: req.body.registrationId, squad_name: req.body.squadName,
      kills: req.body.kills || 0, rank: req.body.rank || null, points: req.body.points || 0, updated_at: new Date(),
    };
    const existing = await dataClient().from("scoreboard").select("id").eq("tournament_id", payload.tournament_id).eq("registration_id", payload.registration_id).maybeSingle();
    if (existing.error) throw existing.error;
    const result = existing.data
      ? await dataClient().from("scoreboard").update(payload).eq("id", existing.data.id).select("*").single()
      : await dataClient().from("scoreboard").insert(payload).select("*").single();
    if (result.error) throw result.error;
    res.status(existing.data ? 200 : 201).json(camel(result.data));
  } catch (err) {
    req.log.error({ err }, "Update scoreboard error");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;