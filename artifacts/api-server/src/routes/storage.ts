import { Router } from "express";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const objectStorage = new ObjectStorageService();
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
    res.status(400).json({ message: "Only image files up to 5MB are supported" });
    return;
  }

  try {
    const result = await objectStorage.createUploadUrl();
    res.json({ ...result, metadata: { name, size, contentType } });
  } catch (err) {
    req.log.error({ err }, "Request upload URL error");
    res.status(500).json({ message: "Unable to prepare image upload" });
  }
});

export default router;