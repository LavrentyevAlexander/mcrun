"""Tests for request/response helpers in api/_db.py."""
import io

import pytest

from _db import BadRequest, read_json_body


class _FakeHeaders(dict):
    def get(self, key, default=None):  # http.client.HTTPMessage-style .get
        return super().get(key, default)


class _FakeHandler:
    def __init__(self, body: bytes, content_length=None):
        self.rfile = io.BytesIO(body)
        length = len(body) if content_length is None else content_length
        self.headers = _FakeHeaders({"Content-Length": str(length)})


def test_read_json_body_parses_object():
    h = _FakeHandler(b'{"a": 1, "b": "x"}')
    assert read_json_body(h) == {"a": 1, "b": "x"}


def test_read_json_body_empty_when_no_length():
    h = _FakeHandler(b"", content_length=0)
    assert read_json_body(h) == {}


def test_read_json_body_rejects_malformed_json():
    h = _FakeHandler(b"{not json")
    with pytest.raises(BadRequest):
        read_json_body(h)


def test_read_json_body_rejects_non_object():
    h = _FakeHandler(b"[1, 2, 3]")
    with pytest.raises(BadRequest):
        read_json_body(h)


def test_read_json_body_rejects_bad_content_length():
    h = _FakeHandler(b"{}")
    h.headers["Content-Length"] = "abc"
    with pytest.raises(BadRequest):
        read_json_body(h)
