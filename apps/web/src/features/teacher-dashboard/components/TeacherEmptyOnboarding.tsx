import React from "react"
import { Link } from "react-router-dom"
import { GraduationCap, Clock, CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface TeacherEmptyOnboardingProps {
  hasAvailability: boolean
}

export const TeacherEmptyOnboarding: React.FC<TeacherEmptyOnboardingProps> = ({
  hasAvailability,
}) => {
  if (hasAvailability) {
    return (
      <Card className="border-border/70 bg-card shadow-xs">
        <CardContent className="p-8 text-center space-y-4 max-w-lg mx-auto">
          <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-foreground">
              Vos disponibilités sont actives.
            </h3>
            <p className="text-sm text-muted-foreground">
              Les prochaines réservations d'élèves apparaîtront ici dès qu'un créneau sera réservé.
            </p>
          </div>
          <Button variant="outline" size="sm" className="text-xs" asChild>
            <Link to="/teacher/availability">Gérer mes disponibilités</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/70 bg-card shadow-xs">
      <CardContent className="p-8 sm:p-10 text-center space-y-5 max-w-xl mx-auto">
        <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <GraduationCap className="size-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Bienvenue dans votre espace professeur
          </h2>
          <p className="text-sm text-muted-foreground">
            Configurez vos disponibilités pour commencer à recevoir des réservations de séances TEF par les étudiants.
          </p>
        </div>

        <div className="pt-2">
          <Button
            size="lg"
            className="gap-2 shadow-xs"
            asChild
          >
            <Link to="/teacher/availability">
              <Clock className="size-4" />
              Configurer mes disponibilités
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
