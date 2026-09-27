import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useDuplexAudioEngine, downsampleTo16k, pcm16ToBase64 } from "@/features/speaking/useDuplexAudioEngine"

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

describe("useDuplexAudioEngine Unit & Acoustic Bleed Gating Tests", () => {
  const originalWebSocket = global.WebSocket

  beforeEach(() => {
    MockWebSocket.instances = []
    // @ts-expect-error mock assignment
    global.WebSocket = MockWebSocket
  })

  afterEach(() => {
    global.WebSocket = originalWebSocket
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("downsamples 48kHz float32 to 16kHz linear PCM 16-bit correctly", () => {
    const inputSampleRate = 48000
    const float32 = new Float32Array(480) // 10ms of 48kHz audio
    // Generate sine wave
    for (let i = 0; i < float32.length; i++) {
      float32[i] = Math.sin((2 * Math.PI * 440 * i) / inputSampleRate)
    }

    const pcm16 = downsampleTo16k(float32, inputSampleRate)
    // 480 / (48000 / 16000) = 160 samples
    expect(pcm16.length).toBe(160)
    expect(pcm16 instanceof Int16Array).toBe(true)

    const b64 = pcm16ToBase64(pcm16)
    expect(typeof b64).toBe("string")
    expect(b64.length).toBeGreaterThan(0)
  })

  it("establishes connection and handles incoming Gemini Live events", async () => {
    const onAISpeakingStateChange = vi.fn()
    const onTurnChange = vi.fn()
    const onTranscript = vi.fn()

    const { result } = renderHook(() =>
      useDuplexAudioEngine({
        wsUrl: "ws://localhost:8000/api/v1/admin/ai-sandbox/speaking/live-ws",
        enabled: true,
        onAISpeakingStateChange,
        onTurnChange,
        onTranscript,
      })
    )

    const ws = MockWebSocket.instances[0]
    expect(ws).toBeDefined()
    expect(result.current.connectionState).toBe("connecting")

    act(() => {
      ws.triggerOpen()
    })
    expect(result.current.connectionState).toBe("connected")

    // Simulate incoming examiner transcript
    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          action: "transcript",
          role: "examiner",
          text: "Bonjour, parlez-moi de votre projet.",
        }),
      })
    })

    expect(result.current.transcripts.length).toBe(1)
    expect(result.current.transcripts[0].text).toBe("Bonjour, parlez-moi de votre projet.")
    expect(onTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "examiner",
        text: "Bonjour, parlez-moi de votre projet.",
      })
    )

    // Simulate incoming server turn_change
    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          action: "turn_change",
          turn: "student",
          ai_state: "listening",
        }),
      })
    })
    expect(result.current.activeTurn).toBe("student")
    expect(result.current.aiState).toBe("listening")

    // Simulate incoming server interruption
    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          action: "interrupted",
        }),
      })
    })
    expect(result.current.interruptionCount).toBe(1)
    expect(result.current.aiState).toBe("listening")
  })

  it("enforces Push-to-Talk gating and flushes silence burst on turn release", async () => {
    const { result } = renderHook(() =>
      useDuplexAudioEngine({
        wsUrl: "ws://localhost:8000/api/v1/test",
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

    // Toggle PTT ON
    act(() => {
      result.current.togglePtt()
    })
    expect(result.current.isPttActive).toBe(true)
    expect(result.current.activeTurn).toBe("student")

    // Toggle PTT OFF -> flushes 25 silence chunks to complete Gemini server VAD turn
    act(() => {
      result.current.togglePtt()
    })
    expect(result.current.isPttActive).toBe(false)
    expect(result.current.aiState).toBe("thinking")

    const silenceChunks = ws.sentData.filter((raw) => {
      try {
        const parsed = JSON.parse(raw)
        return (
          parsed.action === "audio_chunk" &&
          parsed.mime_type === "audio/pcm;rate=16000"
        )
      } catch {
        return false
      }
    })
    expect(silenceChunks.length).toBe(25)
  })

  it("supports global keyboard 'T' shortcut for PTT", async () => {
    const { result } = renderHook(() =>
      useDuplexAudioEngine({
        wsUrl: "ws://localhost:8000/api/v1/test",
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

    // Press 'T'
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "T" }))
    })
    expect(result.current.isPttActive).toBe(false)
  })
})
