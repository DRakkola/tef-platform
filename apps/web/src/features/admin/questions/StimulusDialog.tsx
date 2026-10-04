import React, { useState, useEffect } from "react";
import { Search, Plus, BookOpen, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fetchStimuli, createStimulus } from "../api";
import type { AdminStimulus } from "../types";

interface StimulusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectStimulus: (stimulus: AdminStimulus) => void;
  currentStimulusId?: string | null;
  defaultModality?: string;
}

export const StimulusDialog: React.FC<StimulusDialogProps> = ({
  open,
  onOpenChange,
  onSelectStimulus,
  currentStimulusId,
  defaultModality = "reading",
}) => {
  const [activeTab, setActiveTab] = useState<"browse" | "create">("browse");
  const [search, setSearch] = useState("");
  const [stimuli, setStimuli] = useState<AdminStimulus[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStimulus, setSelectedStimulus] = useState<AdminStimulus | null>(null);

  // Create form state
  const [createTitle, setCreateTitle] = useState("");
  const [createContent, setCreateContent] = useState("");
  const [createModality, setCreateModality] = useState(defaultModality);
  const [createSource, setCreateSource] = useState("");
  const [createCefr, setCreateCefr] = useState("B1");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      loadStimuli();
    }
  }, [open, search, defaultModality]);

  const loadStimuli = async () => {
    setLoading(true);
    try {
      const res = await fetchStimuli({
        search: search || undefined,
        modality: defaultModality || undefined,
        page: 1,
        page_size: 20,
      });
      setStimuli(res.items || []);
    } catch {
      // silent fallback
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || !createContent.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await createStimulus({
        title: createTitle.trim(),
        content: createContent.trim(),
        modality: createModality,
        source_attribution: createSource.trim() || undefined,
        cefr_level: createCefr,
      });
      onSelectStimulus(created);
      onOpenChange(false);
    } catch {
      // handled
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSelect = () => {
    if (selectedStimulus) {
      onSelectStimulus(selectedStimulus);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Gestion du stimulus textuel / média
          </DialogTitle>
        </DialogHeader>

        <div className="flex border-b border-border gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("browse")}
            className={`pb-2 transition ${
              activeTab === "browse"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bibliothèque de stimuli
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`pb-2 transition ${
              activeTab === "create"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Créer un nouveau stimulus
          </button>
        </div>

        {activeTab === "browse" ? (
          <div className="flex-1 flex flex-col min-h-0 space-y-3 pt-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par titre ou texte..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[350px]">
              {loading ? (
                <div className="text-center py-8 text-xs text-muted-foreground">Chargement des stimuli...</div>
              ) : stimuli.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  Aucun stimulus trouvé. Créez-en un nouveau via le second onglet.
                </div>
              ) : (
                stimuli.map((stim) => {
                  const isCurrent = stim.id === currentStimulusId;
                  const isChosen = selectedStimulus?.id === stim.id;
                  return (
                    <div
                      key={stim.id}
                      onClick={() => setSelectedStimulus(stim)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition flex flex-col gap-1 ${
                        isChosen || isCurrent
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-card hover:border-border/80 text-card-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1.5">
                          {stim.title}
                          {isCurrent && (
                            <span className="text-2xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                              Actuellement lié
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          {stim.cefr_level && (
                            <span className="text-2xs uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {stim.cefr_level}
                            </span>
                          )}
                          {(isChosen || isCurrent) && <Check className="h-4 w-4 text-primary" />}
                        </div>
                      </div>
                      <p className="line-clamp-2 text-muted-foreground text-2xs font-mono">
                        {stim.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmSelect}
                disabled={!selectedStimulus}
                className="gap-1"
              >
                <Check className="h-4 w-4" /> Lier ce stimulus
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3 pt-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Titre du stimulus</Label>
              <Input
                required
                placeholder="ex. Article - Transition écologique dans les transports"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Modalité</Label>
                <select
                  value={createModality}
                  onChange={(e) => setCreateModality(e.target.value)}
                  className="w-full mt-1 rounded-md border border-border bg-background p-1.5 text-xs text-foreground"
                >
                  <option value="reading">Compréhension écrite (Reading)</option>
                  <option value="listening">Compréhension orale (Listening)</option>
                  <option value="writing">Expression écrite (Writing)</option>
                  <option value="speaking">Expression orale (Speaking)</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Niveau CEFR estimé</Label>
                <select
                  value={createCefr}
                  onChange={(e) => setCreateCefr(e.target.value)}
                  className="w-full mt-1 rounded-md border border-border bg-background p-1.5 text-xs text-foreground"
                >
                  <option value="A1">A1</option>
                  <option value="A2">A2</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                  <option value="C1">C1</option>
                  <option value="C2">C2</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Texte intégral ou transcription</Label>
              <Textarea
                required
                rows={6}
                placeholder="Insérez ici le texte du document, extrait de presse, dialogue, annonce..."
                value={createContent}
                onChange={(e) => setCreateContent(e.target.value)}
                className="text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Source / Attribution (Optionnel)</Label>
              <Input
                placeholder="ex. Le Monde, 12 mars 2024"
                value={createSource}
                onChange={(e) => setCreateSource(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1">
                <Plus className="h-4 w-4" /> Enregistrer et lier
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
