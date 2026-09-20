# Feature Entitlements & Access Gating Architecture

This document specifies the entitlement abstraction and feature gating system for the TEF Platform.

---

## 1. Architectural Principle: No Hardcoded Plans

A fundamental rule of this platform is **zero plan strings in domain feature code**.

Instead of writing:
```python
# ❌ ANTI-PATTERN: Hardcoded plan logic
if user.subscription.plan == "premium" or user.subscription.plan == "pro":
    allow_ai_correction()
```

Application code depends strictly on **feature keys** via `EntitlementService`:
```python
# ✅ PRODUCTION PATTERN: Feature-based entitlement check
await EntitlementService.require_feature(
    user_id=user.id,
    feature_key="ai_writing_evaluation",
    session=db,
)
```

This ensures that adding new plans, grandfathering legacy tiers, granting trial promotions, or changing pricing packaging requires zero modifications to business or assessment logic.

---

## 2. Standard Feature Keys

| Feature Key | Description | Unit / Limit Type | Default Free Access |
|---|---|---|---|
| `practice_pool_access` | Anonymous 1-to-1 audio practice pool | Boolean (`is_unlimited`) | Unlimited |
| `ai_speaking_practice` | AI speech evaluation & phonetic analysis | Usage count (`limit_units` or credits) | 3 trials |
| `ai_writing_evaluation` | Automated TEF writing scoring & stylistic review | Usage count (`limit_units` or credits) | 2 trials |
| `official_simulation` | Full timed official TEF simulation exams | Usage count / Unlimited | 1 diagnostic |
| `human_writing_review` | Certified examiner human writing correction | One-time credit / Add-on | Requires purchase |
| `teacher_tutoring` | 1-to-1 private tutoring with certified teacher | Hourly credit / Booking fee | Requires booking |

---

## 3. Entitlement Resolution Hierarchy

When evaluating whether a user has access to a feature, `EntitlementService` traverses an authoritative 4-tier hierarchy:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Direct User Grant (UserEntitlementGrant)                 │
│    - Admin override or trial promotion                      │
│    - Checked first; if valid and unexpired -> ALLOW         │
└──────────────────────────────┬──────────────────────────────┘
                               │ fallback
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Active Subscription (ProductEntitlement)                 │
│    - Subscription status IN (active, trialing)              │
│    - Linked ProductEntitlement.is_unlimited = True -> ALLOW │
│    - Or billing cycle usage < limit_units -> ALLOW          │
└──────────────────────────────┬──────────────────────────────┘
                               │ fallback
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Universal Credit Account (CreditAccount & CreditGrant)   │
│    - If feature requires credits, checks available balance  │
│    - If balance >= required_credits -> ALLOW                │
└──────────────────────────────┬──────────────────────────────┘
                               │ fallback
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Free Tier Default Quotas                                 │
│    - Checks historical usage for initial trial quotas       │
│    - If within trial limit -> ALLOW; Else -> 402 / DENY     │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Usage Tracking & AI Metering

All AI evaluations (Gemini 1.5 Flash, Gemini 1.5 Pro, Speech-to-Text, Whisper) record their execution footprint in the `ai_usage_records` table:

```python
class AIUsageRecord(Base):
    user_id: UUID
    feature_key: str          # e.g., "ai_writing_evaluation"
    model_name: str           # e.g., "gemini-1.5-pro"
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    audio_seconds: Decimal    # For STT and audio practice
    estimated_cost_cents: int # Server-side cost tracking
    created_at: datetime
```

This enables:
1. Exact per-user cost attribution.
2. Protection against denial-of-wallet attacks.
3. Accurate usage quota metering within the current billing cycle.

---

## 5. Developer Usage Examples

### Route Dependency Gating
```python
@router.post("/evaluations/speaking")
async def evaluate_speaking(
    request: SpeakingEvalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Enforce access entitlement (raises 402/403 if unauthorized)
    await EntitlementService.require_feature(
        user_id=current_user.id,
        feature_key="ai_speaking_practice",
        session=db,
    )
    
    # Perform evaluation...
    result = await SpeakingEvaluator.run(...)
    
    # Consume usage or credit
    await EntitlementService.consume_usage(
        user_id=current_user.id,
        feature_key="ai_speaking_practice",
        quantity=1,
        session=db,
    )
    return result
```
