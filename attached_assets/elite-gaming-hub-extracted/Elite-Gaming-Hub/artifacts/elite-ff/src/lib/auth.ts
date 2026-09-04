export interface UserData {
  id: number;
  username: string;
  email?: string | null;
  mobile: string;
  role: string;
  profilePic?: string | null;
  createdAt: string;
}

export interface Account {
  token: string;
  user: UserData;
}

const TOKEN_KEY = "eliteff_token";
const USER_KEY = "eliteff_user";
const ACCOUNTS_KEY = "eliteff_accounts";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): UserData | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserData;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: UserData): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  const accounts = getAccounts();
  const existing = accounts.findIndex((a) => a.user.id === user.id);
  if (existing >= 0) {
    accounts[existing] = { token, user };
  } else {
    accounts.push({ token, user });
  }
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAccounts(): Account[] {
  const raw = localStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Account[];
  } catch {
    return [];
  }
}

export function removeAccount(userId: number): void {
  const accounts = getAccounts().filter((a) => a.user.id !== userId);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function isHumanVerified(): boolean {
  return localStorage.getItem("hv_done") === "true";
}

export function setHumanVerified(): void {
  localStorage.setItem("hv_done", "true");
}

export function isPwaInstalled(): boolean {
  return localStorage.getItem("pwa_installed") === "true";
}

export function setPwaInstalled(): void {
  localStorage.setItem("pwa_installed", "true");
}
