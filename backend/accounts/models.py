from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('user', 'User'),
        ('problem_setter', 'Problem Setter'),
        ('admin', 'Admin'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')
    email = models.EmailField(_('email address'), unique=True)

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

class Profile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    contest_history = models.JSONField(default=list)
    preferences = models.JSONField(default=dict)

    def __str__(self):
        return f"{self.user.email}'s profile"