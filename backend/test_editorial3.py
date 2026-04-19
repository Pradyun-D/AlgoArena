import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from db import get_connection

User = get_user_model()
u = User.objects.filter(role="user").first()
if not u:
    u = User.objects.create(username="normaluser123", email="normaluser123@test.com", role="user", account_status="active")

# Create a problem and editorial if it doesn't exist
conn = get_connection()
cursor = conn.cursor(dictionary=True)
cursor.execute("SELECT * FROM editorials LIMIT 1")
ed = cursor.fetchone()
if not ed:
    # Just insert it
    import uuid
    pid = str(uuid.uuid4())
    cursor.execute("INSERT INTO _external_users (user_id, email, username) VALUES (999, 'asdf@a.com', 'a')")
    cursor.execute("INSERT INTO problems (problem_id, title, created_by) VALUES (%s, 'Test', 999)", (pid,))
    cursor.execute("INSERT INTO editorials (problem_id, content, created_by) VALUES (%s, 'Test Content', 999)", (pid,))
    conn.commit()
    problem_id = pid
else:
    problem_id = ed["problem_id"]

refresh = RefreshToken.for_user(u)
import requests
cookie = {"auth": str(refresh.access_token)}

print(f"Fetching editorial for problem_id: {problem_id}")
r = requests.get(f'http://127.0.0.1:8000/contests/editorial/{problem_id}/', cookies=cookie)
print("Normal User Response:", r.status_code, r.text)

