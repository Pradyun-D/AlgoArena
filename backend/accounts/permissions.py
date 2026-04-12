from rest_framework.permissions import BasePermission
from rest_framework.request import Request

def _has_role(user, allowed_roles):
    if not getattr(user, "is_authenticated", False):
        return False

    role = getattr(user, "role", None)
    if role in allowed_roles:
        return True

    if getattr(user, "is_superuser", False) and "admin" in allowed_roles:
        return True

    return user.groups.filter(name__in=allowed_roles).exists()


class IsProblemSetter(BasePermission): # this gives some pylance warning, but it works fine, so im supressing the error below
    def has_permission(self, request: Request, view: object) -> bool:  # type: ignore[override]
        return _has_role(request.user, {"problem_setter", "admin"})

class IsProblemSetterOwner(BasePermission):
    def has_permission(self,request:Request,view:object) -> bool:  # type: ignore[override]
        return _has_role(request.user, {"problem_setter", "admin"})

    def has_object_permission(self, request: Request, view: object, obj: object) -> bool:  # type: ignore[override]
        if _has_role(request.user, {"admin"}):
            return True

        owner_id = getattr(request.user, "external_user_id", None) or getattr(request.user, "id", None)
        created_by = getattr(obj, "created_by", None)
        if isinstance(obj, dict):
            created_by = obj.get("created_by")
        return created_by == owner_id
    
class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return _has_role(request.user, {"admin"})

class IsAuthenticated(BasePermission):
    def has_permission(self,request,view):
        return request.user.is_authenticated
