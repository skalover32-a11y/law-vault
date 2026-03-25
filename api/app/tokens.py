import hashlib
import re
import secrets
from datetime import timedelta

CODE_RE = re.compile(r"^[A-Z0-9]{4}-[A-Z0-9]{4}$")
CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def generate_code() -> str:
    raw = "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
    return f"{raw[:4]}-{raw[4:]}"


def normalize_code(code: str) -> str:
    return code.strip().upper()


def is_valid_code(code: str) -> bool:
    return bool(CODE_RE.match(normalize_code(code)))


def hash_code(code: str, salt: str) -> str:
    normalized = normalize_code(code)
    payload = f"{salt}{normalized}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def label_from_code(code: str) -> str:
    normalized = normalize_code(code)
    if len(normalized) >= 4:
        return f"{normalized[:4]}-****"
    return "****-****"


def parse_ttl(value: str) -> timedelta:
    match = re.match(r"^(\d+)([smhd])$", value.strip().lower())
    if not match:
        raise ValueError("ttl must look like 30m, 24h, 7d")
    amount = int(match.group(1))
    unit = match.group(2)
    if unit == "s":
        return timedelta(seconds=amount)
    if unit == "m":
        return timedelta(minutes=amount)
    if unit == "h":
        return timedelta(hours=amount)
    return timedelta(days=amount)
