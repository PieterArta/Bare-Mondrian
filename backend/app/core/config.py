import os
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "BARE Mondrian API"
    VERSION: str = "1.0.0"
    
    # Database
    DATABASE_URL: str = "sqlite:///./baremondian.db"
    
    # JWT Security
    JWT_SECRET_KEY: str = "bare_mondrian_super_secret_jwt_key_2026_change_in_prod"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440  # 24 hours
    
    # Admin Whitelist
    ADMIN_EMAILS: Union[str, List[str]] = "admin@baremondrian.com"

    # RajaOngkir Shipping API
    RAJAONGKIR_API_KEY: str = ""
    ORIGIN_CITY_ID: str = "152"  # Default: Jakarta Selatan
    
    # Google OAuth 2.0
    GOOGLE_CLIENT_ID: str = "334624921209-ml7gtbe86hfar69dim9b5qjqrq82736u.apps.googleusercontent.com"
    
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )
    
    @property
    def admin_emails_list(self) -> List[str]:
        """Returns ADMIN_EMAILS parsed as a list of cleaned lowercase strings."""
        if isinstance(self.ADMIN_EMAILS, list):
            return [email.strip().lower() for email in self.ADMIN_EMAILS if email.strip()]
        if isinstance(self.ADMIN_EMAILS, str):
            return [email.strip().lower() for email in self.ADMIN_EMAILS.split(",") if email.strip()]
        return []


settings = Settings()
