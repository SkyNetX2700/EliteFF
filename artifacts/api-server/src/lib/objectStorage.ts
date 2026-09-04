import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
  }
}

export class ObjectStorageService {
  private getPrivateObjectDir() {
    const dir = process.env.PRIVATE_OBJECT_DIR?.trim();
    if (!dir) throw new Error("PRIVATE_OBJECT_DIR is not configured");
    return dir.replace(/\/+$/, "");
  }

  async createUploadUrl() {
    const privateDir = this.getPrivateObjectDir();
    const objectName = `uploads/${randomUUID()}`;
    const { bucketName, objectName: storageObjectName } = parseObjectPath(`${privateDir}/${objectName}`);
    const uploadURL = await signObjectURL({
      bucketName,
      objectName: storageObjectName,
      method: "PUT",
      ttlSec: 900,
    });

    return {
      uploadURL,
      objectPath: `/objects/${objectName}`,
    };
  }

  async createDownloadUrl(objectPath: string) {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const privateDir = this.getPrivateObjectDir();
    const entityName = objectPath.slice("/objects/".length);
    if (!entityName || entityName.includes("..")) throw new ObjectNotFoundError();

    const { bucketName, objectName } = parseObjectPath(`${privateDir}/${entityName}`);
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFoundError();

    return signObjectURL({
      bucketName,
      objectName,
      method: "GET",
      ttlSec: 900,
    });
  }
}

function parseObjectPath(rawPath: string) {
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const parts = path.split("/");
  if (parts.length < 3 || !parts[1] || !parts.slice(2).join("/")) {
    throw new Error("Invalid object storage path");
  }
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT";
  ttlSec: number;
}) {
  const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to sign object URL (${response.status})`);
  }
  const body = await response.json() as { signed_url?: string };
  if (!body.signed_url) throw new Error("Object storage did not return a signed URL");
  return body.signed_url;
}