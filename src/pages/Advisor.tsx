import { useAdvisoryLogs } from "@/hooks/useAdvisoryLogs"
import { useUIStore } from "@/stores/uiStore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { AdvisoryLog } from "@/types/database"
import { Bot, Lightbulb, TrendingUp, RefreshCw, Calendar } from "lucide-react"

function AdvisoryCard({ log }: { log: AdvisoryLog }) {
  const isShort = log.horizon_type === "SHORT_TERM"
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isShort ? (
              <TrendingUp className="h-4 w-4 text-orange-500" />
            ) : (
              <Lightbulb className="h-4 w-4 text-blue-500" />
            )}
            <CardTitle className="text-base">
              {isShort ? "Short-Term Tactical" : "Long-Term Strategic"}
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {log.trigger_reason}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-1 text-xs">
          <Calendar className="h-3 w-3" />
          {new Date(log.created_at).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {log.raw_suggestion}
          </ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdvisorPage() {
  const { data: logs, isLoading } = useAdvisoryLogs()
  const advisorTab = useUIStore((s) => s.advisorTab)
  const setAdvisorTab = useUIStore((s) => s.setAdvisorTab)

  const latestShort = (logs ?? []).find((l) => l.horizon_type === "SHORT_TERM")
  const latestLong = (logs ?? []).find((l) => l.horizon_type === "LONG_TERM")

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Advisor</h1>
          <p className="text-muted-foreground">Portfolio rebalancing suggestions powered by AI</p>
        </div>
        <Button variant="outline" disabled>
          <RefreshCw className="h-4 w-4 mr-2" />
          Trigger Diagnostic
        </Button>
      </div>

      <Tabs value={advisorTab} onValueChange={(v) => setAdvisorTab(v as "latest" | "history")}>
        <TabsList>
          <TabsTrigger value="latest">Latest Advice</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="latest" className="space-y-4 mt-4">
          {!latestShort && !latestLong ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Advice Yet</h3>
                <p className="text-muted-foreground mt-1 max-w-md">
                  AI advisory is generated automatically when your portfolio allocation drifts more than the configured threshold from targets. Check your Settings to configure targets.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {latestShort && <AdvisoryCard log={latestShort} />}
              {latestLong && <AdvisoryCard log={latestLong} />}
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {!logs?.length ? (
                <p className="text-muted-foreground text-center py-12">No advisory history yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-3 font-medium">Date</th>
                        <th className="p-3 font-medium">Type</th>
                        <th className="p-3 font-medium">Trigger</th>
                        <th className="p-3 font-medium">Model</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log: AdvisoryLog) => (
                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3">
                            {new Date(log.created_at).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </td>
                          <td className="p-3">
                            <Badge variant={log.horizon_type === "SHORT_TERM" ? "default" : "secondary"}>
                              {log.horizon_type === "SHORT_TERM" ? "Short-Term" : "Long-Term"}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">{log.trigger_reason}</td>
                          <td className="p-3 text-muted-foreground text-xs">{log.model_used ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
