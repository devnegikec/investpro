import { Link, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useUIStore } from "@/stores/uiStore"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  LayoutDashboard,
  Wallet,
  Bot,
  Settings,
  LogOut,
  Menu,
  Sun,
  Moon,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/holdings", icon: Wallet, label: "Holdings" },
  { to: "/advisor", icon: Bot, label: "AI Advisor" },
  { to: "/settings", icon: Settings, label: "Settings" },
]

function Sidebar() {
  const location = useLocation()
  return (
    <nav className="flex flex-col gap-1 p-2">
      {navItems.map((item) => {
        const active = location.pathname === item.to
        return (
          <Link key={item.to} to={item.to}>
            <Button
              variant={active ? "secondary" : "ghost"}
              className={cn("w-full justify-start gap-3", active && "font-medium")}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          </Link>
        )
      })}
    </nav>
  )
}

export function AppShell() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useUIStore()
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "U"

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-56 p-0 pt-10">
                <Sidebar />
              </SheetContent>
            </Sheet>

            <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Hermes AI</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-sm text-muted-foreground truncate">
                  {user?.email}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link to="/settings" className="cursor-pointer w-full">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-56 border-r bg-muted/20 flex-col pt-4">
          <Sidebar />
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 max-w-7xl">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
