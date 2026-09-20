import argparse
import sys
from sqlalchemy.orm import Session

from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.models.user import User


def getpass_asterisk(prompt="Enter Admin Password: "):
    """
    Prompts the user for a password, showing asterisks (*) instead of nothing on Windows.
    """
    sys.stdout.write(prompt)
    sys.stdout.flush()
    
    password = []
    try:
        import msvcrt
        while True:
            ch = msvcrt.getch()
            # Carriage Return or Line Feed (Enter)
            if ch in (b'\r', b'\n'):
                sys.stdout.write('\n')
                sys.stdout.flush()
                break
            # Backspace
            elif ch == b'\x08':
                if len(password) > 0:
                    password.pop()
                    sys.stdout.write('\b \b')
                    sys.stdout.flush()
            # Ctrl+C (KeyboardInterrupt)
            elif ch == b'\x03':
                raise KeyboardInterrupt
            else:
                try:
                    char_decoded = ch.decode('utf-8')
                    # Hanya terima karakter yang bisa diprint (mengecualikan tombol fungsi/panah)
                    if char_decoded.isprintable():
                        password.append(char_decoded)
                        sys.stdout.write('*')
                        sys.stdout.flush()
                except UnicodeDecodeError:
                    pass
    except ImportError:
        # Fallback jika dijalankan di sistem non-Windows
        import getpass
        return getpass.getpass("").strip()
        
    return "".join(password)


def seed_admin(email: str, password: str, full_name: str = "Admin User"):
    """
    Creates an admin user record in the database if it doesn't already exist.
    """
    print(f"[*] Initializing database tables...")
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        clean_email = email.strip().lower()
        if not clean_email:
            print("[!] Error: Email cannot be empty.")
            sys.exit(1)
        if not password:
            print("[!] Error: Password cannot be empty.")
            sys.exit(1)

        # Check for existing user with the same email
        existing_user = db.query(User).filter(User.email == clean_email).first()
        if existing_user:
            print(f"[!] User with email '{clean_email}' already exists (Role: {existing_user.role}).")
            if existing_user.role == "admin":
                print("[*] Admin user is already registered. No changes made.")
            else:
                print(f"[*] Updating role for existing user '{clean_email}' to 'admin'...")
                existing_user.role = "admin"
                existing_user.hashed_password = get_password_hash(password)
                db.commit()
                print(f"[+] User '{clean_email}' updated to admin successfully.")
            return

        # Hash password and create new admin user
        hashed_password = get_password_hash(password)
        admin_user = User(
            full_name=full_name,
            email=clean_email,
            hashed_password=hashed_password,
            role="admin"
        )

        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        print(f"[+] Admin user '{clean_email}' created successfully! (ID: {admin_user.id})")

    except Exception as e:
        db.rollback()
        print(f"[!] Error seeding admin user: {e}")
        sys.exit(1)
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Seed initial Admin user into the database.")
    parser.add_argument("--email", type=str, help="Admin email address")
    parser.add_argument("--password", type=str, help="Admin password")
    parser.add_argument("--name", type=str, default="BARE Mondrian Admin", help="Admin full name")

    args = parser.parse_args()

    email = args.email
    password = args.password

    # Prompt if arguments are missing
    if not email:
        email = input("Enter Admin Email [admin@baremondrian.com]: ").strip() or "admin@baremondrian.com"
    if not password:
        password = getpass_asterisk("Enter Admin Password: ").strip()

    seed_admin(email=email, password=password, full_name=args.name)


if __name__ == "__main__":
    main()

