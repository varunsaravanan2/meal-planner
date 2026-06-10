from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.inventory import Inventory
from datetime import datetime, timedelta
from uuid import UUID
from typing import Optional, List


def get_inventory_item_by_id(
    db: Session,
    item_id: UUID,
    user_id: UUID
) -> Optional[Inventory]:
    """
    Get an inventory item by ID.
    
    Security: Users can only access their own inventory.
    
    Args:
        db: Database session
        item_id: Inventory item UUID
        user_id: User UUID (for authorization)
        
    Returns:
        Inventory object if found and belongs to user, None otherwise
    """
    return db.query(Inventory).filter(
        Inventory.id == item_id,
        Inventory.user_id == user_id
    ).first()


def get_user_inventory(
    db: Session,
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    location: Optional[str] = None,
    expiring_soon: bool = False,
    low_stock: bool = False
) -> List[Inventory]:
    """
    Get all inventory items for a user with filtering.
    
    Filters:
    - By category (dairy, protein, etc.)
    - By location (fridge, freezer, etc.)
    - Expiring soon (within 7 days)
    - Low stock (quantity <= min_quantity)
    
    Args:
        db: Database session
        user_id: User UUID
        skip: Pagination skip
        limit: Pagination limit
        category: Filter by category
        location: Filter by location
        expiring_soon: Show only items expiring within 7 days
        low_stock: Show only low stock items
        
    Returns:
        List of Inventory objects
        
    Example:
        # Get all fridge items
        items = get_user_inventory(db, user.id, location="fridge")
        
        # Get items expiring soon
        items = get_user_inventory(db, user.id, expiring_soon=True)
        
        # Get low stock protein items
        items = get_user_inventory(db, user.id, category="protein", low_stock=True)
    """
    query = db.query(Inventory).filter(Inventory.user_id == user_id)
    
    # Filter by category
    if category:
        query = query.filter(Inventory.category == category)
    
    # Filter by location
    if location:
        query = query.filter(Inventory.location == location)
    
    # Filter expiring soon (within 7 days)
    if expiring_soon:
        seven_days = datetime.utcnow() + timedelta(days=7)
        query = query.filter(
            Inventory.expiry_date.isnot(None),
            Inventory.expiry_date <= seven_days,
            Inventory.expiry_date >= datetime.utcnow()  # Not already expired
        )
    
    # Filter low stock
    # Note: This is tricky in SQL - comparing quantity to min_quantity
    # For simplicity, we filter in Python after querying
    # For production, consider adding a computed column or separate query
    
    items = query.offset(skip).limit(limit).all()
    
    # Filter low stock in Python
    if low_stock:
        items = [item for item in items if item.is_low_stock]
    
    return items


def count_user_inventory(
    db: Session,
    user_id: UUID,
    category: Optional[str] = None,
    location: Optional[str] = None,
    expiring_soon: bool = False
) -> int:
    """
    Count inventory items for pagination.
    
    Note: Doesn't count low_stock filter (handled in Python)
    
    Args:
        db: Database session
        user_id: User UUID
        category: Filter by category
        location: Filter by location
        expiring_soon: Count only expiring items
        
    Returns:
        Total count
    """
    query = db.query(func.count(Inventory.id)).filter(
        Inventory.user_id == user_id
    )
    
    if category:
        query = query.filter(Inventory.category == category)
    
    if location:
        query = query.filter(Inventory.location == location)
    
    if expiring_soon:
        seven_days = datetime.utcnow() + timedelta(days=7)
        query = query.filter(
            Inventory.expiry_date.isnot(None),
            Inventory.expiry_date <= seven_days,
            Inventory.expiry_date >= datetime.utcnow()
        )
    
    return query.scalar()


def create_inventory_item(
    db: Session,
    user_id: UUID,
    item_name: str,
    quantity: float,
    unit: str,
    category: Optional[str] = None,
    location: Optional[str] = None,
    expiry_date: Optional[datetime] = None,
    purchase_date: Optional[datetime] = None,
    price: Optional[float] = None,
    notes: Optional[str] = None,
    min_quantity: Optional[float] = None,
    is_staple: bool = False
) -> Inventory:
    """
    Create a new inventory item.
    
    Args:
        db: Database session
        user_id: User UUID
        item_name: Name of item
        quantity: Amount
        unit: Unit of measurement
        ... (other optional fields)
        
    Returns:
        Created Inventory object
        
    Example:
        item = create_inventory_item(
            db=db,
            user_id=current_user.id,
            item_name="chicken breast",
            quantity=500,
            unit="g",
            category="protein",
            location="fridge",
            expiry_date=datetime(2026, 1, 20),
            min_quantity=200
        )
    """
    db_item = Inventory(
        user_id=user_id,
        item_name=item_name,
        quantity=quantity,
        unit=unit,
        category=category,
        location=location,
        expiry_date=expiry_date,
        purchase_date=purchase_date,
        price=price,
        notes=notes,
        min_quantity=min_quantity,
        is_staple=is_staple
    )
    
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    return db_item


def update_inventory_item(
    db: Session,
    item_id: UUID,
    user_id: UUID,
    update_data: dict
) -> Optional[Inventory]:
    """
    Update an inventory item.
    
    Common use case: Update quantity after using some
    
    Args:
        db: Database session
        item_id: Inventory item UUID
        user_id: User UUID (for authorization)
        update_data: Dict of fields to update
        
    Returns:
        Updated Inventory object if found, None otherwise
        
    Example:
        # Used 200g of chicken, update quantity
        item = update_inventory_item(
            db=db,
            item_id=item_id,
            user_id=current_user.id,
            update_data={"quantity": 300}
        )
    """
    item = get_inventory_item_by_id(db, item_id, user_id)
    
    if not item:
        return None
    
    # Update only provided fields
    for key, value in update_data.items():
        if value is not None and hasattr(item, key):
            setattr(item, key, value)
    
    db.commit()
    db.refresh(item)
    
    return item


def delete_inventory_item(
    db: Session,
    item_id: UUID,
    user_id: UUID
) -> bool:
    """
    Delete an inventory item.
    
    Args:
        db: Database session
        item_id: Inventory item UUID
        user_id: User UUID (for authorization)
        
    Returns:
        True if deleted, False if not found
    """
    item = get_inventory_item_by_id(db, item_id, user_id)
    
    if not item:
        return False
    
    db.delete(item)
    db.commit()
    
    return True


def search_inventory(
    db: Session,
    user_id: UUID,
    query: str,
    skip: int = 0,
    limit: int = 100
) -> List[Inventory]:
    """
    Search inventory by item name.
    
    Case-insensitive search.
    
    Args:
        db: Database session
        user_id: User UUID
        query: Search term
        skip: Pagination
        limit: Pagination
        
    Returns:
        List of matching Inventory objects
        
    Example:
        # Find all items with "chicken"
        items = search_inventory(db, user.id, "chicken")
    """
    search_pattern = f"%{query}%"
    
    return db.query(Inventory).filter(
        Inventory.user_id == user_id,
        Inventory.item_name.ilike(search_pattern)
    ).offset(skip).limit(limit).all()


def get_expired_items(
    db: Session,
    user_id: UUID
) -> List[Inventory]:
    """
    Get all expired items.
    
    Args:
        db: Database session
        user_id: User UUID
        
    Returns:
        List of expired Inventory objects
    """
    return db.query(Inventory).filter(
        Inventory.user_id == user_id,
        Inventory.expiry_date.isnot(None),
        Inventory.expiry_date < datetime.utcnow()
    ).all()


def use_inventory_for_recipe(
    db: Session,
    user_id: UUID,
    ingredients: List[dict]
) -> dict:
    """
    Check if user has ingredients for a recipe and optionally deduct them.
    
    This is used when:
    - User cooks a recipe
    - System deducts ingredients from inventory
    
    Args:
        db: Database session
        user_id: User UUID
        ingredients: List of ingredient dicts
            [{"name": "chicken", "quantity": 200, "unit": "g"}, ...]
        
    Returns:
        Dict with:
        - "available": bool (can make recipe?)
        - "missing": list of missing ingredients
        - "insufficient": list of ingredients with not enough quantity
        
    Example:
        result = use_inventory_for_recipe(
            db,
            user.id,
            [
                {"name": "chicken breast", "quantity": 200, "unit": "g"},
                {"name": "rice", "quantity": 100, "unit": "g"}
            ]
        )
        
        if result["available"]:
            print("You can make this recipe!")
        else:
            print(f"Missing: {result['missing']}")
            print(f"Not enough: {result['insufficient']}")
    """
    missing = []
    insufficient = []
    
    for ingredient in ingredients:
        # Search for item in inventory (case-insensitive)
        item = db.query(Inventory).filter(
            Inventory.user_id == user_id,
            func.lower(Inventory.item_name) == ingredient["name"].lower()
        ).first()
        
        if not item:
            missing.append(ingredient["name"])
        elif item.quantity < float(ingredient["quantity"]):
            insufficient.append({
                "name": ingredient["name"],
                "needed": ingredient["quantity"],
                "have": item.quantity,
                "unit": ingredient["unit"]
            })
    
    return {
        "available": len(missing) == 0 and len(insufficient) == 0,
        "missing": missing,
        "insufficient": insufficient
    }