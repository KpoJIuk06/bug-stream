import { saveLocale, t } from "./i18n";
import type { Settings } from "./types";

/**
 * Extension settings and HTTP client.
 * Server address = the Bug Stream site address (e.g. https://bugs.example.com); API = the same address + /api.
 */

/** Set at build time (build.mjs, the BUGSTREAM_SERVER variable). */
declare const __DEFAULT_SERVER__: string;
export const DEFAULT_SERVER = __DEFAULT_SERVER__;

const DEFAULTS: Settings = { server: DEFAULT_SERVER, accessToken: null, refreshToken: null, user: null };

export async function getSettings(): Promise<Settings> {
  const s = (await chrome.storage.local.get(DEFAULTS as unknown as Record<string, unknown>)) as unknown as Settings;
  const own = await chrome.storage.local.get("server");
  if (!own.server) {
    // Server address set by an administrator through group policy (docs/deploy.md)
    const managed = await chrome.storage.managed.get("server").catch(() => ({}) as Record<string, unknown>);
    if (typeof managed.server === "string" && managed.server.trim()) s.server = normalizeServer(managed.server);
  }
  return s;
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(patch);
}

export function normalizeServer(raw: string): string {
  let s = raw.trim().replace(/\/+$/, "");
  // without a scheme: IP and localhost — http, a name (subdomain) — https
  if (s && !/^https?:\/\//i.test(s)) s = (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(s) ? "http://" : "https://") + s;
  return s;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let body: { code?: string; detail?: string } = {};
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  return new ApiError(res.status, body.code, body.detail ?? `HTTP ${res.status}`);
}

export async function login(server: string, email: string, password: string): Promise<Settings> {
  const res = await fetch(`${server}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: email, password, client: "EXTENSION" }),
  });
  if (!res.ok) throw await parseError(res);
  const tokens = await res.json();
  const s: Settings = { server, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: tokens.user };
  await saveSettings(s);
  await saveLocale(tokens.user?.locale);
  return s;
}

/** Sign-in methods the server offers (public). Old servers without the fields → password only. */
export interface AuthConfig {
  password: boolean;
  passwordReset: boolean;
  ldap: boolean;
  emailCode: boolean;
}

export async function authConfig(server: string): Promise<AuthConfig> {
  const res = await fetch(`${server}/api/auth/config`);
  if (!res.ok) throw await parseError(res);
  const c = await res.json();
  if (c.password === undefined) return { password: true, passwordReset: false, ldap: !!c.ldapEnabled, emailCode: false };
  return c as AuthConfig;
}

/** "Sign in with an e-mail code", step 1: the server e-mails a 6-digit code (always 204). */
export async function requestEmailCode(server: string, email: string, locale: string): Promise<void> {
  const res = await fetch(`${server}/api/auth/email-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, locale }),
  });
  if (!res.ok) throw await parseError(res);
}

/** Step 2: the code → tokens, saved like a normal sign-in. */
export async function loginWithCode(server: string, email: string, code: string): Promise<Settings> {
  const res = await fetch(`${server}/api/auth/email-code/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, client: "EXTENSION" }),
  });
  if (!res.ok) throw await parseError(res);
  const tokens = await res.json();
  const s: Settings = { server, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: tokens.user };
  await saveSettings(s);
  await saveLocale(tokens.user?.locale);
  return s;
}

export async function logout(): Promise<void> {
  const s = await getSettings();
  if (s.refreshToken) {
    await fetch(`${s.server}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: s.refreshToken }),
    }).catch(() => {});
  }
  await saveSettings({ accessToken: null, refreshToken: null, user: null });
}

let refreshing: Promise<boolean> | null = null;

async function refresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const s = await getSettings();
    if (!s.refreshToken) return false;
    try {
      const res = await fetch(`${s.server}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: s.refreshToken }),
      });
      if (!res.ok) {
        await saveSettings({ accessToken: null, refreshToken: null, user: null });
        return false;
      }
      const tokens = await res.json();
      await saveSettings({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: tokens.user });
      await saveLocale(tokens.user?.locale);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** API request with the token; on 401 refreshes the tokens once. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = async () => {
    const s = await getSettings();
    const headers = new Headers(init.headers);
    if (s.accessToken) headers.set("Authorization", `Bearer ${s.accessToken}`);
    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return fetch(`${s.server}${path}`, { ...init, headers });
  };
  let res = await send();
  if (res.status === 401 && (await refresh())) res = await send();
  if (!res.ok) throw await parseError(res);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Makes sure the token is fresh (before a long XHR upload). */
export async function ensureFreshToken(): Promise<string | null> {
  try {
    await api("/api/auth/me");
  } catch {
    /* refresh was already tried inside api() */
  }
  return (await getSettings()).accessToken;
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "BAD_CREDENTIALS") return t("Wrong login or password");
    if (e.code === "USER_DISABLED") return t("Your account is disabled — contact an administrator");
    if (e.code === "NO_ACCESS") return t("You are not in a group that has access to Bug Stream");
    if (e.code === "LDAP_UNAVAILABLE") return t("The corporate directory is not available, try again later");
    if (e.code === "INVALID_CODE") return t("The code is wrong or has expired — request a new one");
    if (e.code === "METHOD_DISABLED") return t("This sign-in method is turned off");
    if (e.code === "TOO_MANY_REQUESTS") return t("Too many attempts — wait a few minutes and try again");
    if (e.code === "INVALID_EMAIL") return t("Enter a valid e-mail address");
    if (e.status === 401) return t("Your session has expired — sign in again");
    if (e.status >= 500 && !e.code?.startsWith("JIRA")) return t("Server error. Try again.");
    return e.message;
  }
  if (e instanceof TypeError) return t("The server is unreachable. Check the address and that you are in the corporate network.");
  return String(e);
}

export interface ResolveResult {
  matched: boolean;
  projectId: string | null;
  serviceId: string | null;
  projectKey: string | null;
  serviceName: string | null;
  environment: string | null;
  networkIgnore: string[];
  /** Linked Jira project; null — the report cannot be sent to Jira. */
  jiraProjectKey: string | null;
}

export interface EnvironmentInfo {
  code: string;
  name: string;
  color: string;
  active: boolean;
}

/** Environments managed in the admin panel (active ones). */
export async function environments(): Promise<EnvironmentInfo[]> {
  return api<EnvironmentInfo[]>("/api/environments").catch(() => []);
}

export interface MyJira {
  configured: boolean;
  connected: boolean;
  invalid: boolean;
}

/** Project by page URL (and its network filter). Not signed in or no answer in 3 s — null. */
export async function resolveProject(url: string): Promise<ResolveResult | null> {
  const s = await getSettings();
  if (!s.refreshToken) return null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
  const request = api<ResolveResult>(`/api/projects/resolve?url=${encodeURIComponent(url)}`).catch(() => null);
  return Promise.race([request, timeout]);
}
