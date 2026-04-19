import json
from unittest.mock import patch
from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient


class CreateContestPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_model = get_user_model()

    def test_regular_user_cannot_access_create_endpoint(self):
        user = self.user_model.objects.create_user(
            username="basic_user",
            email="basic@algoarena.dev",
            password="testpass123",
            role="user",
            external_user_id=101,
        )
        self.client.force_authenticate(user=user)

        response = self.client.post("/contests/create/", {}, format="json")

        self.assertEqual(response.status_code, 403)

    @patch("contests.views.ContestSerializer")
    def test_problem_setter_reaches_view_logic(self, contest_serializer_cls):
        problem_setter = self.user_model.objects.create_user(
            username="setter",
            email="setter@algoarena.dev",
            password="testpass123",
            role="problem_setter",
            external_user_id=202,
        )
        self.client.force_authenticate(user=problem_setter)

        serializer = contest_serializer_cls.return_value
        serializer.is_valid.return_value = False
        serializer.errors = {"contest": ["invalid"]}

        response = self.client.post("/contests/create/", {}, format="json")

        self.assertEqual(response.status_code, 400)
        contest_serializer_cls.assert_called_once()


class DraftPersistenceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_model = get_user_model()

    @patch("contests.views.get_connection")
    def test_draft_detail_returns_only_its_saved_problems(self, get_connection_mock):
        setter = self.user_model.objects.create_user(
            username="draft_setter",
            email="draftsetter@algoarena.dev",
            password="testpass123",
            role="problem_setter",
            external_user_id=301,
        )
        self.client.force_authenticate(user=setter)

        cursor = get_connection_mock.return_value.cursor.return_value
        cursor.fetchone.side_effect = [
            {
                "contest_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                "title": "Draft Alpha",
                "description": "Draft description",
                "start_time": datetime.utcnow(),
                "end_time": datetime.utcnow() + timedelta(hours=2),
                "visibility": "public",
                "created_by": 301,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        ]
        cursor.fetchall.side_effect = [
            [
                {
                    "problem_id": "11111111-1111-1111-1111-111111111111",
                    "title": "Draft Problem",
                    "slug": "draft-problem",
                    "description": "Solve it",
                    "difficulty": "easy",
                    "time_limit_ms": 1000,
                    "memory_limit_kb": 256,
                    "visibility": "contest_only",
                    "max_score": 100,
                }
            ],
            [
                {
                    "problem_id": "11111111-1111-1111-1111-111111111111",
                    "name": "math",
                }
            ]
        ]

        response = self.client.get("/contests/drafts/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["draft"]["problems"]), 1)
        self.assertEqual(response.data["draft"]["problems"][0]["title"], "Draft Problem")

    @patch("contests.views.get_connection")
    def test_publish_draft_rejects_draft_without_problems(self, get_connection_mock):
        setter = self.user_model.objects.create_user(
            username="draft_setter_two",
            email="draftsetter2@algoarena.dev",
            password="testpass123",
            role="problem_setter",
            external_user_id=302,
        )
        self.client.force_authenticate(user=setter)

        cursor = get_connection_mock.return_value.cursor.return_value
        cursor.fetchone.side_effect = [
            {
                "contest_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                "title": "Draft Beta",
                "description": "Draft description",
                "start_time": datetime.utcnow(),
                "end_time": datetime.utcnow() + timedelta(hours=2),
                "visibility": "public",
                "created_by": 302,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        ]
        cursor.fetchall.return_value = []

        response = self.client.post(
            "/contests/drafts/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/publish/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Add at least one problem before publishing this draft.")

    @patch("contests.views.get_connection")
    def test_publish_draft_succeeds_when_draft_has_saved_problems(self, get_connection_mock):
        setter = self.user_model.objects.create_user(
            username="draft_setter_three",
            email="draftsetter3@algoarena.dev",
            password="testpass123",
            role="problem_setter",
            external_user_id=303,
        )
        self.client.force_authenticate(user=setter)

        cursor = get_connection_mock.return_value.cursor.return_value
        cursor.fetchone.side_effect = [
            {
                "contest_id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
                "title": "Draft Gamma",
                "description": "Draft description",
                "start_time": datetime.utcnow(),
                "end_time": datetime.utcnow() + timedelta(hours=2),
                "visibility": "private",
                "created_by": 303,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            },
            {
                "problem_count": 1,
            },
            {
                "contest_id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
                "title": "Draft Gamma",
                "description": "Draft description",
                "start_time": datetime.utcnow(),
                "end_time": datetime.utcnow() + timedelta(hours=2),
                "visibility": "public",
                "created_by": 303,
                "created_at": datetime.utcnow(),
            },
        ]

        response = self.client.post(
            "/contests/drafts/cccccccc-cccc-cccc-cccc-cccccccccccc/publish/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["contest"]["visibility"], "public")
        cursor.execute.assert_any_call(
            """
            UPDATE contests
            SET visibility = 'public', updated_at = UTC_TIMESTAMP()
            WHERE contest_id = %s
            """,
            ("cccccccc-cccc-cccc-cccc-cccccccccccc",),
        )

    @patch("contests.views.get_connection")
    def test_delete_contest_falls_back_to_drafts_table(self, get_connection_mock):
        admin = self.user_model.objects.create_user(
            username="admin_delete",
            email="admindelete@algoarena.dev",
            password="testpass123",
            role="admin",
            external_user_id=304,
        )
        self.client.force_authenticate(user=admin)

        cursor = get_connection_mock.return_value.cursor.return_value
        cursor.fetchone.side_effect = [
            None,
            {
                "contest_id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
                "title": "Draft Delta",
                "created_by": 304,
            },
        ]

        response = self.client.delete("/contests/dddddddd-dddd-dddd-dddd-dddddddddddd/delete/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["message"], "Draft deleted successfully.")
        cursor.execute.assert_any_call(
            "DELETE FROM drafts WHERE contest_id = %s",
            ("dddddddd-dddd-dddd-dddd-dddddddddddd",),
        )

    @patch("contests.views.get_connection")
    def test_create_contest_problem_returns_created_problem(self, get_connection_mock):
        setter = self.user_model.objects.create_user(
            username="problem_creator",
            email="problemcreator@algoarena.dev",
            password="testpass123",
            role="problem_setter",
            external_user_id=303,
        )
        self.client.force_authenticate(user=setter)

        cursor = get_connection_mock.return_value.cursor.return_value
        cursor.fetchone.return_value = {
            "contest_id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
            "created_by": 303,
        }

        response = self.client.post(
            "/contests/cccccccc-cccc-cccc-cccc-cccccccccccc/problems/create",
            {
                "title": "New Problem",
                "slug": "new-problem",
                "description": "Solve it",
                "difficulty": "easy",
                "time_limit_ms": 1000,
                "memory_limit_kb": 256,
                "visibility": "contest_only",
                "max_score": 100,
                "tags": [],
                "testcases": [],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["problem"]["title"], "New Problem")


class ContestRegistrationStatusTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_model = get_user_model()

    @patch("contests.views.get_connection")
    def test_registration_status_returns_true_when_participant_row_exists(self, get_connection_mock):
        user = self.user_model.objects.create_user(
            username="registered_user",
            email="registered@algoarena.dev",
            password="testpass123",
            role="user",
            external_user_id=303,
        )
        self.client.force_authenticate(user=user)

        cursor = get_connection_mock.return_value.cursor.return_value
        cursor.fetchone.return_value = {"is_registered": 1}

        response = self.client.get("/contests/11111111-1111-1111-1111-111111111111/registration-status/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["is_registered"], True)
        cursor.execute.assert_called_once()

    @patch("contests.views.get_connection")
    def test_registration_status_returns_false_for_anonymous_user(self, get_connection_mock):
        response = self.client.get("/contests/11111111-1111-1111-1111-111111111111/registration-status/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["is_registered"], False)
        get_connection_mock.assert_not_called()


class AllContestsVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_model = get_user_model()

    @patch("contests.views.get_connection")
    def test_all_contests_hides_private_contests_for_public_users(self, get_connection_mock):
        cursor = get_connection_mock.return_value.cursor.return_value
        cursor.fetchall.return_value = []

        response = self.client.get("/contests/")

        self.assertEqual(response.status_code, 200)
        executed_sql = cursor.execute.call_args[0][0]
        self.assertIn("WHERE visibility <> 'private'", executed_sql)

    @patch("contests.views.get_connection")
    def test_all_contests_keeps_private_contests_visible_for_problem_setters(self, get_connection_mock):
        setter = self.user_model.objects.create_user(
            username="registry_setter",
            email="registrysetter@algoarena.dev",
            password="testpass123",
            role="problem_setter",
            external_user_id=404,
        )
        self.client.force_authenticate(user=setter)

        cursor = get_connection_mock.return_value.cursor.return_value
        cursor.fetchall.return_value = []

        response = self.client.get("/contests/")

        self.assertEqual(response.status_code, 200)
        executed_sql = cursor.execute.call_args[0][0]
        self.assertNotIn("WHERE visibility <> 'private'", executed_sql)


class LiveContestAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_model = get_user_model()

    @patch("contests.views.get_connection")
    def test_contest_details_block_unregistered_user_when_contest_is_running(self, get_connection_mock):
        user = self.user_model.objects.create_user(
            username="viewer",
            email="viewer@algoarena.dev",
            password="testpass123",
            role="user",
            external_user_id=404,
        )
        self.client.force_authenticate(user=user)

        cursor = get_connection_mock.return_value.cursor.return_value
        cursor.fetchone.return_value = {
            "contest_id": "11111111-1111-1111-1111-111111111111",
            "title": "Running Contest",
            "description": "Live round",
            "start_time": datetime.utcnow() - timedelta(minutes=5),
            "end_time": datetime.utcnow() + timedelta(minutes=55),
            "visibility": "Public",
            "created_by": 1,
            "created_at": datetime.utcnow() - timedelta(days=1),
            "is_registered": 0,
        }

        response = self.client.get("/contests/11111111-1111-1111-1111-111111111111/details/")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["error"], "Contest is running.")

    @patch("contests.views.get_connection")
    def test_problem_workspace_block_unregistered_user_when_contest_is_running(self, get_connection_mock):
        user = self.user_model.objects.create_user(
            username="viewer_two",
            email="viewer2@algoarena.dev",
            password="testpass123",
            role="user",
            external_user_id=405,
        )
        self.client.force_authenticate(user=user)

        cursor = get_connection_mock.return_value.cursor.return_value
        cursor.fetchone.return_value = {
            "contest_id": "11111111-1111-1111-1111-111111111111",
            "title": "Running Contest",
            "description": "Live round",
            "start_time": datetime.utcnow() - timedelta(minutes=5),
            "end_time": datetime.utcnow() + timedelta(minutes=55),
            "visibility": "Public",
            "created_by": 1,
            "created_at": datetime.utcnow() - timedelta(days=1),
            "is_registered": 0,
        }

        response = self.client.get("/contests/11111111-1111-1111-1111-111111111111/problems/22222222-2222-2222-2222-222222222222/solve")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["error"], "Contest is running.")

    @patch("contests.views.get_connection")
    def test_problem_workspace_allows_admin_when_contest_is_running(self, get_connection_mock):
        user = self.user_model.objects.create_user(
            username="admin_solver",
            email="adminsolver@algoarena.dev",
            password="testpass123",
            role="admin",
            external_user_id=407,
        )
        self.client.force_authenticate(user=user)

        cursor = get_connection_mock.return_value.cursor.return_value
        cursor.fetchone.return_value = {
            "contest_id": "11111111-1111-1111-1111-111111111111",
            "title": "Running Contest",
            "description": "Live round",
            "start_time": datetime.utcnow() - timedelta(minutes=5),
            "end_time": datetime.utcnow() + timedelta(minutes=55),
            "visibility": "Public",
            "created_by": 1,
            "created_at": datetime.utcnow() - timedelta(days=1),
            "is_registered": 0,
        }
        cursor.fetchall.side_effect = [[], [], [], []]

        response = self.client.get("/contests/11111111-1111-1111-1111-111111111111/problems/22222222-2222-2222-2222-222222222222/solve")

        self.assertEqual(response.status_code, 200)
        self.assertIn("data", response.data)

    @patch("contests.views.get_connection")
    def test_past_contest_details_are_visible_to_normal_user(self, get_connection_mock):
        user = self.user_model.objects.create_user(
            username="past_viewer",
            email="pastviewer@algoarena.dev",
            password="testpass123",
            role="user",
            external_user_id=408,
        )
        self.client.force_authenticate(user=user)

        cursor = get_connection_mock.return_value.cursor.return_value
        cursor.fetchone.return_value = {
            "contest_id": "11111111-1111-1111-1111-111111111111",
            "title": "Past Contest",
            "description": "Finished round",
            "start_time": datetime.utcnow() - timedelta(days=2, hours=2),
            "end_time": datetime.utcnow() - timedelta(days=1),
            "visibility": "Public",
            "created_by": 1,
            "created_at": datetime.utcnow() - timedelta(days=3),
            "is_registered": 0,
        }
        cursor.fetchall.side_effect = [[], []]

        response = self.client.get("/contests/11111111-1111-1111-1111-111111111111/details/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("data", response.data)

    @patch("contests.views.get_connection")
    def test_admin_can_open_running_contest_details_without_registration(self, get_connection_mock):
        user = self.user_model.objects.create_user(
            username="admin_viewer",
            email="adminviewer@algoarena.dev",
            password="testpass123",
            role="admin",
            external_user_id=406,
        )
        self.client.force_authenticate(user=user)

        cursor = get_connection_mock.return_value.cursor.return_value
        cursor.fetchone.return_value = {
            "contest_id": "11111111-1111-1111-1111-111111111111",
            "title": "Running Contest",
            "description": "Live round",
            "start_time": datetime.utcnow() - timedelta(minutes=5),
            "end_time": datetime.utcnow() + timedelta(minutes=55),
            "visibility": "Public",
            "created_by": 1,
            "created_at": datetime.utcnow() - timedelta(days=1),
            "is_registered": 0,
        }
        cursor.fetchall.side_effect = [[], []]

        response = self.client.get("/contests/11111111-1111-1111-1111-111111111111/details/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("data", response.data)
