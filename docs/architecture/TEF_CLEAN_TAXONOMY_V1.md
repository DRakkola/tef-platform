# TEF Platform — Clean Taxonomy V1 Specification & Database Schema

**Date:** October 4, 2026  
**Status:** Canonical Production Schema Definition  

---

## 1. Schema Definition (SQL DDL & Constraints)

### 1.1 `taxonomy_versions`
```sql
CREATE TABLE taxonomy_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    description TEXT,
    activated_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_taxonomy_version_status CHECK (status IN ('draft', 'active', 'archived'))
);

CREATE INDEX ix_taxonomy_versions_status ON taxonomy_versions(status);
```

### 1.2 `task_types`
```sql
CREATE TABLE task_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modality VARCHAR(30) NOT NULL,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_response_type VARCHAR(50) NOT NULL DEFAULT 'single_choice',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_task_types_modality CHECK (modality IN ('reading', 'listening', 'writing', 'speaking'))
);

CREATE INDEX ix_task_types_modality ON task_types(modality);
CREATE INDEX ix_task_types_is_active ON task_types(is_active);
```

### 1.3 `skills` (Single Canonical Competency Identity)
```sql
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    taxonomy_version_id UUID NOT NULL REFERENCES taxonomy_versions(id) ON DELETE RESTRICT,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    dimension VARCHAR(30) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES skills(id) ON DELETE SET NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_skills_version_code UNIQUE (taxonomy_version_id, code),
    CONSTRAINT ck_skills_dimension CHECK (dimension IN ('reasoning', 'language')),
    CONSTRAINT ck_skills_no_self_parent CHECK (parent_id != id)
);

CREATE INDEX ix_skills_version_id ON skills(taxonomy_version_id);
CREATE INDEX ix_skills_code ON skills(code);
CREATE INDEX ix_skills_dimension ON skills(dimension);
CREATE INDEX ix_skills_parent_id ON skills(parent_id);
CREATE INDEX ix_skills_is_active ON skills(is_active);
```

### 1.4 `task_type_skills` (M:N Task Type to Competencies)
```sql
CREATE TABLE task_type_skills (
    task_type_id UUID NOT NULL REFERENCES task_types(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_type_id, skill_id)
);
```

### 1.5 `skill_relations` (Graph Dependencies & Prerequisites)
```sql
CREATE TABLE skill_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    to_skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    relation_type VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_skill_relations UNIQUE (from_skill_id, to_skill_id, relation_type),
    CONSTRAINT ck_skill_relations_no_self CHECK (from_skill_id != to_skill_id),
    CONSTRAINT ck_skill_relation_type CHECK (relation_type IN ('prerequisite', 'related', 'depends_on'))
);

CREATE INDEX ix_skill_relations_from ON skill_relations(from_skill_id);
CREATE INDEX ix_skill_relations_to ON skill_relations(to_skill_id);
```

### 1.6 `skill_level_descriptors` (Pedagogical Can-Do Benchmarks)
```sql
CREATE TABLE skill_level_descriptors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    level VARCHAR(10) NOT NULL,
    descriptor TEXT NOT NULL,
    evidence_guidance TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_skill_level_descriptors UNIQUE (skill_id, level),
    CONSTRAINT ck_skill_descriptor_level CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
);

CREATE INDEX ix_skill_level_descriptors_skill ON skill_level_descriptors(skill_id);
```
