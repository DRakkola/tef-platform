import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  SpeakingScenario,
  SpeakingScenarioCreateRequest,
  SpeakingScenarioUpdateRequest,
  KnownFactItem,
  ObjectionCardItem,
} from "../types";
import {
  Plus,
  Trash2,
  FileText,
  UserCheck,
  ShieldAlert,
  HelpCircle,
  Sparkles,
  Layers,
} from "lucide-react";

interface ScenarioEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario?: SpeakingScenario | null;
  onSave: (
    data: SpeakingScenarioCreateRequest | SpeakingScenarioUpdateRequest,
    scenarioId?: string
  ) => Promise<void>;
}

export const ScenarioEditorModal: React.FC<ScenarioEditorModalProps> = ({
  open,
  onOpenChange,
  scenario,
  onSave,
}) => {
  const isEditing = Boolean(scenario);
  const [activeTab, setActiveTab] = useState<string>("meta");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [section, setSection] = useState<"section_a" | "section_b">("section_a");
  const [targetLevel, setTargetLevel] = useState("B2");
  const [difficulty, setDifficulty] = useState<"standard" | "challenging" | "lenient">("standard");
  const [isActive, setIsActive] = useState(true);

  // Document (Stimulus)
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentContent, setDocumentContent] = useState("");
  const [documentImageUrl, setDocumentImageUrl] = useState("");

  // Persona & Voice
  const [roleTitle, setRoleTitle] = useState("");
  const [personaName, setPersonaName] = useState("");
  const [voicePersona, setVoicePersona] = useState("Aoede");
  const [speechRegister, setSpeechRegister] = useState<"formal" | "informal">("formal");
  const [temperament, setTemperament] = useState("");
  const [scepticismLevel, setScepticismLevel] = useState(0.5);

  // Factual Base & Objections
  const [knownFacts, setKnownFacts] = useState<KnownFactItem[]>([]);
  const [omittedFacts, setOmittedFacts] = useState<string[]>([]);
  const [objectionCards, setObjectionCards] = useState<ObjectionCardItem[]>([]);

  // Guardrails
  const [scopeDescription, setScopeDescription] = useState("");
  const [forbiddenTopics, setForbiddenTopics] = useState<string[]>([]);
  const [redirectionPhrases, setRedirectionPhrases] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState("");

  // Temporary row inputs
  const [newFactCat, setNewFactCat] = useState("tarifs");
  const [newFactText, setNewFactText] = useState("");
  const [newFactDetail, setNewFactDetail] = useState("");

  const [newOmittedText, setNewOmittedText] = useState("");

  const [newObjTrigger, setNewObjTrigger] = useState("prix");
  const [newObjText, setNewObjText] = useState("");
  const [newObjConcession, setNewObjConcession] = useState("");

  const [newForbiddenText, setNewForbiddenText] = useState("");
  const [newRedirectText, setNewRedirectText] = useState("");

  // Hydrate on open / scenario change
  useEffect(() => {
    if (scenario) {
      setTitle(scenario.title);
      setCode(scenario.code);
      setSection(scenario.section);
      setTargetLevel(scenario.target_level);
      setDifficulty(scenario.difficulty);
      setIsActive(scenario.is_active);

      setDocumentTitle(scenario.document_title);
      setDocumentContent(scenario.document_content);
      setDocumentImageUrl(scenario.document_image_url || "");

      setRoleTitle(scenario.role_title);
      setPersonaName(scenario.persona_name);
      setVoicePersona(scenario.voice_persona);
      setSpeechRegister(scenario.register);
      setTemperament(scenario.temperament || "");
      setScepticismLevel(scenario.scepticism_level);

      setKnownFacts(scenario.known_facts || []);
      setOmittedFacts(scenario.omitted_facts || []);
      setObjectionCards(scenario.objection_cards || []);

      setScopeDescription(scenario.scope_description || "");
      setForbiddenTopics(scenario.forbidden_topics || []);
      setRedirectionPhrases(scenario.redirection_phrases || []);
      setCustomInstructions(scenario.custom_instructions || "");
    } else {
      // Defaults for a new scenario
      setTitle("");
      setCode(`SCEN-${section === "section_a" ? "A" : "B"}-${Math.floor(100 + Math.random() * 900)}`);
      setSection("section_a");
      setTargetLevel("B2");
      setDifficulty("standard");
      setIsActive(true);

      setDocumentTitle("");
      setDocumentContent("");
      setDocumentImageUrl("");

      setRoleTitle(section === "section_a" ? "Secrétaire d'accueil" : "Collègue de travail");
      setPersonaName(section === "section_a" ? "M. Duval" : "Alex");
      setVoicePersona(section === "section_a" ? "Aoede" : "Fenrir");
      setSpeechRegister(section === "section_a" ? "formal" : "informal");
      setTemperament("");
      setScepticismLevel(section === "section_a" ? 0.3 : 0.65);

      setKnownFacts([]);
      setOmittedFacts([]);
      setObjectionCards([]);

      setScopeDescription("");
      setForbiddenTopics([
        "Politique générale ou réglementations extérieures",
        "Immigration générale ou score de visa TEF",
        "Demande de note ou de résultat de l'examen",
      ]);
      setRedirectionPhrases([]);
      setCustomInstructions("");
    }
    setErrorMsg(null);
    setActiveTab("meta");
  }, [scenario, open]);

  // Section toggle adjusts sensible defaults if creating
  const handleSectionChange = (val: "section_a" | "section_b") => {
    setSection(val);
    if (!isEditing) {
      if (val === "section_a") {
        setSpeechRegister("formal");
        setVoicePersona("Aoede");
        setScepticismLevel(0.3);
        setRoleTitle("Responsable des inscriptions");
        setPersonaName("M. Duval");
      } else {
        setSpeechRegister("informal");
        setVoicePersona("Fenrir");
        setScepticismLevel(0.65);
        setRoleTitle("Ami proche ou collègue");
        setPersonaName("Alex");
      }
    }
  };

  const handleAddKnownFact = () => {
    if (!newFactText.trim()) return;
    setKnownFacts([
      ...knownFacts,
      {
        category: newFactCat.trim(),
        fact: newFactText.trim(),
        detail: newFactDetail.trim() || undefined,
      },
    ]);
    setNewFactText("");
    setNewFactDetail("");
  };

  const handleRemoveKnownFact = (idx: number) => {
    setKnownFacts(knownFacts.filter((_, i) => i !== idx));
  };

  const handleAddOmittedFact = () => {
    if (!newOmittedText.trim()) return;
    setOmittedFacts([...omittedFacts, newOmittedText.trim()]);
    setNewOmittedText("");
  };

  const handleRemoveOmittedFact = (idx: number) => {
    setOmittedFacts(omittedFacts.filter((_, i) => i !== idx));
  };

  const handleAddObjection = () => {
    if (!newObjText.trim()) return;
    setObjectionCards([
      ...objectionCards,
      {
        trigger: newObjTrigger.trim(),
        objection: newObjText.trim(),
        concession: newObjConcession.trim() || undefined,
      },
    ]);
    setNewObjText("");
    setNewObjConcession("");
  };

  const handleRemoveObjection = (idx: number) => {
    setObjectionCards(objectionCards.filter((_, i) => i !== idx));
  };

  const handleAddForbidden = () => {
    if (!newForbiddenText.trim()) return;
    setForbiddenTopics([...forbiddenTopics, newForbiddenText.trim()]);
    setNewForbiddenText("");
  };

  const handleRemoveForbidden = (idx: number) => {
    setForbiddenTopics(forbiddenTopics.filter((_, i) => i !== idx));
  };

  const handleAddRedirect = () => {
    if (!newRedirectText.trim()) return;
    setRedirectionPhrases([...redirectionPhrases, newRedirectText.trim()]);
    setNewRedirectText("");
  };

  const handleRemoveRedirect = (idx: number) => {
    setRedirectionPhrases(redirectionPhrases.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !code.trim() || !documentTitle.trim() || !documentContent.trim()) {
      setErrorMsg("Veuillez renseigner les champs obligatoires (Titre, Code, Titre du document, Contenu).");
      return;
    }
    if (!roleTitle.trim() || !personaName.trim()) {
      setErrorMsg("Veuillez définir le rôle et le nom du personnage examinateur.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const payload: SpeakingScenarioCreateRequest = {
        title: title.trim(),
        code: code.trim().toUpperCase(),
        section,
        target_level: targetLevel,
        difficulty,
        is_active: isActive,
        document_title: documentTitle.trim(),
        document_content: documentContent.trim(),
        document_image_url: documentImageUrl.trim() || null,
        role_title: roleTitle.trim(),
        persona_name: personaName.trim(),
        voice_persona: voicePersona,
        register: speechRegister,
        temperament: temperament.trim() || null,
        scepticism_level: Number(scepticismLevel),
        known_facts: knownFacts,
        omitted_facts: omittedFacts,
        objection_cards: objectionCards,
        scope_description: scopeDescription.trim() || null,
        forbidden_topics: forbiddenTopics,
        redirection_phrases: redirectionPhrases,
        custom_instructions: customInstructions.trim() || null,
      };

      await onSave(payload, scenario?.id);
      onOpenChange(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'enregistrement du scénario.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <DialogTitle className="text-xl font-bold text-foreground">
                {isEditing ? `Modifier : ${scenario?.title}` : "Nouveau Scénario d'Épreuve TEF"}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={section === "section_a" ? "default" : "secondary"}>
                {section === "section_a" ? "Section A (Formel)" : "Section B (Persuasion)"}
              </Badge>
              <Badge variant="outline">{targetLevel}</Badge>
            </div>
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 border-b border-border bg-muted/30">
              <TabsList className="bg-transparent h-12 p-0 gap-4">
                <TabsTrigger
                  value="meta"
                  onClick={() => setActiveTab("meta")}
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none bg-transparent text-muted-foreground hover:text-foreground"
                >
                  <Layers className="w-4 h-4 mr-2" />
                  Métadonnées
                </TabsTrigger>
                <TabsTrigger
                  value="document"
                  onClick={() => setActiveTab("document")}
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none bg-transparent text-muted-foreground hover:text-foreground"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Document Ressource
                </TabsTrigger>
                <TabsTrigger
                  value="persona"
                  onClick={() => setActiveTab("persona")}
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none bg-transparent text-muted-foreground hover:text-foreground"
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  Personnage & Voix
                </TabsTrigger>
                <TabsTrigger
                  value="facts"
                  onClick={() => setActiveTab("facts")}
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none bg-transparent text-muted-foreground hover:text-foreground"
                >
                  <HelpCircle className="w-4 h-4 mr-2" />
                  {section === "section_a" ? "Base Factuelle" : "Cartes d'Objection"}
                </TabsTrigger>
                <TabsTrigger
                  value="guardrails"
                  onClick={() => setActiveTab("guardrails")}
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none bg-transparent text-muted-foreground hover:text-foreground"
                >
                  <ShieldAlert className="w-4 h-4 mr-2" />
                  Garde-fous & Scope
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: METADATA */}
              <TabsContent value="meta" className="m-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Titre du Scénario *</Label>
                    <Input
                      id="title"
                      placeholder="Ex: Club de randonnée en montagne"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Code Unique *</Label>
                    <Input
                      id="code"
                      placeholder="Ex: SCEN-A-01"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Épreuve TEF</Label>
                    <Select
                      value={section}
                      onValueChange={(val: any) => handleSectionChange(val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="section_a">Section A : Demande d'informations (Vouvoiement)</SelectItem>
                        <SelectItem value="section_b">Section B : Argumentation / Persuasion (Tutoiement)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Niveau CEFR Visé</Label>
                    <Select value={targetLevel} onValueChange={setTargetLevel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A2">A2 (Élémentaire)</SelectItem>
                        <SelectItem value="B1">B1 (Intermédiaire)</SelectItem>
                        <SelectItem value="B2">B2 (Avancé / Standard TEF)</SelectItem>
                        <SelectItem value="C1">C1 (Autonome)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Difficulté</Label>
                    <Select
                      value={difficulty}
                      onValueChange={(val: any) => setDifficulty(val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="challenging">Exigeant (Challenging)</SelectItem>
                        <SelectItem value="lenient">Bienveillant (Lenient)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 accent-primary rounded"
                  />
                  <Label htmlFor="isActive" className="cursor-pointer">
                    Actif pour les épreuves d'entraînement des étudiants
                  </Label>
                </div>
              </TabsContent>

              {/* TAB 2: STIMULUS DOCUMENT */}
              <TabsContent value="document" className="m-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="docTitle">Titre de l'Annonce ou de l'Article *</Label>
                  <Input
                    id="docTitle"
                    placeholder="Ex: Randonnées accompagnées dans les Alpes — Sorties hebdomadaires"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="docContent">
                    Texte du Stimulus (Annonce / Dépliant / Extrait d'article) *
                  </Label>
                  <Textarea
                    id="docContent"
                    rows={6}
                    placeholder="Saisissez le texte exact affiché au candidat sur son écran..."
                    value={documentContent}
                    onChange={(e) => setDocumentContent(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Astuce : Ne mettez pas toutes les informations dans l'annonce ! Le candidat est évalué sur sa capacité à poser des questions pour découvrir les informations manquantes.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="docImg">Image d'illustration (URL optionnelle)</Label>
                  <Input
                    id="docImg"
                    placeholder="https://..."
                    value={documentImageUrl}
                    onChange={(e) => setDocumentImageUrl(e.target.value)}
                  />
                </div>
              </TabsContent>

              {/* TAB 3: PERSONA & VOICE */}
              <TabsContent value="persona" className="m-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="roleTitle">Rôle du Personnage *</Label>
                    <Input
                      id="roleTitle"
                      placeholder="Ex: Secrétaire d'accueil de l'association"
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="personaName">Nom du Personnage *</Label>
                    <Input
                      id="personaName"
                      placeholder="Ex: M. Lambert ou Julien"
                      value={personaName}
                      onChange={(e) => setPersonaName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Voix Synthétique Gemini Live</Label>
                    <Select value={voicePersona} onValueChange={setVoicePersona}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Aoede">Aoede (Féminine, claire et posée)</SelectItem>
                        <SelectItem value="Charon">Charon (Masculine, grave et formelle)</SelectItem>
                        <SelectItem value="Fenrir">Fenrir (Masculine, énergique et naturelle)</SelectItem>
                        <SelectItem value="Kore">Kore (Féminine, chaleureuse et engageante)</SelectItem>
                        <SelectItem value="Puck">Puck (Masculine, expressive et vivante)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Registre de Langue</Label>
                    <Select
                      value={speechRegister}
                      onValueChange={(val: any) => setSpeechRegister(val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formal">Formel — Vouvoiement strict (« vous »)</SelectItem>
                        <SelectItem value="informal">Informel / Familier — Tutoiement amical (« tu »)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Niveau de Scepticisme / Résistance Initiale</Label>
                    <span className="text-sm font-semibold">{Math.round(scepticismLevel * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={scepticismLevel}
                    onChange={(e) => setScepticismLevel(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Bienveillant (0%)</span>
                    <span>Modéré (50%)</span>
                    <span>Très réticent (100%)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="temperament">Tempérament & Instructions d'attitude</Label>
                  <Textarea
                    id="temperament"
                    rows={3}
                    placeholder="Ex: Poli mais pressé. Répond précisément aux questions sans faire de monologues..."
                    value={temperament}
                    onChange={(e) => setTemperament(e.target.value)}
                  />
                </div>
              </TabsContent>

              {/* TAB 4: FACTS & OBJECTIONS */}
              <TabsContent value="facts" className="m-0 space-y-6">
                {section === "section_a" ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">
                          1. Base Factuelle Connue (Ne pas donner spontanément)
                        </Label>
                        <Badge variant="outline">{knownFacts.length} faits</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Détails précis connus par l'examinateur qu'il ne doit révéler que si le candidat pose la question correspondante.
                      </p>

                      <div className="space-y-2">
                        {knownFacts.map((kf, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 bg-muted/40 border border-border/60 rounded-xl text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="uppercase text-[10px]">
                                {kf.category}
                              </Badge>
                              <span className="font-medium text-foreground">{kf.fact}</span>
                              {kf.detail && <span className="text-muted-foreground">({kf.detail})</span>}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveKnownFact(i)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-12 gap-2 pt-2">
                        <Input
                          placeholder="Catégorie (ex: tarifs)"
                          value={newFactCat}
                          onChange={(e) => setNewFactCat(e.target.value)}
                          className="col-span-3 text-sm"
                        />
                        <Input
                          placeholder="Fait (ex: 45€ par séance)"
                          value={newFactText}
                          onChange={(e) => setNewFactText(e.target.value)}
                          className="col-span-5 text-sm"
                        />
                        <Input
                          placeholder="Détail (ex: -10% étudiants)"
                          value={newFactDetail}
                          onChange={(e) => setNewFactDetail(e.target.value)}
                          className="col-span-3 text-sm"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAddKnownFact}
                          className="col-span-1"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">
                          2. Informations Volontairement Omises de l'Annonce
                        </Label>
                        <Badge variant="outline">{omittedFacts.length} omises</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Liste des éléments clés manquants dans l'annonce que le candidat doit obligatoirement élucider pour obtenir un score B2/C1.
                      </p>

                      <div className="space-y-2">
                        {omittedFacts.map((om, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 bg-muted/40 border border-border/60 rounded-xl text-sm">
                            <span className="text-foreground">{om}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveOmittedFact(i)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Input
                          placeholder="Ex: Matériel obligatoire à apporter, conditions d'annulation..."
                          value={newOmittedText}
                          onChange={(e) => setNewOmittedText(e.target.value)}
                          className="text-sm"
                        />
                        <Button type="button" variant="outline" onClick={handleAddOmittedFact}>
                          <Plus className="w-4 h-4 mr-1" /> Ajouter
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">
                        Cartes d'Objections Progressives (Section B)
                      </Label>
                      <Badge variant="outline">{objectionCards.length} cartes</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Objections réelles formulées par l'examinateur au cours de la discussion, accompagnées de concessions si l'argument de l'étudiant est convaincant.
                    </p>

                    <div className="space-y-2">
                      {objectionCards.map((oc, i) => (
                        <div key={i} className="p-3 bg-muted/40 border border-border/60 rounded-xl text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="uppercase text-[10px]">
                              {oc.trigger}
                            </Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveObjection(i)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          <p className="font-medium text-foreground">« {oc.objection} »</p>
                          {oc.concession && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                              <span className="font-semibold">Concession :</span> « {oc.concession} »
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border">
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Déclencheur (ex: prix, temps)"
                          value={newObjTrigger}
                          onChange={(e) => setNewObjTrigger(e.target.value)}
                          className="text-sm"
                        />
                        <Input
                          placeholder="Objection formulée à voix haute"
                          value={newObjText}
                          onChange={(e) => setNewObjText(e.target.value)}
                          className="col-span-2 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Concession acceptée si bon argument (ex: 'Si c'est gratuit au début, alors...')"
                          value={newObjConcession}
                          onChange={(e) => setNewObjConcession(e.target.value)}
                          className="text-sm"
                        />
                        <Button type="button" variant="outline" onClick={handleAddObjection}>
                          <Plus className="w-4 h-4 mr-1" /> Ajouter
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* TAB 5: GUARDRAILS & SCOPE */}
              <TabsContent value="guardrails" className="m-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="scopeDesc">Périmètre Explicite de l'Échange</Label>
                  <Textarea
                    id="scopeDesc"
                    rows={2}
                    placeholder="Ex: Uniquement l'inscription et l'organisation pratique du club de randonnée..."
                    value={scopeDescription}
                    onChange={(e) => setScopeDescription(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Définit la frontière stricte au-delà de laquelle l'examinateur recadre le candidat en situation.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Sujets Hors-Cadre Interdits</Label>
                    <Badge variant="outline">{forbiddenTopics.length}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {forbiddenTopics.map((top, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-destructive/10 text-destructive text-xs border border-destructive/20 rounded-full font-medium"
                      >
                        {top}
                        <button
                          type="button"
                          onClick={() => handleRemoveForbidden(i)}
                          className="hover:opacity-75 focus:outline-hidden"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex: Politique, météo sans rapport, score TEF..."
                      value={newForbiddenText}
                      onChange={(e) => setNewForbiddenText(e.target.value)}
                      className="text-sm"
                    />
                    <Button type="button" variant="outline" onClick={handleAddForbidden}>
                      <Plus className="w-4 h-4 mr-1" /> Ajouter
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Phrases Types de Recadrage en Français</Label>
                    <Badge variant="outline">{redirectionPhrases.length}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Exemples de répliques naturelles utilisées par l'examinateur pour ramener l'étudiant sans briser le jeu de rôle.
                  </p>
                  <div className="space-y-1.5">
                    {redirectionPhrases.map((rp, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-muted/40 border border-border/60 rounded-lg text-xs text-foreground">
                        <span>« {rp} »</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRedirect(i)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex: « Revenons à nos moutons, vous aviez d'autres questions sur l'annonce ? »"
                      value={newRedirectText}
                      onChange={(e) => setNewRedirectText(e.target.value)}
                      className="text-sm"
                    />
                    <Button type="button" variant="outline" onClick={handleAddRedirect}>
                      <Plus className="w-4 h-4 mr-1" /> Ajouter
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border">
                  <Label htmlFor="customPrompt">Instructions Système Additionnelles (Optionnel)</Label>
                  <Textarea
                    id="customPrompt"
                    rows={2}
                    placeholder="Directives spécifiques supplémentaires pour ce scénario..."
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                  />
                </div>
              </TabsContent>
            </div>

            <DialogFooter className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl"
              >
                {isSubmitting ? "Enregistrement..." : isEditing ? "Mettre à jour" : "Créer le scénario"}
              </Button>
            </DialogFooter>
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
};
