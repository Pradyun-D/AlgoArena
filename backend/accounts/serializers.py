from dj_rest_auth.serializers import UserDetailsSerializer as BaseUserDetailsSerializer
from rest_framework import serializers
from .models import Profile

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['contest_history', 'preferences']

class UserDetailsSerializer(BaseUserDetailsSerializer):
    role = serializers.CharField(source='role', read_only=True)
    profile = ProfileSerializer(read_only=True)

    class Meta(BaseUserDetailsSerializer.Meta):
        fields = BaseUserDetailsSerializer.Meta.fields + ('role', 'profile')