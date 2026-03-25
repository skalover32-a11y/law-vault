import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from app.core.config import get_settings

settings = get_settings()


def wrap_key(file_key: bytes) -> tuple[bytes, bytes, bytes]:
    key_nonce = os.urandom(12)
    encryptor = Cipher(algorithms.AES(settings.master_key), modes.GCM(key_nonce)).encryptor()
    wrapped = encryptor.update(file_key) + encryptor.finalize()
    return wrapped, key_nonce, encryptor.tag


def unwrap_key(wrapped: bytes, key_nonce: bytes, key_tag: bytes) -> bytes:
    decryptor = Cipher(algorithms.AES(settings.master_key), modes.GCM(key_nonce, key_tag)).decryptor()
    return decryptor.update(wrapped) + decryptor.finalize()
