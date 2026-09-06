import React, { useState, useEffect, useCallback, useRef } from "react";
import { AuthContext, type AuthStatus } from "./authTypes";

const BASE = import.meta.env.VITE_API_URL ?? "";

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [status, setStatus] = useState<AuthStatus>("loading");

  // Prevent double-fetching in StrictMode
  const initDone = useRef(false);

  // ── Helpers ──

  const clearAuth = useCallback(() => {
    setStatus("unauthenticated");
  }, []);

  // ── Bootstrap: restore session from cookie (the browser sends it automatically) ──

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    fetch(`${BASE}/api/auth/me`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Session expired");
        setStatus("authenticated");
      })
      .catch(() => {
        clearAuth();
      });
  }, [clearAuth]);

  // ── Actions ──

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Login failed");
      }

      setStatus("authenticated");
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch(`${BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Best-effort — always clear local state
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  // ── Value ──

  return (
    <AuthContext.Provider
      value={{
        status,
        isLoading: status === "loading",
        isAuthenticated: status === "authenticated",
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
