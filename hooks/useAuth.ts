// hooks/useAuth.ts
"use client";

import { useAuthContext } from "@/context/AuthContext";

/*
    Custom hook
    Usage:
    const {user,logout}=useAuth();

*/

export default function useAuth() {
  return useAuthContext();
}
