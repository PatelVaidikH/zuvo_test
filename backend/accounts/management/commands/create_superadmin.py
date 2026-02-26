"""
Management command to create the Zuvo Super Admin.

Usage:
    python manage.py create_superadmin --email admin@zuvo.com --password MySecure123!

This only needs to run ONCE during initial deployment.
"""

from django.core.management.base import BaseCommand
from accounts.models import User


class Command(BaseCommand):
    help = "Create the platform Super Admin user"

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="Super Admin email")
        parser.add_argument("--password", required=True, help="Super Admin password")
        parser.add_argument("--name", default="Super Admin", help="Display name")

    def handle(self, *args, **options):
        email = options["email"]
        password = options["password"]
        name = options["name"]

        # Check if super admin already exists
        if User.objects.filter(role="super_admin").exists():
            self.stdout.write(
                self.style.WARNING("A Super Admin already exists. Aborting.")
            )
            return

        # Check if email is taken
        if User.objects.filter(email=email).exists():
            self.stdout.write(
                self.style.ERROR(f"Email {email} is already in use.")
            )
            return

        # Create the super admin
        user = User.objects.create_superuser(
            email=email,
            password=password,
            full_name=name,
            is_onboarded=True,  # Super admin doesn't need onboarding
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"\n✅ Super Admin created successfully!\n"
                f"   Email:    {email}\n"
                f"   Name:     {name}\n"
                f"   Role:     Super Admin\n"
                f"\n   You can now log in at the /login page.\n"
            )
        )