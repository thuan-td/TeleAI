"""Create or update an internal login user.

Usage (inside the backend container or venv):
    python -m scripts.create_user --username admin --password '...' --role admin
    python -m scripts.create_user --username admin --password '...' --role admin --reset-password
"""
import argparse

from sqlalchemy import select

from app.core.security import hash_password
from app.db.models import User
from app.db.session import SessionLocal

VALID_ROLES = {"admin", "viewer"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--role", required=True, choices=sorted(VALID_ROLES))
    parser.add_argument(
        "--reset-password",
        action="store_true",
        help="If the user already exists, overwrite its password/role instead of failing.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        existing = db.execute(select(User).where(User.username == args.username)).scalar_one_or_none()
        if existing is not None and not args.reset_password:
            print(f"User '{args.username}' already exists — pass --reset-password to overwrite.")
            return

        password_hash = hash_password(args.password)
        if existing is not None:
            existing.password_hash = password_hash
            existing.role = args.role
            existing.is_active = True
            db.commit()
            print(f"Updated user '{args.username}' (role={args.role}).")
        else:
            user = User(username=args.username, password_hash=password_hash, role=args.role)
            db.add(user)
            db.commit()
            print(f"Created user '{args.username}' (role={args.role}).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
