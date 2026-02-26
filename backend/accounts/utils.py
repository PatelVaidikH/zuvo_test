"""
Zuvo — Utility Functions
==========================
Helper functions used across the app.
"""

import secrets
import string


def generate_temp_password():
    """
    Generate a secure temporary password.
    
    Format: "Zuvo-" + 8 random characters (letters + digits)
    Example: "Zuvo-xK9m2pLq"
    
    Why this format?
    - "Zuvo-" prefix makes it recognizable as a temp password
    - 8 random chars = ~48 bits of entropy (very hard to guess)
    - Mix of upper, lower, and digits for readability
    - Easy to share verbally or via message
    
    Returns:
        str: The plain-text temporary password
    """

    # Character pool: uppercase + lowercase + digits
    alphabet = string.ascii_letters + string.digits

    # Generate 8 random characters
    random_part = "".join(secrets.choice(alphabet) for _ in range(8))

    return f"Zuvo-{random_part}"