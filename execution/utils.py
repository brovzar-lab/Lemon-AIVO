"""
Shared utilities for execution scripts.

Provides env loading, temp-file management, and a simple logger
so every script in execution/ starts from a consistent baseline.
"""

import os
import sys
import json
import logging
from pathlib import Path
from datetime import datetime

ROOT_DIR = Path(__file__).resolve().parent.parent
TMP_DIR = ROOT_DIR / ".tmp"
ENV_PATH = ROOT_DIR / ".env"


def load_env(path: Path = ENV_PATH) -> None:
    """Load key=value pairs from .env into os.environ (skip comments/blanks)."""
    if not path.exists():
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


def get_logger(name: str) -> logging.Logger:
    """Return a pre-configured logger that writes to stderr."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(name)s] %(levelname)s  %(message)s")
        )
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


def tmp_path(filename: str) -> Path:
    """Return a path inside .tmp/, creating the directory if needed."""
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    return TMP_DIR / filename


def write_json(data: dict | list, filepath: Path) -> Path:
    """Dump data as pretty-printed JSON and return the path."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, default=str)
    return filepath


def read_json(filepath: Path) -> dict | list:
    """Read and return parsed JSON from a file."""
    with open(filepath) as f:
        return json.load(f)


def timestamp() -> str:
    """ISO-8601 timestamp string, useful for filenames and logs."""
    return datetime.now().strftime("%Y%m%dT%H%M%S")
