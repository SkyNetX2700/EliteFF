import { Router } from "express";
import { db, registrationsTable, tournamentsTable } from "@workspace/db";
import { and, eq, ne, sql } from "drizzle-orm";
import { getAuthMiddleware, getHostMiddleware } from "./auth";
import { dataClient, camel, camels } from "../lib/data";
import { safeUser } from "../lib/data";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const auth = getAuthMiddleware();
const hostOnly = getHostMiddleware();
const objectStorage = new ObjectStorageService();

async function usersById(ids: number[]) {
  if (!ids.length) return new Map<number, any>();
  const { data, error } = await dataClient().from("users").select("*").in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((user: any) => [user.id, safeUser(camel(user))]));
}

async function tournamentById(id: number) {
  const { data, error } = await dataClient().from("tournaments").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return camel(data);
}

async function serializeRegistration(raw: any) {
  const row = camel(raw);
  if (typeof row.paymentScreenshotUrl === "string" && row.paymentScreenshotUrl.startsWith("/objects/")) {
    row.paymentScreenshotUrl = await objectStorage.createDownloadUrl(row.paymentScreenshotUrl);
  }
  return row;
}

async function registrationsWithUsers(query: any) {
  const { data, error } = await query;
  if (error) throw error;
  const rows = await Promise.all((data ?? []).map(serializeRegistration));
  const users = await usersById(rows.map((row: any) => row.userId));
  return rows.map((row: any) => ({ ...row, user: users.get(row.userId) ?? null }));
}

async function ensureGuestUser(username: string) {
  const { data: existing } = await dataClient().from("users").select("*").eq("username", username).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await dataClient().from("users").insert({
    username, mobile: `guest_${crypto.randomUUID()}`, password_hash: "$guest$",
    role: "player", login_method: "guest",
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

router.get("/check", async (req, res) => {
  try {
    const { squadName, tournamentId } = req.query as Record<string, string>;
    if (!squadName || !tournamentId) { res.status(400).json({ message: "squadName and tournamentId required" }); return; }
    const { data, error } = await dataClient().from("registrations").select("*")
      .eq("tournament_id", Number(tournamentId)).eq("squad_name", squadName)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) { res.status(404).json({ message: "Not found" }); return; }
    const row = camel(data);
    res.json({
      id: row.id, status: row.status, slotNumber: row.slotNumber, squadName: row.squadName,
      declineReason: row.declineReason, approvedAt: row.approvedAt, tournamentId: row.tournamentId,
    });
  } catch (err) {
    req.log.error({ err }, "Check registration error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/", auth, async (req: any, res) => {
  try {
    const { tournamentId, userId, status } = req.query as Record<string, string>;
    let query = dataClient().from("registrations").select("*").order("created_at", { ascending: false });
    if (tournamentId) query = query.eq("tournament_id", Number(tournamentId));
    if (req.userRole !== "host") query = query.eq("user_id", req.userId);
    else if (userId) query = query.eq("user_id", Number(userId));
    if (status) query = query.eq("status", status);
    const rows = await registrationsWithUsers(query);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Get registrations error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", async (req: any, res) => {
  try {
    const { tournamentId, squadName, playerNames, paymentScreenshotUrl, utrNumber, guestUsername } = req.body;
    if (!tournamentId || !squadName || !playerNames) {
      res.status(400).json({ message: "Tournament ID, team name, and player names are required" });
      return;
    }
    const tournament = await tournamentById(Number(tournamentId));
    if (!tournament) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }
    const isPaid = Boolean(tournament.isPaid);
    const normalizedUtr = isPaid
      ? String(utrNumber ?? "").trim().toUpperCase().replace(/\s+/g, "")
      : "-";
    if (isPaid && (
      normalizedUtr.length < 6 ||
      normalizedUtr.length > 64 ||
      !/^[A-Z0-9-]+$/.test(normalizedUtr) ||
      normalizedUtr === "-"
    )) {
      res.status(400).json({ message: "Enter a valid UTR / transaction ID using 6–64 letters or numbers." });
      return;
    }
    const userId = req.userId ?? await ensureGuestUser(guestUsername || `Guest ${squadName}`);
    const { data: existing, error: existingError } = await dataClient().from("registrations").select("*")
      .eq("tournament_id", tournamentId).eq("squad_name", squadName).limit(1).maybeSingle();
    if (existingError) throw existingError;
    if (existing && !["declined", "cancelled"].includes(existing.status)) {
      res.status(400).json({ message: "Already registered for this tournament" });
      return;
    }

    // Check the normalized value across every tournament. The unique index in
    // the migration provides the final race-safe guarantee for concurrent posts.
    const normalizedUtrExpression = sql`upper(regexp_replace(trim(${registrationsTable.utrNumber}), '\\s+', '', 'g')) = ${normalizedUtr}`;
    const duplicateWhere = existing
      ? and(normalizedUtrExpression, ne(registrationsTable.id, Number(existing.id)))
      : normalizedUtrExpression;
    const [duplicate] = await db.select({ id: registrationsTable.id })
      .from(registrationsTable)
      .where(duplicateWhere)
      .limit(1);
    if (isPaid && duplicate) {
      res.status(409).json({ message: "This UTR / transaction ID is not valid because it has already been used." });
      return;
    }

    const payload = {
      tournament_id: tournamentId, user_id: userId, squad_name: squadName, player_names: playerNames,
      payment_screenshot_url: paymentScreenshotUrl || null, upi_id: null, utr_number: normalizedUtr,
      status: "pending", decline_reason: null, approved_at: null, slot_number: null,
    };
    const result = existing
      ? await dataClient().from("registrations").update(payload).eq("id", existing.id).select("*").single()
      : await dataClient().from("registrations").insert(payload).select("*").single();
    if (result.error) {
      const message = String((result.error as any)?.message || result.error);
      if ((result.error as any)?.code === "23505" || /registrations_utr_number/i.test(message)) {
        res.status(409).json({ message: "This UTR / transaction ID is not valid because it has already been used." });
        return;
      }
      throw result.error;
    }
    const row = await serializeRegistration(result.data);
    await dataClient().from("history").insert({
      user_id: userId, tournament_id: tournamentId, tournament_name: tournament?.name || "Unknown",
      action: "registered",
    });
    const { data: user } = await dataClient().from("users").select("*").eq("id", userId).maybeSingle();
    res.status(existing ? 200 : 201).json({ ...row, user: safeUser(camel(user)), ...(existing ? { reSubmitted: true } : {}) });
  } catch (err) {
    req.log.error({ err }, "Create registration error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/mine", auth, async (req: any, res) => {
  try {
    const { data, error } = await dataClient().from("registrations").select("*")
      .eq("user_id", req.userId).order("created_at", { ascending: false });
    if (error) throw error;
    const rows = camels(data) as any[];
    const tournaments = await Promise.all(rows.map((row: any) => tournamentById(row.tournamentId)));
    const serialized = await Promise.all(rows.map((row: any) => serializeRegistration(row)));
    res.json(serialized.map((row: any, index: number) => ({ ...row, tournament: tournaments[index] })));
  } catch (err) {
    req.log.error({ err }, "Get my registrations error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", auth, async (req: any, res) => {
  try {
    const { data, error } = await dataClient().from("registrations").select("*").eq("id", Number(req.params.id)).maybeSingle();
    if (error) throw error;
    if (!data) { res.status(404).json({ message: "Registration not found" }); return; }
    const row = await serializeRegistration(data);
    if (req.userRole !== "host" && row.userId !== req.userId) { res.status(403).json({ message: "Access denied" }); return; }
    const { data: user } = await dataClient().from("users").select("*").eq("id", row.userId).maybeSingle();
    res.json({ ...row, user: safeUser(camel(user)) });
  } catch (err) {
    req.log.error({ err }, "Get registration error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/verify", auth, hostOnly, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const { data: reg, error: regError } = await dataClient().from("registrations").select("*").eq("id", id).maybeSingle();
    if (regError) throw regError;
    if (!reg) { res.status(404).json({ message: "Registration not found" }); return; }
    const tournament = await tournamentById(reg.tournament_id);
    if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }
    if (Number(tournament.hostId) !== Number(req.userId)) {
      res.status(403).json({ message: "You do not own this tournament" });
      return;
    }

    const approval = await db.transaction(async (tx) => {
      const [lockedTournament] = await tx.select().from(tournamentsTable)
        .where(eq(tournamentsTable.id, reg.tournament_id)).for("update");
      if (!lockedTournament) return { kind: "not-found" as const };

      const [current] = await tx.select().from(registrationsTable)
        .where(eq(registrationsTable.id, id));
      if (!current) return { kind: "not-found" as const };
      if (current.status === "verified") return { kind: "already" as const, row: current };

      const verifiedRows = await tx.select({ slotNumber: registrationsTable.slotNumber })
        .from(registrationsTable)
        .where(and(
          eq(registrationsTable.tournamentId, reg.tournament_id),
          eq(registrationsTable.status, "verified"),
        ));
      const usedSlots = new Set(verifiedRows.map(row => row.slotNumber).filter((slot): slot is number => slot !== null));
      if (usedSlots.size >= lockedTournament.maxSlots) return { kind: "full" as const };

      let slotNumber = 1;
      while (usedSlots.has(slotNumber)) slotNumber += 1;
      const [updated] = await tx.update(registrationsTable)
        .set({ status: "verified", slotNumber, approvedAt: new Date() })
        .where(and(eq(registrationsTable.id, id), eq(registrationsTable.status, current.status)))
        .returning();
      if (!updated) return { kind: "conflict" as const };

      await tx.update(tournamentsTable)
        .set({ filledSlots: usedSlots.size + 1 })
        .where(eq(tournamentsTable.id, reg.tournament_id));
      return { kind: "ok" as const, row: updated, slotNumber, tournament: lockedTournament };
    });

    if (approval.kind === "not-found") { res.status(404).json({ message: "Registration or tournament not found" }); return; }
    if (approval.kind === "full") { res.status(409).json({ message: "Tournament is full" }); return; }
    if (approval.kind === "conflict") { res.status(409).json({ message: "Registration was already updated" }); return; }
    if (approval.kind === "already") {
      const user = await dataClient().from("users").select("*").eq("id", reg.user_id).maybeSingle();
      res.json({ ...(await serializeRegistration(approval.row)), user: safeUser(camel(user.data)) });
      return;
    }

    const updated = approval.row;
    const slotNumber = approval.slotNumber;
    await dataClient().from("notifications").insert({
      user_id: reg.user_id, title: "Registration Verified!",
      message: `Your registration for ${tournament?.name || "the tournament"} has been verified! You are Slot #${slotNumber}.`,
      type: "verification_success", tournament_id: reg.tournament_id, registration_id: id,
    });
    const { data: user } = await dataClient().from("users").select("*").eq("id", reg.user_id).maybeSingle();
    res.json({ ...(await serializeRegistration(updated)), user: safeUser(camel(user)) });
  } catch (err) {
    req.log.error({ err }, "Verify registration error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/decline", auth, hostOnly, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const { data: reg, error: regError } = await dataClient().from("registrations").select("*").eq("id", id).maybeSingle();
    if (regError) throw regError;
    if (!reg) { res.status(404).json({ message: "Registration not found" }); return; }
    const tournament = await tournamentById(reg.tournament_id);
    if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }
    if (Number(tournament.hostId) !== Number(req.userId)) {
      res.status(403).json({ message: "You do not own this tournament" });
      return;
    }
    const { data: updated, error } = await dataClient().from("registrations")
      .update({ status: "declined", decline_reason: req.body.reason, slot_number: null, approved_at: null }).eq("id", id).select("*").single();
    if (error) throw error;
    await dataClient().from("notifications").insert({
      user_id: reg.user_id, title: "Registration Declined",
      message: `Your registration for ${tournament?.name || "the tournament"} was declined. Reason: ${req.body.reason}`,
      type: "cancelled", tournament_id: reg.tournament_id, registration_id: id,
    });
    const { data: user } = await dataClient().from("users").select("*").eq("id", reg.user_id).maybeSingle();
    res.json({ ...(await serializeRegistration(updated)), user: safeUser(camel(user)) });
  } catch (err) {
    req.log.error({ err }, "Decline registration error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/cancel", auth, hostOnly, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const { data: reg, error: regError } = await dataClient().from("registrations").select("*").eq("id", id).maybeSingle();
    if (regError) throw regError;
    if (!reg) { res.status(404).json({ message: "Registration not found" }); return; }
    const tournament = await tournamentById(reg.tournament_id);
    if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }
    if (Number(tournament.hostId) !== Number(req.userId)) {
      res.status(403).json({ message: "You do not own this tournament" });
      return;
    }
    const { data: updated, error } = await dataClient().from("registrations")
      .update({ status: "cancelled", slot_number: null, approved_at: null }).eq("id", id).select("*").single();
    if (error) throw error;
    if (reg.status === "verified") {
      const { count, error: countError } = await dataClient().from("registrations").select("id", { count: "exact", head: true })
        .eq("tournament_id", reg.tournament_id).eq("status", "verified");
      if (countError) throw countError;
      const filledResult = await dataClient().from("tournaments").update({ filled_slots: count ?? 0 }).eq("id", reg.tournament_id);
      if (filledResult.error) throw filledResult.error;
    }
    const { data: user } = await dataClient().from("users").select("*").eq("id", reg.user_id).maybeSingle();
    res.json({ ...(await serializeRegistration(updated)), user: safeUser(camel(user)) });
  } catch (err) {
    req.log.error({ err }, "Cancel registration error");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;