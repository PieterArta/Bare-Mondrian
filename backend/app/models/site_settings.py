"""
SiteSettings model — key/value store for persisted site configuration.
Used for homepage images, about us content, etc.
Replaces the ephemeral JSON-file approach that was wiped on every Render restart.
"""

from sqlalchemy import Column, String, Text

from app.core.database import Base


class SiteSetting(Base):
    __tablename__ = "site_settings"

    key = Column(String(128), primary_key=True, nullable=False)
    value = Column(Text, nullable=True)

    def __repr__(self):
        return f"<SiteSetting key={self.key!r}>"
