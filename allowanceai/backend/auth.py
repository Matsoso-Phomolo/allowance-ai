import base64
import hashlib
import hmac
import json
import os
import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

import models
from database import get_db


SECRET_KEY = os.environ.get("ALLOWANCEAI_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("ALLOWANCEAI_SECRET_KEY must be set in the environment.")
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7
security = HTTPBearer()


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"pbkdf2_sha256${_b64encode(salt)}${_b64encode(digest)}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, salt_b64, digest_b64 = password_hash.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        salt = _b64decode(salt_b64)
        expected = _b64decode(digest_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
        return hmac.compare_digest(actual, expected)
    except ValueError:
        return False


def create_access_token(user: models.User) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": str(user.id), "email": user.email, "exp": int(time.time()) + TOKEN_TTL_SECONDS}
    signing_input = f"{_b64encode(json.dumps(header, separators=(',', ':')).encode())}.{_b64encode(json.dumps(payload, separators=(',', ':')).encode())}"
    signature = hmac.new(SECRET_KEY.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
    return f"{signing_input}.{_b64encode(signature)}"


def decode_access_token(token: str) -> dict:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
        signing_input = f"{header_b64}.{payload_b64}"
        expected = hmac.new(SECRET_KEY.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64decode(signature_b64)):
            raise ValueError("Bad signature")
        payload = json.loads(_b64decode(payload_b64))
        if payload.get("exp", 0) < int(time.time()):
            raise ValueError("Expired token")
        return payload
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> models.User:
    payload = decode_access_token(credentials.credentials)
    user = db.query(models.User).filter(models.User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user
