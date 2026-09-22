import os
import sys
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.conf import settings

from banking.encryption import (
    rotate_encrypted_token,
    generate_key,
    _derive_256_key
)
from banking.models import BankConnection, BankAccount


class Command(BaseCommand):
    help = "Rotates database-encrypted tokens (BankConnection, BankAccount, GmailAccount) from an old key to a new AES-256-GCM key."

    def add_arguments(self, parser):
        parser.add_argument(
            '--old-key',
            type=str,
            help='Current encryption key. If not provided, defaults to settings.BANKING_ENCRYPTION_KEY or env.',
        )
        parser.add_argument(
            '--new-key',
            type=str,
            help='New encryption key. If omitted and --generate-new is passed, a secure key is generated.',
        )
        parser.add_argument(
            '--generate-new',
            action='store_true',
            help='Automatically generate a new secure 256-bit AES-GCM key and display it.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate rotation without modifying the database.',
        )

    def handle(self, *args, **options):
        old_key = options.get('old_key') or os.environ.get('OLD_BANKING_ENCRYPTION_KEY') or getattr(settings, 'BANKING_ENCRYPTION_KEY', None)
        if not old_key:
            old_key = getattr(settings, 'SECRET_KEY', None)

        if not old_key:
            raise CommandError("Old key not specified and no default found in settings or environment.")

        new_key = options.get('new_key') or os.environ.get('NEW_BANKING_ENCRYPTION_KEY')
        if options.get('generate_new') and not new_key:
            new_key = generate_key()
            self.stdout.write(self.style.WARNING(f"\n[!] GENERATED NEW KEY: {new_key}\nSave this securely in your environment as BANKING_ENCRYPTION_KEY!\n"))

        if not new_key:
            raise CommandError("New key must be provided via --new-key, NEW_BANKING_ENCRYPTION_KEY, or generated with --generate-new.")

        # Ensure old and new keys derive to different keys
        if _derive_256_key(old_key) == _derive_256_key(new_key):
            raise CommandError("Old key and new key derive to the exact same key. Rotation aborted.")

        dry_run = options.get('dry_run', False)
        if dry_run:
            self.stdout.write(self.style.NOTICE("Running in DRY-RUN mode. No database records will be saved."))

        # Import GmailAccount dynamically to avoid hard dependency errors if not installed
        try:
            from documents.models import GmailAccount
        except ImportError:
            GmailAccount = None

        rotated_connections = 0
        rotated_accounts = 0
        rotated_gmail = 0

        try:
            with transaction.atomic():
                # 1. Rotate BankConnection
                connections = BankConnection.objects.all()
                for conn in connections:
                    modified = False
                    if conn.access_token_encrypted:
                        conn.access_token_encrypted = rotate_encrypted_token(
                            conn.access_token_encrypted, old_key=old_key, new_key=new_key
                        )
                        modified = True
                    if conn.refresh_token_encrypted:
                        conn.refresh_token_encrypted = rotate_encrypted_token(
                            conn.refresh_token_encrypted, old_key=old_key, new_key=new_key
                        )
                        modified = True
                    if modified:
                        if not dry_run:
                            conn.save()
                        rotated_connections += 1

                # 2. Rotate BankAccount owner_name
                accounts = BankAccount.objects.exclude(owner_name_encrypted__isnull=True).exclude(owner_name_encrypted=b'')
                for acc in accounts:
                    if acc.owner_name_encrypted:
                        acc.owner_name_encrypted = rotate_encrypted_token(
                            acc.owner_name_encrypted, old_key=old_key, new_key=new_key
                        )
                        if not dry_run:
                            acc.save()
                        rotated_accounts += 1

                # 3. Rotate GmailAccount
                if GmailAccount is not None:
                    gmails = GmailAccount.objects.all()
                    for gm in gmails:
                        modified = False
                        if gm.access_token_encrypted:
                            gm.access_token_encrypted = rotate_encrypted_token(
                                gm.access_token_encrypted, old_key=old_key, new_key=new_key
                            )
                            modified = True
                        if gm.refresh_token_encrypted:
                            gm.refresh_token_encrypted = rotate_encrypted_token(
                                gm.refresh_token_encrypted, old_key=old_key, new_key=new_key
                            )
                            modified = True
                        if modified:
                            if not dry_run:
                                gm.save()
                            rotated_gmail += 1

                if dry_run:
                    # In dry-run mode, raise exception or do not commit
                    transaction.set_rollback(True)

            # Record audit log outside rollback if not dry-run
            if not dry_run:
                try:
                    from api.models import AuditLog
                    AuditLog.objects.create(
                        action='modify',
                        resource='encryption_keys',
                        details={
                            'status': 'success',
                            'connections_rotated': rotated_connections,
                            'accounts_rotated': rotated_accounts,
                            'gmail_rotated': rotated_gmail,
                        }
                    )
                except Exception as log_err:
                    self.stderr.write(self.style.WARNING(f"Audit log warning: {log_err}"))

            total_records = rotated_connections + rotated_accounts + rotated_gmail
            self.stdout.write(self.style.SUCCESS(
                f"\n[OK] Key rotation {'simulated' if dry_run else 'completed'} successfully!"
                f"\n- Bank connections rotated: {rotated_connections}"
                f"\n- Bank accounts rotated: {rotated_accounts}"
                f"\n- Gmail accounts rotated: {rotated_gmail}"
                f"\n- Total records processed: {total_records}\n"
            ))

        except Exception as e:
            raise CommandError(f"Error during key rotation: {str(e)}")

