import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  institution: {
    id: string;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
    academicYear: string;
  };
}

interface AuthState {
  user: SessionUser | null;
  setUser: (u: SessionUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: "apprende-auth",
    }
  )
);
