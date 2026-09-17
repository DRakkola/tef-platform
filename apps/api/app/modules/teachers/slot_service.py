"""Slot generation service translating recurring rules and exceptions into available booking slots."""

import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.modules.teachers.enums import BookingStatus
from app.modules.teachers.models import (
    TeacherAvailabilityException,
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
    except ZoneInfoNotFoundError, ValueError, KeyError:
        return ZoneInfo("UTC")


def generate_available_slots(
    teacher: TeacherProfile,
    rules: list[TeacherAvailabilityRule],
    exceptions: list[TeacherAvailabilityException],
    existing_bookings: list[TeacherBooking],
    date_from: datetime.date,
    date_to: datetime.date,
    student_timezone: str = "UTC",
    slot_duration_minutes: int = 60,
    now_utc: datetime.datetime | None = None,
) -> TeacherSlotsResponse:
    """Calculate discrete bookable slots within [date_from, date_to].

    1. Applies teacher recurring availability rules.
    2. Modifies / blocks days with exceptions.
    3. Translates teacher local time to UTC.
    4. Excludes past slots and overlapping active bookings.
    5. Projects into student's target timezone.
    """
    if now_utc is None:
        now_utc = datetime.datetime.now(datetime.UTC)

    student_tz = get_safe_zoneinfo(student_timezone)

    # Index exceptions by date
    exceptions_by_date: dict[datetime.date, TeacherAvailabilityException] = {
        exc.exception_date: exc for exc in exceptions
    }

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
    delta_days = (date_to - date_from).days

    for day_offset in range(delta_days + 1):
        curr_date = date_from + datetime.timedelta(days=day_offset)

        # Check for exception
        if curr_date in exceptions_by_date:
            exc = exceptions_by_date[curr_date]
            if exc.is_unavailable:
                # Whole day blocked
                continue
            # Modified hours for this day
            if exc.start_time and exc.end_time:
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

        for w_start, w_end, w_tz_str in windows:
            w_tz = get_safe_zoneinfo(w_tz_str)
            # Local start/end datetimes in the specified timezone
            local_start = datetime.datetime.combine(curr_date, w_start).replace(tzinfo=w_tz)
            local_end = datetime.datetime.combine(curr_date, w_end).replace(tzinfo=w_tz)

            # Convert to UTC
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

                # 2. Overlapping booking filter: max(start1, start2) < min(end1, end2)
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
