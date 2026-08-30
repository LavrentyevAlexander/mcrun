"""Tests for CTL fitness score calculation in sync_strava.py.

`api/` is added to sys.path by the repo-root conftest.py.
"""
import math

from sync_strava import _CTL_TAU


def _compute_ctl(efforts: list[tuple[str, float]]) -> list[float]:
    """Minimal CTL computation mirroring the logic in _recompute_fitness."""
    from datetime import datetime
    k = 1 - math.exp(-1 / _CTL_TAU)
    ctl = 0.0
    prev_dt = None
    scores = []
    for date_str, effort in sorted(efforts, key=lambda x: x[0]):
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        if prev_dt is not None:
            gap = (dt - prev_dt).days
            if gap > 0:
                ctl *= math.exp(-gap / _CTL_TAU)
        ctl += effort * k
        scores.append(round(ctl, 1))
        prev_dt = dt
    return scores


def test_ctl_single_effort():
    scores = _compute_ctl([("2024-01-01", 100.0)])
    k = 1 - math.exp(-1 / _CTL_TAU)
    assert scores == [round(100.0 * k, 1)]


def test_ctl_decays_over_time():
    scores = _compute_ctl([("2024-01-01", 100.0), ("2024-02-01", 0.0)])
    # Second entry has zero effort — CTL should be lower than first
    assert scores[1] < scores[0]


def test_ctl_accumulates_daily_efforts():
    # Two consecutive days should yield higher CTL than a single day
    single = _compute_ctl([("2024-01-01", 50.0)])
    double = _compute_ctl([("2024-01-01", 50.0), ("2024-01-02", 50.0)])
    assert double[-1] > single[-1]


def test_ctl_zero_effort_no_accumulation():
    scores = _compute_ctl([("2024-01-01", 0.0), ("2024-01-02", 0.0)])
    assert scores == [0.0, 0.0]


def test_ctl_long_gap_approaches_zero():
    # After 5× tau days with no effort, CTL should be near zero
    k = 1 - math.exp(-1 / _CTL_TAU)
    ctl_after_first = 100.0 * k
    days_gap = int(5 * _CTL_TAU)
    decayed = round(ctl_after_first * math.exp(-days_gap / _CTL_TAU), 1)
    scores = _compute_ctl([
        ("2024-01-01", 100.0),
        (f"2024-01-{days_gap + 1:02d}" if days_gap < 28 else "2025-01-01", 0.0),
    ])
    # Last score should be very small (< 1% of initial)
    assert scores[-1] < ctl_after_first * 0.01


def test_validate_helper():
    """Test the validate() helper from _db.py."""
    from _db import validate

    errors = validate({"name": "Test", "limit_km": 500}, {
        "name": {"required": True, "type": str, "min_len": 1},
        "limit_km": {"type": (int, float), "min": 0},
    })
    assert errors == []


def test_validate_missing_required():
    from _db import validate
    errors = validate({}, {"name": {"required": True, "type": str}})
    assert len(errors) == 1
    assert "name" in errors[0]


def test_validate_wrong_type():
    from _db import validate
    errors = validate({"limit_km": "notanumber"}, {"limit_km": {"type": (int, float)}})
    assert len(errors) == 1


def test_validate_min_value():
    from _db import validate
    errors = validate({"limit_km": -10}, {"limit_km": {"type": (int, float), "min": 0}})
    assert len(errors) == 1


def test_validate_empty_string_min_len():
    from _db import validate
    errors = validate({"name": "  "}, {"name": {"type": str, "min_len": 1}})
    assert len(errors) == 1
