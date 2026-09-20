"""Activity tracking service capturing and serving student learning events."""

import datetime
import uuid
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.learning.models import StudentActivityEvent


class ActivityTracker:
    """Records and retrieves immutable student activity events with strict privacy isolation."""

    @classmethod
    async def record_activity(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        event_type: str,
        title: str,
        entity_type: str | None = None,
        entity_id: uuid.UUID | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> StudentActivityEvent:
        """Persist a privacy-isolated learning event."""
        event_metadata = metadata or {}
        event_metadata["title"] = title

        event = StudentActivityEvent(
            user_id=user_id,
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_payload=event_metadata,
            created_at=datetime.datetime.now(datetime.UTC),
        )
        db.add(event)
        await db.flush()
        return event

    @classmethod
    async def get_student_activities(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        event_type: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Retrieve paginated activity history strictly scoped to the student."""
        query = select(StudentActivityEvent).where(StudentActivityEvent.user_id == user_id)
        count_query = select(func.count(StudentActivityEvent.id)).where(
            StudentActivityEvent.user_id == user_id
        )

        if event_type:
            query = query.where(StudentActivityEvent.event_type == event_type)
            count_query = count_query.where(StudentActivityEvent.event_type == event_type)

        total_count = (await db.scalar(count_query)) or 0
        events = (
            await db.execute(
                query.order_by(desc(StudentActivityEvent.created_at))
                .offset(offset)
                .limit(limit)
            )
        ).scalars().all()

        items = [
            {
                "id": ev.id,
                "user_id": ev.user_id,
                "event_type": ev.event_type,
                "entity_type": ev.entity_type,
                "entity_id": ev.entity_id,
                "title": ev.metadata_payload.get("title", ev.event_type.replace("_", " ").title()),
                "metadata": ev.metadata_payload,
                "created_at": ev.created_at,
            }
            for ev in events
        ]

        return {
            "items": items,
            "total": total_count,
            "limit": limit,
            "offset": offset,
        }
