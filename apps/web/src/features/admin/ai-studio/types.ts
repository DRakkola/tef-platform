export interface SpeakingExaminerConfigItem {
  id: string;
  section: string;
  model: string;
  voice_persona: string;
  scepticism_level: number;
  temperature: number;
  top_p: number;
  system_prompt: string;
  updated_at: string;
  updated_by?: string;
}

export interface BenchmarkSample {
  id: string;
  title: string;
  feature_type: "writing" | "speaking";
  section: string;
  cefr_level: string;
  task_prompt: string;
  sample_content: string;
  description: string;
  expected_score_range: string;
}

export interface AIPromptTemplate {
  id: string;
  name: string;
  description: string | null;
  feature_type: "writing" | "speaking" | "raw";
  system_prompt: string;
  user_prompt_template: string | null;
  default_model: string;
  default_temperature: number;
  is_system_preset: boolean;
  created_at: string;
}

export interface WritingErrorSpan {
  error_text: string;
  start_index: number;
  end_index: number;
  error_type: string;
  suggestion: string;
  explanation: string;
}

export interface WritingCriteria {
  task_completion: number;
  coherence_cohesion: number;
  vocabulary_range_accuracy: number;
  grammatical_range_accuracy: number;
  detailed_notes?: Record<string, string>;
}

export interface WritingTestResult {
  score: number;
  tef_points: number;
  cefr_level: string;
  criteria: WritingCriteria;
  strengths: string[];
  weaknesses: string[];
  errors: WritingErrorSpan[];
  corrected_text: string;
  recommendations: string[];
  overall_feedback: string;
}

export interface AISandboxRun {
  id: string;
  feature_type: string;
  template_id: string | null;
  model: string;
  temperature: number;
  system_prompt: string;
  user_prompt: string;
  input_context: Record<string, any>;
  raw_output: string;
  parsed_result: Record<string, any> | null;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  is_simulation: boolean;
  created_at: string;
}

export interface SpeakingTurn {
  role: "examiner" | "candidate";
  content: string;
}

export interface SpeakingEvaluationResult {
  tef_points: number;
  cefr_level: string;
  score: number;
  pronunciation_fluency: number;
  lexical_resource: number;
  grammatical_accuracy: number;
  interaction_coherence: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  examiner_feedback: string;
}

export interface CompareResponse {
  run_a: AISandboxRun;
  run_b: AISandboxRun;
  score_difference: number | null;
  latency_difference_ms: number;
  token_difference: number;
  prompt_diff_summary: string;
  evaluation_diff_summary: string;
}

export interface KnownFactItem {
  category: string;
  fact: string;
  detail?: string;
}

export interface ObjectionCardItem {
  trigger: string;
  objection: string;
  concession?: string;
}

export interface SpeakingScenario {
  id: string;
  title: string;
  code: string;
  section: "section_a" | "section_b";
  target_level: string;
  difficulty: "standard" | "challenging" | "lenient";
  is_active: boolean;

  // Stimulus document
  document_title: string;
  document_content: string;
  document_image_url?: string | null;

  // Persona & Voice
  role_title: string;
  persona_name: string;
  voice_persona: string;
  register: "formal" | "informal";
  temperament?: string | null;
  scepticism_level: number;

  // Ground truth & objections
  known_facts: KnownFactItem[];
  omitted_facts: string[];
  objection_cards: ObjectionCardItem[];

  // Guardrails
  scope_description?: string | null;
  forbidden_topics: string[];
  redirection_phrases: string[];
  custom_instructions?: string | null;

  created_at: string;
  updated_at: string;
}

export interface SpeakingScenarioCreateRequest {
  title: string;
  code: string;
  section: "section_a" | "section_b";
  target_level: string;
  difficulty?: "standard" | "challenging" | "lenient";
  is_active?: boolean;

  document_title: string;
  document_content: string;
  document_image_url?: string | null;

  role_title: string;
  persona_name: string;
  voice_persona?: string;
  register?: "formal" | "informal";
  temperament?: string | null;
  scepticism_level?: number;

  known_facts?: KnownFactItem[];
  omitted_facts?: string[];
  objection_cards?: ObjectionCardItem[];

  scope_description?: string | null;
  forbidden_topics?: string[];
  redirection_phrases?: string[];
  custom_instructions?: string | null;
}

export interface SpeakingScenarioUpdateRequest {
  title?: string;
  code?: string;
  section?: "section_a" | "section_b";
  target_level?: string;
  difficulty?: "standard" | "challenging" | "lenient";
  is_active?: boolean;

  document_title?: string;
  document_content?: string;
  document_image_url?: string | null;

  role_title?: string;
  persona_name?: string;
  voice_persona?: string;
  register?: "formal" | "informal";
  temperament?: string | null;
  scepticism_level?: number;

  known_facts?: KnownFactItem[];
  omitted_facts?: string[];
  objection_cards?: ObjectionCardItem[];

  scope_description?: string | null;
  forbidden_topics?: string[];
  redirection_phrases?: string[];
  custom_instructions?: string | null;
}

export interface SpeakingScenarioListResponse {
  items: SpeakingScenario[];
  total: number;
}

