from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('user', 'User'),
        ('problem_setter', 'Problem Setter'),
        ('admin', 'Admin'),
    )
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('banned', 'Banned'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')
    email = models.EmailField(_('email address'), unique=True)
    account_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    external_user_id = models.PositiveBigIntegerField(unique=True, null=True, blank=True)
    external_uuid = models.CharField(max_length=36, unique=True, null=True, blank=True)

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def has_platform_role(self, *roles):
        return self.role in roles

class Profile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    contest_history = models.JSONField(default=list)
    preferences = models.JSONField(default=dict)

    def __str__(self):
        return f"{self.user.email}'s profile"
