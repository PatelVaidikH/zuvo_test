from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Team, BoardColumn


# Default columns every new team gets
DEFAULT_COLUMNS = [
    {"name": "Not Started", "position": 0, "color": "#94A3B8", "is_default": True},
    {"name": "In Progress", "position": 1, "color": "#F59E0B", "is_default": True},
    {"name": "Under Review", "position": 2, "color": "#8B5CF6", "is_default": True},
    {"name": "Completed", "position": 3, "color": "#10B981", "is_default": True},
    {"name": "On Hold", "position": 4, "color": "#EF4444", "is_default": True},
    {"name": "Cancelled", "position": 5, "color": "#6B7280", "is_default": True},
]


@receiver(post_save, sender=Team)
def create_default_columns(sender, instance, created, **kwargs):
    """
    When a new Team is created, auto-generate the 6 default board columns.
    This only runs on creation, not on updates.
    """
    if created:
        columns = [
            BoardColumn(
                team=instance,
                name=col["name"],
                position=col["position"],
                color=col["color"],
                is_default=col["is_default"],
            )
            for col in DEFAULT_COLUMNS
        ]
        BoardColumn.objects.bulk_create(columns)