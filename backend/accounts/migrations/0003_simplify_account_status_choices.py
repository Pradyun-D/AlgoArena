from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_customuser_external_identity"),
    ]

    operations = [
        migrations.AlterField(
            model_name="customuser",
            name="account_status",
            field=models.CharField(
                choices=[("active", "Active"), ("banned", "Banned")],
                default="active",
                max_length=20,
            ),
        ),
    ]
