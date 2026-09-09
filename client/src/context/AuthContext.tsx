import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../api/client.js";

interface AuthContextValue {
  authenticated: boolean | null;
  login: (passphrase: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await api.get<{ authenticated: boolean }>("/auth/me");
      setAuthenticated(res.authenticated);
    } catch {
      setAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const login = useCallback(async (passphrase: string) => {
    await api.post("/auth/login", { passphrase });
    setAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setAuthenticated(false);
  }, []);

  return <AuthContext.Provider value={{ authenticated, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
