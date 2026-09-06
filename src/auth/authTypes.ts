import { createContext } from "react";

// ─── Auth-specific types (React only) ─────────────────────────────────────────

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthContextType = {
  status: AuthStatus;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

// ─── Context ──────────────────────────────────────────────────────────────────

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
