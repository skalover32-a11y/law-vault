import argparse
import os
from datetime import datetime, timezone

import pyotp
from sqlalchemy import func

from app.db.session import SessionLocal
from app.models import UploadToken, User
from app.security import hash_password
from app.tokens import generate_code, hash_code, label_from_code, parse_ttl


def create_upload_token(ttl: str) -> str:
    token = generate_code()
    token_hash = hash_code(token, os.environ.get("UPLOAD_TOKEN_SALT", ""))
    expires_at = datetime.now(timezone.utc) + parse_ttl(ttl)

    session = SessionLocal()
    session.add(
        UploadToken(
            token_hash=token_hash,
            token_label=label_from_code(token),
            expires_at=expires_at,
        )
    )
    session.commit()
    session.close()
    return token


def normalize_username(username: str) -> str:
    return username.strip().lower()


def find_user(session, username: str) -> User | None:
    normalized = normalize_username(username)
    return session.query(User).filter(func.lower(User.username) == normalized).one_or_none()


def create_user(username: str, password: str, totp_secret: str | None) -> str:
    username = normalize_username(username)
    session = SessionLocal()
    existing = find_user(session, username)
    if existing:
        session.close()
        raise ValueError("login already exists")

    secret = totp_secret
    totp_enabled = False
    if secret:
        totp_enabled = True
    user = User(username=username, password_hash=hash_password(password), totp_secret=secret, totp_enabled=totp_enabled)
    session.add(user)
    session.commit()
    session.close()
    return secret or ""


def reset_totp(username: str) -> tuple[str, str]:
    session = SessionLocal()
    user = find_user(session, username)
    if not user:
        session.close()
        raise ValueError("login not found")
    secret = pyotp.random_base32()
    user.totp_secret = secret
    user.totp_enabled = True
    session.commit()
    session.close()
    code = pyotp.TOTP(secret).now()
    return secret, code


def disable_totp(username: str) -> None:
    session = SessionLocal()
    user = find_user(session, username)
    if not user:
        session.close()
        raise ValueError("login not found")
    user.totp_secret = None
    user.totp_enabled = False
    session.commit()
    session.close()


def set_password(username: str, password: str) -> None:
    session = SessionLocal()
    user = find_user(session, username)
    if not user:
        session.close()
        raise ValueError("login not found")
    user.password_hash = hash_password(password)
    session.commit()
    session.close()


def list_users() -> None:
    session = SessionLocal()
    users = session.query(User).order_by(User.created_at.asc()).all()
    for user in users:
        print(f"{user.username}\ttotp_enabled={user.totp_enabled}")
    session.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command")

    token_parser = sub.add_parser("create-upload-token")
    token_parser.add_argument("--ttl", required=True)

    user_parser = sub.add_parser("create-user")
    user_parser.add_argument("--login", required=True)
    user_parser.add_argument("--password", required=True)
    user_parser.add_argument("--totp-secret")

    reset_parser = sub.add_parser("reset-totp")
    reset_parser.add_argument("--login", required=True)

    disable_parser = sub.add_parser("disable-totp")
    disable_parser.add_argument("--login", required=True)

    password_parser = sub.add_parser("set-password")
    password_parser.add_argument("--login", required=True)
    password_parser.add_argument("--password", required=True)

    sub.add_parser("list-users")

    args = parser.parse_args()

    if args.command == "create-upload-token":
        token = create_upload_token(args.ttl)
        print(token)
        return

    if args.command == "create-user":
        secret = create_user(args.login, args.password, args.totp_secret)
        print(secret)
        return

    if args.command == "reset-totp":
        secret, code = reset_totp(args.login)
        print(secret)
        print(code)
        return

    if args.command == "disable-totp":
        disable_totp(args.login)
        print("disabled")
        return

    if args.command == "set-password":
        set_password(args.login, args.password)
        print("password_updated")
        return

    if args.command == "list-users":
        list_users()
        return

    parser.print_help()


if __name__ == "__main__":
    main()
