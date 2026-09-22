import json

from django.contrib.auth.models import User
from django.test import TestCase

from .models import Category, Transaction, Account, Budget


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


class BudgetComparisonTreeTests(TestCase):
    """Pruebas para el cálculo jerárquico y rollup de presupuestos."""

    def setUp(self):
        self.user = User.objects.create_user(username='budget-user', password='safe-password')
        self.account = Account.objects.create(user=self.user, name='Cuenta Principal')
        
        # Categoría padre: Alimentación
        self.parent_cat = Category.objects.create(
            user=self.user, name='Alimentación', color='#ef4444', is_income=False
        )
        # Subcategorías
        self.sub_super = Category.objects.create(
            user=self.user, name='Supermercado', parent=self.parent_cat, color='#ef4444', is_income=False
        )
        self.sub_rest = Category.objects.create(
            user=self.user, name='Restaurantes', parent=self.parent_cat, color='#ef4444', is_income=False
        )
        
        # Presupuesto en el padre y en un hijo
        Budget.objects.create(user=self.user, category=self.parent_cat, amount=500.00, month='2026-09-01')
        Budget.objects.create(user=self.user, category=self.sub_super, amount=300.00, month='2026-09-01')
        
        # Transacciones en septiembre 2026
        # Directa en padre: 20 €
        Transaction.objects.create(
            user=self.user, account=self.account, category=self.parent_cat,
            date='2026-09-05', description='Picnic varios', amount=20.00, type='expense'
        )
        # En Supermercado: 300 €
        Transaction.objects.create(
            user=self.user, account=self.account, category=self.sub_super,
            date='2026-09-10', description='Compra Mercadona', amount=300.00, type='expense'
        )
        # En Restaurantes: 100 €
        Transaction.objects.create(
            user=self.user, account=self.account, category=self.sub_rest,
            date='2026-09-15', description='Cena amigos', amount=100.00, type='expense'
        )
        
        self.client.force_login(self.user)

    def test_budget_comparison_tree_rollup_and_no_double_counting(self):
        response = self.client.get('/api/budgets/comparison/?month=2026-09-01', secure=True)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Total gastado global debe ser exactamente 420 (sin duplicar hijos)
        self.assertEqual(data['total_spent'], 420.00)
        self.assertEqual(data['total_budgeted'], 500.00)
        
        # Verificar nodo raíz en árbol
        tree = data['tree']
        self.assertEqual(len(tree), 1)
        root = tree[0]
        self.assertEqual(root['category_name'], 'Alimentación')
        self.assertEqual(root['spent_direct'], 20.00)
        self.assertEqual(root['children_spent'], 400.00)
        self.assertEqual(root['spent'], 420.00)  # Rollup total
        self.assertEqual(root['budgeted'], 500.00)
        self.assertTrue(root['has_subcategories'])
        
        # Verificar subcategorías
        subs = {s['category_name']: s for s in root['subcategories']}
        self.assertIn('Supermercado', subs)
        self.assertEqual(subs['Supermercado']['spent'], 300.00)
        self.assertEqual(subs['Supermercado']['budgeted'], 300.00)
        self.assertEqual(subs['Supermercado']['percentage_of_parent'], 71.4)
        
        self.assertIn('Restaurantes', subs)
        self.assertEqual(subs['Restaurantes']['spent'], 100.00)
        self.assertEqual(subs['Restaurantes']['budgeted'], 0.00)
        self.assertEqual(subs['Restaurantes']['percentage_of_parent'], 23.8)


class SyncViewSetTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='syncuser', password='password123', email='sync@test.com')
        self.account = Account.objects.create(user=self.user, name='Cuenta Principal', initial_balance=1000.00)
        self.cat = Category.objects.create(user=self.user, name='Supermercado', color='#ef4444', is_income=False)
        self.budget = Budget.objects.create(user=self.user, category=self.cat, amount=250.00, month='2026-09-01')
        self.client.force_login(self.user)

    def test_sync_pull_includes_budgets(self):
        response = self.client.post('/api/sync/pull/', {}, content_type='application/json', secure=True)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('budgets', data)
        self.assertEqual(len(data['budgets']), 1)
        self.assertEqual(data['budgets'][0]['category_name'], 'Supermercado')
        self.assertEqual(data['budgets'][0]['amount'], 250.0)

    def test_sync_pull_returns_updated_transactions_with_since(self):
        from datetime import datetime, timezone, timedelta
        
        # Create transaction with an older created_at
        tx = Transaction.objects.create(
            user=self.user,
            account=self.account,
            category=self.cat,
            date='2026-09-10',
            description='Compra ayer',
            amount=50.0,
            type='expense'
        )
        old_time = datetime.now(timezone.utc) - timedelta(hours=2)
        Transaction.objects.filter(id=tx.id).update(created_at=old_time, updated_at=old_time)
        
        # 'since' is 1 hour ago (after old_time)
        since_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        
        # Pull before updating: should return 0 transactions
        res_before = self.client.post('/api/sync/pull/', {'since': since_time}, content_type='application/json', secure=True)
        self.assertEqual(len(res_before.json()['transactions']), 0)
        
        # Now update transaction (e.g. recategorized or edited on web)
        tx.description = 'Compra modificada en web'
        tx.save() # updates updated_at to now
        
        # Pull again: must return the updated transaction because updated_at >= since
        res_after = self.client.post('/api/sync/pull/', {'since': since_time}, content_type='application/json', secure=True)
        self.assertEqual(len(res_after.json()['transactions']), 1)
        self.assertEqual(res_after.json()['transactions'][0]['description'], 'Compra modificada en web')
