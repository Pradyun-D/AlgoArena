import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()
u, _ = User.objects.get_or_create(email="normal@test.com", defaults={"role": "user", "username": "normal"})
u.account_status = "active"
u.save()

refresh = RefreshToken.for_user(u)
import requests
cookie = {"auth": str(refresh.access_token)}

r = requests.get('http://127.0.0.1:8000/contests/editorial/00000000-0000-0000-0000-000000000000/', cookies=cookie)
print("Normal User Response:", r.status_code, r.text)

u2, _ = User.objects.get_or_create(email="admin@test.com", defaults={"role": "admin", "username": "admin"})
u2.account_status = "active"
u2.save()
refresh2 = RefreshToken.for_user(u2)
cookie2 = {"auth": str(refresh2.access_token)}
r2 = requests.get('http://127.0.0.1:8000/contests/editorial/00000000-0000-0000-0000-000000000000/', cookies=cookie2)
print("Admin User Response:", r2.status_code, r2.text)
