import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from rest_framework import serializers
from datetime import datetime

class TestSerializer(serializers.Serializer):
    dt = serializers.DateTimeField()

sz = TestSerializer(instance={"dt": datetime(2024, 10, 10, 15, 30, 0)})
print("Serialized:", sz.data)
