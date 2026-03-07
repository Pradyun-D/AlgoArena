from django.shortcuts import render
from django.contrib.auth.decorators import login_required


def auth_page(request):
	return render(request, 'accounts/auth.html')


@login_required
def profile_page(request):
	return render(request, 'accounts/profile.html', {'user': request.user})
