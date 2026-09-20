import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Award,
  ArrowRight,
  Search,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExerciseOption {
  content: string;
  order_index: number;
}

interface ExerciseItem {
  id: string;
  title: string;
  instructions?: string | null;
  category: string;
  level: string;
  difficulty: number;
  prompt: string;
  points: number;
  options: ExerciseOption[];
  skills: string[];
}

export const ExercisesCatalogPage: React.FC = () => {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  useEffect(() => {
    async function loadExercises() {
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (selectedCategory !== "all") queryParams.append("category", selectedCategory);
        if (selectedLevel !== "all") queryParams.append("level", selectedLevel);

        const url = `/api/v1/exercises${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
        const resp = await fetch(url, {
          credentials: "include",
          headers: authHeaders,
        });

        if (!resp.ok) {
          throw new Error("Impossible de charger les exercices d'entraînement.");
        }

        const data: ExerciseItem[] = await resp.json();
        setExercises(data);
      } catch (err: any) {
        setError(err.message || "Erreur de chargement des exercices.");
      } finally {
        setIsLoading(false);
      }
    }

    loadExercises();
  }, [selectedCategory, selectedLevel]);

  const filteredExercises = exercises.filter((ex) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      ex.title.toLowerCase().includes(q) ||
      ex.prompt.toLowerCase().includes(q) ||
      ex.skills?.some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <LayoutDashboard className="size-4" />
            <span>Tableau de bord</span>
          </button>

          <Button
            onClick={() => navigate("/assessments")}
            variant="outline"
            size="sm"
            className="text-xs border-slate-700 bg-slate-900/60 text-slate-300 hover:text-white"
          >
            <BookOpen className="size-3.5 mr-1.5" />
            <span>Simulations complètes TEF</span>
          </Button>
        </div>

        {/* Hero Banner */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-950/50 via-slate-900/70 to-slate-950 p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-2xl space-y-3 relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
              <Sparkles className="size-3.5" />
              Entraînement ciblé
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Catalogue des exercices d'entraînement
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Consolidez vos compétences linguistiques point par point. Chaque exercice validé met à jour en temps réel votre niveau de maîtrise sur votre tableau de bord.
            </p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {[
              { id: "all", label: "Toutes les catégories" },
              { id: "reading", label: "Compréhension écrite" },
              { id: "listening", label: "Compréhension orale" },
              { id: "grammar", label: "Grammaire" },
              { id: "vocabulary", label: "Vocabulaire" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedCategory === cat.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Level & Search */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Level Selector */}
            <select
              aria-label="Filtrer par niveau CEFR"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Tous niveaux</option>
              <option value="A1">Niveau A1</option>
              <option value="A2">Niveau A2</option>
              <option value="B1">Niveau B1</option>
              <option value="B2">Niveau B2</option>
              <option value="C1">Niveau C1</option>
              <option value="C2">Niveau C2</option>
            </select>

            {/* Search Input */}
            <div className="relative flex-1 md:w-56">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-200 pl-8 pr-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Exercises Grid */}
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Chargement des exercices...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-xs text-rose-300">
            {error}
          </div>
        ) : filteredExercises.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-12 text-center space-y-3">
            <BookOpen className="size-10 text-slate-500 mx-auto" />
            <h3 className="text-sm font-semibold text-white">Aucun exercice trouvé</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Aucun exercice ne correspond aux filtres sélectionnés. Essayez de réinitialiser vos critères de recherche.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExercises.map((exercise) => (
              <div
                key={exercise.id}
                className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 flex flex-col justify-between space-y-5 hover:border-indigo-500/40 transition-all shadow-xl group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {exercise.category}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-slate-300 border border-white/10">
                        Niveau {exercise.level}
                      </span>
                      <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                        <Award className="size-3.5" />
                        {exercise.points} pts
                      </span>
                    </div>
                  </div>

                  <h2 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                    {exercise.title}
                  </h2>

                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                    {exercise.prompt}
                  </p>

                  {exercise.skills && exercise.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {exercise.skills.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => navigate(`/exercises/${exercise.id}`)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                >
                  <span>S'entraîner</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
