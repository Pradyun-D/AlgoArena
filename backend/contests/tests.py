from unittest.mock import patch

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
