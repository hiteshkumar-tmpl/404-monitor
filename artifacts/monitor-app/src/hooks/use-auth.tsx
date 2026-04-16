import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLogin,
  useLogout,
  useSignup,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import type { AuthUser } from "@workspace/api-client-react";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const loginMutation = useLogin();
  const signupMutation = useSignup();
  const logoutMutation = useLogout();

  const { data, isLoading: isQueryLoading, error } = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      retry: false,
      refetchOnWindowFocus: false,
    },
  });

  useEffect(() => {
    if (data) {
      setUser(data);
    } else if (error) {
      setUser(null);
    }
    setIsLoading(isQueryLoading);
  }, [data, isQueryLoading, error]);

  const login = async (email: string, password: string) => {
    const result = await loginMutation.mutateAsync({
      data: { email, password },
    });
    setUser(result);
    queryClient.invalidateQueries({ queryKey: ["getWebsites"] });
    queryClient.invalidateQueries({ queryKey: ["getDashboardSummary"] });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
    setUser(null);
    queryClient.clear();
  };

  const signup = async (name: string, email: string, password: string) => {
    const result = await signupMutation.mutateAsync({
      data: { name, email, password },
    });
    setUser(result);
    queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["getWebsites"] });
    queryClient.invalidateQueries({ queryKey: ["getDashboardSummary"] });
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
