"""Pytest bootstrap: make the serverless modules in api/ importable from tests/."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "api"))
