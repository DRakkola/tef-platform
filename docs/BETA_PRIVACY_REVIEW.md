# TEF Canada Platform — Private Beta Privacy & Data Protection Review

**Document Version:** 1.0.0-beta  
**Date:** September 18, 2026  
**Auditor:** Principal Engineer & Data Protection Officer (DPO)  
**Compliance Frameworks:** GDPR (EU Regulation 2016/679), PIPEDA (Canada Personal Information Protection and Electronic Documents Act), Law 25 (Quebec)  
**Status:** APPROVED FOR PRIVATE BETA LAUNCH  

---

## 1. Executive Summary

The TEF Canada platform is architected with **Privacy by Design and Default** as a core engineering invariant. In accordance with Canadian federal privacy regulations (PIPEDA), Quebec Law 25, and European GDPR guidelines, all personal data processed during the Private Beta (encompassing 10–50 students and 5–15 teachers) is strictly cataloged, minimized, pseudonymized where possible, and governed by deterministic lifecycle rules.

This review confirms:
1. **Zero-PII in Logs and Telemetry:** No user passwords, authentication tokens, student drafts, or contact information are written to log streams, tracing spans, or analytics event tables.
2. **Cryptographic Identity Protection:** Beta invitation tokens are stored solely as one-way SHA-256 digests. Registration tokens are verified without persisting cleartext credentials.
3. **Double-Blind Practice Pool:** Realtime practice sessions operate entirely anonymously with ephemeral session aliases and zero exchange of student profile metadata.
4. **Self-Hosted Infrastructure Boundaries:** All persistent relational data, user profiles, and audio recordings are retained on dedicated self-hosted servers with TLS 1.3 in transit and AES-256 encryption at rest.

---

## 2. Personal Data Inventory & Data Flow Map

| Data Category | Specific Attributes | Legal Basis (GDPR / PIPEDA) | Storage Location | Retention Period | Encryption (Transit / Rest) |
|---|---|---|---|---|---|
| **Account Identity** | Email, hashed password (`Argon2id`), role, active status | Contractual Necessity (Art. 6(1)(b)) | PostgreSQL (`users`) | Duration of active account + 30 days post-deletion | TLS 1.3 / AES-256 (LUKS) |
| **Beta Tokens** | SHA-256 token hash, prefix, cohort linkage, max uses | Legitimate Interest (Pilot Governance) | PostgreSQL (`beta_invitations`) | 90 days post-cohort expiration | TLS 1.3 / AES-256 |
| **Student Pedagogical Profile** | Target exam (TEF Canada), target NCLC/CEFR level, target test date | Contractual Necessity (Educational Delivery) | PostgreSQL (`student_profiles`) | Duration of active account | TLS 1.3 / AES-256 |
| **Writing Submissions & Drafts** | Essay text, keystroke deltas, revision timestamps | Contractual Necessity (Assessment) | MinIO Object Store / PostgreSQL | 180 days post-grading (or on user deletion) | TLS 1.3 / AES-256-GCM |
| **Speaking Audio Recordings** | Student audio stream (`.webm` / `.wav`), duration | Explicit Consent (Art. 6(1)(a)) | MinIO Object Store (`speaking-recordings`) | 90 days; deleted immediately upon evaluation complete if unpinned | TLS 1.3 / AES-256-GCM |
| **Audio Transcripts** | STT textual output, pronunciation scores | Contractual Necessity (Acoustic Evaluation) | PostgreSQL (`speaking_evaluations`) | Duration of student account | TLS 1.3 / AES-256 |
| **Teacher Identity & Verification** | Display name, bio, hourly rate, verification documents | Contractual Necessity / Legal Obligation | PostgreSQL / MinIO (`teacher_profiles`) | Duration of contractual relationship + 7 years (tax) | TLS 1.3 / AES-256 |
| **Billing & Payments** | Stripe Customer ID, payment intent reference, order totals (cents) | Legal Obligation / Contract (Art. 6(1)(c)) | PostgreSQL (`orders`, Stripe Vault) | 7 years (Statutory accounting requirement) | TLS 1.3 / PCI-DSS Level 1 (Stripe) |
| **Analytics & Telemetry** | User UUID (pseudonymized), event type, feature timing, cohort ID | Legitimate Interest (Service Quality) | PostgreSQL (`analytics_events`) | 90 days rolling TTL | TLS 1.3 / AES-256 |
| **Support & Feedback** | User feedback rating, category, free-text remarks, ticket messages | Consent / Legitimate Interest | PostgreSQL (`user_feedback`, `support_tickets`) | 1 year post-ticket closure | TLS 1.3 / AES-256 |

---

## 3. PII Minimization & Masking Verification

### 3.1 Structured Log Sanitization
The platform utilizes `structlog` configured with strict log processors (`app/core/logging.py`) that filter and scrub sensitive key names before emitting JSON log lines. 

- **Scrubbed Keys:** `password`, `token`, `secret`, `authorization`, `cookie`, `access_token`, `refresh_token`, `stripe_signature`, `api_key`.
- **IP Address Policy:** Client IP addresses logged for security auditing (`AuditEvent`) are truncated or hashed for analytics events.
- **Header Masking:** All incoming HTTP `Authorization` headers are masked as `Bearer [REDACTED]` in debug and info middleware logging.

### 3.2 Invitation Token Security
- Cleartext invitation tokens (`tef_beta_[a-f0-9]{32}`) are presented **once** to the administrator upon generation.
- The backend stores exclusively the SHA-256 digest (`token_hash`) and an 8-character identification prefix (`token_prefix`) for indexing.
- Even in the event of a full database leak, unredeemed tokens cannot be reverse-engineered or redeemed by unauthorized third parties.

### 3.3 Practice Pool Double-Blind Anonymity
- The peer practice pool matchmaking engine (`app/modules/practice_pool/service.py`) operates with pseudonymized session tokens.
- When two beta students match in a real-time practice room, the signaling channel transmits only:
  - Ephemeral peer identifier (`student_alias`: e.g., "Participant Alpha").
  - Target language level (e.g., "B2").
  - Selected practice topic prompt.
- Real names, email addresses, historical test scores, and account UUIDs are strictly withheld from peer client payloads.

---

## 4. Subprocessors & Third-Party Transfers

During the Private Beta, third-party data processing is restricted to the minimum required integrations:

| Subprocessor | Role | Data Processed | Data Location | Safeguards |
|---|---|---|---|---|
| **Stripe, Inc.** | Payment Processing (Sandbox) | Email, Order Total, Tokenized Card | US / EU | PCI-DSS Level 1, Standard Contractual Clauses (SCCs), Sandbox Mode Active |
| **OpenRouter / LLM Inference Providers** | Automated Correction & Speech Transcription | Submission text, audio snippet, evaluation rubric | EU / US | Zero-Data-Retention (ZDR) agreements requested; ephemeral API processing; no training on customer submissions |
| **Self-Hosted MinIO** | Audio & Essay Storage | Student recordings, essay text | Internal VPC (Frankfurt) | Dedicated server, no external subprocessor access, encrypted at rest |
| **Self-Hosted PostgreSQL** | Core Operational Database | Relational models | Internal VPC (Frankfurt) | Non-shared host, no multi-tenant third-party infrastructure |

---

## 5. User Rights & Data Subject Access Workflows (DSAR)

Under PIPEDA Principle 9 and GDPR Articles 15–20, users retain unconditional rights regarding their personal data.

### 5.1 Right of Access (Data Portability)
A student may request a full export of their pedagogical and account records.
- **Trigger:** Request to `support@tef-prep.example.com` or via the automated profile export endpoint (`/api/v1/users/me/export`).
- **Output:** Machine-readable `.json` archive containing:
  - Account profile metadata.
  - Assessment history, section scores, and CEFR progression history.
  - Written submissions with associated teacher/AI feedback.
  - Completed oral session evaluations.
- **SLA:** Delivered within 7 business days (exceeding GDPR 30-day requirement).

### 5.2 Right to Erasure ("Right to Be Forgotten")
- **Trigger:** Account deletion request through user settings or privacy desk.
- **Workflow:**
  1. User account marked `is_active=False` and email overwritten with randomized hash (`deleted_<uuid>@anonymized.tef`).
  2. Student profile and learning preferences wiped.
  3. Associated audio recordings in MinIO bucket permanently purged via `DeleteObjects` API call.
  4. Writing submissions scrubbed of user reference (anonymized for aggregated model evaluation or permanently purged upon user preference).
  5. Refresh tokens invalidated and purged.
  6. Financial ledger entries retained in anonymized state for 7 years to satisfy statutory tax obligations, with all direct PII disassociated.

---

## 6. Security Incident & Breach Notification Procedure

In accordance with PIPEDA's mandatory breach reporting regulations and GDPR Article 33:

1. **Detection & Triage (Hour 0–2):** SRE and Security Lead isolate affected services, revoke compromised keys, and determine the blast radius using `audit_events` and PostgreSQL binary logs.
2. **Impact Assessment (Hour 2–12):** Evaluate whether real risk of significant harm (RROSH) exists regarding student or teacher data.
3. **Regulatory Notification (Within 72 Hours):** If PII is compromised, formal notification is submitted to the Privacy Commissioner of Canada (OPC), the Quebec Commission d'accès à l'information (CAI), and relevant EU supervisory authorities.
4. **Subject Notification:** Affected beta participants are notified directly via registered email with clear guidance on mitigation steps.

---

## 7. Compliance Sign-Off

- [x] PII data catalog audited against all 83 database tables.
- [x] Password hashing verified as Argon2id with memory-hard parameters ($m=65536, t=3, p=4$).
- [x] Zero plain-text secrets or bearer tokens in structured application logs.
- [x] Beta invitation tokens cryptographically protected via SHA-256.
- [x] Sandbox payment mode verified (`BILLING_PRODUCTION_ENABLED=false`).
- [x] Object storage retention life-cycles configured on MinIO buckets.

**Privacy Review Assessment:** **APPROVED for Private Beta Launch.**
