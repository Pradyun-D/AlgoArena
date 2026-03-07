from rest_framework.permissions import BasePermission
from rest_framework.request import Request

class IsProblemmSetter(BasePermission): # this gives some pylance warning, but it works fine, so im supressing the error below
    def has_permission(self, request: Request, view: object) -> bool:  # type: ignore[override]
        return bool(request.user.is_authenticated and request.user.role in ['problem_setter', 'admin'])
    
class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'