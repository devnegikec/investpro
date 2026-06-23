import { useProfile } from "@/hooks/useProfile"
import { useUIStore } from "@/stores/uiStore"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Loader2 } from "lucide-react"

export default function SettingsPage() {
  const { data: profile, isLoading, updateProfile } = useProfile()
  const { displayCurrency, setDisplayCurrency, theme, toggleTheme } = useUIStore()

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-xl">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const handleSaveTargets = async (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    await updateProfile.mutateAsync({
      target_crypto: Number(data.get("target_crypto")),
      target_equity_in: Number(data.get("target_equity_in")),
      target_equity_us: Number(data.get("target_equity_us")),
      drift_threshold: Number(data.get("drift_threshold")),
      risk_profile: data.get("risk_profile") as "Conservative" | "Moderate" | "Aggressive",
    })
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure your portfolio and preferences</p>
      </div>

      {/* Target Allocation */}
      <Card>
        <CardHeader>
          <CardTitle>Target Asset Allocation</CardTitle>
          <CardDescription>
            Set your desired allocation percentages. AI advisories trigger when drift exceeds the threshold.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveTargets} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="target_crypto">Crypto %</Label>
                <Input
                  id="target_crypto"
                  name="target_crypto"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={profile?.target_crypto ?? 10}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="target_equity_in">Indian Equity %</Label>
                <Input
                  id="target_equity_in"
                  name="target_equity_in"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={profile?.target_equity_in ?? 50}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="target_equity_us">US Equity %</Label>
                <Input
                  id="target_equity_us"
                  name="target_equity_us"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={profile?.target_equity_us ?? 40}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="drift_threshold">Drift Threshold %</Label>
                <Input
                  id="drift_threshold"
                  name="drift_threshold"
                  type="number"
                  min="1"
                  max="20"
                  step="0.5"
                  defaultValue={profile?.drift_threshold ?? 5}
                  required
                />
                <p className="text-xs text-muted-foreground">AI triggers when any class deviates beyond this %</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="risk_profile">Risk Profile</Label>
                <Select name="risk_profile" defaultValue={profile?.risk_profile ?? "Moderate"}>
                  <SelectTrigger id="risk_profile">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Conservative">Conservative</SelectItem>
                    <SelectItem value="Moderate">Moderate</SelectItem>
                    <SelectItem value="Aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Allocation Targets
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Display Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Display Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Currency</p>
              <p className="text-sm text-muted-foreground">Display values in INR or USD</p>
            </div>
            <Select value={displayCurrency} onValueChange={(v) => setDisplayCurrency(v as "INR" | "USD")}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">₹ INR</SelectItem>
                <SelectItem value="USD">$ USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">Toggle dark mode</p>
            </div>
            <Button variant="outline" size="sm" onClick={toggleTheme}>
              {theme === "light" ? "🌙 Dark" : "☀️ Light"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
