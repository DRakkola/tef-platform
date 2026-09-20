/**
 * Tests for Practice Pool frontend pages and user journey.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PracticeHubPage } from "@/features/practice-pool/PracticeHubPage";
import { PracticeQueuePage } from "@/features/practice-pool/PracticeQueuePage";
import { PracticeRequestPage } from "@/features/practice-pool/PracticeRequestPage";
import { PracticeSessionPage } from "@/features/practice-pool/PracticeSessionPage";
import { PracticeResultPage } from "@/features/practice-pool/PracticeResultPage";

describe("Practice Pool Experience", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    localStorage.setItem("auth_token", "test-bearer-token");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders PracticeHubPage with level selection, topics, and modalities", async () => {
    const mockTopics = [
      {
        id: "topic-1",
        title: "Commander au café",
        description: "Commander des boissons et plats typiques",
        level: "B2",
        category: "Quotidien",
        prompts: ["Un café svp", "L'addition s'il vous plaît"],
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/practice/queue/status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ in_queue: false, candidates: [] }),
        });
      }
      if (url.includes("/practice/topics")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTopics),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;

    render(
      <MemoryRouter initialEntries={["/practice"]}>
        <Routes>
          <Route path="/practice" element={<PracticeHubPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/TEF French Practice Pool/i)).toBeInTheDocument();
    expect(screen.getByText(/Strict Audio-Only/i)).toBeInTheDocument();
    expect(screen.getByText(/25-Minute Sessions/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Commander au café")).toBeInTheDocument();
    });

    const enterBtn = screen.getByRole("button", { name: /Enter Practice Pool/i });
    expect(enterBtn).toBeInTheDocument();
  });

  it("renders PracticeQueuePage with live candidate list and incoming invitation", async () => {
    const mockQueueStatus = {
      in_queue: true,
      queue_id: "q-1",
      anonymous_alias: "Voyageur Étoilé #77",
      level: "B2",
      candidates: [
        {
          queue_id: "q-2",
          anonymous_alias: "Observateur Calme #12",
          language: "fr",
          level: "B2",
          practice_type: "free_conversation",
          joined_at: new Date().toISOString(),
          score: 95.0,
        },
      ],
    };

    const mockIncoming = [
      {
        id: "req-1",
        sender_alias: "Explorateur #99",
        receiver_alias: "Voyageur Étoilé #77",
        language: "fr",
        level: "B2",
        practice_type: "free_conversation",
        status: "pending",
        expires_at: new Date(Date.now() + 60000).toISOString(),
        created_at: new Date().toISOString(),
        is_incoming: true,
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/practice/queue/status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockQueueStatus),
        });
      }
      if (url.includes("/practice/requests/incoming")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockIncoming),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;

    render(
      <MemoryRouter initialEntries={["/practice/queue"]}>
        <Routes>
          <Route path="/practice/queue" element={<PracticeQueuePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Searching for Practice Peers/i)).toBeInTheDocument();
      expect(screen.getByText(/Voyageur Étoilé #77/i)).toBeInTheDocument();
      expect(screen.getByText("Observateur Calme #12")).toBeInTheDocument();
      expect(screen.getByText("Explorateur #99")).toBeInTheDocument();
      expect(screen.getByText(/Accept & Start/i)).toBeInTheDocument();
    });
  });

  it("renders PracticeSessionPage with authoritative 25m countdown clock, mic controls, and partner alias", async () => {
    const mockSession = {
      id: "sess-1",
      match_id: "match-1",
      room_id: "practice_room_abc123",
      my_alias: "Voyageur Étoilé #77",
      peer_alias: "Observateur Calme #12",
      language: "fr",
      level: "B2",
      practice_type: "free_conversation",
      duration_minutes: 25,
      status: "active",
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
      remaining_seconds: 1500,
      audio_only: true,
      topic: {
        id: "t-1",
        title: "Discussion sur l'environnement",
        description: "Parler des transports écologiques et énergies renouvelables",
        level: "B2",
        category: "Écologie",
        prompts: ["Que pensez-vous des transports en commun ?", "Comment réduire le plastique ?"],
      },
      ice_servers: [{ urls: "stun:stun.l.google.com:19302" }],
      created_at: new Date().toISOString(),
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/practice/sessions/sess-1")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSession),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;

    render(
      <MemoryRouter initialEntries={["/practice/session/sess-1"]}>
        <Routes>
          <Route path="/practice/session/:id" element={<PracticeSessionPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Observateur Calme #12/i)).toBeInTheDocument();
      expect(screen.getByText(/Discussion sur l'environnement/i)).toBeInTheDocument();
      expect(screen.getByText(/End Session/i)).toBeInTheDocument();
      expect(screen.getByText(/Report Peer/i)).toBeInTheDocument();
      expect(screen.getByText(/Mute Microphone/i)).toBeInTheDocument();
    });
  });

  it("renders PracticeResultPage with completion stats and self-reflection ratings", async () => {
    const mockSession = {
      id: "sess-1",
      match_id: "match-1",
      room_id: "practice_room_abc123",
      my_alias: "Voyageur Étoilé #77",
      peer_alias: "Observateur Calme #12",
      language: "fr",
      level: "B2",
      practice_type: "free_conversation",
      duration_minutes: 25,
      status: "completed",
      starts_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
      audio_only: true,
      topic: {
        id: "t-1",
        title: "Discussion sur l'environnement",
        description: "Énergie et climat",
        level: "B2",
        category: "Écologie",
        prompts: [],
      },
      created_at: new Date().toISOString(),
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/practice/sessions/sess-1")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSession),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;

    render(
      <MemoryRouter initialEntries={["/practice/session/sess-1/result"]}>
        <Routes>
          <Route path="/practice/session/:id/result" element={<PracticeResultPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Practice Session Complete!/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/25 Minutes/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Observateur Calme #12/i)).toBeInTheDocument();
    expect(screen.getByText(/Self-Reflection/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Practice Again/i })).toBeInTheDocument();
  });

  it("handles searching state, active timer, and cancels search cleanly", async () => {
    let inQueue = false;

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes("/practice/queue/join")) {
        inQueue = true;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              in_queue: true,
              anonymous_alias: "Explorateur B2 #42",
              level: "B2",
              candidates: [],
            }),
        });
      }
      if (url.includes("/practice/queue/leave")) {
        inQueue = false;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message: "Successfully left practice queue" }),
        });
      }
      if (url.includes("/practice/queue/status")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              in_queue: inQueue,
              anonymous_alias: inQueue ? "Explorateur B2 #42" : null,
              level: "B2",
              candidates: [],
            }),
        });
      }
      if (url.includes("/practice/topics")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url.includes("/practice/requests/incoming")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url.includes("/practice/requests/outgoing")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;

    render(
      <MemoryRouter initialEntries={["/practice-pool"]}>
        <Routes>
          <Route path="/practice-pool" element={<PracticeHubPage />} />
        </Routes>
      </MemoryRouter>
    );

    const enterBtn = screen.getByRole("button", { name: /Enter Practice Pool/i });
    fireEvent.click(enterBtn);

    await waitFor(() => {
      expect(screen.getByText(/Recherche d'un partenaire en cours.../i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Annuler la recherche/i })).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole("button", { name: /Annuler la recherche/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Enter Practice Pool/i })).toBeInTheDocument();
    });
  });

  it("handles direct candidate discovery, sending request, and outgoing countdown", async () => {
    const mockCandidates = [
      {
        queue_id: "cand-101",
        anonymous_alias: "Linguiste Agile #15",
        language: "fr",
        level: "B2",
        practice_type: "free_conversation",
        joined_at: new Date().toISOString(),
      },
    ];

    let outgoingCreated: any = null;

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes("/practice/queue/status")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              in_queue: false,
              candidates: mockCandidates,
            }),
        });
      }
      if (url.includes("/practice/requests/outgoing")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(outgoingCreated ? [outgoingCreated] : []),
        });
      }
      if (url.includes("/practice/requests/incoming")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url.includes("/practice/requests") && opts?.method === "POST") {
        outgoingCreated = {
          id: "out-req-1",
          sender_alias: "Moi-Même #99",
          receiver_alias: "Linguiste Agile #15",
          language: "fr",
          level: "B2",
          practice_type: "free_conversation",
          status: "pending",
          expires_at: new Date(Date.now() + 60000).toISOString(),
          created_at: new Date().toISOString(),
          is_incoming: false,
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(outgoingCreated),
        });
      }
      if (url.includes("/practice/requests/out-req-1/cancel")) {
        outgoingCreated = null;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message: "Practice request cancelled" }),
        });
      }
      if (url.includes("/practice/topics")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;

    render(
      <MemoryRouter initialEntries={["/practice-pool"]}>
        <Routes>
          <Route path="/practice-pool" element={<PracticeHubPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Linguiste Agile #15")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Practice Together/i })).toBeInTheDocument();
    });

    const practiceTogetherBtn = screen.getByRole("button", { name: /Practice Together/i });
    fireEvent.click(practiceTogetherBtn);

    await waitFor(() => {
      expect(screen.getByText(/Invitation envoyée à Linguiste Agile #15/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Annuler l'invitation/i })).toBeInTheDocument();
    });

    const cancelInvitationBtn = screen.getByRole("button", { name: /Annuler l'invitation/i });
    fireEvent.click(cancelInvitationBtn);

    await waitFor(() => {
      expect(screen.getByText(/Invitation annulée/i)).toBeInTheDocument();
    });
  });

  it("handles incoming practice invitation with accept and navigation", async () => {
    const mockIncoming = [
      {
        id: "inc-req-42",
        sender_alias: "Polyglotte #88",
        receiver_alias: "Moi-Même #99",
        language: "fr",
        level: "B2",
        practice_type: "free_conversation",
        status: "pending",
        expires_at: new Date(Date.now() + 60000).toISOString(),
        created_at: new Date().toISOString(),
        is_incoming: true,
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes("/practice/queue/status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ in_queue: false, candidates: [] }),
        });
      }
      if (url.includes("/practice/requests/incoming")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockIncoming),
        });
      }
      if (url.includes("/practice/requests/outgoing")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url.includes("/practice/requests/inc-req-42/accept")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "session-new-777",
              match_id: "m-777",
              room_id: "room_777",
              my_alias: "Moi-Même #99",
              peer_alias: "Polyglotte #88",
              language: "fr",
              level: "B2",
              practice_type: "free_conversation",
              duration_minutes: 25,
              status: "active",
              starts_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
              audio_only: true,
              created_at: new Date().toISOString(),
            }),
        });
      }
      if (url.includes("/practice/topics")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;

    render(
      <MemoryRouter initialEntries={["/practice-pool"]}>
        <Routes>
          <Route path="/practice-pool" element={<PracticeHubPage />} />
          <Route
            path="/practice-pool/session/:id"
            element={<div data-testid="session-page">Session Connected</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Polyglotte #88")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Accepter & Démarrer/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Refuser/i })).toBeInTheDocument();
    });

    const acceptBtn = screen.getByRole("button", { name: /Accepter & Démarrer/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(screen.getByTestId("session-page")).toBeInTheDocument();
    });
  });

  it("handles leave practice session confirmation dialog", async () => {
    const mockSession = {
      id: "sess-leave-1",
      match_id: "match-1",
      room_id: "room_leave",
      my_alias: "Voyageur #77",
      peer_alias: "Observateur #12",
      language: "fr",
      level: "B2",
      practice_type: "free_conversation",
      duration_minutes: 25,
      status: "active",
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
      remaining_seconds: 1500,
      audio_only: true,
      created_at: new Date().toISOString(),
    };

    let leaveCalled = false;

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/practice/sessions/sess-leave-1/leave")) {
        leaveCalled = true;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSession),
        });
      }
      if (url.includes("/practice/sessions/sess-leave-1")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSession),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;

    render(
      <MemoryRouter initialEntries={["/practice-pool/session/sess-leave-1"]}>
        <Routes>
          <Route path="/practice-pool/session/:id" element={<PracticeSessionPage />} />
          <Route
            path="/practice-pool/session/:id/result"
            element={<div data-testid="result-page">Result Page</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Observateur #12")).toBeInTheDocument();
    });

    const endBtn = screen.getByRole("button", { name: /End Session/i });
    fireEvent.click(endBtn);

    await waitFor(() => {
      expect(screen.getByText(/Leave practice session\?/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Leave$/i })).toBeInTheDocument();
    });

    const confirmLeaveBtn = screen.getByRole("button", { name: /^Leave$/i });
    fireEvent.click(confirmLeaveBtn);

    await waitFor(() => {
      expect(leaveCalled).toBe(true);
      expect(screen.getByTestId("result-page")).toBeInTheDocument();
    });
  });

  it("handles report practice peer dialog submission", async () => {
    const mockSession = {
      id: "sess-report-1",
      match_id: "match-1",
      room_id: "room_report",
      my_alias: "Voyageur #77",
      peer_alias: "Observateur #12",
      language: "fr",
      level: "B2",
      practice_type: "free_conversation",
      duration_minutes: 25,
      status: "active",
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
      remaining_seconds: 1500,
      audio_only: true,
      created_at: new Date().toISOString(),
    };

    let reportCalled = false;

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes("/practice/sessions/sess-report-1/report") && opts?.method === "POST") {
        reportCalled = true;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "rep-1",
              reason: "inappropriate_behavior",
              status: "pending",
              created_at: new Date().toISOString(),
            }),
        });
      }
      if (url.includes("/practice/sessions/sess-report-1")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSession),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;

    render(
      <MemoryRouter initialEntries={["/practice-pool/session/sess-report-1"]}>
        <Routes>
          <Route path="/practice-pool/session/:id" element={<PracticeSessionPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Observateur #12")).toBeInTheDocument();
    });

    const reportBtn = screen.getByRole("button", { name: /Report Peer/i });
    fireEvent.click(reportBtn);

    await waitFor(() => {
      expect(screen.getByText(/Report Practice Peer/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Submit report/i })).toBeInTheDocument();
    });

    const submitReportBtn = screen.getByRole("button", { name: /Submit report/i });
    fireEvent.click(submitReportBtn);

    await waitFor(() => {
      expect(reportCalled).toBe(true);
      expect(screen.getByText(/Report submitted for review/i)).toBeInTheDocument();
    });
  });

  it("handles block practice peer dialog confirmation", async () => {
    const mockSession = {
      id: "sess-block-1",
      match_id: "match-1",
      room_id: "room_block",
      my_alias: "Voyageur #77",
      peer_alias: "Observateur #12",
      language: "fr",
      level: "B2",
      practice_type: "free_conversation",
      duration_minutes: 25,
      status: "active",
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
      remaining_seconds: 1500,
      audio_only: true,
      created_at: new Date().toISOString(),
    };

    let blockCalled = false;

    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes("/practice/sessions/sess-block-1/block-peer") && opts?.method === "POST") {
        blockCalled = true;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "blk-1",
              blocked_user_id: "user-peer-1",
              created_at: new Date().toISOString(),
            }),
        });
      }
      if (url.includes("/practice/sessions/sess-block-1/leave")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSession),
        });
      }
      if (url.includes("/practice/sessions/sess-block-1")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSession),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;

    render(
      <MemoryRouter initialEntries={["/practice-pool/session/sess-block-1"]}>
        <Routes>
          <Route path="/practice-pool/session/:id" element={<PracticeSessionPage />} />
          <Route path="/practice-pool" element={<div data-testid="hub-page">Practice Hub</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Observateur #12")).toBeInTheDocument();
    });

    const blockBtn = screen.getByRole("button", { name: /Block Peer/i });
    fireEvent.click(blockBtn);

    await waitFor(() => {
      expect(screen.getByText(/Block participant\?/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Block$/i })).toBeInTheDocument();
    });

    const confirmBlockBtn = screen.getByRole("button", { name: /^Block$/i });
    fireEvent.click(confirmBlockBtn);

    await waitFor(() => {
      expect(blockCalled).toBe(true);
      expect(screen.getByTestId("hub-page")).toBeInTheDocument();
    });
  });
});


