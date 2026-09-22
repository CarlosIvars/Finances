from datetime import timedelta
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken


class Command(BaseCommand):
    help = 'Generates a long-lived JWT Bearer token for FinancIAs mobile app sync'

    def add_arguments(self, parser):
        parser.add_argument(
            '-u', '--username',
            type=str,
            help='Username to generate the sync token for (defaults to first user if omitted)'
        )
        parser.add_argument(
            '-d', '--days',
            type=int,
            default=365,
            help='Token validity in days (default: 365 days)'
        )

    def handle(self, *args, **options):
        username = options.get('username')
        days = options.get('days') or 365

        if username:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                raise CommandError(f'User "{username}" does not exist.')
        else:
            user = User.objects.filter(is_superuser=True).first() or User.objects.first()
            if not user:
                raise CommandError(
                    'No users found in database. Create a user first using "python manage.py createsuperuser".'
                )

        # Generate a long-lived access token directly for this user
        token = AccessToken.for_user(user)
        token.set_exp(lifetime=timedelta(days=days))

        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS(f'🚀 Token de sincronización generado para el usuario: {user.username}'))
        self.stdout.write(self.style.SUCCESS(f'⏱️  Validez: {days} días'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write('\nCopia este token y pégalo en "Token de Acceso / API Key" en los Ajustes de la app móvil:\n')
        self.stdout.write(self.style.WARNING(str(token)))
        self.stdout.write('\n' + '=' * 60 + '\n')

