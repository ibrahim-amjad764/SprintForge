// // context/AuthContext.tsx
// 'use client';
// import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
// import { useRouter } from "next/navigation";

// interface User {
//   id?: number;
//   email: string;
//   name?: string;
// }

// interface AuthContextType {
//   user: User | null;
//   login: (email: string, password: string) => Promise<void>;
//   logout: () => void;
//   register: (email: string, password: string) => Promise<void>;
// }

// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// interface AuthProviderProps {
//   children: ReactNode;
// }

// export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
//   const [user, setUser] = useState<User | null>(null);
//   const router = useRouter();

//   useEffect(() => {
//     const storedUser = localStorage.getItem("user");

//     if (storedUser) {
//       setUser(JSON.parse(storedUser));
//     }
//   }, []);

//   const login = async (email: string, password: string) => {
//     const response = await fetch("/api/auth/login", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ email, password }),
//     });

//     if (!response.ok) {
//       throw new Error("Login failed");
//     }

//     const data = await response.json();

//     setUser(data.user);
//     localStorage.setItem("user", JSON.stringify(data.user));

//     await router.push("/dashboard");
//   };

//   const register = async (email: string, password: string) => {
//     const response = await fetch("/api/auth/register", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ email, password }),
//     });

//     if (!response.ok) {
//       throw new Error("Registration failed");
//     }

//     const data = await response.json();

//     setUser(data.user);
//     localStorage.setItem("user", JSON.stringify(data.user));

//     await router.push("/dashboard");
//   };

//   const logout = () => {
//     setUser(null);
//     localStorage.removeItem("user");
//     router.push("/login");
//   };

//   return (
//     <AuthContext.Provider
//       value={{
//         user,
//         login,
//         logout,
//         register,
//       }}
//     >
//       {children}
//     </AuthContext.Provider>
//   );
// };

// /**
//  * Custom hook for using AuthContext safely.
//  */
// export const useAuth = (): AuthContextType => {
//   const context = useContext(AuthContext);

//   if (context === undefined) {
//     throw new Error("useAuth must be used within an AuthProvider");
//   }

//   return context;
// };

// export default AuthContext;

"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@/types/user";
import { apiRequest } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);
  async function loadUser() {
    try {
      const response = await apiRequest("/api/auth/me");
      setUser(response.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function refreshUser() {
    setLoading(true);
    await loadUser();
  }
  useEffect(() => {
    loadUser();
  }, []);

  async function logout() {
    try {
      // Clear user state immediately
      setUser(null);
      
      // Call logout API to invalidate server session
      await apiRequest("/api/auth/logout", {
        method: "POST",
      });
      
      // Clear any local storage data
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      
      // Redirect to login page
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      // Even if API fails, clear local state and redirect
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      window.location.href = "/login";
    }
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used inside AuthProvider");
  }

  return context;
}

// 'use client';  // ← ADD THIS

// import React, {
//   createContext,
//   useContext,
//   useState,
//   useEffect,
//   ReactNode,
// } from "react";
// import { useRouter } from "next/navigation";  // ← CHANGE THIS

// interface User {
//   id?: number;
//   email: string;
//   name?: string;
// }

// interface AuthContextType {
//   user: User | null;
//   login: (email: string, password: string) => Promise<void>;
//   logout: () => void;
//   register: (email: string, password: string) => Promise<void>;
// }

// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// interface AuthProviderProps {
//   children: ReactNode;
// }

// export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
//   const [user, setUser] = useState<User | null>(null);
//   const router = useRouter();

//   useEffect(() => {
//     const storedUser = localStorage.getItem("user");
//     if (storedUser) {
//       setUser(JSON.parse(storedUser));
//     }
//   }, []);

//   const login = async (email: string, password: string) => {
//     const response = await fetch("/api/auth/login", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ email, password }),
//     });

//     if (!response.ok) {
//       throw new Error("Login failed");
//     }

//     const data = await response.json();
//     setUser(data.user);
//     localStorage.setItem("user", JSON.stringify(data.user));
//     router.push("/dashboard");  // ← Remove await (push is not async)
//   };

//   const register = async (email: string, password: string) => {
//     const response = await fetch("/api/auth/register", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ email, password }),
//     });

//     if (!response.ok) {
//       throw new Error("Registration failed");
//     }

//     const data = await response.json();
//     setUser(data.user);
//     localStorage.setItem("user", JSON.stringify(data.user));
//     router.push("/dashboard");  // ← Remove await
//   };

//   const logout = () => {
//     setUser(null);
//     localStorage.removeItem("user");
//     router.push("/login");
//   };

//   return (
//     <AuthContext.Provider value={{ user, login, logout, register }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = (): AuthContextType => {
//   const context = useContext(AuthContext);
//   if (context === undefined) {
//     throw new Error("useAuth must be used within an AuthProvider");
//   }
//   return context;
// };

// export default AuthContext;
