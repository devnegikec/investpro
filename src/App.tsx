import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import { QueryProvider } from "@/providers/QueryProvider"
import { AppShell } from "@/components/layout/AppShell"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { Toaster } from "@/components/ui/sonner"
import LoginPage from "@/pages/Login"
import SignupPage from "@/pages/Signup"
import DashboardPage from "@/pages/Dashboard"
import HoldingsPage from "@/pages/Holdings"
import AdvisorPage from "@/pages/Advisor"
import SettingsPage from "@/pages/Settings"

export default function App() {
  return (
    <BrowserRouter>
      <QueryProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/holdings" element={<HoldingsPage />} />
              <Route path="/advisor" element={<AdvisorPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
          <Toaster />
        </AuthProvider>
      </QueryProvider>
    </BrowserRouter>
  )
}
