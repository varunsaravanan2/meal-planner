from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from uuid import UUID
from typing import Optional, List


class InventoryBase(BaseModel):
    """
    Base inventory schema with common fields.
    """
    item_name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Name of the item",
        examples=["chicken breast", "milk", "flour"]
    )
    quantity: float = Field(
        ...,
        gt=0,
        description="Quantity of the item",
        examples=[500, 1.5, 2]
    )
    unit: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Unit of measurement",
        examples=["g", "ml", "cups", "pieces", "whole"]
    )
    category: Optional[str] = Field(
        None,
        description="Category for organization",
        examples=["dairy", "protein", "vegetables", "grains", "spices"]
    )
    location: Optional[str] = Field(
        None,
        description="Storage location",
        examples=["fridge", "freezer", "pantry", "spice_rack"]
    )
    expiry_date: Optional[datetime] = Field(
        None,
        description="Expiry date (if applicable)"
    )
    purchase_date: Optional[datetime] = Field(
        None,
        description="Purchase date"
    )
    price: Optional[float] = Field(
        None,
        ge=0,
        description="Price paid for item"
    )
    notes: Optional[str] = Field(
        None,
        max_length=500,
        description="Additional notes"
    )
    min_quantity: Optional[float] = Field(
        None,
        ge=0,
        description="Minimum quantity threshold for low stock alert"
    )
    is_staple: bool = Field(
        False,
        description="Is this a staple item to always keep in stock?"
    )


class InventoryCreate(InventoryBase):
    """
    Schema for creating an inventory item.
    
    Used when: POST /api/v1/inventory
    
    Example:
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
    """
    pass


class InventoryUpdate(BaseModel):
    """
    Schema for updating an inventory item.
    
    All fields are optional - only update what's provided.
    
    Common use case: Updating quantity after using some
    
    Example:
    {
        "quantity": 300  // Used 200g, now have 300g left
    }
    
    Or updating expiry:
    {
        "expiry_date": "2026-02-01T00:00:00"
    }
    """
    item_name: Optional[str] = Field(None, min_length=1, max_length=200)
    quantity: Optional[float] = Field(None, gt=0)
    unit: Optional[str] = Field(None, min_length=1, max_length=50)
    category: Optional[str] = None
    location: Optional[str] = None
    expiry_date: Optional[datetime] = None
    purchase_date: Optional[datetime] = None
    price: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=500)
    min_quantity: Optional[float] = Field(None, ge=0)
    is_staple: Optional[bool] = None


class InventoryResponse(InventoryBase):
    """
    Schema for returning inventory item data.
    
    Includes all item data plus:
    - id (UUID)
    - user_id (owner)
    - computed fields (is_low_stock, is_expiring_soon, days_until_expiry)
    - timestamps
    
    Example response:
    {
        "id": "item-uuid",
        "user_id": "user-uuid",
        "item_name": "yogurt",
        "quantity": 500,
        "unit": "g",
        "category": "dairy",
        "location": "fridge",
        "expiry_date": "2026-01-20T00:00:00",
        "is_low_stock": false,
        "is_expiring_soon": true,
        "is_expired": false,
        "days_until_expiry": 5,
        "created_at": "2026-01-13T10:30:00",
        "updated_at": "2026-01-13T10:30:00"
    }
    """
    id: UUID
    user_id: UUID
    is_low_stock: bool
    is_expiring_soon: bool
    is_expired: bool
    days_until_expiry: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class InventoryListResponse(BaseModel):
    """
    Schema for paginated list of inventory items.
    
    Example:
    {
        "items": [item1, item2, item3],
        "total": 50,
        "page": 1,
        "page_size": 20,
        "total_pages": 3
    }
    """
    items: List[InventoryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class InventoryStats(BaseModel):
    """
    Schema for inventory statistics.
    
    Example:
    {
        "total_items": 45,
        "by_category": {
            "protein": 8,
            "vegetables": 12,
            "dairy": 5
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
    total_items: int
    by_category: dict
    by_location: dict
    expiring_soon: int
    expired: int
    low_stock: int
    total_value: Optional[float] = None