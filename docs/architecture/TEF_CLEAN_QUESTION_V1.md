# TEF Platform — Clean Question V1 Specification & Database Schema

**Date:** October 4, 2026  
**Status:** Canonical Production Schema Definition  

---

## 1. Schema Definition (SQL DDL & Constraints)

### 1.1 `stimuli`
```sql
CREATE TABLE stimuli (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modality VARCHAR(30) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content_text TEXT,
    text_format VARCHAR(20) NOT NULL DEFAULT 'plain',
    word_count INTEGER,
    media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    media_url VARCHAR(512),
    source_citation TEXT,
    content_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_stimuli_modality CHECK (modality IN ('reading', 'listening'))
);

CREATE INDEX ix_stimuli_modality ON stimuli(modality);
CREATE INDEX ix_stimuli_content_hash ON stimuli(content_hash);
```

### 1.2 `questions` (Decoupled Bank Entities)
```sql
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type_id UUID NOT NULL REFERENCES task_types(id) ON DELETE RESTRICT,
    stimulus_id UUID REFERENCES stimuli(id) ON DELETE SET NULL,
    response_type VARCHAR(50) NOT NULL DEFAULT 'single_choice',
    prompt TEXT NOT NULL,
    instructions TEXT,
    target_cefr VARCHAR(10),
    difficulty_rating INTEGER,
    cognitive_complexity VARCHAR(50),
    explanation TEXT,
    points INTEGER NOT NULL DEFAULT 1,
    penalty_points INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    version INTEGER NOT NULL DEFAULT 1,
    is_live_delivered BOOLEAN NOT NULL DEFAULT FALSE,
    scoring_payload JSONB,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_questions_status CHECK (status IN ('draft', 'in_review', 'approved', 'published', 'archived')),
    CONSTRAINT ck_questions_target_cefr CHECK (target_cefr IS NULL OR target_cefr IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
    CONSTRAINT ck_questions_complexity CHECK (cognitive_complexity IS NULL OR cognitive_complexity IN ('recall_recognition', 'interpretation', 'inferencing_synthesis', 'critical_evaluation'))
);

CREATE INDEX ix_questions_task_type ON questions(task_type_id);
CREATE INDEX ix_questions_stimulus_id ON questions(stimulus_id);
CREATE INDEX ix_questions_status ON questions(status);
CREATE INDEX ix_questions_target_cefr ON questions(target_cefr);
CREATE INDEX ix_questions_response_type ON questions(response_type);
```

### 1.3 `question_options`
```sql
CREATE TABLE question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    explanation TEXT,
    distractor_rationale TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_question_options_question_id ON question_options(question_id);
```

### 1.4 `question_skill_tags` (Canonical Competency Mappings)
```sql
CREATE TABLE question_skill_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
    role VARCHAR(20) NOT NULL DEFAULT 'primary',
    weight FLOAT NOT NULL DEFAULT 1.0,
    context JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_question_skill_tag UNIQUE (question_id, skill_id),
    CONSTRAINT ck_question_skill_tag_role CHECK (role IN ('primary', 'secondary')),
    CONSTRAINT ck_question_skill_tag_weight CHECK (weight > 0.0 AND weight <= 1.0)
);

CREATE INDEX ix_question_skill_tags_question_id ON question_skill_tags(question_id);
CREATE INDEX ix_question_skill_tags_skill_id ON question_skill_tags(skill_id);
```

### 1.5 `question_versions` (Immutable Historical Deliverables)
```sql
CREATE TABLE question_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    snapshot_payload JSONB NOT NULL,
    changelog TEXT,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_question_version UNIQUE (question_id, version)
);

CREATE INDEX ix_question_versions_question_id ON question_versions(question_id);
```

### 1.6 `question_provenance`
```sql
CREATE TABLE question_provenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE UNIQUE,
    author_type VARCHAR(30) NOT NULL DEFAULT 'human',
    source_type VARCHAR(50) NOT NULL DEFAULT 'original',
    source_reference TEXT,
    generator_model VARCHAR(100),
    generator_prompt_version VARCHAR(100),
    generator_parameters JSONB,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_provenance_author_type CHECK (author_type IN ('human', 'ai', 'imported'))
);
```

### 1.7 `question_validations`
```sql
CREATE TABLE question_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    validation_status VARCHAR(30) NOT NULL,
    blocking_error_count INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    issues_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    validated_by_system_version VARCHAR(50) NOT NULL DEFAULT 'v2.0.0'
);

CREATE INDEX ix_question_validations_question_id ON question_validations(question_id);
```

### 1.8 `assessment_section_questions` (M:N Assembly)
```sql
CREATE TABLE assessment_section_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_section_id UUID NOT NULL REFERENCES assessment_sections(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    question_version_id UUID REFERENCES question_versions(id) ON DELETE SET NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    points_override INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_section_question UNIQUE (assessment_section_id, question_id)
);

CREATE INDEX ix_asq_section_order ON assessment_section_questions(assessment_section_id, order_index);
```
