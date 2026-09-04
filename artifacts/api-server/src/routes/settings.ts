import { Router } from "express";
import { getAuthMiddleware, getHostMiddleware } from "./auth";
import { dataClient } from "../lib/data";

const router = Router();
const auth = getAuthMiddleware();
const hostOnly = getHostMiddleware();

const DEFAULTS = {
  app_name: "ELITE FF",
  app_logo_url: "/Elite_1777629983897.png",
};

async function readBranding() {
  const { data, error } = await dataClient()
    .from("app_settings")
    .select("*")
    .in("key", Object.keys(DEFAULTS));
  if (error) throw error;
  const values = Object.fromEntries((data ?? []).map((row: any) => [row.key, row.value]));
  return {
    name: values.app_name || DEFAULTS.app_name,
    logoUrl: values.app_logo_url || DEFAULTS.app_logo_url,
  };
}

router.get("/public", async (req, res) => {
  try {
    res.json(await readBranding());
  } catch (err) {
    req.log.error({ err }, "Get public settings error");
    // Branding should never prevent the rest of the application from loading.
    res.json({ name: DEFAULTS.app_name, logoUrl: DEFAULTS.app_logo_url });
  }
});

router.put("/branding", auth, hostOnly, async (req: any, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const logoUrl = String(req.body?.logoUrl ?? "").trim();
    if (name.length < 1 || name.length > 60) {
      res.status(400).json({ message: "App name must be between 1 and 60 characters." });
      return;
    }
    if (
      logoUrl.length > 2_000_000 ||
      (!logoUrl.startsWith("data:image/") && !/^https?:\/\//i.test(logoUrl) && !logoUrl.startsWith("/"))
    ) {
      res.status(400).json({ message: "Please provide a valid image." });
      return;
    }

    for (const [key, value] of [["app_name", name], ["app_logo_url", logoUrl]] as const) {
      const existing = await dataClient().from("app_settings").select("*").eq("key", key).maybeSingle();
      if (existing.error) throw existing.error;
      const result = existing.data
        ? await dataClient().from("app_settings").update({ value, updated_at: new Date() }).eq("key", key)
        : await dataClient().from("app_settings").insert({ key, value, updated_at: new Date() });
      if (result.error) throw result.error;
    }
    res.json({ name, logoUrl });
  } catch (err) {
    req.log.error({ err }, "Save branding error");
    res.status(500).json({ message: "Unable to save shared branding. Apply the app settings database migration and try again." });
  }
});

export default router;