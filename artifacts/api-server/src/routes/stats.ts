import { Router } from "express";
import { getAuthMiddleware, getHostMiddleware } from "./auth";
import { dataClient, camel, camels } from "../lib/data";

const router = Router();
const auth = getAuthMiddleware();
const hostOnly = getHostMiddleware();

router.get("/summary", async (req, res) => {
  try {
    const [{ count: totalTournaments }, { count: activeTournaments }, { count: totalPlayers }, { count: totalRegistrations }] = await Promise.all([
      dataClient().from("tournaments").select("id", { count: "exact", head: true }),
      dataClient().from("tournaments").select("id", { count: "exact", head: true }).eq("status", "upcoming"),
      dataClient().from("users").select("id", { count: "exact", head: true }).eq("role", "player"),
      dataClient().from("registrations").select("id", { count: "exact", head: true }),
    ]);
    res.json({ totalTournaments: totalTournaments ?? 0, activeTournaments: activeTournaments ?? 0, totalPlayers: totalPlayers ?? 0, totalRegistrations: totalRegistrations ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Stats summary error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/leaderboard", async (req, res) => {
  try {
    const { data: users, error } = await dataClient().from("users").select("*")
      .eq("role", "player").order("points", { ascending: false }).limit(50);
    if (error) throw error;
    const rows = await Promise.all((users ?? []).map(async (user: any) => {
      const { count } = await dataClient().from("registrations").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      return { ...camel(user), tournamentsPlayed: count ?? 0 };
    }));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Leaderboard error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/best-player", async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [{ data: exclusions, error: exclusionsError }, { data: results, error }] = await Promise.all([
      dataClient().from("best_player_exclusions").select("result_id"),
      dataClient().from("match_results").select("*").gte("created_at", since).limit(100),
    ]);
    if (exclusionsError) throw exclusionsError;
    if (error) throw error;
    const excludedIds = new Set((exclusions ?? []).map((entry: any) => Number(entry.result_id)));
    const visibleResults = (results ?? [])
      .filter((result: any) => !excludedIds.has(Number(result.id)))
      .sort((a: any, b: any) => {
        const prizeDifference = Number(b.prize ?? 0) - Number(a.prize ?? 0);
        if (prizeDifference !== 0) return prizeDifference;
        const killDifference = Number(b.kills ?? 0) - Number(a.kills ?? 0);
        if (killDifference !== 0) return killDifference;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 20);

    const players = await Promise.all(visibleResults.map(async (result: any) => {
      const { data: registration } = await dataClient().from("registrations").select("user_id").eq("id", result.registration_id).maybeSingle();
      const { data: user } = registration ? await dataClient().from("users").select("*").eq("id", registration.user_id).maybeSingle() : { data: null };
      const { data: tournament } = await dataClient().from("tournaments").select("name").eq("id", result.tournament_id).maybeSingle();
      return { ...camel(user), tournamentName: tournament?.name, ...camel(result) };
    }));
    res.json(players);
  } catch (err) {
    req.log.error({ err }, "Best player error");
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/best-player/:id", auth, hostOnly, async (req: any, res) => {
  try {
    const resultId = Number(req.params.id);
    if (!Number.isInteger(resultId) || resultId <= 0) {
      res.status(400).json({ message: "A valid result id is required" });
      return;
    }
    const { data: result, error: resultError } = await dataClient()
      .from("match_results").select("id").eq("id", resultId).maybeSingle();
    if (resultError) throw resultError;
    if (!result) {
      res.status(404).json({ message: "Best player result not found" });
      return;
    }
    const { data: existing, error: existingError } = await dataClient()
      .from("best_player_exclusions").select("id").eq("result_id", resultId).maybeSingle();
    if (existingError) throw existingError;
    if (!existing) {
      const { error } = await dataClient().from("best_player_exclusions").insert({
        result_id: resultId,
        removed_by: req.userId,
      });
      if (error) throw error;
    }
    res.json({ ok: true, resultId });
  } catch (err) {
    req.log.error({ err }, "Remove best player error");
    res.status(500).json({ message: "Unable to remove this best player right now" });
  }
});

router.post("/fair-play", auth, async (req: any, res) => {
  try {
    const { data: user, error } = await dataClient().from("users").select("*").eq("id", req.userId).maybeSingle();
    if (error) throw error;
    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    const lastClaim = user.last_fair_play_at ? new Date(user.last_fair_play_at) : null;
    const daysSince = lastClaim ? Math.floor((Date.now() - lastClaim.getTime()) / 86400000) : 999;
    if (daysSince < 7) { res.status(400).json({ message: `Already claimed ${daysSince}d ago. Wait ${7 - daysSince} more days.` }); return; }
    if (user.toxic_report_count > 0) { res.status(400).json({ message: "Fair Play Bonus blocked due to toxic reports." }); return; }
    const { data: updated, error: updateError } = await dataClient().from("users").update({
      points: (user.points || 0) + 20, weekly_fair_play: (user.weekly_fair_play || 0) + 20, last_fair_play_at: new Date(),
    }).eq("id", req.userId).select("*").single();
    if (updateError) throw updateError;
    res.json({ points: updated.points, weeklyFairPlay: updated.weekly_fair_play, bonus: 20, nextClaimInDays: 7, toxicReportCount: updated.toxic_report_count });
  } catch (err) {
    req.log.error({ err }, "Fair play bonus error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/toxic-report", auth, hostOnly, async (req, res) => {
  try {
    const { data: user } = await dataClient().from("users").select("toxic_report_count").eq("id", req.body.userId).maybeSingle();
    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    const { data, error } = await dataClient().from("users").update({ toxic_report_count: (user.toxic_report_count || 0) + 1 }).eq("id", req.body.userId).select("toxic_report_count").single();
    if (error) throw error;
    res.json({ message: "Reported", toxicReportCount: data.toxic_report_count });
  } catch (err) {
    req.log.error({ err }, "Toxic report error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/clear-toxic", auth, hostOnly, async (req, res) => {
  try {
    const { error } = await dataClient().from("users").update({ toxic_report_count: 0 }).eq("id", req.body.userId);
    if (error) throw error;
    res.json({ message: "Toxic reports cleared" });
  } catch (err) {
    req.log.error({ err }, "Clear toxic error");
    res.status(500).json({ message: "Server error" });
  }
});

export const historyRouter = Router();
historyRouter.use(auth);
historyRouter.get("/", async (req: any, res) => {
  try {
    const { data, error } = await dataClient().from("history").select("*").eq("user_id", req.userId).order("created_at", { ascending: false });
    if (error) throw error;
    res.json(camels(data));
  } catch (err) {
    req.log.error({ err }, "Get history error");
    res.status(500).json({ message: "Server error" });
  }
});
historyRouter.delete("/", async (req: any, res) => {
  const { error } = await dataClient().from("history").delete().eq("user_id", req.userId);
  if (error) { req.log.error({ err: error }, "Delete history error"); res.status(500).json({ message: "Server error" }); return; }
  res.json({ message: "History cleared" });
});
historyRouter.delete("/:id", async (req: any, res) => {
  const { error } = await dataClient().from("history").delete().eq("id", Number(req.params.id)).eq("user_id", req.userId);
  if (error) { req.log.error({ err: error }, "Delete history entry error"); res.status(500).json({ message: "Server error" }); return; }
  res.json({ message: "History entry deleted" });
});

export default router;