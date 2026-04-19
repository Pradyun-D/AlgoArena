import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from db import get_connection

conn = get_connection()
cursor = conn.cursor(dictionary=True)

cursor.execute("SELECT c.contest_id, c.end_time FROM contests c LIMIT 1")
contest_data = cursor.fetchone()
print(f"Contest End Time: {contest_data['end_time']}")

cursor.execute("SELECT UTC_TIMESTAMP() as now")
now_data = cursor.fetchone()
print(f"Now UTC (MySQL): {now_data['now']}")

if contest_data['end_time'] > now_data['now']:
    print("Contest > Now => LOCKED")
else:
    print("Contest <= Now => OPEN")

cursor.close()
conn.close()
