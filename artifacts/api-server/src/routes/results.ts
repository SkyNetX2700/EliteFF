import { Router } from "express";
import { getAuthMiddleware, getHostMiddleware } from "./auth";
import { dataClient, camel, camels } from "../lib/data";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const auth = getAuthMiddleware();
const hostOnly = getHostMiddleware();
const objectStorage = new ObjectStorageService();

async function serializeResult(raw: any) {
  const row = camel(raw);
  if (typeof row.screenshotUrl === "string" && row.screenshotUrl.startsWith("/objects/")) {
    row.screenshotUrl = await objectStorage.createDownloadUrl(row.screenshotUrl);
  }
  if (typeof row.paymentScreenshotUrl === "string" && row.paymentScreenshotUrl.startsWith("/objects/")) {
    row.paymentScreenshotUrl = await objectStorage.createDownloadUrl(row.paymentScreenshotUrl);
  }
  return row;
}

router.get("/", async (req: any, res) => {
  try {
    const { tournamentId, registrationId, mine } = req.query as Record<string, string>;
    let query = dataClient().from("match_results").select("*").order("created_at", { ascending: false });
    if (tournamentId) query = query.eq("tournament_id", Number(tournamentId));
    if (registrationId) query = query.eq("registration_id", Number(registrationId));
    if (mine === "true" && req.userId) {
      const { data: registrations, error: registrationsError } = await dataClient()
        .from("registrations").select("id").eq("user_id", req.userId);
      if (registrationsError) throw registrationsError;
      const ids = (registrations ?? []).map((row: any) => row.id);
      if (!ids.length) { res.json([]); return; }
      query = query.in("registration_id", ids);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(await Promise.all((data ?? []).map(serializeResult)));
  } catch (err) {
    req.log.error({ err }, "Get results error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", auth, hostOnly, async (req: any, res) => {
  try {
    const body = req.body;
    const payload = {
      tournament_id: body.tournamentId, registration_id: body.registrationId, match_number: body.matchNumber ?? 1,
      squad_name: body.squadName, placement: body.placement || null, outcome: body.outcome || null,
      kills: body.kills || null, prize: body.prize || null, prize_type: body.prizeType || null,
      screenshot_url: body.screenshotUrl || null, payment_screenshot_url: body.paymentScreenshotUrl || null,
      utr_number: body.utrNumber || null, description: body.description || null,
    };
    const existing = await dataClient().from("match_results").select("*")
      .eq("tournament_id", body.tournamentId)
      .eq("registration_id", body.registrationId)
      .eq("match_number", body.matchNumber ?? 1)
      .maybeSingle();
    if (existing.error) throw existing.error;
    const result = existing.data
      ? await dataClient().from("match_results").update(payload).eq("id", existing.data.id).select("*").single()
      : await dataClient().from("match_results").insert(payload).select("*").single();
    if (result.error) throw result.error;

    const wasCreated = !existing.data;
    const { data: registration } = await dataClient().from("registrations").select("user_id").eq("id", body.registrationId).maybeSingle();
    if (registration) {
      const { data: user } = await dataClient().from("users").select("*").eq("id", registration.user_id).maybeSingle();
      if (user) {
        const outcome = String(body.outcome || "").toLowerCase();
        const previousOutcome = String(existing.data?.outcome || "").toLowerCase();
        const pointsFor = (value: string) => value === "won" || value === "winner" ? 100 : value === "completed" || value === "top 3" ? 50 : value === "lost" ? 10 : 0;
        const earnedPoints = pointsFor(outcome);
        const previousPoints = pointsFor(previousOutcome);
        const pointsDelta = earnedPoints - previousPoints;
        const prizeAmount = Number(body.prize || 0);
        const previousPrize = Number(existing.data?.prize || 0);
        const earningsDelta = prizeAmount - previousPrize;
        const nextPoints = Number(user.points || 0) + pointsDelta;
        if (pointsDelta !== 0 || earningsDelta !== 0) {
          const { error: updateError } = await dataClient().from("users").update({
            points: nextPoints, rank: nextPoints >= 1700 ? "Apex" : nextPoints >= 1200 ? "Diamond" : nextPoints >= 700 ? "Gold" : "Blaze",
            total_earnings: Number(user.total_earnings || 0) + earningsDelta,
          }).eq("id", user.id);
          if (updateError) throw updateError;
        }
        if (body.outcome && (wasCreated || outcome !== previousOutcome || prizeAmount !== previousPrize || body.placement !== existing.data?.placement)) {
          const isWinner = outcome === "won" || outcome === "winner";
          const isLoser = outcome === "lost";
          const position = body.placement ? `Position #${body.placement}` : "Your result has been posted";
          const title = isWinner ? "Congratulations! You Won" : isLoser ? "Better Luck Next Time" : "Your Tournament Result";
          const message = isWinner
            ? `Congratulations! ${body.squadName} — ${position}. ${prizeAmount > 0 ? `Prize amount ₹${prizeAmount} will be credited within 15 minutes.` : "Great performance!"}`
            : isLoser
            ? `Better luck next time! ${body.squadName} — ${position}. Keep practicing and come back stronger.`
            : `${body.squadName} — ${position}.${prizeAmount > 0 ? ` Prize amount ₹${prizeAmount} will be credited within 15 minutes.` : ""}`;
          const { error: notificationError } = await dataClient().from("notifications").insert({
            user_id: registration.user_id,
            title,
            message,
            type: isWinner ? "matchCompleted" : "custom",
            tournament_id: body.tournamentId,
            registration_id: body.registrationId,
          });
          if (notificationError) throw notificationError;
        }
      }
    }
    res.status(existing.data ? 200 : 201).json(await serializeResult(result));
  } catch (err) {
    req.log.error({ err }, "Create result error");
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", auth, hostOnly, async (req, res) => {
  try {
    const body = req.body;
    const fields: Record<string, string> = {
      placement: "placement", outcome: "outcome", kills: "kills", prize: "prize",
      prizeType: "prize_type", paymentScreenshotUrl: "payment_screenshot_url",
      proofOfRewardUrl: "proof_of_reward_url", utrNumber: "utr_number", description: "description",
    };
    const updates: Record<string, any> = {};
    for (const [from, to] of Object.entries(fields)) if (body[from] !== undefined) updates[to] = body[from];
    const { data, error } = await dataClient().from("match_results").update(updates)
      .eq("id", Number(req.params.id)).select("*").maybeSingle();
    if (error) throw error;
    if (!data) { res.status(404).json({ message: "Result not found" }); return; }
    res.json(camel(data));
  } catch (err) {
    req.log.error({ err }, "Update result error");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;