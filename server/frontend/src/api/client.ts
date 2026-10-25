import { t } from "../i18n";
import type { ApiProblem, TokenResponse, User } from "./types";

/**
 * HTTP client.
 *  - the access token lives in memory, the refresh token in localStorage (survives a page reload);
 *  - on 401 it refreshes the tokens once and repeats the request;
 *  - if refreshing fails it calls onLogout (back to the sign-in page).
 */

const REFRESH_KEY = "bugtrack.refresh";

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onLogout: (() => void) | null = null;
let onUser: ((u: User) => void) | null = null;

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields?: Record<string, string>;

  constructor(p: ApiProblem) {
    super(p.detail ?? `HTTP ${p.status}`);
    this.status = p.status;
    this.code = p.code;
    this.fields = p.fields;
  }
}

export function configureAuth(handlers: { onLogout: () => void; onUser: (u: User) => void }) {
  onLogout = handlers.onLogout;
  onUser = handlers.onUser;
}

function readRefresh(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

function writeRefresh(token: string | null) {
  try {
    if (token) localStorage.setItem(REFRESH_KEY, token);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* private mode — the token stays in memory only */
  }
}

export function hasSession(): boolean {
  return accessToken != null || readRefresh() != null;
}

function applyTokens(t: TokenResponse) {
  accessToken = t.accessToken;
  writeRefresh(t.refreshToken);
  onUser?.(t.user);
}

export async function login(loginName: string, password: string): Promise<User> {
  const tokens = await request<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: { login: loginName, password, client: "WEB" },
    auth: false,
  });
  applyTokens(tokens);
  return tokens.user;
}

/** "Sign in with an e-mail code", step 2. */
export async function loginWithCode(email: string, code: string): Promise<User> {
  const tokens = await request<TokenResponse>("/api/auth/email-code/verify", {
    method: "POST",
    body: { email, code, client: "WEB" },
    auth: false,
  });
  applyTokens(tokens);
  return tokens.user;
}

/** Password from a reset / invitation link; signs the user in. */
export async function setPasswordFromLink(token: string, newPassword: string): Promise<User> {
  const tokens = await request<TokenResponse>("/api/auth/password/reset", {
    method: "POST",
    body: { token, newPassword, client: "WEB" },
    auth: false,
  });
  applyTokens(tokens);
  return tokens.user;
}

export async function logout() {
  const refreshToken = readRefresh();
  accessToken = null;
  writeRefresh(null);
  if (refreshToken) {
    await request("/api/auth/logout", { method: "POST", body: { refreshToken }, auth: false }).catch(() => {});
  }
}

/** Refreshes the tokens. Parallel calls wait for the same request. */
export function refreshTokens(): Promise<boolean> {
  if (refreshing) return refreshing;
  const refreshToken = readRefresh();
  if (!refreshToken) return Promise.resolve(false);
  refreshing = request<TokenResponse>("/api/auth/refresh", {
    method: "POST",
    body: { refreshToken },
    auth: false,
  })
    .then((tokens) => {
      applyTokens(tokens);
      return true;
    })
    .catch(() => {
      accessToken = null;
      writeRefresh(null);
      return false;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, unknown>;
  auth?: boolean;
  raw?: boolean;
}

export function buildQuery(query?: Record<string, unknown>): string {
  if (!query) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
    else p.append(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = true } = opts;

  if (auth && !accessToken && readRefresh()) {
    await refreshTokens();
  }

  const send = () => {
    const headers: Record<string, string> = {};
    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(path + buildQuery(query), { method, headers, body: payload });
  };

  let res = await send();
  if (res.status === 401 && auth) {
    const ok = await refreshTokens();
    if (ok) {
      res = await send();
    } else {
      onLogout?.();
    }
  }

  if (!res.ok) {
    let problem: ApiProblem = { status: res.status };
    try {
      problem = { ...(await res.json()), status: res.status };
    } catch {
      /* body is not JSON */
    }
    throw new ApiError(problem);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** A readable error text for the interface. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const byCode: Record<string, string> = {
      BAD_CREDENTIALS: "Wrong login or password",
      USER_DISABLED: "Your account is disabled — contact an administrator",
      NO_ACCESS: "You are not in a group that has access to Bug Stream",
      LDAP_UNAVAILABLE: "The corporate directory is not available, try again later",
      LDAP_USER: "This account signs in with the corporate directory password",
      EMAIL_TAKEN: "A user with this e-mail already exists",
      USERNAME_TAKEN: "A user with this login already exists",
      PROJECT_KEY_TAKEN: "A project with this key already exists",
      SERVICE_CODE_TAKEN: "The project already has a service with this code",
      PATTERN_EXISTS: "This pattern is already added",
      LAST_OWNER: "A project must keep at least one owner",
      FORBIDDEN: "You do not have permission to do this",
      SELF_LOCKOUT: "You cannot disable yourself or remove your own admin role",
      WRONG_PASSWORD: "The current password is wrong",
      INTEGRATION_EXISTS: "The project already has an integration with this name",
      ROLE_EXISTS: "A role with this code already exists",
      ROLE_IN_USE: "Move the users to another role first",
      SYSTEM_ROLE: "System roles cannot be deleted",
      ENVIRONMENT_EXISTS: "An environment with this code already exists",
      ENVIRONMENT_IN_USE: "The environment is used by services or reports — make it inactive instead",
      LAST_ENVIRONMENT: "At least one environment must stay active",
      INVALID_ENVIRONMENT: "Unknown or inactive environment",
      PASSWORD_REQUIRED: "Password must be at least 8 characters",
      WEAK_PASSWORD: "Password must be at least 8 characters",
      INVALID_CODE: "The code is wrong or has expired — request a new one",
      INVALID_LINK: "The link is invalid or has expired — request a new one.",
      METHOD_DISABLED: "This sign-in method is turned off",
      TOO_MANY_REQUESTS: "Too many attempts — wait a few minutes and try again",
      INVALID_EMAIL: "Enter a valid e-mail address",
      NO_SIGN_IN_METHOD: "At least one sign-in method must stay available",
      MAIL_NOT_CONFIGURED: "E-mail is not configured — set the SMTP server in Administration → E-mail (SMTP)",
    };
    if (e.code && byCode[e.code]) return t(byCode[e.code]);
    if (e.status === 403) return t("You do not have permission to do this");
    // tracker errors (Jira) come with a readable text — shown as is
    if (e.code?.startsWith("TRACKER_") || e.code?.startsWith("JIRA_") || e.code === "MAIL_FAILED") return e.message;
    if (e.fields) return Object.entries(e.fields).map(([f, m]) => `${f}: ${m}`).join("; ");
    if (e.status === 0 || e.status >= 500) return t("The server is unavailable or an error occurred. Try again.");
    return e.message;
  }
  if (e instanceof TypeError) return t("No connection to the server");
  return String(e);
}
