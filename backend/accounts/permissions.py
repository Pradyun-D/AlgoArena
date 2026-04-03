from rest_framework.permissions import BasePermission
from rest_framework.request import Request

class IsProblemSetter(BasePermission): # this gives some pylance warning, but it works fine, so im supressing the error below
    def has_permission(self, request: Request, view: object) -> bool:  # type: ignore[override]
        return bool(request.user.is_authenticated and request.user.role in ['problem_setter', 'admin'])

class IsProblemSetterOwner(BasePermission):
    def has_permission(self,request:Request,view:object) -> bool:
        return bool(request.user.is_authenticated and (request.user.role=="admin" or object.created_by==request.user))
    
class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'

class IsAuthenticated(BasePermission):
    def has_permission(self,request,view):
        return request.user.is_authenticated