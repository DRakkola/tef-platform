import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useSpeakingWebRTC } from "@/features/speaking/useSpeakingWebRTC"

class MockWebSocket {
  static instances: MockWebSocket[] = []
  url: string
  readyState: number = WebSocket.CONNECTING
  sentData: string[] = []
  onopen: ((event: unknown) => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  triggerOpen() {
    this.readyState = WebSocket.OPEN
    if (this.onopen) this.onopen({})
  }

  send(data: string) {
    this.sentData.push(data)
  }

  close() {
    this.readyState = WebSocket.CLOSED
    if (this.onclose) this.onclose({})
  }
}

describe("SpeakingAudioPipeline Regression Tests", () => {
  const originalWebSocket = global.WebSocket

  beforeEach(() => {
    MockWebSocket.instances = []
    // @ts-expect-error mock assignment
    global.WebSocket = MockWebSocket
    // Mock localStorage auth token
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (key === "auth_token" ? "mock-test-token" : null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })

  afterEach(() => {
    global.WebSocket = originalWebSocket
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("does NOT connect WebSocket or send audio chunks when enabled is false (pre-join)", () => {
    const { result } = renderHook(() =>
      useSpeakingWebRTC({
        sessionId: "test-session-123",
        roomId: "test-room-123",
        enabled: false,
      })
    )

    // No WebSocket instance should exist before Join
    expect(MockWebSocket.instances.length).toBe(0)
    expect(result.current.connectionState).toBe("new")
  })

  it("connects WebSocket and transitions to connected when enabled is true (post-join)", async () => {
    let isJoined = false
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useSpeakingWebRTC({
          sessionId: "test-session-123",
          roomId: "test-room-123",
          enabled,
        }),
      { initialProps: { enabled: isJoined } }
    )

    expect(MockWebSocket.instances.length).toBe(0)

    // User joins session -> enabled becomes true
    isJoined = true
    rerender({ enabled: true })

    expect(MockWebSocket.instances.length).toBe(1)
    const ws = MockWebSocket.instances[0]
    expect(result.current.connectionState).toBe("connecting")

    // WebSocket completes handshake
    act(() => {
      ws.triggerOpen()
    })

    expect(result.current.connectionState).toBe("connected")
  })

  it("discards accumulated samples and marks state closed on intentional cleanup", async () => {
    const { result } = renderHook(() =>
      useSpeakingWebRTC({
        sessionId: "test-session-123",
        roomId: "test-room-123",
        enabled: true,
      })
    )

    const ws = MockWebSocket.instances[0]
    act(() => {
      ws.triggerOpen()
    })
    expect(result.current.connectionState).toBe("connected")

    // Cleanup resources (intentional leave)
    act(() => {
      result.current.cleanup()
    })

    // Closed and buffer discarded
    expect(ws.readyState).toBe(WebSocket.CLOSED)
    expect(result.current.connectionState).toBe("closed")
  })

  it("supports defaultAudioInputMode push_to_talk and toggles PTT with silence burst on finish", async () => {
    const { result } = renderHook(() =>
      useSpeakingWebRTC({
        sessionId: "test-session-ptt",
        roomId: "test-room-ptt",
        enabled: true,
        defaultAudioInputMode: "push_to_talk",
      })
    )

    const ws = MockWebSocket.instances[0]
    act(() => {
      ws.triggerOpen()
    })

    expect(result.current.audioInputMode).toBe("push_to_talk")
    expect(result.current.isPttActive).toBe(false)

    // Activate PTT
    act(() => {
      result.current.togglePtt()
    })

    expect(result.current.isPttActive).toBe(true)
    expect(result.current.activeTurn).toBe("student")

    // Deactivate PTT -> should flush 25 silence chunks to complete Gemini VAD turn
    act(() => {
      result.current.togglePtt()
    })

    expect(result.current.isPttActive).toBe(false)
    expect(result.current.aiState).toBe("thinking")

    const silenceChunks = ws.sentData.filter((msg) => {
      try {
        const parsed = JSON.parse(msg)
        return parsed.action === "audio_chunk" && parsed.mime_type === "audio/pcm;rate=16000"
      } catch {
        return false
      }
    })
    expect(silenceChunks.length).toBe(25)
  })

  it("toggles PTT via 'T' / 't' keyboard shortcut", async () => {
    const { result } = renderHook(() =>
      useSpeakingWebRTC({
        sessionId: "test-session-ptt-key",
        roomId: "test-room-ptt-key",
        enabled: true,
        defaultAudioInputMode: "push_to_talk",
      })
    )

    const ws = MockWebSocket.instances[0]
    act(() => {
      ws.triggerOpen()
    })

    expect(result.current.isPttActive).toBe(false)

    // Press 't'
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "t" }))
    })
    expect(result.current.isPttActive).toBe(true)

    // Press 'T' to toggle off
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "T" }))
    })
    expect(result.current.isPttActive).toBe(false)

    // Ctrl+T should NOT toggle PTT
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "t", ctrlKey: true }))
    })
    expect(result.current.isPttActive).toBe(false)
  })
})

