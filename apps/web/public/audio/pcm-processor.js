// public/audio/pcm-processor.js
/**
 * AudioWorkletProcessor running on an isolated rendering thread.
 * Quantizes Float32 browser audio data to signed 16-Bit PCM with zero-copy buffer transfer.
 */
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input[0]) {
      const inputChannel = input[0]; // Channel 0 (Mono)
      const pcmBuffer = new Int16Array(inputChannel.length);

      // Quantize Float32 browser data to signed 16-Bit PCM
      for (let i = 0; i < inputChannel.length; i++) {
        const s = Math.max(-1, Math.min(1, inputChannel[i]));
        pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      // Ship the binary buffer back to the main thread hook with zero-copy transfer
      this.port.postMessage(pcmBuffer.buffer, [pcmBuffer.buffer]);
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
