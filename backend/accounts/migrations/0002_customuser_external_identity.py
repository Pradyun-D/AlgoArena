from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="customuser",
            name="account_status",
            field=models.CharField(
                choices=[("active", "Active"), ("suspended", "Suspended"), ("banned", "Banned")],
                default="active",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="customuser",
            name="external_user_id",
            field=models.PositiveBigIntegerField(blank=True, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="customuser",
            name="external_uuid",
            field=models.CharField(blank=True, max_length=36, null=True, unique=True),
        ),
    ]
