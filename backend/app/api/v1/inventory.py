from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.schemas.inventory import (
    InventoryCreate,
    InventoryUpdate,
    InventoryResponse,
    InventoryListResponse,
    InventoryStats
)
from app.crud.inventory import (
    get_inventory_item_by_id,
    get_user_inventory,
    count_user_inventory,
    create_inventory_item,
    update_inventory_item,
    delete_inventory_item,
    search_inventory,
    get_expired_items,
    use_inventory_for_recipe
)
from app.api.v1.auth import get_current_user_dependency
from app.models.user import User


# Create router
router = APIRouter()


@router.post(
    "/",
    response_model=InventoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add item to inventory",
    description="Add a new item to your pantry/fridge/freezer"
)
def add_inventory_item(
    item: InventoryCreate,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Add a new item to inventory.
    
    Track what you have at home for meal planning.
    
    Args:
        item: InventoryCreate schema with item details
        current_user: Authenticated user
        db: Database session
    
    Returns:
        201 Created + InventoryResponse
        
    Example request:
    POST /api/v1/inventory
    Headers: Authorization: Bearer <token>
    Body:
    {
        "item_name": "chicken breast",
        "quantity": 500,
        "unit": "g",
        "category": "protein",
        "location": "fridge",
        "expiry_date": "2026-01-20T00:00:00",
        "min_quantity": 200,
        "notes": "Organic from Whole Foods"
    }
    
    Example response (201):
    {
        "id": "item-uuid",
        "user_id": "user-uuid",
        "item_name": "chicken breast",
        "quantity": 500,
        "unit": "g",
        "category": "protein",
        "location": "fridge",
        "expiry_date": "2026-01-20T00:00:00",
        "is_low_stock": false,
        "is_expiring_soon": true,
        "is_expired": false,
        "days_until_expiry": 7,
        "created_at": "2026-01-13T10:30:00",
        "updated_at": "2026-01-13T10:30:00"
    }
    """
    try:
        new_item = create_inventory_item(
            db=db,
            user_id=current_user.id,
            item_name=item.item_name,
            quantity=item.quantity,
            unit=item.unit,
            category=item.category,
            location=item.location,
            expiry_date=item.expiry_date,
            purchase_date=item.purchase_date,
            price=item.price,
            notes=item.notes,
            min_quantity=item.min_quantity,
            is_staple=item.is_staple
        )
        
        return new_item
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create inventory item: {str(e)}"
        )


@router.get(
    "/",
    response_model=InventoryListResponse,
    summary="Get all inventory items",
    description="Get your inventory with filtering and pagination"
)
def get_inventory(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(None, description="Filter by category"),
    location: Optional[str] = Query(None, description="Filter by location"),
    expiring_soon: bool = Query(False, description="Show only items expiring within 7 days"),
    low_stock: bool = Query(False, description="Show only low stock items"),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get all inventory items with filtering.
    
    Features:
    - Pagination
    - Filter by category (dairy, protein, etc.)
    - Filter by location (fridge, freezer, etc.)
    - Filter expiring soon (within 7 days)
    - Filter low stock items
    
    Args:
        page: Page number (starts at 1)
        page_size: Items per page
        category: Filter by category
        location: Filter by location
        expiring_soon: Show only expiring items
        low_stock: Show only low stock items
        current_user: Authenticated user
        db: Database session
    
    Returns:
        InventoryListResponse with items and pagination
        
    Example requests:
    
    GET /api/v1/inventory?page=1&page_size=20
    → All inventory items (paginated)
    
    GET /api/v1/inventory?category=protein
    → All protein items
    
    GET /api/v1/inventory?location=fridge&expiring_soon=true
    → Fridge items expiring within 7 days
    
    GET /api/v1/inventory?low_stock=true
    → Items running low
    
    Example response (200):
    {
        "items": [
            {
                "id": "item-uuid-1",
                "item_name": "chicken breast",
                "quantity": 500,
                "unit": "g",
                ...
            },
            {
                "id": "item-uuid-2",
                "item_name": "milk",
                "quantity": 1000,
                "unit": "ml",
                ...
            }
        ],
        "total": 45,
        "page": 1,
        "page_size": 20,
        "total_pages": 3
    }
    """
    # Calculate skip for pagination
    skip = (page - 1) * page_size
    
    # Get items
    items = get_user_inventory(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=page_size,
        category=category,
        location=location,
        expiring_soon=expiring_soon,
        low_stock=low_stock
    )
    
    # Count total (for pagination)
    # Note: Doesn't count low_stock filter accurately
    # For production, you'd want a more sophisticated count
    total = count_user_inventory(
        db=db,
        user_id=current_user.id,
        category=category,
        location=location,
        expiring_soon=expiring_soon
    )
    
    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get(
    "/search",
    response_model=List[InventoryResponse],
    summary="Search inventory",
    description="Search inventory items by name"
)
def search_inventory_endpoint(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Search inventory by item name.
    
    Case-insensitive search.
    
    Args:
        q: Search query
        limit: Max results
        current_user: Authenticated user
        db: Database session
    
    Returns:
        List of matching InventoryResponse objects
        
    Example request:
    GET /api/v1/inventory/search?q=chicken
    
    Example response (200):
    [
        {
            "id": "item-uuid-1",
            "item_name": "chicken breast",
            "quantity": 500,
            "unit": "g",
            ...
        },
        {
            "id": "item-uuid-2",
            "item_name": "chicken thighs",
            "quantity": 300,
            "unit": "g",
            ...
        }
    ]
    """
    items = search_inventory(
        db=db,
        user_id=current_user.id,
        query=q,
        limit=limit
    )
    
    return items


@router.get(
    "/expired",
    response_model=List[InventoryResponse],
    summary="Get expired items",
    description="Get all items that have expired"
)
def get_expired_items_endpoint(
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get all expired items.
    
    Useful for:
    - Cleanup reminders
    - Waste tracking
    - Avoiding using expired ingredients
    
    Args:
        current_user: Authenticated user
        db: Database session
    
    Returns:
        List of expired InventoryResponse objects
        
    Example request:
    GET /api/v1/inventory/expired
    
    Example response (200):
    [
        {
            "id": "item-uuid",
            "item_name": "milk",
            "expiry_date": "2026-01-10T00:00:00",
            "is_expired": true,
            "days_until_expiry": -3,
            ...
        }
    ]
    """
    items = get_expired_items(db, current_user.id)
    return items


@router.get(
    "/stats",
    response_model=InventoryStats,
    summary="Get inventory statistics",
    description="Get summary statistics about your inventory"
)
def get_inventory_stats(
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get inventory statistics.
    
    Provides overview of:
    - Total items
    - Count by category
    - Count by location
    - Items expiring soon
    - Expired items
    - Low stock items
    - Total value (if prices tracked)
    
    Args:
        current_user: Authenticated user
        db: Database session
    
    Returns:
        InventoryStats object
        
    Example request:
    GET /api/v1/inventory/stats
    
    Example response (200):
    {
        "total_items": 45,
        "by_category": {
            "protein": 8,
            "vegetables": 12,
            "dairy": 5,
            "grains": 10,
            "spices": 10
        },
        "by_location": {
            "fridge": 20,
            "freezer": 10,
            "pantry": 15
        },
        "expiring_soon": 5,
        "expired": 2,
        "low_stock": 3,
        "total_value": 250.50
    }
    """
    from sqlalchemy import func
    from app.models.inventory import Inventory
    from datetime import timedelta
    
    # Total items
    total = db.query(func.count(Inventory.id)).filter(
        Inventory.user_id == current_user.id
    ).scalar()
    
    # Count by category
    by_category = db.query(
        Inventory.category,
        func.count(Inventory.id)
    ).filter(
        Inventory.user_id == current_user.id,
        Inventory.category.isnot(None)
    ).group_by(Inventory.category).all()
    
    # Count by location
    by_location = db.query(
        Inventory.location,
        func.count(Inventory.id)
    ).filter(
        Inventory.user_id == current_user.id,
        Inventory.location.isnot(None)
    ).group_by(Inventory.location).all()
    
    # Count expiring soon (within 7 days)
    from datetime import datetime
    seven_days = datetime.utcnow() + timedelta(days=7)
    expiring_soon = db.query(func.count(Inventory.id)).filter(
        Inventory.user_id == current_user.id,
        Inventory.expiry_date.isnot(None),
        Inventory.expiry_date <= seven_days,
        Inventory.expiry_date >= datetime.utcnow()
    ).scalar()
    
    # Count expired
    expired = db.query(func.count(Inventory.id)).filter(
        Inventory.user_id == current_user.id,
        Inventory.expiry_date.isnot(None),
        Inventory.expiry_date < datetime.utcnow()
    ).scalar()
    
    # Count low stock (need to fetch all and check in Python)
    all_items = db.query(Inventory).filter(
        Inventory.user_id == current_user.id
    ).all()
    low_stock = sum(1 for item in all_items if item.is_low_stock)
    
    # Total value
    total_value = db.query(func.sum(Inventory.price)).filter(
        Inventory.user_id == current_user.id,
        Inventory.price.isnot(None)
    ).scalar()
    
    return {
        "total_items": total or 0,
        "by_category": {cat: count for cat, count in by_category},
        "by_location": {loc: count for loc, count in by_location},
        "expiring_soon": expiring_soon or 0,
        "expired": expired or 0,
        "low_stock": low_stock,
        "total_value": float(total_value) if total_value else None
    }


@router.get(
    "/{item_id}",
    response_model=InventoryResponse,
    summary="Get inventory item by ID",
    description="Get a specific inventory item"
)
def get_inventory_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a specific inventory item by ID.
    
    Security: Users can only access their own inventory.
    
    Args:
        item_id: Inventory item UUID
        current_user: Authenticated user
        db: Database session
    
    Returns:
        InventoryResponse
        
    Raises:
        404 Not Found: Item doesn't exist or doesn't belong to user
        
    Example request:
    GET /api/v1/inventory/123e4567-e89b-12d3-a456-426614174000
    
    Example response (200):
    {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "item_name": "chicken breast",
        "quantity": 500,
        "unit": "g",
        ...
    }
    """
    item = get_inventory_item_by_id(db, item_id, current_user.id)
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    return item


@router.put(
    "/{item_id}",
    response_model=InventoryResponse,
    summary="Update inventory item",
    description="Update an existing inventory item"
)
def update_inventory_item_endpoint(
    item_id: UUID,
    item_update: InventoryUpdate,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Update an inventory item.
    
    Common use cases:
    - Update quantity after using some
    - Update expiry date
    - Mark as low stock threshold
    
    Only updates fields that are provided.
    
    Args:
        item_id: Inventory item UUID
        item_update: InventoryUpdate schema
        current_user: Authenticated user
        db: Database session
    
    Returns:
        Updated InventoryResponse
        
    Raises:
        404 Not Found: Item doesn't exist or doesn't belong to user
        
    Example request:
    PUT /api/v1/inventory/123e4567-e89b-12d3-a456-426614174000
    Body:
    {
        "quantity": 300
    }
    
    Example response (200):
    {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "item_name": "chicken breast",
        "quantity": 300,
        ...
    }
    """
    # Convert to dict, exclude unset fields
    update_data = item_update.model_dump(exclude_unset=True)
    
    # Update item
    updated_item = update_inventory_item(
        db=db,
        item_id=item_id,
        user_id=current_user.id,
        update_data=update_data
    )
    
    if not updated_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    return updated_item


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete inventory item",
    description="Delete an inventory item permanently"
)
def delete_inventory_item_endpoint(
    item_id: UUID,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Delete an inventory item.
    
    Use when:
    - Item is fully consumed
    - Item expired and discarded
    - Cleaning up inventory
    
    Args:
        item_id: Inventory item UUID
        current_user: Authenticated user
        db: Database session
    
    Returns:
        204 No Content
        
    Raises:
        404 Not Found: Item doesn't exist or doesn't belong to user
        
    Example request:
    DELETE /api/v1/inventory/123e4567-e89b-12d3-a456-426614174000
    
    Example response (204):
    (empty response body)
    """
    success = delete_inventory_item(db, item_id, current_user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    return None


@router.post(
    "/check-recipe",
    summary="Check if you can make a recipe",
    description="Check if you have enough ingredients for a recipe"
)
def check_recipe_availability(
    recipe_id: UUID,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Check if user has enough inventory to make a recipe.
    
    This is useful for:
    - Showing "Can Make" badge on recipes
    - Meal planning (only suggest makeable recipes)
    - Shopping list generation (what's missing?)
    
    Args:
        recipe_id: Recipe UUID to check
        current_user: Authenticated user
        db: Database session
    
    Returns:
        Dict with availability status
        
    Example request:
    POST /api/v1/inventory/check-recipe?recipe_id=recipe-uuid
    
    Example response (200):
    {
        "available": false,
        "missing": ["rice", "soy sauce"],
        "insufficient": [
            {
                "name": "chicken breast",
                "needed": 500,
                "have": 200,
                "unit": "g"
            }
        ]
    }
    """
    from app.crud.recipe import get_recipe_by_id
    
    # Get recipe
    recipe = get_recipe_by_id(db, recipe_id, current_user.id)
    
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )
    
    # Check inventory
    result = use_inventory_for_recipe(
        db=db,
        user_id=current_user.id,
        ingredients=recipe.ingredients
    )
    
    return result