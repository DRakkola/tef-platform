"""Slot generation service translating recurring rules and exceptions into available booking slots."""

import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.modules.teachers.enums import BookingStatus
from app.modules.teachers.models import (
    TeacherAvailabilityException,
    TeacherAvailabilityOverride,
    TeacherAvailabilityRule,
    TeacherBooking,
)
from app.modules.teachers.schemas import TeacherSlotsResponse, TimeSlot
from app.modules.users.models import TeacherProfile


def get_safe_zoneinfo(tz_name: str | None) -> ZoneInfo:
    """Safely return a ZoneInfo object, falling back to UTC if unrecognized."""
    if not tz_name:
        return ZoneInfo("UTC")
    try:
        return ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError, KeyError):
        return ZoneInfo("UTC")


def generate_available_slots(
    teacher: TeacherProfile,
    rules: list[TeacherAvailabilityRule],
    exceptions: list[TeacherAvailabilityException],
    existing_bookings: list[TeacherBooking],
    date_from: datetime.date,
    date_to: datetime.date,
    overrides: list[TeacherAvailabilityOverride] | None = None,
    student_timezone: str = "UTC",
    slot_duration_minutes: int = 60,
    now_utc: datetime.datetime | None = None,
) -> TeacherSlotsResponse:
    """Calculate discrete bookable slots within [date_from, date_to].

    1. Applies teacher recurring availability rules.
    2. Modifies / blocks days with exceptions.
    3. Merges custom availability overrides (adds or excludes windows).
    4. Translates teacher local time to UTC.
    5. Excludes past slots and overlapping active bookings.
    6. Projects into student's target timezone.
    """
    if now_utc is None:
        now_utc = datetime.datetime.now(datetime.UTC)

    student_tz = get_safe_zoneinfo(student_timezone)

    # Index exceptions by date
    exceptions_by_date: dict[datetime.date, TeacherAvailabilityException] = {
        exc.exception_date: exc for exc in exceptions
    }

    # Index overrides by date
    overrides_by_date: dict[datetime.date, list[TeacherAvailabilityOverride]] = {}
    if overrides:
        for ov in overrides:
            overrides_by_date.setdefault(ov.override_date, []).append(ov)

    # Index active rules by weekday
    rules_by_weekday: dict[int, list[TeacherAvailabilityRule]] = {}
    for r in rules:
        if r.is_active:
            rules_by_weekday.setdefault(r.weekday, []).append(r)

    # Active bookings filter (only REQUESTED and CONFIRMED hold time slots)
    active_bookings = [
        b
        for b in existing_bookings
        if b.status in (BookingStatus.REQUESTED, BookingStatus.CONFIRMED)
    ]

    slots: list[TimeSlot] = []
    seen_slots: set[tuple[datetime.datetime, datetime.datetime]] = set()
    delta_days = (date_to - date_from).days

    for day_offset in range(delta_days + 1):
        curr_date = date_from + datetime.timedelta(days=day_offset)

        # Check for exception
        if curr_date in exceptions_by_date:
            exc = exceptions_by_date[curr_date]
            if exc.is_unavailable:
                # Whole day blocked
                windows = []
            elif exc.start_time and exc.end_time:
                windows = [(exc.start_time, exc.end_time, teacher.timezone or "UTC")]
            else:
                windows = []
        else:
            # Recurring weekday rules
            weekday = curr_date.weekday()
            active_day_rules = rules_by_weekday.get(weekday, [])
            windows = [
                (r.start_time, r.end_time, r.timezone or teacher.timezone or "UTC")
                for r in active_day_rules
            ]

        # Add custom positive availability windows from overrides
        day_overrides = overrides_by_date.get(curr_date, [])
        for ov in day_overrides:
            if ov.is_available:
                windows.append((ov.start_time, ov.end_time, ov.timezone or teacher.timezone or "UTC"))

        # Blackout windows from overrides with is_available=False
        blackouts = []
        for ov in day_overrides:
            if not ov.is_available:
                ov_tz = get_safe_zoneinfo(ov.timezone or teacher.timezone or "UTC")
                b_start = datetime.datetime.combine(curr_date, ov.start_time).replace(tzinfo=ov_tz).astimezone(datetime.UTC)
                b_end = datetime.datetime.combine(curr_date, ov.end_time).replace(tzinfo=ov_tz).astimezone(datetime.UTC)
                blackouts.append((b_start, b_end))

        for w_start, w_end, w_tz_str in windows:
            w_tz = get_safe_zoneinfo(w_tz_str)
            local_start = datetime.datetime.combine(curr_date, w_start).replace(tzinfo=w_tz)
            local_end = datetime.datetime.combine(curr_date, w_end).replace(tzinfo=w_tz)

            utc_window_start = local_start.astimezone(datetime.UTC)
            utc_window_end = local_end.astimezone(datetime.UTC)

            curr_slot_start = utc_window_start
            slot_delta = datetime.timedelta(minutes=slot_duration_minutes)

            while curr_slot_start + slot_delta <= utc_window_end:
                curr_slot_end = curr_slot_start + slot_delta

                # 1. Past slot filter
                if curr_slot_start <= now_utc:
                    curr_slot_start += slot_delta
                    continue

                # 2. Blackout override filter
                in_blackout = False
                for b_start, b_end in blackouts:
                    if max(curr_slot_start, b_start) < min(curr_slot_end, b_end):
                        in_blackout = True
                        break
                if in_blackout:
                    curr_slot_start += slot_delta
                    continue

                # 3. Overlapping booking filter
                has_overlap = False
                for b in active_bookings:
                    b_start = (
                        b.start_time.astimezone(datetime.UTC)
                        if b.start_time.tzinfo
                        else b.start_time.replace(tzinfo=datetime.UTC)
                    )
                    b_end = (
                        b.end_time.astimezone(datetime.UTC)
                        if b.end_time.tzinfo
                        else b.end_time.replace(tzinfo=datetime.UTC)
                    )

                    if max(curr_slot_start, b_start) < min(curr_slot_end, b_end):
                        has_overlap = True
                        break

                if not has_overlap:
                    slot_key = (curr_slot_start, curr_slot_end)
                    if slot_key not in seen_slots:
                        seen_slots.add(slot_key)
                        slot_local_start = curr_slot_start.astimezone(student_tz)
                        slot_local_end = curr_slot_end.astimezone(student_tz)

                        slots.append(
                            TimeSlot(
                                start_time=curr_slot_start,
                                end_time=curr_slot_end,
                                start_time_local=slot_local_start.strftime("%Y-%m-%d %H:%M %Z"),
                                end_time_local=slot_local_end.strftime("%Y-%m-%d %H:%M %Z"),
                                duration_minutes=slot_duration_minutes,
                            )
                        )

                curr_slot_start += slot_delta

    # Sort slots chronologically
    slots.sort(key=lambda s: s.start_time)

    return TeacherSlotsResponse(
        teacher_id=teacher.id,
        teacher_timezone=teacher.timezone or "UTC",
        student_timezone=student_timezone,
        date_from=date_from,
        date_to=date_to,
        slots=slots,
    )
