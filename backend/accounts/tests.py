from django.contrib.auth.models import Group
from django.test import TestCase

from .auth_sync import sync_django_user_from_external_row


class AuthSyncTests(TestCase):
    def test_sync_django_user_from_external_row_maps_role_and_group_state(self):
        stale_group = Group.objects.create(name="user")
        admin_group = Group.objects.create(name="admin")

        row = {
            "user_id": 42,
            "uuid": "11111111-1111-1111-1111-111111111111",
            "username": "arena_admin",
            "email": "admin@algoarena.dev",
            "role_name": "admin",
            "status": "active",
            "password_hash": "pbkdf2_sha256$720000$example$hash",
        }

        user = sync_django_user_from_external_row(row)
        user.groups.add(stale_group)

        user = sync_django_user_from_external_row(row)

        self.assertEqual(user.role, "admin")
        self.assertEqual(user.account_status, "active")
        self.assertEqual(user.external_user_id, 42)
        self.assertEqual(user.external_uuid, row["uuid"])
        self.assertTrue(user.is_active)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.groups.filter(id=admin_group.id).exists())
        self.assertFalse(user.groups.filter(id=stale_group.id).exists())

    def test_sync_django_user_from_external_row_avoids_duplicate_username_collision(self):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        User.objects.create_user(
            username="arena_admin",
            email="existing-admin@algoarena.dev",
            password="testpass123",
            external_user_id=99,
        )

        row = {
            "user_id": 42,
            "uuid": "22222222-2222-2222-2222-222222222222",
            "username": "arena_admin",
            "email": "admin@algoarena.dev",
            "role_name": "admin",
            "status": "active",
            "password_hash": "pbkdf2_sha256$720000$example$hash",
        }

        user = sync_django_user_from_external_row(row)

        self.assertEqual(user.external_user_id, 42)
        self.assertNotEqual(user.username, "arena_admin")
        self.assertTrue(user.username.startswith("arena_admin-") or user.username.startswith("user-"))
