from rest_framework import serializers
import uuid
from datetime import timezone
from db import get_connection


class ContestInfoSerializer(serializers.Serializer):
    contest_id = serializers.UUIDField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    created_by = serializers.IntegerField(required=False, allow_null=True)
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(
        allow_blank=True,
        required=False,
        style={"base_template": "textarea.html"},
    )
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField()
    visibility = serializers.ChoiceField(choices=["public", "private"])

    def validate(self, data):
        if not data["title"].strip():
            raise serializers.ValidationError({"title": "Title must not be empty."})
        if data["start_time"] >= data["end_time"]:
            raise serializers.ValidationError(
                {"end_time": "End time must occur after start time."}
            )
        return data


class ProblemSerializer(serializers.Serializer):
    problem_id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(
        allow_blank=True,
        required=False,
        style={"base_template": "textarea.html"},
    )
    difficulty = serializers.ChoiceField(choices=["easy", "medium", "hard"])
    time_limit_ms = serializers.IntegerField(min_value=1)
    memory_limit_kb = serializers.IntegerField(min_value=1)
    visibility = serializers.ChoiceField(choices=["public", "private", "contest_only"])
    tags = serializers.ListField(
        child=serializers.CharField(max_length=255),
        required=False,
        allow_empty=True,
    )
    max_score = serializers.IntegerField(min_value=1)

    def validate(self, data):
        if not data["title"].strip():
            raise serializers.ValidationError({"title": "Problem title must not be empty."})
        data["tags"] = [tag.strip() for tag in data.get("tags", []) if tag.strip()]
        return data


class TestcaseSerializer(serializers.Serializer):
    testcase_id = serializers.UUIDField(read_only=True)
    input_data = serializers.CharField(allow_blank=True, required=False)
    output_data = serializers.CharField(allow_blank=True, required=False)
    is_hidden = serializers.BooleanField(required=False, default=True)


class ProblemManageSerializer(serializers.Serializer):
    problem_id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(max_length=255)
    slug = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(
        allow_blank=True,
        required=False,
        style={"base_template": "textarea.html"},
    )
    difficulty = serializers.ChoiceField(choices=["easy", "medium", "hard"])
    time_limit_ms = serializers.IntegerField(min_value=1)
    memory_limit_kb = serializers.IntegerField(min_value=1)
    visibility = serializers.ChoiceField(choices=["public", "private", "contest_only"])
    max_score = serializers.IntegerField(min_value=1)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=255),
        required=False,
        allow_empty=True,
    )
    testcases = TestcaseSerializer(many=True, required=False)

    def validate(self, data):
        if not data["title"].strip():
            raise serializers.ValidationError({"title": "Problem title must not be empty."})
        data["tags"] = [tag.strip() for tag in data.get("tags", []) if tag.strip()]
        data["slug"] = (data.get("slug") or data["title"]).strip().lower().replace(" ", "-")
        return data


class ContestSerializer(serializers.Serializer):
    contest = ContestInfoSerializer()
    problems = ProblemSerializer(many=True)

    def validate(self, data):
        if not data["problems"]:
            raise serializers.ValidationError(
                {"problems": "Add at least one problem before creating a contest."}
            )
        return data

    @staticmethod
    def _to_utc_sql_datetime(value):
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc)
        return value.replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")

    def create(self, validated_data):
        contest_data = validated_data["contest"].copy()
        problems_data = [problem.copy() for problem in validated_data["problems"]]

        contest_id = str(uuid.uuid4())
        contest_data["contest_id"] = contest_id

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        try:
            cursor.execute(
                """
                INSERT INTO contests
                (contest_id, title, description, start_time, end_time, visibility, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    contest_id,
                    contest_data["title"],
                    contest_data.get("description", ""),
                    self._to_utc_sql_datetime(contest_data["start_time"]),
                    self._to_utc_sql_datetime(contest_data["end_time"]),
                    contest_data["visibility"],
                    contest_data.get("created_by"),
                ),
            )

            cursor.execute(
                """
                SELECT contest_id, title, description, start_time, end_time, visibility,
                       created_by, created_at
                FROM contests
                WHERE contest_id = %s
                """,
                (contest_id,),
            )
            saved_contest = cursor.fetchone()

            saved_problems = []

            for problem in problems_data:
                problem_id = str(uuid.uuid4())
                tags = problem.get("tags", [])

                cursor.execute(
                    """
                    INSERT INTO problems
                    (problem_id, title, slug, description, difficulty, time_limit_ms,
                     memory_limit_kb, visibility, created_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        problem_id,
                        problem["title"],
                        problem["title"].strip().lower().replace(" ", "-"),
                        problem.get("description", ""),
                        problem["difficulty"],
                        problem["time_limit_ms"],
                        problem["memory_limit_kb"],
                        problem["visibility"],
                        contest_data.get("created_by"),
                    ),
                )

                cursor.execute(
                    """
                    INSERT INTO contest_problems (contest_id, problem_id, max_score)
                    VALUES (%s, %s, %s)
                    """,
                    (contest_id, problem_id, problem["max_score"]),
                )

                for tag_name in tags:
                    cursor.execute(
                        "INSERT IGNORE INTO tags (name) VALUES (%s)",
                        (tag_name,),
                    )
                    cursor.execute("SELECT tag_id FROM tags WHERE name = %s", (tag_name,))
                    tag_row = cursor.fetchone()
                    if tag_row:
                        cursor.execute(
                            """
                            INSERT IGNORE INTO problem_tags (problem_id, tag_id)
                            VALUES (%s, %s)
                            """,
                            (problem_id, tag_row["tag_id"]),
                        )

                saved_problem = problem.copy()
                saved_problem["problem_id"] = problem_id
                saved_problem["tags"] = tags
                saved_problems.append(saved_problem)

            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

        return {"contest": saved_contest, "problems": saved_problems}


class EditorialSerializer(serializers.Serializer):
    editorial_id = serializers.UUIDField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    created_by = serializers.IntegerField(read_only=True)
    problem_id = serializers.UUIDField()
    content = serializers.CharField(style={"base_template": "textarea.html"})

    def validate(self, data):
        if not data.get("content") or len(data["content"].strip()) == 0:
            raise serializers.ValidationError({"content": "Content must not be empty."})
        return data

    def create(self, validated_data):
        new_id = str(uuid.uuid4())

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        try:
            cursor.execute(
                """
                INSERT INTO editorials
                (editorial_id, problem_id, content, created_by)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    new_id,
                    str(validated_data["problem_id"]),
                    validated_data["content"],
                    validated_data.get("created_by"),
                ),
            )
            conn.commit()
            validated_data["editorial_id"] = new_id
        finally:
            cursor.close()
            conn.close()

        return validated_data
