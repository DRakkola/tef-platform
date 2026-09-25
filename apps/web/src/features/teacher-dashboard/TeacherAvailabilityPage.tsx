import React, { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Clock,
  Plus,
  Trash2,
  ArrowLeft,
  AlertCircle,
} from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { PageShell } from "@/components/layout/PageShell"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/features/auth"
import {
  getMyTeacherProfile,
  getTeacherAvailabilityRules,
  createTeacherAvailabilityRule,
  deleteTeacherAvailabilityRule,
} from "./api"

const WEEKDAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
]

export const TeacherAvailabilityPage: React.FC = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedWeekday, setSelectedWeekday] = useState<number>(0)
  const [startTime, setStartTime] = useState<string>("09:00")
  const [endTime, setEndTime] = useState<string>("12:00")
  const [formError, setFormError] = useState<string | null>(null)

  // 1. Fetch teacher profile
  const { data: profile } = useQuery({
    queryKey: ["teacher-profile-me"],
    queryFn: getMyTeacherProfile,
  })

  // 2. Fetch availability rules
  const {
    data: rules = [],
    isLoading: loadingRules,
  } = useQuery({
    queryKey: ["teacher-availability-rules", profile?.id],
    queryFn: () => getTeacherAvailabilityRules(profile!.id),
    enabled: !!profile?.id,
  })

  // 3. Add Rule Mutation
  const addMutation = useMutation({
    mutationFn: () =>
      createTeacherAvailabilityRule({
        weekday: selectedWeekday,
        start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
        end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
        timezone: profile?.timezone || "UTC",
      }),
    onSuccess: () => {
      setFormError(null)
      queryClient.invalidateQueries({ queryKey: ["teacher-availability-rules"] })
      queryClient.invalidateQueries({ queryKey: ["teacher-slots-preview"] })
    },
    onError: (err: any) => {
      setFormError(err?.message || "Impossible d'ajouter ce créneau.")
    },
  })

  // 4. Delete Rule Mutation
  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => deleteTeacherAvailabilityRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-availability-rules"] })
      queryClient.invalidateQueries({ queryKey: ["teacher-slots-preview"] })
    },
  })

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault()
    if (startTime >= endTime) {
      setFormError("L'heure de fin doit être strictement postérieure à l'heure de début.")
      return
    }
    setFormError(null)
    addMutation.mutate()
  }

  return (
    <AppShell
      headerTitle="Gestion des disponibilités"
      studentName={profile?.display_name || user?.first_name || "Professeur"}
    >
      <PageShell maxWidth="default">
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Header Navigation */}
          <div className="flex items-center justify-between pb-4 border-b border-border/60">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs">
                <Link to="/teacher">
                  <ArrowLeft className="size-3.5" />
                  <span>Tableau de bord</span>
                </Link>
              </Button>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Créneaux de disponibilité hebdomadaires
              </h1>
            </div>

            <Badge variant="outline" className="text-xs font-mono">
              Fuseau : {profile?.timezone || "UTC"}
            </Badge>
          </div>

          {/* Add Rule Form */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Plus className="size-4 text-primary" />
                <span>Ajouter un créneau récurrent</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Définissez les plages horaires où les étudiants peuvent réserver des sessions TEF avec vous.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 pt-2">
              <form onSubmit={handleAddRule} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                      Jour de la semaine
                    </label>
                    <select
                      value={selectedWeekday}
                      onChange={(e) => setSelectedWeekday(Number(e.target.value))}
                      className="w-full text-xs h-9 rounded-lg border border-border bg-background px-3 text-foreground"
                    >
                      {WEEKDAYS.map((name, idx) => (
                        <option key={name} value={idx}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                      Heure de début
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full text-xs h-9 rounded-lg border border-border bg-background px-3 text-foreground"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                      Heure de fin
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full text-xs h-9 rounded-lg border border-border bg-background px-3 text-foreground"
                      required
                    />
                  </div>
                </div>

                {formError && (
                  <div className="text-xs text-destructive flex items-center gap-1.5" role="alert">
                    <AlertCircle className="size-3.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={addMutation.isPending}
                    className="text-xs gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    <span>{addMutation.isPending ? "Ajout..." : "Enregistrer ce créneau"}</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Active Rules List */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between border-b border-border/40">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <span>Créneaux configurés ({rules.length})</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-5">
              {loadingRules ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted/40 rounded-lg" />
                  ))}
                </div>
              ) : rules.length === 0 ? (
                <div className="p-8 text-center space-y-2 rounded-xl border border-dashed border-border/70 bg-muted/10">
                  <AlertCircle className="size-8 text-amber-500 mx-auto" />
                  <p className="text-sm font-medium text-foreground">
                    Aucun créneau configuré
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ajoutez au moins un créneau récurrent ci-dessus pour ouvrir vos réservations aux candidats.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {rules.map((rule) => {
                    const weekdayName = WEEKDAYS[rule.weekday] || `Jour ${rule.weekday}`
                    const startFormatted = rule.start_time.slice(0, 5)
                    const endFormatted = rule.end_time.slice(0, 5)

                    return (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-card hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-semibold text-xs min-w-24 justify-center">
                            {weekdayName}
                          </Badge>
                          <span className="text-xs font-mono font-medium text-foreground">
                            {startFormatted} — {endFormatted}
                          </span>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(rule.id)}
                          className="text-xs text-destructive hover:bg-destructive/10 h-8 gap-1"
                        >
                          <Trash2 className="size-3.5" />
                          <span className="sr-only sm:not-sr-only">Supprimer</span>
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageShell>
    </AppShell>
  )
}
