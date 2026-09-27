"""Audio utilities for raw linear PCM to WAV conversion and turn audio storage."""

import io
import uuid
import wave

import structlog

from app.core.storage import StorageService

logger = structlog.get_logger("tef-api.speaking.audio")


def pcm_to_wav(
    pcm_bytes: bytes,
    sample_rate: int = 16000,
    channels: int = 1,
    sample_width: int = 2,
) -> bytes:
    """Wraps raw linear PCM audio bytes into a canonical RIFF/WAVE container.

    Args:
        pcm_bytes: Raw linear PCM samples.
        sample_rate: Sampling frequency in Hz (16000 for candidate, 24000 for examiner).
        channels: Channel count (1 for mono).
        sample_width: Bytes per sample (2 for 16-bit linear PCM).

    Returns:
        Bytes containing the complete, valid WAV file header and PCM payload.
    """
    if not pcm_bytes:
        # Return a valid empty WAV header
        pcm_bytes = b""

    wav_io = io.BytesIO()
    with wave.open(wav_io, "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_bytes)

    return wav_io.getvalue()


def calculate_audio_duration(
    pcm_bytes: bytes,
    sample_rate: int = 16000,
    channels: int = 1,
    sample_width: int = 2,
) -> float:
    """Calculates duration in seconds of linear PCM audio."""
    bytes_per_second = sample_rate * channels * sample_width
    if bytes_per_second <= 0:
        return 0.0
    return round(len(pcm_bytes) / bytes_per_second, 3)


def build_turn_audio_storage_path(
    exam_id: uuid.UUID | str,
    section_type: str,
    turn_number: int,
    speaker: str,
) -> tuple[str, str, str]:
    """Generates the deterministic folder, filename, and extension for turn audio.

    Pattern:
        Folder: speaking/exams/{exam_id}/{section_type}
        Filename: turn_{turn_number:03d}_{speaker}
        Extension: .wav
    """
    norm_section = str(section_type).lower()
    norm_speaker = str(speaker).lower()
    folder = f"speaking/exams/{exam_id}/{norm_section}"
    filename = f"turn_{turn_number:03d}_{norm_speaker}"
    return folder, filename, ".wav"


def save_turn_audio(
    storage: StorageService,
    exam_id: uuid.UUID | str,
    section_type: str,
    turn_number: int,
    speaker: str,
    pcm_bytes: bytes,
    sample_rate: int = 16000,
) -> tuple[str, float]:
    """Converts PCM to WAV, uploads to private object storage, and returns (object_key, duration_seconds).

    Args:
        storage: Object storage service instance.
        exam_id: Speaking examination UUID.
        section_type: Section identifier ("section_a" or "section_b").
        turn_number: 1-indexed conversational turn number.
        speaker: Speaker identifier ("candidate" or "examiner").
        pcm_bytes: Raw 16-bit linear PCM audio chunk.
        sample_rate: 16000 Hz for candidate audio, 24000 Hz for examiner audio.

    Returns:
        Tuple of (object_key, duration_seconds).
    """
    duration = calculate_audio_duration(pcm_bytes, sample_rate=sample_rate)
    wav_bytes = pcm_to_wav(pcm_bytes, sample_rate=sample_rate)
    folder, filename, ext = build_turn_audio_storage_path(
        exam_id=exam_id,
        section_type=section_type,
        turn_number=turn_number,
        speaker=speaker,
    )

    wav_io = io.BytesIO(wav_bytes)
    object_key = storage.upload_file(
        file_obj=wav_io,
        content_type="audio/wav",
        folder=folder,
        filename=filename,
        file_extension=ext,
    )

    logger.info(
        "Saved turn audio to object storage",
        object_key=object_key,
        duration_seconds=duration,
        turn_number=turn_number,
        speaker=speaker,
        exam_id=str(exam_id),
    )
    return object_key, duration
