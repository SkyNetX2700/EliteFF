import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";

const HOST_EMAILS = new Set(["venomx2424@gmail.com", "knightxvenom@gmail.com"]);

interface SupabaseAuthUser {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}

async function getSupabaseUser(accessToken: string): Promise<SupabaseAuthUser | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) return null;
  return await response.json() as SupabaseAuthUser;
}

async function getOrCreateUser(supabaseUser: SupabaseAuthUser): Promise<typeof usersTable.$inferSelect> {
  const supabaseUserId = supabaseUser.id;
  const email = supabaseUser.email ?? null;
  const normalizedEmail = email?.trim().toLowerCase() ?? null;
  const metadata = supabaseUser.user_metadata ?? {};
  const metadataName = typeof metadata.full_name === "string"
    ? metadata.full_name.trim()
    : typeof metadata.name === "string"
    ? metadata.name.trim()
    : typeof metadata.username === "string"
    ? metadata.username.trim()
    : null;
  const metadataAvatar = typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;
  const isHost = normalizedEmail ? HOST_EMAILS.has(normalizedEmail) : false;
  const [existing] = await db.select().from(usersTable)
    .where(email ? or(eq(usersTable.mobile, supabaseUserId), eq(usersTable.email, email)) : eq(usersTable.mobile, supabaseUserId))
    .limit(1);
  if (existing) {
    const updates: Record<string, unknown> = {};
    if (existing.mobile !== supabaseUserId) updates.mobile = supabaseUserId;
    if (existing.loginMethod !== "supabase") updates.loginMethod = "supabase";
    if (email && existing.email !== email) updates.email = email;
    if (isHost && existing.role !== "host") updates.role = "host";
    if (metadataName && existing.username !== metadataName) updates.username = metadataName;
    if (metadataAvatar && existing.profilePic !== metadataAvatar) updates.profilePic = metadataAvatar;
    if (Object.keys(updates).length > 0) {
      const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, existing.id)).returning();
      return updated ?? existing;
    }
    return existing;
  }

  const username = metadataName || email?.split("@")[0] || `user_${supabaseUserId.slice(0, 8)}`;

  const [user] = await db.insert(usersTable).values({
    username,
    email,
    mobile: supabaseUserId,
    passwordHash: "$supabase$",
    role: isHost ? "host" : "player",
    loginMethod: "supabase",
    profilePic: metadataAvatar,
  }).returning();
  return user;
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!accessToken) {
    (req as any).isAuthenticated = () => false;
    return next();
  }

  try {
    const supabaseUser = await getSupabaseUser(accessToken);
    if (!supabaseUser) {
      (req as any).isAuthenticated = () => false;
      return next();
    }
    const user = await getOrCreateUser(supabaseUser);
    (req as any).userId = user.id;
    (req as any).supabaseUserId = supabaseUser.id;
    (req as any).userRole = user.role;
    (req as any).userEmail = user.email;
    (req as any).isAuthenticated = () => true;
    (req as any).user = user;
    next();
  } catch (err) {
    (req as any).log?.error({ err }, "Auth middleware error");
    (req as any).isAuthenticated = () => false;
    next();
  }
}