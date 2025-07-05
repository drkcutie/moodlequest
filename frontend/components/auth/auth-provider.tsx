"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import toast from "react-hot-toast";

export interface User {
  id: number;
  username: string;
  name?: string;
  email?: string;
  role: string;
  token?: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Check for existing auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);

        // Check for stored user in cookie
        const response = await fetch("/api/auth/check", {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setUser(data.user);
          } else {
            setUser(null);
            // If on protected route, redirect to login
            if (isProtectedRoute(pathname)) {
              router.push("/login");
            }
          }
        } else {
          setUser(null);
          // If on protected route, redirect to login
          if (isProtectedRoute(pathname)) {
            router.push("/login");
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  const login = async (
    username: string,
    password: string
  ): Promise<boolean> => {
    try {
      setLoading(true);

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);

        toast.success(`Welcome back, ${data.user.name || data.user.username}!`);

        return true;
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Invalid username or password");

        return false;
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("An error occurred during login");

      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);

      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      setUser(null);
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUserData = async () => {
    if (!user) return;

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error("User refresh error:", error);
    }
  };

  // Helper function to check if route should be protected
  const isProtectedRoute = (path: string) => {
    // Add all paths that should not require auth
    const publicPaths = [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
    ];
    return !publicPaths.some((pp) => path.startsWith(pp));
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, refreshUserData }}
    >
      {children}
    </AuthContext.Provider>
  );
}
