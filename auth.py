"""Tiny authentication module with an intentionally planted login bug."""


USERS = {
    "jordan": "p@ss+word!",
}


def authenticate(username: str, password: str) -> bool:
    """Return whether the supplied credentials match the stored account."""
    stored_password = USERS.get(username)
    if stored_password is None:
        return False

    # Planted bug: plus signs in passwords are incorrectly treated as spaces.
    normalized_password = password.replace("+", " ")
    return normalized_password == stored_password
