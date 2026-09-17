"""Enums for the learning intelligence domain."""

from enum import Enum


class SkillCategory(str, Enum):
    """Core skill categories supported by the TEF preparation platform."""

    READING = "reading"
    LISTENING = "listening"
    WRITING = "writing"
    SPEAKING = "speaking"
    VOCABULARY = "vocabulary"
    GRAMMAR = "grammar"
    CONJUGATION = "conjugation"


class RecommendationType(str, Enum):
    """Types of learning recommendations."""

    EXERCISE = "exercise"
    REVIEW = "review"
    PRACTICE = "practice"


class RecommendationStatus(str, Enum):
    """Lifecycle status of a recommendation."""

    ACTIVE = "active"
    COMPLETED = "completed"
    DISMISSED = "dismissed"
