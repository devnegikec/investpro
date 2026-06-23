import { create } from "zustand"
import type { AssetClass } from "@/types/database"

interface UIState {
  // Theme
  theme: "light" | "dark"
  toggleTheme: () => void

  // Holdings filter
  assetClassFilter: AssetClass | "ALL"
  setAssetClassFilter: (filter: AssetClass | "ALL") => void

  // Advisor tab
  advisorTab: "latest" | "history"
  setAdvisorTab: (tab: "latest" | "history") => void

  // Currency display
  displayCurrency: "INR" | "USD"
  setDisplayCurrency: (currency: "INR" | "USD") => void

  // Sidebar
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  theme: "light",
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "light" ? "dark" : "light"
      document.documentElement.classList.toggle("dark", next === "dark")
      return { theme: next }
    }),

  assetClassFilter: "ALL",
  setAssetClassFilter: (filter) => set({ assetClassFilter: filter }),

  advisorTab: "latest",
  setAdvisorTab: (tab) => set({ advisorTab: tab }),

  displayCurrency: "INR",
  setDisplayCurrency: (currency) => set({ displayCurrency: currency }),

  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
