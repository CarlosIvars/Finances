"""
Tests de cifrado de tokens bancarios.
"""
import os
from django.test import TestCase

from banking.encryption import encrypt_token, decrypt_token, generate_key


class EncryptionTest(TestCase):
    """Tests del módulo de cifrado."""

    def test_encrypt_decrypt_roundtrip(self):
        """Cifrar y descifrar devuelve el texto original."""
        plaintext = 'my-super-secret-token-abc123'
        encrypted = encrypt_token(plaintext)
        decrypted = decrypt_token(encrypted)
        self.assertEqual(decrypted, plaintext)

    def test_encrypted_differs_from_plaintext(self):
        """El texto cifrado debe ser diferente del original."""
        plaintext = 'visible-token'
        encrypted = encrypt_token(plaintext)
        self.assertNotEqual(encrypted, plaintext.encode())

    def test_encrypt_empty_string(self):
        """Cifrar un string vacío debe funcionar."""
        encrypted = encrypt_token('')
        decrypted = decrypt_token(encrypted)
        self.assertEqual(decrypted, '')

    def test_encrypt_unicode(self):
        """Cifrar texto con caracteres unicode (español) debe funcionar."""
        plaintext = 'token-con-ñ-y-acentos-á-é-í'
        encrypted = encrypt_token(plaintext)
        decrypted = decrypt_token(encrypted)
        self.assertEqual(decrypted, plaintext)

    def test_generate_key_format(self):
        """generate_key debe devolver un string válido de Fernet."""
        key = generate_key()
        self.assertIsInstance(key, str)
        self.assertGreater(len(key), 20)

    def test_different_encryptions_differ(self):
        """Dos cifrados del mismo texto deben ser diferentes (Fernet usa timestamp)."""
        plaintext = 'same-token'
        enc1 = encrypt_token(plaintext)
        enc2 = encrypt_token(plaintext)
        # Fernet includes a timestamp, so encryptions should differ
        self.assertNotEqual(enc1, enc2)
        # But both should decrypt to the same value
        self.assertEqual(decrypt_token(enc1), plaintext)
        self.assertEqual(decrypt_token(enc2), plaintext)

