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
