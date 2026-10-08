"""Tests for the pure parsing helpers in api/sync_utmb.py."""
from sync_utmb import _index_map, _parse_race


def test_index_map_reads_known_categories():
    raw = [
        {"piCategory": "general", "index": 454},
        {"piCategory": "20k", "index": 452},
        {"piCategory": "50k", "index": 410},
        {"piCategory": "100k", "index": None},
        {"piCategory": "100m", "index": None},
    ]
    assert _index_map(raw) == {
        "general": 454, "20k": 452, "50k": 410, "100k": None, "100m": None,
    }


def test_index_map_defaults_missing_categories_to_none():
    assert _index_map([{"piCategory": "general", "index": 700}]) == {
        "general": 700, "20k": None, "50k": None, "100k": None, "100m": None,
    }


def test_index_map_ignores_unknown_categories():
    assert _index_map([{"piCategory": "marathon", "index": 999}])["general"] is None


def test_index_map_handles_empty_input():
    assert _index_map(None) == {
        "general": None, "20k": None, "50k": None, "100k": None, "100m": None,
    }


_SAMPLE_RACE = {
    "date": "09.19.2026",
    "dateIso": "2026-09-19",
    "raceYearId": 140182,
    "race": "Prokletije Trail 2026 2026 - BLUE 29K",
    "raceName": "BLUE 29K",
    "eventName": "Prokletije Trail 2026",
    "eventYear": 2026,
    "piCategory": "20k",
    "distance": "29.24",
    "elevationGain": 1784,
    "time": "04:50:23",
    "isDnf": False,
    "rank": 23,
    "rankGender": 18,
    "totalRanked": 54,
    "uri": "58472.prokletijetrail2026blue29k.2026",
    "country": "Montenegro",
}


def test_parse_race_extracts_expected_fields():
    row = _parse_race(_SAMPLE_RACE)
    assert row == (
        "58472.prokletijetrail2026blue29k.2026",
        "2026-09-19",
        "Prokletije Trail 2026",
        "BLUE 29K",
        29.24,
        1784,
        "04:50:23",
        "20k",
        23,
        18,
        54,
        False,
        "Montenegro",
    )


def test_parse_race_returns_none_when_missing_uri():
    raw = dict(_SAMPLE_RACE)
    del raw["uri"]
    assert _parse_race(raw) is None


def test_parse_race_returns_none_when_missing_date():
    raw = dict(_SAMPLE_RACE)
    del raw["dateIso"]
    assert _parse_race(raw) is None


def test_parse_race_handles_unparseable_distance():
    raw = dict(_SAMPLE_RACE)
    raw["distance"] = "N/A"
    row = _parse_race(raw)
    assert row[4] is None


def test_parse_race_coerces_is_dnf_to_bool():
    raw = dict(_SAMPLE_RACE)
    raw["isDnf"] = None
    row = _parse_race(raw)
    assert row[11] is False
