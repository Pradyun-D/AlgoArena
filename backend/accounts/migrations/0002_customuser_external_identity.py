from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        ALTER TABLE accounts_customuser
                        ADD COLUMN IF NOT EXISTS account_status varchar(20) NOT NULL DEFAULT 'active'
                    """,
                    reverse_sql="""
                        ALTER TABLE accounts_customuser
                        DROP COLUMN IF EXISTS account_status
                    """,
                ),
                migrations.RunSQL(
                    sql="""
                        ALTER TABLE accounts_customuser
                        ADD COLUMN IF NOT EXISTS external_user_id bigint UNSIGNED NULL
                    """,
                    reverse_sql="""
                        ALTER TABLE accounts_customuser
                        DROP COLUMN IF EXISTS external_user_id
                    """,
                ),
                migrations.RunSQL(
                    sql="""
                        CREATE UNIQUE INDEX IF NOT EXISTS accounts_customuser_external_user_id_uniq
                        ON accounts_customuser (external_user_id)
                    """,
                    reverse_sql="""
                        DROP INDEX IF EXISTS accounts_customuser_external_user_id_uniq
                        ON accounts_customuser
                    """,
                ),
                migrations.RunSQL(
                    sql="""
                        ALTER TABLE accounts_customuser
                        ADD COLUMN IF NOT EXISTS external_uuid varchar(36) NULL
                    """,
                    reverse_sql="""
                        ALTER TABLE accounts_customuser
                        DROP COLUMN IF EXISTS external_uuid
                    """,
                ),
                migrations.RunSQL(
                    sql="""
                        CREATE UNIQUE INDEX IF NOT EXISTS accounts_customuser_external_uuid_uniq
                        ON accounts_customuser (external_uuid)
                    """,
                    reverse_sql="""
                        DROP INDEX IF EXISTS accounts_customuser_external_uuid_uniq
                        ON accounts_customuser
                    """,
                ),
            ],
            state_operations=[
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
            ],
        ),
    ]
