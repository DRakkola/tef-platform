import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sliders,
  Award,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Save,
  Sparkles,
  Scale,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { AdminLayout } from "../AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRichTextEditor } from "@/components/common/MarkdownRichTextEditor";
import { MediaUploadDropzone } from "../media/MediaUploadDropzone";
import { OptionEditor } from "./OptionEditor";
import { MatchingEditor } from "./MatchingEditor";
import { OrderingEditor } from "./OrderingEditor";
import { GapFillEditor } from "./GapFillEditor";
import { ShortTextEditor } from "./ShortTextEditor";
import { StimulusDialog } from "./StimulusDialog";
import { fetchTaskTypes } from "../skills/api";
import { fetchTaxonomySkills } from "../skills/api";
import { createQuestion, createStimulus } from "../api";
import type { TaskType, TaxonomySkillItem } from "../skills/types";
import type {
  AdminStimulus,
  CognitiveComplexityLevel,
  QuestionOption,
  QuestionResponseType,
  QuestionSkillTag,
} from "../types";

export const CreateQuestionStreamlinedPage: React.FC = () => {
  const navigate = useNavigate();

  // 1. Modality & Task Type State
  const [modality, setModality] = useState<string>("reading");
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [taskTypeId, setTaskTypeId] = useState<string>("");
  const [responseType, setResponseType] = useState<QuestionResponseType>("single_choice");

  // 2. Stimulus / Document State
  const [stimulusMode, setStimulusMode] = useState<"none" | "new" | "existing">("new");
  const [stimulusTitle, setStimulusTitle] = useState("");
  const [stimulusText, setStimulusText] = useState("");
  const [stimulusMediaUrl, setStimulusMediaUrl] = useState<string | null>(null);
  const [stimulusMediaAssetId, setStimulusMediaAssetId] = useState<string | null>(null);
  const [existingStimulus, setExistingStimulus] = useState<AdminStimulus | null>(null);
  const [isStimulusPickerOpen, setIsStimulusPickerOpen] = useState(false);

  // 3. Question Prompt & Answers State
  const [prompt, setPrompt] = useState("");
  const [questionAudioUrl, setQuestionAudioUrl] = useState<string | null>(null);
  const [questionMediaAssetId, setQuestionMediaAssetId] = useState<string | null>(null);
  const [options, setOptions] = useState<QuestionOption[]>([
    { content: "Option A", is_correct: true, order_index: 0, explanation: "" },
    { content: "Option B", is_correct: false, order_index: 1, explanation: "" },
    { content: "Option C", is_correct: false, order_index: 2, explanation: "" },
    { content: "Option D", is_correct: false, order_index: 3, explanation: "" },
  ]);
  const [responseMetadata, setResponseMetadata] = useState<Record<string, any>>({});
  const [explanation, setExplanation] = useState("");

  // 4. Psychometrics & Skills State
  const [targetCefr, setTargetCefr] = useState<string>("B1");
  const [difficulty, setDifficulty] = useState<number>(3);
  const [cognitiveComplexity, setCognitiveComplexity] = useState<CognitiveComplexityLevel>("understand");
  const [points, setPoints] = useState<number>(1);
  const [penaltyPoints, setPenaltyPoints] = useState<number>(0);
  const [skillTags, setSkillTags] = useState<QuestionSkillTag[]>([]);

  // Taxonomy Skills for tag picker
  const [availableSkills, setAvailableSkills] = useState<TaxonomySkillItem[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load task types when modality changes
  useEffect(() => {
    fetchTaskTypes(modality)
      .then((tts) => {
        setTaskTypes(tts);
        if (tts.length > 0) {
          setTaskTypeId(tts[0].id);
          const defaultResp = (tts[0] as any)?.default_response_type;
          if (defaultResp) {
            setResponseType(defaultResp as QuestionResponseType);
          }
        } else {
          setTaskTypeId("");
        }
      })
      .catch(() => {});
  }, [modality]);

  // Load skills for quick picker
  useEffect(() => {
    fetchTaxonomySkills({ page_size: 50 })
      .then((res) => setAvailableSkills(res.items || []))
      .catch(() => {});
  }, []);

  // Auto-balance skill weights
  const handleBalanceSkillWeights = () => {
    if (skillTags.length === 0) return;
    const balancedWeight = Math.round((1.0 / skillTags.length) * 100) / 100;
    const updated = skillTags.map((tag, idx) => ({
      ...tag,
      weight: idx === skillTags.length - 1 ? Number((1.0 - balancedWeight * (skillTags.length - 1)).toFixed(2)) : balancedWeight,
    }));
    setSkillTags(updated);
  };

  const handleAddSkillTag = () => {
    if (!selectedSkillId) return;
    if (skillTags.some((t) => t.skill_id === selectedSkillId)) return;

    const found = availableSkills.find((s) => s.id === selectedSkillId);
    const newTag: QuestionSkillTag = {
      skill_id: selectedSkillId,
      skill_code: found?.code,
      skill_name: found?.name,
      dimension: found?.dimension,
      weight: skillTags.length === 0 ? 1.0 : 0.5,
      role: skillTags.length === 0 ? "primary" : "secondary",
    };
    const nextTags = [...skillTags, newTag];
    setSkillTags(nextTags);
    setSelectedSkillId("");
  };

  const handleRemoveSkillTag = (index: number) => {
    setSkillTags(skillTags.filter((_, i) => i !== index));
  };

  // Validation
  const validationErrors: string[] = [];
  if (!prompt.trim()) {
    validationErrors.push("L'énoncé de la question est obligatoire.");
  }
  if (responseType === "single_choice" || responseType === "multiple_choice") {
    if (options.length < 2) {
      validationErrors.push("Au moins 2 options de réponse sont requises.");
    }
    if (!options.some((o) => o.is_correct)) {
      validationErrors.push("Au moins une réponse correcte doit être cochée.");
    }
  }

  const handleSave = async (publishImmediately = false) => {
    if (validationErrors.length > 0) {
      setErrorMsg(validationErrors[0]);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let resolvedStimulusId: string | null = null;

      // 1. Create or attach stimulus
      if (stimulusMode === "new" && (stimulusTitle.trim() || stimulusText.trim() || stimulusMediaUrl)) {
        const createdStim = await createStimulus({
          title: stimulusTitle.trim() || `Document ${modality.toUpperCase()}`,
          modality,
          content: stimulusText.trim() || undefined,
          media_url: stimulusMediaUrl || undefined,
          text_format: "markdown",
        });
        resolvedStimulusId = createdStim.id;
      } else if (stimulusMode === "existing" && existingStimulus) {
        resolvedStimulusId = existingStimulus.id;
      }

      // 2. Prepare payload
      const payload: any = {
        prompt: prompt.trim(),
        question_type: responseType,
        stimulus_id: resolvedStimulusId,
        media_url: questionAudioUrl || undefined,
        modality,
        level: targetCefr,
        target_cefr: targetCefr,
        difficulty,
        item_difficulty: difficulty,
        cognitive_complexity: cognitiveComplexity,
        task_type_id: taskTypeId || undefined,
        explanation: explanation.trim() || undefined,
        points,
        penalty_points: penaltyPoints,
        options: (responseType === "single_choice" || responseType === "multiple_choice")
          ? options.map((opt, i) => ({
              content: opt.content,
              is_correct: opt.is_correct,
              order_index: i,
              explanation: opt.explanation || undefined,
              misconception_type: opt.misconception_type || undefined,
              distractor_rationale: opt.distractor_rationale || undefined,
            }))
          : undefined,
        skill_tags: skillTags.map((tag) => ({
          skill_id: tag.skill_id,
          role: tag.role || "primary",
          weight: tag.weight || 1.0,
        })),
      };

      const created = await createQuestion(payload);

      // If publish requested, update status
      if (publishImmediately) {
        // Redirect to content view where publish can be finalized
        navigate(`/admin/questions/${created.id}?tab=content&autoPublish=1`);
      } else {
        navigate(`/admin/questions?created=${created.id}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Échec de l'enregistrement de la question.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-24">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Link to="/admin/questions" className="hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Banque de questions
              </Link>
              <span>/</span>
              <span className="text-foreground font-semibold">Nouvelle question</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-primary" />
              Création simplifiée d'une question
            </h1>
            <p className="text-xs text-muted-foreground">
              Formulaire unifié et fluide pour configurer le document, l'énoncé, les choix et les compétences.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/admin/questions/new?tab=content">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs text-muted-foreground">
                <ExternalLink className="h-3.5 w-3.5" /> Atelier avancé (7 onglets)
              </Button>
            </Link>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* Card 1: Contexte de l'épreuve & Format */}
        {/* ============================================================== */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground border-b border-border/40 pb-3">
            <Sliders className="h-4 w-4 text-primary" />
            <span>1. Contexte de l'épreuve & Format de réponse</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Modality */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Modalité TEF</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "reading", label: "Compréhension écrite" },
                  { id: "listening", label: "Compréhension orale" },
                  { id: "writing", label: "Expression écrite" },
                  { id: "speaking", label: "Expression orale" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModality(m.id)}
                    className={`p-2 rounded-xl border text-center font-medium transition text-2xs ${
                      modality === m.id
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Task Type */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Type de tâche (Référentiel)</label>
              <select
                value={taskTypeId}
                onChange={(e) => setTaskTypeId(e.target.value)}
                className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground font-medium"
              >
                {taskTypes.map((tt) => (
                  <option key={tt.id} value={tt.id}>
                    {tt.name}
                  </option>
                ))}
              </select>
              <span className="text-2xs text-muted-foreground block">
                Filtre automatique des compétences associées.
              </span>
            </div>

            {/* Response Type */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Format de réponse</label>
              <select
                value={responseType}
                onChange={(e) => setResponseType(e.target.value as QuestionResponseType)}
                className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground font-semibold"
              >
                <option value="single_choice">Choix unique (QCM 1 réponse)</option>
                <option value="multiple_choice">Choix multiple (plusieurs réponses)</option>
                <option value="matching">Appariement (paires gauche/droite)</option>
                <option value="ordering">Ordonnancement (ordre logique)</option>
                <option value="gap_fill">Texte à trous (cloze)</option>
                <option value="short_text">Réponse courte (saisie exacte)</option>
              </select>
              <span className="text-2xs text-muted-foreground block">
                Adapte dynamiquement la saisie des choix ci-dessous.
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Card 2: Document support / Stimulus (Rich Text & Média MinIO) */}
        {/* ============================================================== */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <BookOpen className="h-4 w-4 text-primary" />
              <span>2. Document support (Stimulus textuel ou sonore)</span>
            </div>

            {/* Stimulus Mode Toggle */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border text-2xs">
              <button
                type="button"
                onClick={() => setStimulusMode("none")}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  stimulusMode === "none"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sans document
              </button>
              <button
                type="button"
                onClick={() => setStimulusMode("new")}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  stimulusMode === "new"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Rédiger un document
              </button>
              <button
                type="button"
                onClick={() => {
                  setStimulusMode("existing");
                  setIsStimulusPickerOpen(true);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  stimulusMode === "existing"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Bibliothèque existante
              </button>
            </div>
          </div>

          {stimulusMode === "none" && (
            <div className="text-center py-6 text-muted-foreground text-xs bg-muted/10 rounded-xl border border-dashed border-border">
              Cette question ne comportera aucun document support externe (énoncé autonome).
            </div>
          )}

          {stimulusMode === "existing" && (
            <div className="p-3 bg-muted/20 rounded-xl border border-border flex items-center justify-between">
              {existingStimulus ? (
                <div>
                  <span className="font-semibold text-xs text-foreground block">
                    {existingStimulus.title}
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    Format : {existingStimulus.text_format} — {existingStimulus.word_count || 0} mots
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Aucun document sélectionné dans la bibliothèque.
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsStimulusPickerOpen(true)}
                className="text-xs"
              >
                {existingStimulus ? "Changer" : "Sélectionner"}
              </Button>
            </div>
          )}

          {stimulusMode === "new" && (
            <div className="space-y-4">
              <div className="space-y-1.5 text-xs">
                <label className="font-semibold text-foreground">Titre du document</label>
                <Input
                  value={stimulusTitle}
                  onChange={(e) => setStimulusTitle(e.target.value)}
                  placeholder="ex: Annonce de la mairie d'Ottawa, Article de presse..."
                  className="text-xs"
                />
              </div>

              {/* Rich Text Editor for Document */}
              <MarkdownRichTextEditor
                label="Contenu du document (Markdown riche supporté)"
                value={stimulusText}
                onChange={setStimulusText}
                placeholder="Rédigez le texte de l'article, annonce, brochure ou dialogue..."
                minHeight="min-h-[180px]"
              />

              {/* MinIO Media Upload for Listening / Graphic Stimulus */}
              <MediaUploadDropzone
                label="Média support (Fichier audio d'écoute ou infographie hébergé sur MinIO)"
                mediaUrl={stimulusMediaUrl}
                mediaAssetId={stimulusMediaAssetId}
                onMediaChange={(url, id) => {
                  setStimulusMediaUrl(url);
                  setStimulusMediaAssetId(id);
                }}
                allowedMediaType={modality === "listening" ? "audio" : undefined}
              />
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* Card 3: Énoncé de la question & Réponses */}
        {/* ============================================================== */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground border-b border-border/40 pb-3">
            <HelpCircle className="h-4 w-4 text-primary" />
            <span>3. Énoncé de la question & Choix de réponse</span>
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Énoncé de la question (Prompt) *</span>
              <span className="text-2xs text-muted-foreground font-normal">
                Question précise posée au candidat
              </span>
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="ex: Quel est le but principal de cette lettre ? Selon l'auteur, pourquoi..."
              rows={3}
              className="text-xs resize-y"
            />
          </div>

          {/* Audio specific to question if modality is listening */}
          {modality === "listening" && stimulusMode !== "new" && (
            <MediaUploadDropzone
              label="Audio direct de la question"
              mediaUrl={questionAudioUrl}
              mediaAssetId={questionMediaAssetId}
              onMediaChange={(url, id) => {
                setQuestionAudioUrl(url);
                setQuestionMediaAssetId(id);
              }}
              allowedMediaType="audio"
            />
          )}

          {/* Dynamic Options Editors */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-semibold text-foreground block">
              Options et configuration des réponses
            </label>

            {(responseType === "single_choice" || responseType === "multiple_choice") && (
              <OptionEditor
                options={options}
                onChange={setOptions}
                responseType={responseType}
              />
            )}

            {responseType === "matching" && (
              <MatchingEditor
                metadata={responseMetadata}
                onChange={setResponseMetadata}
              />
            )}

            {responseType === "ordering" && (
              <OrderingEditor
                metadata={responseMetadata}
                onChange={setResponseMetadata}
              />
            )}

            {responseType === "gap_fill" && (
              <GapFillEditor
                metadata={responseMetadata}
                onChange={setResponseMetadata}
              />
            )}

            {responseType === "short_text" && (
              <ShortTextEditor
                metadata={responseMetadata}
                onChange={setResponseMetadata}
              />
            )}
          </div>

          {/* Pedagogical Explanation */}
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <label className="text-xs font-semibold text-foreground block">
              Explication didactique globale
            </label>
            <Textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Justification de la bonne réponse et repères textuels d'analyse..."
              rows={2}
              className="text-xs"
            />
          </div>
        </div>

        {/* ============================================================== */}
        {/* Card 4: Profil psychométrique & Compétences */}
        {/* ============================================================== */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground border-b border-border/40 pb-3">
            <Award className="h-4 w-4 text-primary" />
            <span>4. Profil psychométrique & Compétences</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
            {/* Target CEFR */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Niveau CEFR</label>
              <select
                value={targetCefr}
                onChange={(e) => setTargetCefr(e.target.value)}
                className="w-full rounded-xl border border-border bg-background p-2 text-xs font-bold text-foreground"
              >
                {["A1", "A2", "B1", "B2", "C1", "C2"].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    Niveau {lvl}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Difficulté (1 à 5)</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(parseInt(e.target.value, 10))}
                className="w-full rounded-xl border border-border bg-background p-2 text-xs text-foreground font-medium"
              >
                <option value="1">1 - Très facile</option>
                <option value="2">2 - Facile</option>
                <option value="3">3 - Intermédiaire</option>
                <option value="4">4 - Difficile</option>
                <option value="5">5 - Expert</option>
              </select>
            </div>

            {/* Bloom Complexity */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Complexité (Bloom)</label>
              <select
                value={cognitiveComplexity}
                onChange={(e) => setCognitiveComplexity(e.target.value as CognitiveComplexityLevel)}
                className="w-full rounded-xl border border-border bg-background p-2 text-xs text-foreground font-medium"
              >
                <option value="remember">Mémoriser (Remember)</option>
                <option value="understand">Comprendre (Understand)</option>
                <option value="apply">Appliquer (Apply)</option>
                <option value="analyze">Analyser (Analyze)</option>
                <option value="evaluate">Évaluer (Evaluate)</option>
              </select>
            </div>

            {/* Points */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Points accordés</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value, 10) || 1)}
                className="text-xs h-9"
              />
            </div>

            {/* Penalty */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Pénalité erreur</label>
              <Input
                type="number"
                min={0}
                max={5}
                step={0.25}
                value={penaltyPoints}
                onChange={(e) => setPenaltyPoints(parseFloat(e.target.value) || 0)}
                className="text-xs h-9"
              />
            </div>
          </div>

          {/* Skill Tagging */}
          <div className="space-y-3 pt-3 border-t border-border/40">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Compétences didactiques indexées ({skillTags.length})
              </label>

              {skillTags.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBalanceSkillWeights}
                  className="h-6 text-2xs gap-1 text-purple-600 dark:text-purple-400"
                >
                  <Scale className="h-3 w-3" /> Équilibrer les poids (1.00)
                </Button>
              )}
            </div>

            {/* Existing tags */}
            {skillTags.length > 0 && (
              <div className="space-y-2">
                {skillTags.map((tag, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card text-xs gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-primary text-2xs">
                        {tag.skill_code || tag.skill_id.slice(0, 8)}
                      </span>
                      <span className="truncate text-foreground font-medium">
                        {tag.skill_name || "Compétence"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={tag.role || "primary"}
                        onChange={(e) => {
                          const updated = [...skillTags];
                          updated[idx].role = e.target.value as any;
                          setSkillTags(updated);
                        }}
                        className="rounded-md border border-border bg-background p-1 text-2xs"
                      >
                        <option value="primary">Primaire</option>
                        <option value="secondary">Secondaire</option>
                      </select>

                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.05"
                          min="0.1"
                          max="1.0"
                          value={tag.weight || 1.0}
                          onChange={(e) => {
                            const updated = [...skillTags];
                            updated[idx].weight = parseFloat(e.target.value) || 0.1;
                            setSkillTags(updated);
                          }}
                          className="w-16 h-7 text-2xs font-mono"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSkillTag(idx)}
                        className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick add skill */}
            <div className="flex items-center gap-2">
              <select
                value={selectedSkillId}
                onChange={(e) => setSelectedSkillId(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-background p-2 text-xs text-foreground"
              >
                <option value="">-- Choisir une compétence du référentiel --</option>
                {availableSkills.map((sk) => (
                  <option key={sk.id} value={sk.id}>
                    [{sk.code}] {sk.name} ({sk.dimension})
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSkillTag}
                disabled={!selectedSkillId}
                className="h-9 gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </Button>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Sticky Action Bar */}
        {/* ============================================================== */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border p-4 shadow-xl">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs">
              {validationErrors.length > 0 ? (
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  {validationErrors.length} élément{validationErrors.length > 1 ? "s" : ""} à compléter
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Formulaire conforme
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate("/admin/questions")}
                disabled={isSubmitting}
                size="sm"
              >
                Annuler
              </Button>

              <Button
                variant="secondary"
                onClick={() => handleSave(false)}
                disabled={isSubmitting || validationErrors.length > 0}
                size="sm"
                className="gap-1.5 font-semibold"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Enregistrer en brouillon
              </Button>

              <Button
                onClick={() => handleSave(true)}
                disabled={isSubmitting || validationErrors.length > 0}
                size="sm"
                className="gap-1.5 font-semibold shadow-xs"
              >
                <Sparkles className="h-4 w-4" />
                Enregistrer et valider
              </Button>
            </div>
          </div>
        </div>

        {/* Existing Stimulus Picker Dialog */}
        <StimulusDialog
          open={isStimulusPickerOpen}
          onOpenChange={setIsStimulusPickerOpen}
          onSelectStimulus={(stim: AdminStimulus) => {
            setExistingStimulus(stim);
            setStimulusMode("existing");
            setIsStimulusPickerOpen(false);
          }}
          defaultModality={modality}
        />
      </div>
    </AdminLayout>
  );
};
