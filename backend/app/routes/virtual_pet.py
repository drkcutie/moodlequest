from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.database.connection import get_db
from app.models.user import User
from app.models.virtual_pet import VirtualPet, PetAccessory
from app.schemas.virtual_pet import (
    PetCreateRequest, 
    PetUpdateNameRequest,
    PetCreateResponse,
    PetGetResponse,
    PetDeleteResponse,
    PetResponse,
    PetAccessoryResponse,
    PetCheckResponse
)
from app.utils.auth import get_current_active_user, get_current_user_from_moodle_token
from app.services.activity_log_service import log_activity

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/virtual-pet", tags=["virtual-pet"])


@router.get("/check-pet", response_model=PetCheckResponse)
async def check_pet(
    request: Request,
    current_user: User = Depends(get_current_user_from_moodle_token),
    db: Session = Depends(get_db)
):
    """
    Check if the current user has a virtual pet.
    This is used by the frontend to determine whether to show onboarding or load the pet.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) checking for pet")
        
        pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        
        has_pet = pet is not None
        message = f"User has a pet named '{pet.name}'" if has_pet else "User does not have a pet"
        
        logger.info(f"Pet check result for user {current_user.username}: {message}")
        
        return PetCheckResponse(
            has_pet=has_pet,
            message=message
        )
        
    except Exception as e:
        logger.error(f"Error checking pet for user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check pet status"
        )


@router.get("/get-pet", response_model=PetGetResponse)
async def get_pet(
    request: Request,
    current_user: User = Depends(get_current_user_from_moodle_token),
    db: Session = Depends(get_db)
):
    """
    Get the current user's virtual pet information using moodleToken authentication.
    Returns 404 if no pet exists.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) requesting pet data")
        
        pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        
        if not pet:
            logger.info(f"No pet found for user {current_user.username} (ID: {current_user.id})")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No virtual pet found for this user"
            )
        
        # Get pet accessories
        accessories = db.query(PetAccessory).filter(PetAccessory.pet_id == pet.pet_id).all()
        
        accessories_data = []
        for accessory in accessories:
            accessories_data.append(PetAccessoryResponse(
                accessory_id=accessory.accessory_id,
                accessory_type=accessory.accessory_type,
                name=accessory.name,
                description=accessory.description,
                icon_url=accessory.icon_url,
                level_required=accessory.level_required,
                stats_boost=accessory.stats_boost,
                is_equipped=bool(accessory.is_equipped),
                created_at=accessory.created_at
            ))
        
        pet_data = PetResponse(
            pet_id=pet.pet_id,
            name=pet.name,
            species=pet.species,
            happiness=pet.happiness,
            energy=pet.energy,
            last_fed=pet.last_fed,
            last_played=pet.last_played,
            created_at=pet.created_at,
            last_updated=pet.last_updated,
            accessories=accessories_data
        )
        
        logger.info(f"Successfully retrieved pet '{pet.name}' for user {current_user.username}")
        
        return PetGetResponse(
            success=True,
            has_pet=True,
            pet=pet_data,
            message=f"Pet '{pet.name}' loaded successfully"
        )
        
    except HTTPException:
        raise  # Re-raise HTTPExceptions as-is
    except Exception as e:
        logger.error(f"Error getting pet for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get pet information"
        )


@router.post("/create-pet", response_model=PetCreateResponse)
async def create_pet_new(
    pet_data: PetCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user_from_moodle_token),
    db: Session = Depends(get_db)
):
    """
    Create a new virtual pet for the current user using moodleToken authentication.
    Each user can only have one virtual pet. Used during onboarding flow.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) creating pet: {pet_data.name}")
        
        # Check if user already has a pet
        existing_pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        
        if existing_pet:
            logger.warning(f"User {current_user.username} already has a pet: {existing_pet.name}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have a pet named '{existing_pet.name}'. You can only have one pet."
            )
        
        # Create new pet
        new_pet = VirtualPet(
            user_id=current_user.id,
            name=pet_data.name,
            species=pet_data.species,
            happiness=100.0,
            energy=100.0
        )
        
        db.add(new_pet)
        db.commit()
        db.refresh(new_pet)
        
        # Log the pet creation activity
        log_activity(
            db=db,
            user_id=current_user.id,
            action_type="pet_created",
            action_details={
                "pet_name": pet_data.name,
                "species": pet_data.species,
                "pet_id": new_pet.pet_id
            },
            related_entity_type="virtual_pet",
            related_entity_id=new_pet.pet_id
        )
        
        # Create response with new pet data
        pet_response = PetResponse(
            pet_id=new_pet.pet_id,
            name=new_pet.name,
            species=new_pet.species,
            happiness=new_pet.happiness,
            energy=new_pet.energy,
            last_fed=new_pet.last_fed,
            last_played=new_pet.last_played,
            created_at=new_pet.created_at,
            last_updated=new_pet.last_updated,
            accessories=[]
        )
        
        logger.info(f"Successfully created pet '{pet_data.name}' for user {current_user.username}")
        
        return PetCreateResponse(
            success=True,
            message=f"Virtual pet '{pet_data.name}' created successfully!",
            pet=pet_response,
            is_new_pet=True
        )
        
    except HTTPException:
        raise  # Re-raise HTTPExceptions as-is
    except Exception as e:
        logger.error(f"Error creating pet for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create virtual pet"
        )


@router.get("/my-pet", response_model=PetGetResponse)
async def get_my_pet(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get the current user's virtual pet information.
    Returns 404 if no pet exists (normal for first-time users).
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) requesting pet data")
        
        pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        
        if not pet:
            logger.info(f"No pet found for user {current_user.username} (ID: {current_user.id})")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No virtual pet found for this user"
            )
        
        # Get pet accessories
        accessories = db.query(PetAccessory).filter(PetAccessory.pet_id == pet.pet_id).all()
        
        accessories_data = []
        for accessory in accessories:
            accessories_data.append(PetAccessoryResponse(
                accessory_id=accessory.accessory_id,
                accessory_type=accessory.accessory_type,
                name=accessory.name,
                description=accessory.description,
                icon_url=accessory.icon_url,
                level_required=accessory.level_required,
                stats_boost=accessory.stats_boost,
                is_equipped=bool(accessory.is_equipped),
                created_at=accessory.created_at
            ))
        
        pet_data = PetResponse(
            pet_id=pet.pet_id,
            name=pet.name,
            species=pet.species,
            happiness=pet.happiness,
            energy=pet.energy,
            last_fed=pet.last_fed,
            last_played=pet.last_played,
            created_at=pet.created_at,
            last_updated=pet.last_updated,
            accessories=accessories_data
        )
        
        logger.info(f"Successfully retrieved pet '{pet.name}' for user {current_user.username}")
        
        return PetGetResponse(
            success=True,
            has_pet=True,
            pet=pet_data,
            message=f"Pet '{pet.name}' loaded successfully"
        )
        
    except HTTPException:
        raise  # Re-raise HTTPExceptions as-is
    except Exception as e:
        logger.error(f"Error getting pet for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get pet information"
        )


@router.post("/create", response_model=PetCreateResponse)
async def create_pet(
    pet_data: PetCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a new virtual pet for the current user.
    Each user can only have one virtual pet.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) creating pet: {pet_data.name}")
        
        # Check if user already has a pet
        existing_pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        
        if existing_pet:
            logger.warning(f"User {current_user.username} already has a pet: {existing_pet.name}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have a pet named '{existing_pet.name}'. You can only have one pet."
            )
        
        # Create new pet
        new_pet = VirtualPet(
            user_id=current_user.id,
            name=pet_data.name,
            species=pet_data.species,
            happiness=100.0,
            energy=100.0
        )
        
        db.add(new_pet)
        db.commit()
        db.refresh(new_pet)
        
        # Log the pet creation activity
        log_activity(
            db=db,
            user_id=current_user.id,
            action_type="pet_created",
            action_details={
                "pet_name": pet_data.name,
                "species": pet_data.species,
                "pet_id": new_pet.pet_id
            },
            related_entity_type="virtual_pet",
            related_entity_id=new_pet.pet_id
        )
        
        logger.info(f"Successfully created pet '{pet_data.name}' for user {current_user.username}")
        
        pet_response = PetResponse(
            pet_id=new_pet.pet_id,
            name=new_pet.name,
            species=new_pet.species,
            happiness=new_pet.happiness,
            energy=new_pet.energy,
            last_fed=new_pet.last_fed,
            last_played=new_pet.last_played,
            created_at=new_pet.created_at,
            last_updated=new_pet.last_updated,
            accessories=[]
        )
        
        return PetCreateResponse(
            success=True,
            message=f"Virtual pet '{pet_data.name}' created successfully!",
            pet=pet_response,
            is_new_pet=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating pet for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create pet"
        )


@router.put("/update-name", response_model=PetCreateResponse)
async def update_pet_name(
    pet_data: PetUpdateNameRequest,
    request: Request,
    current_user: User = Depends(get_current_user_from_moodle_token),
    db: Session = Depends(get_db)
):
    """
    Update the name of the current user's pet using moodleToken authentication.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) updating pet name to: {pet_data.name}")
        
        # Check if user has a pet
        pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        
        if not pet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No pet found. Create a pet first."
            )
        
        # Update pet name
        old_name = pet.name
        pet.name = pet_data.name
        pet.last_updated = datetime.utcnow()
        
        db.commit()
        db.refresh(pet)
        
        # Log the name change activity
        log_activity(
            db=db,
            user_id=current_user.id,
            action_type="pet_name_change",
            action_details={
                "old_name": old_name,
                "new_name": pet_data.name,
                "pet_id": pet.pet_id
            },
            related_entity_type="virtual_pet",
            related_entity_id=pet.pet_id
        )
        
        logger.info(f"Successfully updated pet name from '{old_name}' to '{pet_data.name}' for user {current_user.username}")
        
        pet_response = PetResponse(
            pet_id=pet.pet_id,
            name=pet.name,
            species=pet.species,
            happiness=pet.happiness,
            energy=pet.energy,
            last_fed=pet.last_fed,
            last_played=pet.last_played,
            created_at=pet.created_at,
            last_updated=pet.last_updated,
            accessories=[]
        )
        
        return PetCreateResponse(
            success=True,
            message=f"Pet name updated from '{old_name}' to '{pet_data.name}'",
            pet=pet_response,
            is_new_pet=False
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating pet name for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update pet name"
        )


@router.delete("/delete", response_model=PetDeleteResponse)
async def delete_pet(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete the current user's virtual pet.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) deleting pet")
        
        # Check if user has a pet
        pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        
        if not pet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No pet found to delete"
            )
        
        pet_name = pet.name
        pet_id = pet.pet_id
        
        # Delete the pet (accessories will be deleted automatically due to cascade)
        db.delete(pet)
        db.commit()
        
        # Log the pet deletion activity
        log_activity(
            db=db,
            user_id=current_user.id,
            action_type="pet_deleted",
            action_details={
                "pet_name": pet_name,
                "pet_id": pet_id
            },
            related_entity_type="virtual_pet",
            related_entity_id=pet_id
        )
        
        logger.info(f"Successfully deleted pet '{pet_name}' for user {current_user.username}")
        
        return PetDeleteResponse(
            success=True,
            message=f"Pet '{pet_name}' has been deleted"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting pet for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete pet"
        )
