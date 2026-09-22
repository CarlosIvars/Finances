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

    def test_rotate_encrypted_token(self):
        from banking.encryption import rotate_encrypted_token
        key1 = generate_key()
        key2 = generate_key()
        original = "super_secret_api_token_123"
        enc1 = encrypt_token(original, custom_key=key1)
        # Cannot decrypt enc1 with key2
        self.assertNotEqual(decrypt_token(enc1, custom_key=key2), original)
        # Rotate
        enc2 = rotate_encrypted_token(enc1, old_key=key1, new_key=key2)
        # Now decodes with key2
        self.assertEqual(decrypt_token(enc2, custom_key=key2), original)

    def test_rotate_encryption_key_management_command(self):
        from django.core.management import call_command
        from django.contrib.auth.models import User
        from banking.models import BankConnection, BankAccount
        from documents.models import GmailAccount

        user = User.objects.create(username="rotate_user")
        key_old = generate_key()
        key_new = generate_key()

        # Create connection encrypted with key_old
        conn = BankConnection.objects.create(
            user=user,
            institution_id="test_bank",
            institution_name="Test Bank",
            access_token_encrypted=encrypt_token("access_123", custom_key=key_old),
            refresh_token_encrypted=encrypt_token("refresh_456", custom_key=key_old),
        )
        # Create bank account with encrypted owner
        acc = BankAccount.objects.create(
            bank_connection=conn,
            external_account_id="ext_acc_1",
            name="Checking",
            owner_name_encrypted=encrypt_token("Juan Perez", custom_key=key_old)
        )
        # Create gmail account with encrypted tokens
        gm = GmailAccount.objects.create(
            user=user,
            email="rotate@example.com",
            access_token_encrypted=encrypt_token("gmail_acc_789", custom_key=key_old),
            refresh_token_encrypted=encrypt_token("gmail_ref_012", custom_key=key_old)
        )

        # Dry run first
        call_command('rotate_encryption_key', old_key=key_old, new_key=key_new, dry_run=True)

        # Actual rotation
        call_command('rotate_encryption_key', old_key=key_old, new_key=key_new)

        # Verify all can be decrypted with key_new
        conn.refresh_from_db()
        acc.refresh_from_db()
        gm.refresh_from_db()

        self.assertEqual(decrypt_token(conn.access_token_encrypted, custom_key=key_new), "access_123")
        self.assertEqual(decrypt_token(conn.refresh_token_encrypted, custom_key=key_new), "refresh_456")
        self.assertEqual(decrypt_token(acc.owner_name_encrypted, custom_key=key_new), "Juan Perez")
        self.assertEqual(decrypt_token(gm.access_token_encrypted, custom_key=key_new), "gmail_acc_789")
        self.assertEqual(decrypt_token(gm.refresh_token_encrypted, custom_key=key_new), "gmail_ref_012")

