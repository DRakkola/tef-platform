# UX & Architecture Specification: Student Teachers Marketplace (Page 13)

## 1. Overview & Purpose
The **Student Teachers Marketplace** (`/teachers`) is the discovery and matching portal where TEF candidates find accredited French instructors for:
- **Expression orale** (Section A informal inquiry & Section B formal persuasion)
- **Expression écrite** (Section A fait divers & Section B argumentation letter)
- **Méthodologie TEF** (Score optimization strategies, grading rubric alignment, diagnostic evaluation)

The student experience prioritizes **trust, accreditation, clarity, and low friction**. Teachers are presented as serious educational professionals rather than commercial commodities.

---

## 2. Core User Experience & Guiding Principles

1. **Immediate Answers**:
   - **Who is available?** Display names, verified badges, credentials, headline, and bio summary.
   - **What do they teach?** Discrete service badges for TEF specialties (`Expression orale`, `Expression écrite`, `Méthodologie TEF`) and CEFR levels (`B1`, `B2`, `C1`).
   - **When are they available?** Live slot inspection (`/api/v1/teachers/{id}/slots`) formatted into natural relative dates (*"Aujourd'hui, 19:30"*, *"Demain, 10:00"*, *"Jeudi, 14:00"*).
   - **How much does it cost?** Transparent hourly rate formatted in CAD (`45.00 CAD / heure`) alongside student entitlement indicators (*"Inclus dans votre forfait"*).

2. **Calm, High-Stakes Visual Language**:
   - Elevated white/card surfaces (`bg-card`), subtle borders (`border-border/80`), and restrained typography.
   - No aggressive commercial marketing, spam badges, or cluttering review stars.
   - Initial-based clean avatars with verified shield indicators (`ShieldCheck`).

3. **Primary CTA**:
   - **"Voir le profil"**: Directs students to `/teachers/:id` to review pedagogical methodology, credentials, and select specific calendar slots before booking.

4. **Privacy & Trust Guarantees**:
   - Zero exposure of teacher private contact information (personal email, phone number).
   - Zero exposure of internal calendar identifiers, provider IDs, or platform earnings.

---

## 3. Component Architecture & Hierarchy

```
TeachersDirectoryPage (/teachers)
│
├── StudentLayout & PageShell
│   │
│   ├── TeachersHeader
│   │   ├── Title ("Trouver un professeur")
│   │   ├── Verified Teachers Count Badge
│   │   └── "Mes réservations" Quick Action Link
│   │
│   ├── Search & Sort Bar
│   │   ├── TeacherSearch (Debounced 300ms, clear button, accessible searchbox role)
│   │   └── TeacherSort (Dropdown: Recommandés, Tarif croissant, Tarif décroissant)
│   │
│   ├── TeacherFilterBar (Desktop inline segmented controls + mobile trigger)
│   │   ├── Specialization Pills ("Toutes", "Expression orale", "Expression écrite", "Méthodologie")
│   │   ├── Level Pills ("Tous", "B1", "B2", "C1")
│   │   ├── Price Pills ("Tous", "< 50 CAD", "50 - 70 CAD", "> 70 CAD")
│   │   ├── Availability Pills ("Toutes dates", "Aujourd'hui", "Cette semaine")
│   │   └── Reset Action (Visible when filters are active)
│   │
│   ├── TeacherFiltersSheet (Mobile dialog slide-out, full touch-optimized filter controls)
│   │
│   ├── TeacherSkeleton (6 fluid card skeletons displayed during async queries)
│   │
│   ├── TeacherEmptyState (Clean dashed-card state with "Réinitialiser les filtres" button)
│   │
│   ├── TeacherGrid (Responsive 1/2/3-column grid)
│   │   └── TeacherCard
│   │       ├── Avatar + Identity + Verified Shield
│   │       ├── Headline & Bio Snippet
│   │       ├── TeacherServiceBadges (Specialty tags)
│   │       ├── TeacherAvailabilityPreview (Live earliest slot indicator from /slots API)
│   │       ├── Hourly Rate + Entitlement Badge ("Inclus dans votre forfait")
│   │       └── Primary CTA ("Voir le profil")
│   │
│   └── TeacherPagination (Accessible Previous/Next and page number navigation)
```

---

## 4. State Management & URL Synchronization
- All filter and search states (`search`, `specialization`, `level`, `price`, `availability`, `sort`, `page`) are bidirectionally synchronized with URL search params using `useSearchParams`.
- Deep linking and browser back/forward navigation preserve active search queries and filter selections.
- Client-side sorting and fallback mechanisms provide smooth performance even on low-bandwidth connections.

---

## 5. API Contracts Reused
1. `GET /api/v1/teachers`
   - Parameters: `specialization`, `level`, `min_price`, `max_price`, `page`, `page_size`
   - Returns paginated list of `TeacherSummary` objects.
2. `GET /api/v1/teachers/{teacher_id}/slots`
   - Parameters: `date_from`, `date_to`, `student_timezone`
   - Returns bookable 60-minute `TimeSlot`s in the student's detected local timezone.
3. `GET /api/v1/billing/entitlements`
   - Returns student subscription tier, active entitlement flags, and credit balance.
