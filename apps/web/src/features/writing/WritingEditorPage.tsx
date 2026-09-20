/**
 * WritingEditorPage Component.
 * The student-facing Writing Workspace for the TEF exam simulation.
 * Composes FocusedWritingShell, WritingInstructionsPanel, WritingEditor,
 * SubmitWritingDialog, WritingExitDialog, and WritingSkeleton.
 */

import React, { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FocusedWritingShell } from "@/components/layout/FocusedWritingShell"
import { WritingInstructionsPanel } from "./components/WritingInstructionsPanel"
import { WritingEditor } from "./components/WritingEditor"
import { SubmitWritingDialog } from "./components/SubmitWritingDialog"
import { WritingExitDialog } from "./components/WritingExitDialog"
import { WritingSkeleton } from "./components/WritingSkeleton"
import { useWritingSession } from "./useWritingSession"
import type { CorrectionType } from "./types"

export const WritingEditorPage: React.FC = () => {
  const { id: taskId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    task,
    content,
    wordCount,
    remainingSeconds,
    saveStatus,
    isLoading,
    isSubmitting,
    error,
    isReadOnly,
    setContent,
    submitAttempt,
  } = useWritingSession(taskId)

  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false)
  const [showExitModal, setShowExitModal] = useState<boolean>(false)
  const [correctionType, setCorrectionType] = useState<CorrectionType>("ai")
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false)

  // 1. Loading State
  if (isLoading) {
    return (
      <FocusedWritingShell
        title="Expression Écrite"
        remainingSeconds={3600}
        saveStatus="saved"
        onExitClick={() => navigate("/practice")}
        onSubmitClick={() => {}}
        isReadOnly
      >
        <WritingSkeleton />
      </FocusedWritingShell>
    )
  }

  // 2. Error State (Task Not Found or Unavailable)
  if (error || !task) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive border border-destructive/20 mb-4">
          <AlertTriangle className="size-7" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">
          {error || "Épreuve introuvable"}
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          Cette épreuve d'écriture n'est pas disponible ou a été déplacée. Veuillez sélectionner un sujet valide depuis le catalogue d'entraînement.
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/practice")}
            className="cursor-pointer gap-2"
          >
            <ArrowLeft className="size-4" />
            <span>Retour aux entraînements</span>
          </Button>
          <Button
            onClick={() => navigate("/writing")}
            className="cursor-pointer"
          >
            Mes soumissions
          </Button>
        </div>
      </div>
    )
  }

  // 3. Active / Read-Only Exam Workspace
  const sectionBadge =
    task.task_type === "section_a"
      ? "Section A"
      : task.task_type === "section_b"
      ? "Section B"
      : "Épreuve écrite"

  const handleSubmit = async () => {
    const result = await submitAttempt(correctionType)
    if (result) {
      setSubmitSuccess(true)
    }
  }

  return (
    <FocusedWritingShell
      title={task.title}
      sectionBadge={sectionBadge}
      remainingSeconds={remainingSeconds}
      saveStatus={saveStatus}
      onExitClick={() => setShowExitModal(true)}
      onSubmitClick={() => setShowSubmitModal(true)}
      isSubmitting={isSubmitting}
      isReadOnly={isReadOnly}
    >
      {/* Two-Pane Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Pane (5 cols): Official Prompt & Criteria */}
        <WritingInstructionsPanel
          task={task}
          className="lg:col-span-5 h-full"
        />

        {/* Right Pane (7 cols): Writing Editor */}
        <WritingEditor
          content={content}
          onChange={setContent}
          wordCount={wordCount}
          minWords={task.min_words}
          maxWords={task.max_words}
          saveStatus={saveStatus}
          isReadOnly={isReadOnly}
          className="lg:col-span-7 h-full"
        />
      </main>

      {/* Confirmation & Routing Dialog */}
      <SubmitWritingDialog
        open={showSubmitModal}
        onOpenChange={(open) => {
          setShowSubmitModal(open)
          if (!open && submitSuccess) {
            setSubmitSuccess(false)
          }
        }}
        wordCount={wordCount}
        minWords={task.min_words}
        maxWords={task.max_words}
        remainingSeconds={remainingSeconds}
        correctionType={correctionType}
        onSelectCorrectionType={setCorrectionType}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitSuccess={submitSuccess}
        onViewSubmissions={() => navigate("/writing")}
      />

      {/* Exit Warning Dialog */}
      <WritingExitDialog
        open={showExitModal}
        onOpenChange={setShowExitModal}
        onConfirmExit={() => navigate("/practice")}
      />
    </FocusedWritingShell>
  )
}
export default WritingEditorPage
