import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  Sliders,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Send,
  MessageSquare,
  Radio,
  CheckCircle2,
  AlertCircle,
  FileText,
  ExternalLink,
  Shield,
} from "lucide-react";
import { AIStudioLayout } from "../layout/AIStudioLayout";
import { useAIStudio, AIStudioProvider } from "../context/AIStudioContext";
import { ProductionConfigModal } from "./ProductionConfigModal";
import { ModelSelector } from "../shared/ModelSelector";
import { ScepticismSlider } from "../shared/ScepticismSlider";
import {
  SpeakingTimer,
  SpeakingParticipant,
  AudioLevelIndicator,
  SpeakingPrompt,
} from "@/features/speaking/components";
import { useLiveAudioSession } from "@/features/speaking/useLiveAudioSession";
import type {
  SpeakingTurn,
  SpeakingEvaluationResult,
  SpeakingScenario,
  SpeakingScenarioListResponse,
} from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const DEFAULT_SECTION_A_PROMPT = `Tu es l'examinateur officiel du TEF pour l'épreuve d'expression orale Section A (Prise d'information formelle). Tu incarnes un interlocuteur professionnel face au candidat qui te pose des questions sur une annonce. Tu dois répondre de manière polie et concise en utilisant le vouvoiement. Tu ne donnes que les informations demandées par le candidat.`;

const DEFAULT_SECTION_B_PROMPT = `Tu es l'examinateur officiel du TEF pour l'épreuve d'expression orale Section B (Argumentation et persuasion). Tu incarnes un ami ou collègue du candidat dans une situation informelle. Tu dois tutoyer le candidat. Tu te montres dubitatif et résistant face à ses propositions selon le niveau de scepticisme configuré ({scepticism}). Tu soulèves des objections réalistes pour le forcer à développer son argumentation.`;

const ExaminerStudioPageContent: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const scenarioIdParam = searchParams.get("scenarioId");

  const {
    speakingConfigs,
    refreshSpeakingConfigs,
    isSimulation,
    apiKeyOverride,
    getAuthHeaders,
  } = useAIStudio();

  // Mode: "live" (Gemini Live Audio WebSocket) vs "text" (Discrete HTTP Turn-by-Turn)
  const [sessionMode, setSessionMode] = useState<"live" | "text">("live");

  // Scenarios catalog
  const [scenarios, setScenarios] = useState<SpeakingScenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<SpeakingScenario | null>(null);
  const [loadingScenarios, setLoadingScenarios] = useState<boolean>(true);

  // Section & Topic
  const [section, setSection] = useState<string>("section_a");
  const [topic, setTopic] = useState<string>("Atelier de cuisine du monde");
  const level = "B2";

  // Examiner Config Draft State
  const [voicePersona, setVoicePersona] = useState<string>("Aoede");
  const [scepticism, setScepticism] = useState<number>(0.3);
  const [model, setModel] = useState<string>("models/gemini-3.8-live");
  const [temperature, setTemperature] = useState<number>(0.7);
  const [topP, setTopP] = useState<number>(0.95);
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SECTION_A_PROMPT);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Candidate turns & timer
  const [turns, setTurns] = useState<SpeakingTurn[]>([
    {
      role: "examiner",
      content: "Bonjour, bienvenue ! Je vous écoute pour vos questions concernant l'annonce.",
    },
  ]);
  const [candidateTextInput, setCandidateTextInput] = useState<string>("");
  const [timerSeconds, setTimerSeconds] = useState<number>(300);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // Discrete Mode State
  const [discreteLoading, setDiscreteLoading] = useState<boolean>(false);
  const [discreteTurnMetrics, setDiscreteTurnMetrics] = useState<{
    latency_ms: number;
    total_tokens: number;
    estimated_cost_usd: number;
    is_simulation: boolean;
  } | null>(null);

  // Live Duplex Engine Hook
  const liveSession = useLiveAudioSession();

  // Bottom Inspector Tabs
  const [inspectorTab, setInspectorTab] = useState<"transcript" | "evaluation" | "telemetry">("transcript");
  const [evalResult, setEvalResult] = useState<SpeakingEvaluationResult | null>(null);
  const [evalLoading, setEvalLoading] = useState<boolean>(false);

  // Modals & Feedback
  const [showDeployModal, setShowDeployModal] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const applyScenario = (sc: SpeakingScenario) => {
    setSelectedScenario(sc);
    setSection(sc.section);
    setTopic(sc.title);
    setVoicePersona(sc.voice_persona);
    setScepticism(sc.scepticism_level);
    setTimerRunning(false);
    setTimerSeconds(sc.section === "section_a" ? 300 : 600);

    const greeting =
      sc.section === "section_a"
        ? `Bonjour, ${sc.persona_name} à l'appareil. Je vous écoute pour vos questions concernant l'annonce.`
        : `Salut ! C'est ${sc.persona_name}. Alors, de quoi voulais-tu me parler ?`;

    setTurns([{ role: "examiner", content: greeting }]);
  };

  // Load scenarios on mount and apply query param if provided
  useEffect(() => {
    const loadScenarios = async () => {
      try {
        setLoadingScenarios(true);
        const res = await fetch("/api/v1/admin/ai-sandbox/scenarios", {
          credentials: "include",
        });
        if (res.ok) {
          const data: SpeakingScenarioListResponse = await res.json();
          setScenarios(data.items);
          if (scenarioIdParam) {
            const match = data.items.find((s) => s.id === scenarioIdParam);
            if (match) {
              applyScenario(match);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load scenarios", e);
      } finally {
        setLoadingScenarios(false);
      }
    };
    loadScenarios();
  }, [scenarioIdParam]);

  const handleSelectScenarioId = (id: string) => {
    if (!id || id === "generic") {
      setSelectedScenario(null);
      setSearchParams({});
      handleSectionChange(section);
      return;
    }
    const match = scenarios.find((s) => s.id === id);
    if (match) {
      applyScenario(match);
      setSearchParams({ scenarioId: match.id });
    }
  };

  // Sync section change with production defaults
  const handleSectionChange = (newSec: string) => {
    setSelectedScenario(null);
    setSearchParams({});
    setSection(newSec);
    setTimerRunning(false);
    if (newSec === "section_a") {
      setTopic("Atelier de cuisine du monde");
      setTimerSeconds(300);
      setTurns([
        {
          role: "examiner",
          content: "Bonjour, bienvenue ! Je vous écoute pour vos questions concernant l'annonce.",
        },
      ]);
    } else {
      setTopic("Voyage surprise en Islande entre amis");
      setTimerSeconds(600);
      setTurns([
        {
          role: "examiner",
          content: "Salut ! Alors, de quoi voulais-tu me parler pour ce projet de voyage ?",
        },
      ]);
    }

    const cfg = speakingConfigs.find((c) => c.section === newSec);
    if (cfg) {
      setModel(cfg.model.includes("live") ? cfg.model : "models/gemini-3.8-live");
      setVoicePersona(cfg.voice_persona);
      setScepticism(cfg.scepticism_level);
      setTemperature(cfg.temperature);
      setTopP(cfg.top_p);
      setSystemPrompt(cfg.system_prompt);
    } else {
      setScepticism(newSec === "section_a" ? 0.3 : 0.65);
      setSystemPrompt(newSec === "section_a" ? DEFAULT_SECTION_A_PROMPT : DEFAULT_SECTION_B_PROMPT);
    }
  };

  // Sync live transcripts to turns
  useEffect(() => {
    if (liveSession.isConnected && liveSession.transcripts.length > 0) {
      setTurns(
        liveSession.transcripts.map((t) => ({
          role: t.role,
          content: t.text,
        }))
      );
    }
  }, [liveSession.isConnected, liveSession.transcripts]);

  // Sync liveSession reportCard to evalResult
  useEffect(() => {
    if (liveSession.reportCard) {
      setEvalResult({
        score: liveSession.reportCard.score,
        tef_points: liveSession.reportCard.tef_points,
        cefr_level: liveSession.reportCard.cefr_level,
        pronunciation_fluency: liveSession.reportCard.pronunciation_fluency,
        lexical_resource: liveSession.reportCard.lexical_resource,
        grammatical_accuracy: liveSession.reportCard.grammatical_accuracy,
        interaction_coherence: liveSession.reportCard.interaction_coherence,
        examiner_feedback: liveSession.reportCard.examiner_feedback,
        strengths: liveSession.reportCard.strengths,
        weaknesses: liveSession.reportCard.weaknesses,
        recommendations: liveSession.reportCard.recommendations,
      });
      setInspectorTab("evaluation");
    }
  }, [liveSession.reportCard]);

  // Start Live Duplex Audio Session
  const handleStartLiveSession = async () => {
    setErrorMsg(null);
    let token = "";
    if (typeof window !== "undefined") {
      token = localStorage.getItem("auth_token") || "";
    }
    setTimerRunning(true);
    try {
      await liveSession.startSession({
        scenarioId: selectedScenario?.id,
        topic,
        level: selectedScenario?.target_level || level,
        model: model.includes("live") ? model : "models/gemini-3.8-live",
        voicePersona: selectedScenario?.voice_persona || voicePersona,
        scepticismLevel: selectedScenario ? selectedScenario.scepticism_level : scepticism,
        systemPrompt: selectedScenario ? undefined : systemPrompt,
        temperature,
        topP,
        token,
        forceSimulation: isSimulation,
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Échec de connexion au flux vocal live.");
    }
  };

  // Send Discrete Text Turn (Alternate Mode)
  const handleSendTextTurn = async () => {
    const text = candidateTextInput.trim();
    if (!text) return;
    const newTurns: SpeakingTurn[] = [...turns, { role: "candidate", content: text }];
    setTurns(newTurns);
    setCandidateTextInput("");
    setDiscreteLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/admin/ai-sandbox/run/speaking/turn", {
        method: "POST",
        headers: getAuthHeaders(true),
        credentials: "include",
        body: JSON.stringify({
          section,
          topic,
          candidate_message: text,
          dialogue_history: turns,
          model,
          voice_persona: voicePersona,
          scepticism_level: scepticism,
          top_p: topP,
          force_simulation: isSimulation,
          api_key_override: apiKeyOverride || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur lors du tour de dialogue.");
      }

      const data = await res.json();
      const reply = data.turn.examiner_reply;
      setTurns([...newTurns, { role: "examiner", content: reply }]);
      if (data.run) {
        setDiscreteTurnMetrics({
          latency_ms: data.run.latency_ms,
          total_tokens: data.run.total_tokens,
          estimated_cost_usd: data.run.estimated_cost_usd,
          is_simulation: data.run.is_simulation,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Échec de la réponse de l'examinateur.");
    } finally {
      setDiscreteLoading(false);
    }
  };

  // Evaluate Complete Speaking Session
  const handleEvaluateSpeaking = async () => {
    setEvalLoading(true);
    setErrorMsg(null);
    try {
      const fullTranscript = turns.map((t) => `${t.role.toUpperCase()}: ${t.content}`).join("\n");
      const res = await fetch("/api/v1/admin/ai-sandbox/run/speaking/evaluate", {
        method: "POST",
        headers: getAuthHeaders(true),
        credentials: "include",
        body: JSON.stringify({
          section,
          topic,
          transcription: fullTranscript,
          model: model.toLowerCase().includes("live") ? "models/gemini-3.5-flash" : model,
          force_simulation: isSimulation,
          api_key_override: apiKeyOverride || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erreur d'évaluation orale");
      }

      const data = await res.json();
      setEvalResult(data.result);
      setInspectorTab("evaluation");
      setSuccessMsg("Évaluation de l'échange oral calculée !");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || "Échec de l'évaluation.");
    } finally {
      setEvalLoading(false);
    }
  };

  // Deploy to Production
  const handleDeployToProduction = async () => {
    const res = await fetch("/api/v1/admin/ai-sandbox/speaking/config", {
      method: "PUT",
      headers: getAuthHeaders(true),
      credentials: "include",
      body: JSON.stringify({
        section,
        model,
        voice_persona: voicePersona,
        scepticism_level: scepticism,
        temperature,
        top_p: topP,
        system_prompt: systemPrompt,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Échec de déploiement");
    }

    await refreshSpeakingConfigs();
    setSuccessMsg(`Configuration de la ${section.toUpperCase()} déployée avec succès en production !`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const activeProdConfig = speakingConfigs.find((c) => c.section === section);

  return (
    <AIStudioLayout
      title="Examinateur Studio — Simulation & Calibration Live"
      description="Cockpit professionnel de test en conditions réelles de l'examinateur oral Gemini et déploiement officiel des paramètres."
    >
      {/* Alert Notices */}
      {errorMsg && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="font-bold text-sm px-2">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold text-sm px-2">✕</button>
        </div>
      )}

      {/* Main Split-Screen Cockpit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (~60%): Candidate Experience Mirror */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-card rounded-2xl border border-border shadow-2xs overflow-hidden">
            {/* Top Bar with Timer & Status */}
            <div className="bg-muted/60 px-5 py-3.5 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-3">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Miroir Candidat (Student POV)
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-lg bg-card text-muted-foreground font-mono border border-border">
                  {section === "section_a" ? "Section A (5:00)" : "Section B (10:00)"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <SpeakingTimer remainingSeconds={timerSeconds} />
                <button
                  type="button"
                  onClick={() => setTimerRunning(!timerRunning)}
                  className="text-xs text-primary hover:underline font-medium cursor-pointer"
                >
                  {timerRunning ? "Pause" : "Démarrer"}
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Official Stimulus Card */}
              {selectedScenario ? (
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-indigo-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                        Document Ressource Officiel (Stimulus Candidat)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="bg-white font-mono text-[10px] text-slate-700">
                        {selectedScenario.code}
                      </Badge>
                      <Badge className="bg-indigo-600 text-[10px] text-white">
                        Niveau {selectedScenario.target_level}
                      </Badge>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-lg border border-indigo-100 shadow-2xs space-y-1.5">
                    <h4 className="font-bold text-xs text-slate-900">{selectedScenario.document_title}</h4>
                    <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                      {selectedScenario.document_content}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-indigo-800 gap-1 pt-0.5">
                    <span className="italic">
                      {selectedScenario.section === "section_a"
                        ? "Consigne : Posez une dizaine de questions formelles pour obtenir des renseignements détaillés."
                        : "Consigne : Présentez cette proposition à votre ami(e) et persuadez-le d'y participer."}
                    </span>
                    <span className="font-semibold shrink-0">
                      Registre : {selectedScenario.register === "formal" ? "Vouvoiement formel" : "Tutoiement amical"}
                    </span>
                  </div>
                </div>
              ) : (
                <SpeakingPrompt
                  topic={topic}
                  level={level}
                  objective={
                    section === "section_a"
                      ? "Vous avez sélectionné une annonce. Posez une dizaine de questions formelles (vouvoiement) à votre interlocuteur pour obtenir des précisions sur le déroulement, les tarifs et l'organisation."
                      : "Vous tentez de convaincre votre ami(e) ou collègue (tutoiement) de participer à ce projet. Présentez vos arguments avec enthousiasme, écoutez ses doutes et réfutez ses objections."
                  }
                />
              )}

              {/* Participant Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Virtual Examiner */}
                <SpeakingParticipant
                  sessionType="ai"
                  aiState={
                    liveSession.isConnected
                      ? liveSession.isExaminerSpeaking
                        ? "speaking"
                        : "listening"
                      : "listening"
                  }
                  activeTurn={
                    liveSession.isConnected
                      ? liveSession.isExaminerSpeaking
                        ? "ai"
                        : "student"
                      : "student"
                  }
                  className="border-border bg-muted/30"
                />

                {/* Candidate Mirror Card */}
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-border bg-muted/30 text-center space-y-3 shadow-xs">
                  <div className="relative">
                    <div className="size-20 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg border border-primary/20">
                      Candidat
                    </div>
                    {liveSession.isConnected && !liveSession.isMuted && (
                      <span className="absolute -top-1 -right-1 flex size-5 rounded-full bg-destructive text-white items-center justify-center text-[10px] font-bold animate-pulse">
                        LIVE
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-foreground">Vous (Candidat TEF)</h4>
                    <p className="text-xs text-muted-foreground">
                      {liveSession.isConnected
                        ? liveSession.isCandidateSpeaking
                          ? "Voix détectée (VAD en direct)"
                          : liveSession.isExaminerSpeaking
                            ? "Examinateur en train de parler..."
                            : liveSession.audioInputMode === "push_to_talk"
                              ? liveSession.isPttActive
                                ? "Vous parlez... (Envoi audio en cours)"
                                : "En attente · Appuyez sur [T] pour parler"
                              : "À votre tour de parler"
                        : "Microphone inactif"}
                    </p>
                  </div>

                  <AudioLevelIndicator
                    level={
                      liveSession.isConnected
                        ? liveSession.audioInputMode === "push_to_talk" && !liveSession.isPttActive
                          ? 0
                          : liveSession.micLevel || liveSession.candidateVolume * 100
                        : 0
                    }
                    isMuted={
                      liveSession.isConnected
                        ? liveSession.isMuted ||
                          (liveSession.audioInputMode === "push_to_talk" && !liveSession.isPttActive)
                        : true
                    }
                    showCheckText={true}
                  />
                </div>
              </div>

              {/* Mode Selector & Session Controls */}
              <div className="pt-2 border-t border-border space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => setSessionMode("live")}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                        sessionMode === "live"
                          ? "bg-card text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Radio className="size-3.5 inline mr-1 text-emerald-500" />
                      Conversation Live (Audio)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionMode("text")}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                        sessionMode === "text"
                          ? "bg-card text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <MessageSquare className="size-3.5 inline mr-1 text-primary" />
                      Tour par tour (Texte)
                    </button>
                  </div>

                  {sessionMode === "live" && (
                    <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/60">
                      <button
                        type="button"
                        onClick={() => liveSession.setAudioInputMode("hands_free")}
                        className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          liveSession.audioInputMode !== "push_to_talk"
                            ? "bg-card text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Mains libres
                      </button>
                      <button
                        type="button"
                        onClick={() => liveSession.setAudioInputMode("push_to_talk")}
                        className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          liveSession.audioInputMode === "push_to_talk"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Radio className="size-3" />
                        <span>Push-to-Talk [T]</span>
                      </button>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (liveSession.isConnected) liveSession.stopSession();
                      setTurns([
                        {
                          role: "examiner",
                          content:
                            section === "section_a"
                              ? "Bonjour, je vous écoute pour vos questions concernant l'annonce."
                              : "Salut ! Alors, de quoi voulais-tu me parler pour ce projet ?",
                        },
                      ]);
                      setTimerSeconds(section === "section_a" ? 300 : 600);
                      setTimerRunning(false);
                      setEvalResult(null);
                    }}
                    className="text-xs text-muted-foreground rounded-xl"
                  >
                    <RotateCcw className="size-3.5 mr-1" />
                    Réinitialiser
                  </Button>
                </div>

                {/* Push-to-Talk Interactive Action Banner (when PTT mode is selected and session is connected) */}
                {sessionMode === "live" && liveSession.isConnected && liveSession.audioInputMode === "push_to_talk" && (
                  <div className="w-full flex flex-col items-center gap-2 p-3 bg-muted/30 rounded-2xl border border-border">
                    <Button
                      type="button"
                      size="lg"
                      onClick={liveSession.togglePtt}
                      data-testid="ptt-action-btn"
                      className={`w-full max-w-md h-12 font-bold text-sm gap-2.5 rounded-xl cursor-pointer shadow-md transition-all ${
                        liveSession.isPttActive
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-[1.01]"
                      }`}
                    >
                      <Mic className={`size-5 ${liveSession.isPttActive ? "animate-bounce" : ""}`} />
                      <span>
                        {liveSession.isPttActive
                          ? "Vous parlez... (Appuyez sur T ou cliquez pour terminer)"
                          : "Appuyez pour parler [T]"}
                      </span>
                    </Button>
                    <span className="text-[11px] text-muted-foreground text-center">
                      Raccourci clavier : <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono font-semibold">T</kbd> · Idéal si vos haut-parleurs sont détectés par le micro.
                    </span>
                  </div>
                )}

                {/* Session Action Footer */}
                {sessionMode === "live" ? (
                  <div className="flex flex-wrap items-center gap-3">
                    {!liveSession.isConnected ? (
                      <Button
                        onClick={handleStartLiveSession}
                        disabled={liveSession.isConnecting}
                        data-testid="start-live-duplex-btn"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs py-2.5 px-5 rounded-xl shadow-xs"
                      >
                        <Mic className="size-4 mr-2" />
                        {liveSession.isConnecting ? "Connexion au flux vocal..." : "Démarrer Session Live"}
                      </Button>
                    ) : (
                      <>
                        {liveSession.audioInputMode !== "push_to_talk" && (
                          <Button
                            variant={liveSession.isMuted ? "default" : "outline"}
                            size="sm"
                            onClick={liveSession.toggleMute}
                            className="text-xs rounded-xl"
                          >
                            {liveSession.isMuted ? <MicOff className="size-3.5 mr-1.5 text-destructive" /> : <Mic className="size-3.5 mr-1.5" />}
                            {liveSession.isMuted ? "Micro Coupé" : "Couper Micro"}
                          </Button>
                        )}

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={liveSession.stopSession}
                          data-testid="stop-live-duplex-btn"
                          className="text-xs rounded-xl"
                        >
                          <PhoneOff className="size-3.5 mr-1.5" />
                          Terminer la Session
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Saisissez la réplique du candidat..."
                      value={candidateTextInput}
                      onChange={(e) => setCandidateTextInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendTextTurn()}
                      className="flex-1 text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                    />
                    <Button
                      onClick={handleSendTextTurn}
                      disabled={discreteLoading || !candidateTextInput.trim()}
                      className="text-xs rounded-xl"
                    >
                      <Send className="size-3.5 mr-1" />
                      Envoyer
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Inspector Area (Tabs: Transcript, Evaluation, Telemetry) */}
          <div className="bg-card rounded-2xl border border-border shadow-2xs overflow-hidden">
            <div className="flex border-b border-border bg-muted/30 px-4 pt-2 gap-2">
              <button
                onClick={() => setInspectorTab("transcript")}
                className={`px-3 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
                  inspectorTab === "transcript"
                    ? "border-primary text-foreground bg-card shadow-2xs"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Transcription ({turns.length} tours)
              </button>
              <button
                onClick={() => setInspectorTab("evaluation")}
                className={`px-3 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
                  inspectorTab === "evaluation"
                    ? "border-primary text-foreground bg-card shadow-2xs"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Grille d'Évaluation TEF {evalResult ? `(${evalResult.tef_points} pts)` : ""}
              </button>
              <button
                onClick={() => setInspectorTab("telemetry")}
                className={`px-3 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
                  inspectorTab === "telemetry"
                    ? "border-primary text-foreground bg-card shadow-2xs"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Télémétrie Moteur
              </button>
            </div>

            <div className="p-5">
              {/* Tab 1: Transcript Feed */}
              {inspectorTab === "transcript" && (
                <div className="space-y-3">
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1 text-xs">
                    {turns.map((t, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl leading-relaxed ${
                          t.role === "examiner"
                            ? "bg-muted/40 border border-border text-foreground"
                            : "bg-primary/10 border border-primary/20 text-foreground ml-6"
                        }`}
                      >
                        <span className="font-bold text-[10px] uppercase tracking-wider block mb-1 text-muted-foreground">
                          {t.role === "examiner" ? "Examinateur" : "Candidat"}
                        </span>
                        {t.content}
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-border flex justify-end">
                    <Button
                      onClick={handleEvaluateSpeaking}
                      disabled={evalLoading || turns.length < 2}
                      data-testid="evaluate-speaking-session-btn"
                      size="sm"
                      className="text-xs rounded-xl"
                    >
                      <Sparkles className="size-3.5 mr-1.5" />
                      {evalLoading ? "Évaluation en cours..." : "Calculer l'Évaluation de l'Échange"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Tab 2: Evaluation Scorecard */}
              {inspectorTab === "evaluation" && (
                <div>
                  {evalResult ? (
                    <div className="space-y-4 text-xs animate-in fade-in">
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            Score Officiel TEF Oral
                          </span>
                          <div className="text-3xl font-extrabold text-foreground mt-0.5">
                            {evalResult.tef_points}{" "}
                            <span className="text-sm font-normal text-muted-foreground">/ 698 pts</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="inline-block bg-primary text-primary-foreground font-bold px-3 py-1 rounded-xl text-sm shadow-xs">
                            Niveau {evalResult.cefr_level}
                          </span>
                          <div className="text-xs text-muted-foreground mt-1">
                            Score normalisé : {evalResult.score}%
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="p-3 bg-muted/40 border border-border rounded-xl">
                          <span className="text-muted-foreground block text-[11px]">Aisance</span>
                          <span className="text-base font-bold text-foreground font-mono">
                            {evalResult.pronunciation_fluency} / 25
                          </span>
                        </div>
                        <div className="p-3 bg-muted/40 border border-border rounded-xl">
                          <span className="text-muted-foreground block text-[11px]">Lexique</span>
                          <span className="text-base font-bold text-foreground font-mono">
                            {evalResult.lexical_resource} / 25
                          </span>
                        </div>
                        <div className="p-3 bg-muted/40 border border-border rounded-xl">
                          <span className="text-muted-foreground block text-[11px]">Grammaire</span>
                          <span className="text-base font-bold text-foreground font-mono">
                            {evalResult.grammatical_accuracy} / 25
                          </span>
                        </div>
                        <div className="p-3 bg-muted/40 border border-border rounded-xl">
                          <span className="text-muted-foreground block text-[11px]">Interaction</span>
                          <span className="text-base font-bold text-foreground font-mono">
                            {evalResult.interaction_coherence} / 25
                          </span>
                        </div>
                      </div>

                      {evalResult.examiner_feedback && (
                        <div className="p-3.5 bg-muted/30 border border-border rounded-xl italic leading-relaxed text-muted-foreground">
                          "{evalResult.examiner_feedback}"
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      Aucune évaluation calculée. Conduisez un échange avec l'examinateur puis cliquez sur « Calculer l'Évaluation ».
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Telemetry */}
              {inspectorTab === "telemetry" && (
                <div>
                  {discreteTurnMetrics ? (
                    <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                      <div className="p-3 bg-muted/40 rounded-xl">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">Latence Dernier Tour</span>
                        <span className="text-base font-bold text-foreground">{discreteTurnMetrics.latency_ms} ms</span>
                      </div>
                      <div className="p-3 bg-muted/40 rounded-xl">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">Jetons Inférence</span>
                        <span className="text-base font-bold text-foreground">{discreteTurnMetrics.total_tokens}</span>
                      </div>
                      <div className="p-3 bg-muted/40 rounded-xl">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">Coût Estimé</span>
                        <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                          ${discreteTurnMetrics.estimated_cost_usd.toFixed(5)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      La télémétrie s'affiche lors de l'exécution d'un tour de parole ou d'une évaluation.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (~40%): Examiner Cockpit & Production Configuration */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Sliders className="size-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">Cockpit & Réglages Examinateur</h3>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/20">
                Mode Test
              </span>
            </div>

            {/* Prepared Scenario Selector */}
            <div className="space-y-1.5 p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-indigo-600" />
                  Scénario TEF & Garde-fous
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/admin/ai-studio/scenarios")}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  Catalogue <ExternalLink className="size-3" />
                </button>
              </div>

              <select
                value={selectedScenario ? selectedScenario.id : "generic"}
                onChange={(e) => handleSelectScenarioId(e.target.value)}
                disabled={loadingScenarios}
                className="w-full text-xs bg-background border border-indigo-200 rounded-lg p-2 font-medium text-foreground focus:ring-1 focus:ring-indigo-500"
              >
                <option value="generic">-- Sujet Libre Générique (Non lié à un scénario) --</option>
                {scenarios.filter((s) => s.section === "section_a").length > 0 && (
                  <optgroup label="Section A (Demande d'informations)">
                    {scenarios
                      .filter((s) => s.section === "section_a")
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          [{s.code}] {s.title} ({s.target_level})
                        </option>
                      ))}
                  </optgroup>
                )}
                {scenarios.filter((s) => s.section === "section_b").length > 0 && (
                  <optgroup label="Section B (Argumentation & Persuasion)">
                    {scenarios
                      .filter((s) => s.section === "section_b")
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          [{s.code}] {s.title} ({s.target_level})
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>

              {selectedScenario && (
                <div className="mt-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/40 text-[11px] text-indigo-950 dark:text-indigo-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1">
                      <Shield className="size-3 text-indigo-600" />
                      Garde-fous Actifs :
                    </span>
                    <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded font-mono">
                      Anti-Jailbreak V2
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Personnage : <strong className="text-foreground">{selectedScenario.persona_name}</strong> ({selectedScenario.role_title})
                  </div>
                  {selectedScenario.section === "section_a" ? (
                    <div className="text-[10px] text-muted-foreground">
                      Base secrète : {selectedScenario.known_facts.length} faits · {selectedScenario.omitted_facts.length} infos omises à découvrir
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground">
                      Objections préparées : {selectedScenario.objection_cards.length} cartes de résistance
                    </div>
                  )}
                  {selectedScenario.forbidden_topics.length > 0 && (
                    <div className="text-[10px] text-destructive flex items-center gap-1">
                      <span className="font-semibold">Interdits :</span> {selectedScenario.forbidden_topics.slice(0, 2).join(", ")}
                      {selectedScenario.forbidden_topics.length > 2 && "..."}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">Épreuve Ciblée</label>
              <select
                value={section}
                onChange={(e) => handleSectionChange(e.target.value)}
                className="w-full text-xs bg-background border border-border rounded-xl p-2.5 text-foreground font-medium focus:ring-1 focus:ring-primary"
              >
                <option value="section_a">Section A — Prise d'informations (5 min, vouvoiement)</option>
                <option value="section_b">Section B — Argumentation amicale (10 min, tutoiement)</option>
              </select>
            </div>

            {/* Voice Persona Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">Persona Vocal Gemini</label>
              <select
                value={voicePersona}
                onChange={(e) => setVoicePersona(e.target.value)}
                className="w-full text-xs bg-background border border-border rounded-xl p-2.5 font-medium text-foreground focus:ring-1 focus:ring-primary"
              >
                <option value="Aoede">Aoede — Chaleureux, expressif & mélodieux</option>
                <option value="Charon">Charon — Posé, grave & institutionnel</option>
                <option value="Fenrir">Fenrir — Énergique, direct & percutant</option>
                <option value="Kore">Kore — Neutre, clair & pédagogique</option>
                <option value="Puck">Puck — Dynamique, spontané & familier</option>
              </select>
            </div>

            {/* Scepticism Slider */}
            <ScepticismSlider value={scepticism} onChange={setScepticism} section={section} />

            {/* Advanced Controls Accordion (Progressive Disclosure) */}
            <div className="border border-border rounded-xl overflow-hidden bg-muted/10">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Paramètres Modèle Avancés</span>
                {showAdvanced ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>

              {showAdvanced && (
                <div className="p-4 border-t border-border space-y-4 text-xs animate-in fade-in-50">
                  <ModelSelector value={model} onChange={setModel} allowedTypes="all" />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex justify-between font-mono text-[11px]">
                        <span>Température</span>
                        <span className="font-bold text-primary">{temperature}</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.2"
                        step="0.05"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full accent-primary cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between font-mono text-[11px]">
                        <span>Top-P</span>
                        <span className="font-bold text-primary">{topP}</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.0"
                        step="0.05"
                        value={topP}
                        onChange={(e) => setTopP(parseFloat(e.target.value))}
                        className="w-full accent-primary cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="font-semibold text-foreground">Consigne Système Brute</label>
                      <button
                        type="button"
                        onClick={() =>
                          setSystemPrompt(
                            section === "section_a" ? DEFAULT_SECTION_A_PROMPT : DEFAULT_SECTION_B_PROMPT
                          )
                        }
                        className="text-[10px] text-primary hover:underline cursor-pointer"
                      >
                        Réinitialiser au prompt officiel
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      className="w-full font-mono text-[11px] bg-background border border-border rounded-xl p-2.5 text-foreground leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Separated Production Deployment Section */}
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  Mise en Production
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {activeProdConfig?.updated_at
                    ? `Actif depuis: ${new Date(activeProdConfig.updated_at).toLocaleDateString()}`
                    : "Non déployé"}
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Après avoir validé le comportement de l'examinateur dans ce simulateur, promouvez cette
                configuration pour tous les candidats réels de la plateforme.
              </p>

              <Button
                type="button"
                onClick={() => setShowDeployModal(true)}
                data-testid="deploy-speaking-config-btn"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 rounded-xl shadow-xs"
              >
                <ShieldCheck className="size-4 mr-2" />
                Déployer la Configuration en Production
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Production Configuration Diff & Confirmation Modal */}
      <ProductionConfigModal
        isOpen={showDeployModal}
        onClose={() => setShowDeployModal(false)}
        section={section}
        draftConfig={{
          model,
          voice_persona: voicePersona,
          scepticism_level: scepticism,
          temperature,
          top_p: topP,
          system_prompt: systemPrompt,
        }}
        activeProdConfig={activeProdConfig}
        onDeploy={handleDeployToProduction}
      />
    </AIStudioLayout>
  );
};

export const ExaminerStudioPage: React.FC = () => (
  <AIStudioProvider>
    <ExaminerStudioPageContent />
  </AIStudioProvider>
);
