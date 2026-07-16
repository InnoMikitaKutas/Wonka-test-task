"""Service configuration."""

import os

DEFAULT_DATABASE_URL = "postgres://ats:ats@localhost:5432/ats"
POOL_MIN_SIZE = 1
POOL_MAX_SIZE = 10


def get_database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)
