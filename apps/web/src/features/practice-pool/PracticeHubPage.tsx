import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mic,
  ShieldCheck,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  VideoOff,
  Send,
  XCircle,
  Sparkles,
  Layers,
  HelpCircle,
  Check,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { PageShell } from "@/components/layout/PageShell";
import { StudentLayout } from "@/features/dashboard/StudentLayout";
import {
  getPracticeTopics,
  joinPracticeQueue,
  leavePracticeQueue,
  getPracticeQueueStatus,
  sendPracticeHeartbeat,
  createPracticeRequest,
  getIncomingRequests,
  getOutgoingRequests,
  acceptPracticeRequest,
  rejectPracticeRequest,
  cancelPracticeRequest,
} from "./api";
import type {
  PracticeCandidate,
  PracticeQueueStatus,
  PracticeRequest,
  PracticeTopic,
  PracticeType,
} from "./types";

export const PracticeHubPage: React.FC = () => {
  const navigate = useNavigate();

  // Configuration state
  const [level, setLevel] = useState<string>("B2");
  const language = "Français";
  const practiceType: PracticeType = "free_conversation";
  const [topics, setTopics] = useState<PracticeTopic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");

  // Queue & Matchmaking state
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchSeconds, setSearchSeconds] = useState<number>(0);
  const [queueStatus, setQueueStatus] = useState<PracticeQueueStatus | null>(null);
  const [candidates, setCandidates] = useState<PracticeCandidate[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PracticeRequest[]>([]);
  const [outgoingRequest, setOutgoingRequest] = useState<PracticeRequest | null>(null);
  const [outgoingSeconds, setOutgoingSeconds] = useState<number>(60);

  // Loading & Error states
  const [isSendingRequest, setIsSendingRequest] = useState<string | null>(null);
  const [isProcessingIncoming, setIsProcessingIncoming] = useState<string | null>(null);
  const [isCancellingOutgoing, setIsCancellingOutgoing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Ref to track search status for polling loops
  const isSearchingRef = useRef(isSearching);
  isSearchingRef.current = isSearching;

  // 1. Fetch available topics when level changes
  useEffect(() => {
    getPracticeTopics(level)
      .then((data) => {
        setTopics(data);
        if (data.length > 0 && !selectedTopicId) {
          setSelectedTopicId(data[0].id);
        }
      })
      .catch(() => {});
  }, [level, selectedTopicId]);

  // 2. Poll queue status, candidates, and incoming requests
  const pollQueueAndRequests = async () => {
    try {
      const status = await getPracticeQueueStatus();
      setQueueStatus(status);
      setCandidates(status.candidates || []);

      // Synchronize searching state if server says in_queue
      if (status.in_queue && !isSearchingRef.current) {
        setIsSearching(true);
      } else if (!status.in_queue && isSearchingRef.current) {
        setIsSearching(false);
      }

      // Check incoming invitations
      const incoming = await getIncomingRequests();
      setIncomingRequests(incoming || []);

      // Check outgoing invitations
      const outgoing = await getOutgoingRequests();
      if (outgoing && outgoing.length > 0) {
        const activeOut = outgoing.find((r) => r.status === "pending");
        if (activeOut) {
          setOutgoingRequest(activeOut);
          const exp = new Date(activeOut.expires_at).getTime();
          setOutgoingSeconds(Math.max(0, Math.round((exp - Date.now()) / 1000)));
        } else {
          setOutgoingRequest(null);
        }
      } else {
        setOutgoingRequest(null);
      }
    } catch {
      // Background poll silently handles network drop
    }
  };

  useEffect(() => {
    pollQueueAndRequests();
    const interval = setInterval(pollQueueAndRequests, 4000);
    return () => clearInterval(interval);
  }, []);

  // 3. Heartbeat timer while searching in queue
  useEffect(() => {
    if (!isSearching) return;
    const heartbeatTimer = setInterval(() => {
      sendPracticeHeartbeat().catch(() => {});
    }, 25000);
    return () => clearInterval(heartbeatTimer);
  }, [isSearching]);

  // 4. Elapsed search timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isSearching) {
      timer = setInterval(() => {
        setSearchSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setSearchSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isSearching]);

  // 5. Outgoing request countdown
  useEffect(() => {
    if (!outgoingRequest) return;
    const timer = setInterval(() => {
      setOutgoingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setOutgoingRequest(null);
          setInfoMessage("L'invitation a expiré sans réponse.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [outgoingRequest]);

  // --- Handlers ---

  const handleStartSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setIsSearching(true);
    setSearchSeconds(0);

    try {
      const res = await joinPracticeQueue({
        language: "fr",
        level,
        practice_type: practiceType,
        topic_id: selectedTopicId || null,
      });
      setQueueStatus(res);
      if (res.candidates) setCandidates(res.candidates);
    } catch (err: unknown) {
      setIsSearching(false);
      setErrorMessage(err instanceof Error ? err.message : "Erreur de connexion à la file d'attente");
    }
  };

  const handleCancelSearch = async () => {
    setErrorMessage(null);
    try {
      await leavePracticeQueue();
    } catch {
      // Clean exit
    } finally {
      setIsSearching(false);
      setSearchSeconds(0);
      setQueueStatus((prev) => (prev ? { ...prev, in_queue: false } : null));
    }
  };

  const handleSendRequest = async (candidateQueueId: string) => {
    setIsSendingRequest(candidateQueueId);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const req = await createPracticeRequest(candidateQueueId, selectedTopicId || null);
      setOutgoingRequest(req);
      setOutgoingSeconds(60);
      setInfoMessage(`Demande envoyée à ${req.receiver_alias}. En attente de confirmation...`);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Ce candidat n'est plus disponible ou est déjà en session."
      );
      pollQueueAndRequests();
    } finally {
      setIsSendingRequest(null);
    }
  };

  const handleCancelOutgoing = async () => {
    if (!outgoingRequest) return;
    setIsCancellingOutgoing(true);
    try {
      await cancelPracticeRequest(outgoingRequest.id);
      setOutgoingRequest(null);
      setInfoMessage("Invitation annulée.");
    } catch {
      setOutgoingRequest(null);
    } finally {
      setIsCancellingOutgoing(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    setIsProcessingIncoming(requestId);
    setErrorMessage(null);
    try {
      const session = await acceptPracticeRequest(requestId);
      navigate(`/practice-pool/session/${session.id}`);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Impossible d'accepter cette invitation. Elle a peut-être expiré."
      );
      pollQueueAndRequests();
    } finally {
      setIsProcessingIncoming(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setIsProcessingIncoming(requestId);
    try {
      await rejectPracticeRequest(requestId);
      setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      pollQueueAndRequests();
    } finally {
      setIsProcessingIncoming(null);
    }
  };

  return (
    <StudentLayout>
      <PageShell maxWidth="default">
        {/* Page Header */}
        <PageHeader
          title="TEF French Practice Pool · Échange Oral entre Pairs"
          description="Trouvez un autre candidat préparant le TEF Canada pour une session d'entraînement audio chronométrée. 100% anonyme et sans caméra."
          badge={
            <Badge variant="success" size="sm" className="gap-1.5 font-medium">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Candidats en ligne</span>
            </Badge>
          }
        />

        {/* Global Safety Guarantees Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-card border border-border/80 shadow-xs flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
              <VideoOff className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground">Strict Audio-Only</div>
              <div className="text-[11px] text-muted-foreground truncate">Zéro caméra requise</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-card border border-border/80 shadow-xs flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground">Anonymat strict</div>
              <div className="text-[11px] text-muted-foreground truncate">Pseudonyme attribué</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-card border border-border/80 shadow-xs flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground">25-Minute Sessions</div>
              <div className="text-[11px] text-muted-foreground truncate">Format TEF calibré</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-card border border-border/80 shadow-xs flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Mic className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground">WebRTC P2P</div>
              <div className="text-[11px] text-muted-foreground truncate">Connexion chiffrée</div>
            </div>
          </div>
        </div>

        {/* Error / Alert Messages */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2.5">
            <AlertCircle className="size-4 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {infoMessage && (
          <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs flex items-center gap-2.5">
            <Sparkles className="size-4 shrink-0" />
            <span className="font-medium">{infoMessage}</span>
          </div>
        )}

        {/* Incoming Practice Invitations Banner */}
        {incomingRequests.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-500 animate-pulse" />
              <h2 className="text-sm font-bold text-foreground">
                Invitation de pratique reçue ({incomingRequests.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {incomingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">{req.sender_alias}</span>
                      <Badge variant="outline" size="sm" className="font-mono font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        Niveau {req.level}
                      </Badge>
                      <Badge variant="secondary" size="sm">
                        25 min · Audio
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Souhaite pratiquer l'expression orale avec vous dès maintenant.
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isProcessingIncoming === req.id}
                      onClick={() => handleRejectRequest(req.id)}
                      className="cursor-pointer text-xs"
                    >
                      Refuser
                    </Button>
                    <Button
                      size="sm"
                      disabled={isProcessingIncoming === req.id}
                      onClick={() => handleAcceptRequest(req.id)}
                      className="cursor-pointer font-bold gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>Accepter & Démarrer</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Outgoing Request Notification */}
        {outgoingRequest && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Send className="size-4 animate-bounce" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground flex items-center gap-2">
                  <span>Invitation envoyée à {outgoingRequest.receiver_alias}</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">({outgoingSeconds}s)</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  En attente de la confirmation de votre partenaire pour lancer la salle audio...
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={isCancellingOutgoing}
              onClick={handleCancelOutgoing}
              className="cursor-pointer text-xs shrink-0 gap-1.5"
            >
              <XCircle className="size-3.5" />
              <span>{isCancellingOutgoing ? "Annulation..." : "Annuler l'invitation"}</span>
            </Button>
          </div>
        )}

        {/* Main Content Layout: 2 Columns on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Matching / Search & Candidates (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Searching State Panel */}
            {isSearching ? (
              <Card className="p-8 text-center space-y-6 border-primary/30 bg-primary/5 shadow-sm">
                <div className="relative size-16 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                  <div className="relative size-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                    <RotateCw className="size-7 animate-spin" />
                  </div>
                </div>

                <div className="space-y-2 max-w-md mx-auto">
                  <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                    Recherche active · Niveau {level}
                  </Badge>
                  <h3 className="text-lg font-bold text-foreground">
                    Recherche d'un partenaire en cours...
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Nous cherchons un apprenant disponible pour une session d'expression orale en français (25 minutes, audio uniquement).
                  </p>
                  <div className="pt-2 flex items-center justify-center gap-3 text-xs font-mono">
                    <span className="text-muted-foreground">Temps écoulé :</span>
                    <span className="font-bold text-primary">{searchSeconds}s</span>
                    <span className="text-muted-foreground">· Votre alias :</span>
                    <span className="font-bold text-foreground">{queueStatus?.anonymous_alias || "Attribution..."}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelSearch}
                    className="cursor-pointer text-xs gap-1.5"
                  >
                    <LogOut className="size-3.5" />
                    <span>Annuler la recherche</span>
                  </Button>
                </div>
              </Card>
            ) : (
              /* Idle Setup Card */
              <Card className="border-border shadow-xs">
                <CardHeader className="space-y-1.5 pb-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono text-xs">
                      Connexion instantanée
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                      <Clock className="size-3.5" />
                      Sessions chronométrées
                    </span>
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-bold">
                    Pratiquez avec un autre étudiant
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Sélectionnez vos critères pour être mis en relation avec un partenaire de votre niveau.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Language Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Langue d'échange
                      </label>
                      <div className="p-3 rounded-lg border border-border bg-muted/40 text-sm font-medium text-foreground flex items-center justify-between">
                        <span>{language}</span>
                        <Badge variant="secondary" size="sm">
                          TEF Officiel
                        </Badge>
                      </div>
                    </div>

                    {/* Level Selection */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-foreground">
                          Niveau visé
                        </label>
                        <span className="text-[11px] text-muted-foreground">
                          Compatible : B1 - C1
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {["B1", "B2", "C1"].map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setLevel(lvl)}
                            className={`p-2.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer text-center ${
                              level === lvl
                                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                : "bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Niveau {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Topic Selection */}
                  {topics.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span>Thème de discussion suggéré</span>
                        <span className="text-[11px] font-normal text-muted-foreground">
                          Optionnel · Support d'échange TEF
                        </span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {topics.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTopicId(t.id)}
                            className={`p-3 rounded-lg text-left text-xs border transition-colors cursor-pointer ${
                              selectedTopicId === t.id
                                ? "border-primary bg-primary/5 font-semibold text-foreground"
                                : "border-border bg-card text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-foreground">{t.title}</span>
                              {selectedTopicId === t.id && (
                                <Check className="size-3 text-primary shrink-0 ml-1" />
                              )}
                            </div>
                            {t.description && (
                              <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                {t.description}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
                    <span>File d'attente sécurisée et anonyme</span>
                  </div>

                  <Button
                    onClick={handleStartSearch}
                    className="cursor-pointer gap-2 font-semibold text-sm px-6"
                  >
                    <Users className="size-4" />
                    <span>Enter Practice Pool</span>
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Compatible Available Candidates Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    <span>Candidats en ligne compatibles</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Étudiants actuellement connectés au niveau {level} ou compatible.
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {candidates.length} en ligne
                </Badge>
              </div>

              {candidates.length === 0 ? (
                <Card className="p-8 text-center space-y-3 border-dashed border-border/80 bg-muted/20">
                  <div className="size-12 rounded-full bg-muted text-muted-foreground mx-auto flex items-center justify-center">
                    <Users className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground">
                      Aucun candidat en attente pour le moment
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Lancez la recherche automatique pour que les autres apprenants puissent vous inviter dès leur arrivée.
                    </p>
                  </div>
                  {!isSearching && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartSearch}
                      className="cursor-pointer text-xs font-semibold mt-2"
                    >
                      Activer la recherche
                    </Button>
                  )}
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {candidates.map((cand) => (
                    <Card
                      key={cand.queue_id}
                      className="p-4 border-border hover:border-primary/40 transition-colors shadow-xs flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-sm">
                            {cand.anonymous_alias}
                          </span>
                          <Badge variant="outline" size="sm" className="font-mono font-bold text-primary">
                            {cand.level}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Layers className="size-3.5 text-muted-foreground/70" />
                          <span className="capitalize">{cand.practice_type.replace(/_/g, " ")}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="size-3" />
                          <span>En attente</span>
                        </div>
                        <Button
                          size="sm"
                          disabled={isSendingRequest === cand.queue_id || outgoingRequest !== null}
                          onClick={() => handleSendRequest(cand.queue_id)}
                          className="cursor-pointer font-bold text-xs gap-1.5"
                        >
                          <Send className="size-3" />
                          <span>
                            {isSendingRequest === cand.queue_id ? "Envoi..." : "Practice Together"}
                          </span>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Sidebar (How it Works & Safety Charter) (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* How It Works Card */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3 space-y-1">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <HelpCircle className="size-4 text-primary" />
                  <span>Comment ça marche ?</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Pratique structurée en 3 étapes simples.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <div className="font-bold text-foreground">Choisissez vos critères</div>
                    <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
                      Sélectionnez votre niveau cible (B1-C1) et un thème suggéré pour amorcer le dialogue.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <div className="font-bold text-foreground">Session audio 25 min</div>
                    <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
                      Échangez en direct en français dans un salon WebRTC audio uniquement, chronométré selon le TEF.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <div className="font-bold text-foreground">Auto-évaluation & Bilan</div>
                    <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
                      Évaluez votre ressenti à la fin, validez vos minutes d'entraînement et enrichissez votre profil d'aptitude.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Safety & Conduct Charter Card */}
            <Card className="border-border shadow-xs bg-muted/20">
              <CardHeader className="pb-3 space-y-1">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Charte de sécurité & respect</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Check className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Audio uniquement :</strong> Aucune webcam n'est activée ou requise.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Anonymat garanti :</strong> Ne partagez ni nom de famille, ni coordonnées personnelles.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Équité de parole :</strong> Accordez 50% du temps d'expression à chaque participant.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Contrôle immédiat :</strong> Possibilité de quitter, signaler ou bloquer un pair à tout instant.</span>
                </div>
              </CardContent>
            </Card>

            {/* TEF Exam Tips Card */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-2 space-y-1">
                <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-amber-500" />
                  <span>Conseils pour l'épreuve TEF</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground leading-relaxed space-y-1.5">
                <p>
                  <strong>Section A (5 min) :</strong> Posez des questions précises sur une petite annonce pour obtenir des informations complémentaires.
                </p>
                <p>
                  <strong>Section B (10 min) :</strong> Présentez un document à votre interlocuteur et tentez de le convaincre avec des arguments variés.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageShell>
    </StudentLayout>
  );
};
