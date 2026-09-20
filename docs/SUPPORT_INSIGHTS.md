# TEF Canada Platform — Support Ticket Insights & Root Cause Resolution

**Document Version:** 2.1.0-rc  
**Date:** September 18, 2026  
**Auditors:** Customer Support Lead & Principal Site Reliability Engineer  
**Dataset:** 9 Support Tickets Filed & Triaged During Beta Cohort 1  
**Status:** COMPLETE TRIAGE & PRODUCT REMEDIATION MAP  

---

## 1. Executive Summary

During the Private Beta phase, 9 user support tickets were filed across 34 active participants (ticket-to-user ratio: 0.26). All tickets were resolved within the operational SLA:
- **First Response Time:** Median 14 minutes (SLA: $\le 60$ minutes for normal, $\le 15$ minutes for urgent).
- **Time to Resolution:** Median 42 minutes (SLA: $\le 24$ hours).
- **Customer Resolution Satisfaction (CSAT):** 4.8 / 5.0.

---

## 2. Support Ticket Categorization & Volume Breakdown

| Category | Ticket Count | % of Total | Dominant Severity | Primary Impact |
|---|---|---|---|---|
| **Technical Bugs** | 3 | 33.3% | High (1), Normal (2) | Audio capture failure, question typo, autosave ambiguity |
| **UX & Interface Confusion** | 3 | 33.3% | Normal (2), Low (1) | Timezone in calendar, essay word count visibility, recommendation dismissal |
| **Pedagogical Disputes** | 2 | 22.2% | Normal | Candidate questioning AI grammar flag on French subjunctive |
| **Billing / Subscription Inquiries** | 1 | 11.1% | Low | Confirmation of sandbox mode non-billing |
| **Total** | **9** | **100.0%** | — | — |

---

## 3. Deep-Dive: Root Causes & Permanent Product Fixes

### Ticket #T-101: Microphone Access Error on iOS Safari
- **Severity:** High (User blocked from taking oral simulation).
- **Symptoms:** Candidate tapped "Start Speaking", but the browser threw a generic `NotAllowedError` without activating the audio visualizer.
- **Root Cause:** iOS Safari requires explicit user interaction immediately prior to invoking `navigator.mediaDevices.getUserMedia()`. The original code triggered permission within an asynchronous promise chain, which WebKit security blocks.
- **Immediate Resolution:** Support guided user to reset Safari site settings and refresh.
- **Permanent Product Fix:** Refactored audio initialization into a synchronous tap event handler with pre-flight permission inspection in `SpeakingTakingPage.tsx`.

### Ticket #T-102: Ambiguous Autosave Feedback During Essay Writing
- **Severity:** Normal.
- **Symptoms:** Candidate was writing a 250-word letter and feared losing text because there was no obvious confirmation that drafts were being saved.
- **Root Cause:** Autosave was debounced every 5 seconds, but the UI only updated a discreet small grey timestamp in the footer without distinct color cues.
- **Immediate Resolution:** Support confirmed all draft revisions were intact in the database.
- **Permanent Product Fix:** Added a high-visibility animated status pill in the top header: `Enregistrement en cours...` $\to$ `Brouillon synchronisé à 14:32` with green checkmark.

### Ticket #T-103: Teacher Booking Timezone Confusion
- **Severity:** Normal.
- **Symptoms:** Montreal candidate booked an 11:00 AM slot thinking it was Eastern Time, but the teacher had published it as 11:00 AM Central European Time (05:00 AM Montreal).
- **Root Cause:** The slot selector component did not explicitly state the timezone next to the hour pills.
- **Immediate Resolution:** Support cancelled and rescheduled the booking with full credit refund.
- **Permanent Product Fix:** Upgraded `TeacherBookingPage.tsx` to automatically detect client local timezone, convert all slot times, and display an explicit banner: *"Toutes les heures sont affichées dans votre fuseau horaire local (America/Montreal, UTC-4)"*.

### Ticket #T-104: Content Distractor Typo in Reading Test
- **Severity:** Normal.
- **Symptoms:** In Question #3 of Assessment #1, option C had a missing accent (*deja* instead of *déjà*).
- **Root Cause:** Minor proofreading oversight in original seed fixture.
- **Immediate Resolution:** Content updated via Admin Content Studio within 10 minutes.
- **Permanent Product Fix:** Integrated automated spell-checking and accent verification into the `validate-content` CLI.

### Ticket #T-105: Pedagogical Query on Subjunctive Trigger
- **Severity:** Normal.
- **Symptoms:** Candidate used *"Il est probable qu'il vienne"* and was marked incorrect with advice to use indicative (*viendra*).
- **Root Cause:** In French grammar, *il est probable que* takes the indicative (unlike *il est possible que* which requires the subjunctive). The candidate was confused by the subtlety.
- **Immediate Resolution:** Academic lead provided a detailed explanation of the nuance between probability (indicative) and possibility (subjunctive).
- **Permanent Product Fix:** Enhanced the AI feedback template to include specific comparative rule cards whenever this exact distinction is evaluated.

### Ticket #T-106: Recommendation Stagnation (Cannot Dismiss)
- **Severity:** Low.
- **Symptoms:** Student mastered logical connectors but was still seeing the exercise card at the top of their dashboard recommendations.
- **Root Cause:** No dismissal action on recommendation cards.
- **Immediate Resolution:** Support manually refreshed the student's recommendation cache.
- **Permanent Product Fix:** Implemented `POST /api/v1/learning/recommendations/{id}/dismiss` (V2.1 P0 Backlog Item 02).

---

## 4. Support Quality & Escalation Metrics

```
Average First Response Time: 14 minutes
Average Full Resolution Time: 42 minutes
First Contact Resolution (FCR) Rate: 77.8% (7 / 9 tickets)
Reopened Tickets: 0
Escalated to Engineering: 3 tickets
```

---

## 5. Support Operations Sign-Off

All customer pain points identified during the beta have been mapped to concrete engineering fixes in V2.1. The support desk has zero unresolved or overdue tickets.

**Support Review Status:** **APPROVED FOR V2.1 RELEASE.**
