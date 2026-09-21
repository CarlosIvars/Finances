import json

from django.contrib.auth.models import User
from django.test import TestCase

from .models import Category, Transaction


class MobileCategorySyncTests(TestCase):
    """The mobile client must receive and use the server-owned category IDs."""

    def setUp(self):
        self.user = User.objects.create_user(username='mobile-user', password='safe-password')
        self.parent = Category.objects.create(
            user=self.user, name='Vivienda', color='#123456', is_income=False
        )
        self.category = Category.objects.create(
            user=self.user,
            name='Electricidad',
            parent=self.parent,
            color='#654321',
            icon='directions_car',
            is_income=False,
        )
        self.client.force_login(self.user)

    def test_pull_returns_the_complete_hierarchical_catalogue(self):
        response = self.client.post(
            '/api/sync/pull/', data=json.dumps({'since': None}), content_type='application/json', secure=True
        )

        self.assertEqual(response.status_code, 200)
        categories = {item['id']: item for item in response.json()['categories']}
        self.assertEqual(categories[self.category.id]['name'], 'Electricidad')
        self.assertEqual(categories[self.category.id]['parent_id'], self.parent.id)
        self.assertEqual(categories[self.category.id]['color'], '#654321')
        self.assertEqual(categories[self.category.id]['icon'], 'directions_car')

    def test_push_assigns_transaction_to_the_server_category_id(self):
        response = self.client.post(
            '/api/sync/push/',
            data=json.dumps({'transactions': [{
                'local_id': 'mobile-transaction-1',
                'date': '2026-09-21',
                'description': 'Factura de luz',
                'amount': -42.50,
                'type': 'expense',
                'category_id': self.category.id,
            }]}),
            content_type='application/json',
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['created'][0]['status'], 'created')
        self.assertEqual(Transaction.objects.get().category_id, self.category.id)

    def test_push_recategorizes_an_existing_mobile_transaction(self):
        old_category = Category.objects.create(
            user=self.user, name='Sin clasificar', color='#cccccc', is_income=False
        )
        Transaction.objects.create(
            user=self.user,
            account=self.user.accounts.create(name='Main Account'),
            category=old_category,
            date='2026-09-21',
            description='Factura de luz',
            amount=-42.50,
            type='expense',
        )

        response = self.client.post(
            '/api/sync/push/',
            data=json.dumps({'transactions': [{
                'local_id': 'mobile-transaction-1',
                'date': '2026-09-21',
                'description': 'Factura de luz',
                'amount': -42.50,
                'type': 'expense',
                'category_id': self.category.id,
            }]}),
            content_type='application/json',
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['created'][0]['status'], 'exists')
        self.assertEqual(Transaction.objects.get().category_id, self.category.id)

# Create your tests here.
