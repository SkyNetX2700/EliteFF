import { Router } from "express";
import { randomUUID } from "node:crypto";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const objectStorage = new ObjectStorageService();
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "payment-screenshots";

function supabaseStorageConfig(req: any) {
  // Vercel does not provide Replit's object-storage sidecar. Use the
  // authenticated Supabase Storage API there instead.
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  const authorization = req.headers.authorization;
  if (!url || !key || typeof authorization !== "string") return null;
  return { url: url.replace(/\/+$/, ""), key, authorization };
}

router.post("/storage/uploads/request-url", async (req: any, res) => {
  // authMiddleware runs before the API router and maps the Supabase bearer
  // token to the existing database user.
  if (!req.userId || !req.isAuthenticated?.()) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const { name, size, contentType } = req.body ?? {};
  if (
    typeof name !== "string" ||
    typeof size !== "number" ||
    !Number.isFinite(size) ||
    size <= 0 ||
    size > MAX_IMAGE_BYTES ||
    typeof contentType !== "string" ||
    !contentType.startsWith("image/")
  ) {
    res.status(400).json({ message: "Only image files up to 10MB are supported" });
    return;
  }

  try {
    const supabase = supabaseStorageConfig(req);
    if (supabase) {
      const extension = (name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const owner = String(req.supabaseUserId || req.userId);
      const objectName = `${owner}/${randomUUID()}.${extension}`;
      const encodedObjectName = objectName.split("/").map(encodeURIComponent).join("/");
      const uploadURL = `${supabase.url}/storage/v1/object/${encodeURIComponent(SUPABASE_BUCKET)}/${encodedObjectName}`;
      const publicURL = `${supabase.url}/storage/v1/object/public/${encodeURIComponent(SUPABASE_BUCKET)}/${encodedObjectName}`;
      res.json({
        uploadURL,
        uploadMethod: "POST",
        uploadHeaders: {
          apikey: supabase.key,
          Authorization: supabase.authorization,
          "x-upsert": "false",
        },
        objectPath: publicURL,
        metadata: { name, size, contentType },
      });
      return;
    }
    if (!process.env.PRIVATE_OBJECT_DIR?.trim()) {
      res.status(503).json({
        message: "Payment screenshot storage is not configured. Apply the Supabase storage migration before uploading screenshots.",
      });
      return;
    }
    const result = await objectStorage.createUploadUrl();
    res.json({ ...result, metadata: { name, size, contentType } });
  } catch (err) {
    req.log.error({ err }, "Request upload URL error");
    res.status(500).json({ message: "Unable to prepare image upload" });
  }
});

export default router;