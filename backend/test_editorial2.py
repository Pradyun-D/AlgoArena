import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
import time

User = get_user_model()
u, _ = User.objects.get_or_create(username=f"normal{time.time()}", defaults={"role": "user", "email": f"normal{time.time()}@test.com"})
u.account_status = "active"
u.save()

refresh = RefreshToken.for_user(u)
import requests
cookie = {"auth": str(refresh.access_token)}

r = requests.get('http://127.0.0.1:8000/contests/editorial/00000000-0000-0000-0000-000000000000/', cookies=cookie)
print("Normal User Response:", r.status_code, r.text)

