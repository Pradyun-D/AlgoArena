import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from datetime import datetime

result = {
    "editorial_id": "b7096745-766e-4673-bbb2-682ca396aa09",
    "problem_id": "b7096745-766e-4673-bbb2-682ca396aa09",
    "content": "Test",
    "created_at": datetime.now(),
    "updated_at": datetime.now()
}

r = Response({"editorial": result})
try:
    rendered = JSONRenderer().render(r.data)
    print("Rendered:", rendered)
except Exception as e:
    print("Error:", str(e))
