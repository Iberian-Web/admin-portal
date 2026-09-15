import React, { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthContext, type AuthStatus } from "./authTypes";

const BASE = import.meta.env.VITE_API_URL ?? "";

// Cualquier fallo (sesión caducada, red, etc.) se trata igual: no
// autenticado — nunca se propaga como error de la query.
async function checkSession(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/auth/me`, { credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

const AUTH_QUERY_KEY = ["auth", "session"];

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();

  // La sesión solo cambia por un login/logout explícito (ver más abajo), no
  // por un refetch en segundo plano — de ahí el staleTime infinito. Al ser
  // una query, React Query ya deduplica la petición inicial en StrictMode
  // sin necesitar el useRef "initDone" que hacía falta antes.
  const { data: authenticated = false, isLoading } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: checkSession,
    retry: false,
    staleTime: Infinity,
  });

  const status: AuthStatus = isLoading
    ? "loading"
    : authenticated
      ? "authenticated"
      : "unauthenticated";

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

      queryClient.setQueryData(AUTH_QUERY_KEY, true);
    },
    [queryClient],
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
      queryClient.setQueryData(AUTH_QUERY_KEY, false);
    }
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        status,
        isLoading,
        isAuthenticated: authenticated,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
