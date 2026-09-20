# UX & Architecture Specification: Student Teacher Profile & Detail (Page 14)

## 1. Overview & Purpose
The **Teacher Profile / Detail page** (`/teachers/:id`) provides candidates with a high-trust, educational environment to evaluate an accredited French teacher before booking a 60-minute session.

Candidates discover:
- **Who the teacher is**: Verified credentials, pedagogical background, and local timezone.
- **What they teach**: Specialties, prepared CEFR levels (`B1`, `B2`, `C1`).
- **What services they provide**: Discrete 60-minute lesson types mapped from their expertise (Oral examination simulation, Written expression correction, Exam methodology).
- **When they are available**: Real bookable slots fetched dynamically from `/api/v1/teachers/{id}/slots`.
- **What it costs**: Transparent pricing in CAD alongside student plan entitlements (*"Inclus dans votre forfait"*).

---

## 2. Core User Flow & Booking Sequence

```
Browse Profile (Bio, Services, Approach)
       ↓
Select Service (e.g. Expression orale)
       ↓
Select Date & Local Time Slot
       ↓
Review in Confirmation Modal
       ↓
Atomic Booking via POST /api/v1/bookings
       ↓
Success & Confirmation / Graceful Stale Slot Recovery (409)
```

---

## 3. Visual & Architectural Principles

1. **Academic & Professional Tone**:
   - Elevated white/card surfaces (`bg-card`), subtle borders (`border-border/80`), restrained typography.
   - Initial-based clean avatars with verified shield badge (`ShieldCheck`).
   - Structured 60-minute session breakdown based on official CCI Paris Île-de-France grading criteria.

2. **Privacy Guarantees**:
   - Zero exposure of private teacher contact information (personal email, phone number).
   - Zero exposure of internal calendar identifiers, provider IDs, or platform earnings.

3. **Authoritative Booking & Stale Slot Handling**:
   - When a student attempts to book a slot that was just taken by another candidate, the backend returns `409` (`SLOT_ALREADY_BOOKED`).
   - The UI displays an immediate, actionable alert: *"Ce créneau n'est plus disponible. Veuillez choisir un autre horaire."* with a direct action to refresh availability without losing page context.

4. **Responsive Layout & Mobile Sticky CTA**:
   - **Desktop (1280px+)**: Two-column layout with 7 columns for pedagogical content (Bio, Services, Teaching Approach, Qualifications) and 5 columns for the sticky interactive `TeacherBookingPanel`.
   - **Mobile (< 1024px)**: Single-column clean stack with a fixed bottom sticky bar (`TeacherMobileStickyCTA`) displaying price / entitlement and a "Réserver une session" anchor button.

---

## 4. Component Hierarchy

```
TeacherDetailPage (/teachers/:id)
│
├── StudentLayout & PageShell
│   │
│   ├── TeacherProfileHeader
│   │   ├── Back Link ("Tous les professeurs")
│   │   ├── Avatar, Display Name, Role/Headline
│   │   ├── Verified Badge (ShieldCheck)
│   │   ├── Timezone & Pricing / Entitlement Summary
│   │   └── Primary CTA ("Réserver une session")
│   │
│   ├── TeacherInactiveBanner (Rendered if teacher is not approved)
│   │
│   ├── Main Grid (7 cols / 5 cols on Desktop)
│   │   │
│   │   ├── Left Column:
│   │   │   ├── About / Bio Card (Preserved paragraph structure)
│   │   │   ├── Qualifications & Teaching Levels (B1, B2, C1)
│   │   │   ├── TeacherServicesSection (60-min service cards with entitlement badges)
│   │   │   └── TeacherTeachingApproach (3-step structured session breakdown)
│   │   │
│   │   └── Right Column (Sticky Desktop):
│   │       └── TeacherBookingPanel
│   │           ├── Selected Service Summary
│   │           ├── Date Picker (1. Choisissez une date)
│   │           ├── Time Slot Grid (2. Choisissez une heure - discrete local slots)
│   │           ├── Session Objectives Input (3. Objectif de la session)
│   │           └── Continue Button ("Continuer vers la confirmation")
│   │
│   ├── TeacherMobileStickyCTA (Fixed bottom on mobile)
│   │
│   └── TeacherBookingModal (Accessible confirmation dialog)
│       ├── Detailed Session Summary
│       ├── Stale Slot Conflict Alert (409 recovery)
│       ├── Sandbox Notice
│       └── Success Confirmation Screen
```

---

## 5. Telemetry & Analytics
Fail-safe events dispatched:
- `teacher_profile_viewed`: On initial profile render.
- `teacher_slot_selected`: When a student clicks an available time slot.
- `teacher_booking_started`: When opening confirmation modal.
- `teacher_booking_confirmed`: When booking is confirmed.
- `teacher_booking_conflict`: When a 409 stale slot conflict is detected.
