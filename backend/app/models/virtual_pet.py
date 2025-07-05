from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.connection import Base


class VirtualPet(Base):
    __tablename__ = "virtual_pets"

    pet_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    species = Column(String(50), nullable=False)
    happiness = Column(Float, nullable=False, default=100.0)
    energy = Column(Float, nullable=False, default=100.0)
    last_fed = Column(DateTime(timezone=True), server_default=func.now())
    last_played = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    accessories = relationship("PetAccessory", back_populates="pet", cascade="all, delete-orphan")
    user = relationship("User", foreign_keys=[user_id])


class PetAccessory(Base):
    __tablename__ = "pet_accessories"

    accessory_id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("virtual_pets.pet_id", ondelete="CASCADE"), nullable=False)
    accessory_type = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    icon_url = Column(String(255))
    level_required = Column(Integer, nullable=False, default=1)
    stats_boost = Column(Text)  # JSON string
    is_equipped = Column(Integer, nullable=False, default=0)  # 0 = not equipped, 1 = equipped
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    pet = relationship("VirtualPet", back_populates="accessories")
