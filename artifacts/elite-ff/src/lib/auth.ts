const SESSION_KEY = "eliteff_supabase_session";

export interface SupabaseUser {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: SupabaseUser;
}

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL
) as string | undefined;
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY
) as string | undefined;

let activeSession: SupabaseSession | null = null;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function setAccessToken(token: string | null) {
  if (!activeSession) return;
  activeSession = token ? { ...activeSession, access_token: token } : null;
}

export async function getToken(): Promise<string | null> {
  return activeSession?.access_token ?? null;
}

export async function apiFetch(input: RequestInfo | URL, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (activeSession?.access_token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${activeSession.access_token}`);
  }
  return fetch(input, { ...options, headers });
}

function saveSession(session: SupabaseSession | null) {
  activeSession = session;
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // A blocked localStorage should not prevent the auth request from completing.
  }
}

function readStoredSession(): SupabaseSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as SupabaseSession : null;
  } catch {
    return null;
  }
}

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.msg === "string") return record.msg;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error_description === "string") return record.error_description;
  }
  return fallback;
}

async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase Authentication is not configured yet.");
  }

  const headers = new Headers(options.headers);
  headers.set("apikey", supabaseAnonKey!);
  headers.set("Content-Type", "application/json");
  if (activeSession?.access_token) {
    headers.set("Authorization", `Bearer ${activeSession.access_token}`);
  }

  const response = await fetch(`${supabaseUrl}/auth/v1${path}`, { ...options, headers });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(getErrorMessage(body, "Supabase Authentication request failed."));
  }
  return body as T;
}

export async function hydrateCurrentSessionUser(): Promise<SupabaseUser | null> {
  if (!activeSession?.access_token) return null;
  try {
    const user = await authRequest<SupabaseUser>("/user");
    saveSession({ ...activeSession, user });
    return user;
  } catch {
    return null;
  }
}

export async function loadSession(): Promise<SupabaseSession | null> {
  const stored = readStoredSession();
  if (!stored) return null;

  activeSession = stored;
  const expiresAt = stored.expires_at ?? 0;
  if (expiresAt > Math.floor(Date.now() / 1000) + 60) {
    await hydrateCurrentSessionUser();
    return activeSession;
  }

  try {
    const refreshed = await refreshSession(stored.refresh_token);
    return refreshed;
  } catch {
    saveSession(null);
    return null;
  }
}

export function subscribeToAuthChanges(listener: (session: SupabaseSession | null) => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== SESSION_KEY) return;
    const nextSession = event.newValue ? JSON.parse(event.newValue) as SupabaseSession : null;
    activeSession = nextSession;
    listener(nextSession);
  };
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

export async function refreshCurrentSession() {
  if (!activeSession?.refresh_token) return activeSession;
  return refreshSession(activeSession.refresh_token);
}

export async function signInWithPassword(email: string, password: string) {
  const session = await authRequest<SupabaseSession>("/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  saveSession({
    ...session,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
  });
  return activeSession;
}

export async function signUpWithPassword(email: string, password: string, username: string) {
  const result = await authRequest<SupabaseSession | { user: SupabaseUser; session: null }>("/signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      data: { username, full_name: username },
    }),
  });
  if ("access_token" in result) {
    saveSession({
      ...result,
      expires_at: result.expires_at ?? Math.floor(Date.now() / 1000) + (result.expires_in ?? 3600),
    });
  }
  return result;
}

export async function refreshSession(refreshToken: string) {
  const previous = activeSession;
  activeSession = previous ? { ...previous, refresh_token: refreshToken } : null;
  const session = await authRequest<SupabaseSession>("/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  saveSession({
    ...session,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
  });
  return activeSession;
}

export async function signOut() {
  try {
    if (activeSession) await authRequest("/logout", { method: "POST" });
  } finally {
    saveSession(null);
  }
}

export function getGoogleOAuthUrl(basePath: string) {
  if (!isSupabaseConfigured()) return null;
  const redirectTo = `${window.location.origin}${basePath || "/"}`;
  return `${supabaseUrl}/auth/v1/authorize?provider=google&flow_type=implicit&redirect_to=${encodeURIComponent(redirectTo)}`;
}

export function consumeOAuthCallback() {
  if (!window.location.hash.includes("access_token=")) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  const session: SupabaseSession = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: params.get("token_type") ?? "bearer",
    expires_in: Number(params.get("expires_in") ?? 3600),
    expires_at: Math.floor(Date.now() / 1000) + Number(params.get("expires_in") ?? 3600),
    user: { id: params.get("user_id") ?? "" },
  };
  saveSession(session);
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  return session;
}
