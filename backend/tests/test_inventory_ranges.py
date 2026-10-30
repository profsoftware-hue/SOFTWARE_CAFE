from datetime import date, time, timedelta

import pytest
from fastapi import HTTPException

from app.api.routes.inventory import BOGOTA_TZ, _bogota_range_bounds


def test_empty_range_returns_unbounded_bounds() -> None:
    assert _bogota_range_bounds(None, None) == (None, None)


def test_single_day_range_covers_full_day_in_bogota() -> None:
    day = date(2026, 10, 30)
    start, end = _bogota_range_bounds(day, day)

    assert start is not None and end is not None
    assert start.date() == day
    assert end.date() == day
    assert start.timetz().replace(tzinfo=None) == time.min
    assert end.timetz().replace(tzinfo=None) == time.max
    assert start.utcoffset() == timedelta(hours=-5)
    assert end.utcoffset() == timedelta(hours=-5)
    assert start.tzinfo is BOGOTA_TZ


def test_only_start_date_leaves_end_unbounded() -> None:
    start, end = _bogota_range_bounds(date(2026, 10, 1), None)
    assert start is not None
    assert end is None


def test_only_end_date_leaves_start_unbounded() -> None:
    start, end = _bogota_range_bounds(None, date(2026, 10, 31))
    assert start is None
    assert end is not None


def test_reversed_range_is_rejected() -> None:
    with pytest.raises(HTTPException) as exc_info:
        _bogota_range_bounds(date(2026, 10, 31), date(2026, 10, 1))

    assert exc_info.value.status_code == 400
    assert "fecha inicial" in exc_info.value.detail.lower()
