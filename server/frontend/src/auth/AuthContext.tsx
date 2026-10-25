import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { configureAuth, hasSession, login as apiLogin, logout as apiLogout, refreshTokens, request } from "../api/client";
import type { User } from "../api/types";
import { useI18n } from "../i18n";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** The signed-in user's role has this permission (see V10 migration for the list). */
  can: (permission: string) => boolean;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();
  const { locale, setLocale } = useI18n();

  // the interface language follows the user's saved choice
  const setUser = useCallback(
    (u: User | null) => {
      setUserState((prev) => {
        // keep permissions when a response without them (e.g. a list item) replaces the user
        if (u && !u.permissions && prev?.id === u.id) return { ...u, permissions: prev.permissions };
        return u;
      });
      if (u?.locale && u.locale !== locale) setLocale(u.locale);
    },
    [locale, setLocale],
  );

  useEffect(() => {
    configureAuth({
      onUser: setUser,
      onLogout: () => {
        setUserState(null);
        qc.clear();
      },
    });
  }, [qc, setUser]);

  useEffect(() => {
    // restore the session after a page reload
    (async () => {
      if (hasSession() && (await refreshTokens())) {
        try {
          setUser(await request<User>("/api/auth/me"));
        } catch {
          setUserState(null);
        }
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (loginName: string, password: string) => {
      setUser(await apiLogin(loginName, password));
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setUserState(null);
    qc.clear();
  }, [qc]);

  const can = useCallback((permission: string) => !!user?.permissions?.includes(permission), [user]);

  const value = useMemo(
    () => ({ user, ready, login, logout, can, setUser: (u: User) => setUser(u) }),
    [user, ready, login, logout, can, setUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
