from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class Inventory(Base):
    """
    Inventory model - tracks ingredients/items user has at home.
    
    Purpose:
    - Track what's in pantry/fridge/freezer
    - Monitor quantities
    - Track expiry dates
    - Alert when items running low or expiring soon
    
    Use cases:
    - "What can I make with what I have?"
    - "What's expiring this week?"
    - "What do I need to buy?"
    - Meal planner uses this to suggest recipes
    
    Relationships:
    - Belongs to one User (user's inventory)
    
    Example inventory item:
        item = Inventory(
            user_id=user.id,
            item_name="chicken breast",
            quantity=500,
            unit="g",
            category="protein",
            location="fridge",
            expiry_date=datetime(2026, 1, 20),
            notes="Organic, from Whole Foods"
        )
    """
    
    __tablename__ = "inventory"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key - links to users table
    # Each inventory item belongs to one user
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Item details
    # item_name = Generic name (not tied to specific recipe ingredient)
    # Examples: "chicken breast", "milk", "flour", "eggs"
    item_name = Column(String, nullable=False, index=True)
    # index=True → Fast searches for "do I have chicken?"
    
    # Quantity tracking
    # Float allows: 1.5, 0.25, etc.
    quantity = Column(Float, nullable=False)
    
    # Unit of measurement
    # Examples: "g", "ml", "cups", "pieces", "whole"
    # Store as string for flexibility
    unit = Column(String, nullable=False)
    
    # Category for organization
    # Examples: "dairy", "protein", "vegetables", "grains", "spices"
    # Helps with: filtering, shopping list organization
    category = Column(String, nullable=True, index=True)
    
    # Storage location
    # Examples: "fridge", "freezer", "pantry", "spice_rack"
    # Helps users find items physically
    location = Column(String, nullable=True)
    
    # Expiry tracking
    # DateTime = Can track exact expiry date
    # nullable=True → Not all items have expiry (rice, flour, etc.)
    expiry_date = Column(DateTime, nullable=True, index=True)
    # index=True → Fast queries for "what's expiring soon?"
    
    # Purchase tracking (optional)
    purchase_date = Column(DateTime, nullable=True)
    
    # Price tracking (optional, for budget features)
    price = Column(Float, nullable=True)
    
    # Notes/description
    # Examples: "Organic", "From Costco", "Half-used package"
    notes = Column(String, nullable=True)
    
    # Low stock alert threshold
    # When quantity drops below this, alert user
    # Example: milk.min_quantity = 500 (alert when < 500ml)
    min_quantity = Column(Float, nullable=True)
    
    # Is this a staple item? (always keep in stock)
    # Examples: salt, pepper, olive oil, garlic
    # Used for: automatic shopping list generation
    is_staple = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to User
    # back_populates="inventory" → Creates user.inventory attribute
    # cascade="all, delete-orphan" → Delete inventory when user deleted
    user = relationship("User", back_populates="inventory")
    
    def __repr__(self):
        return f"<Inventory(item='{self.item_name}', qty={self.quantity}{self.unit})>"
    
    @property
    def is_low_stock(self):
        """
        Check if item is running low.
        
        Returns True if quantity below minimum threshold.
        
        @property makes this act like an attribute.
        Usage: item.is_low_stock (not item.is_low_stock())
        
        Example:
            milk = Inventory(quantity=200, min_quantity=500)
            print(milk.is_low_stock)  # True
        """
        if self.min_quantity is not None:
            return self.quantity <= self.min_quantity
        return False
    
    @property
    def is_expiring_soon(self, days=7):
        """
        Check if item expires within N days.
        
        Default: 7 days
        
        Args:
            days: Number of days to check (default 7)
        
        Returns:
            True if expiring within N days, False otherwise
            
        Example:
            eggs = Inventory(expiry_date=datetime(2026, 1, 15))
            # If today is Jan 10:
            print(eggs.is_expiring_soon)  # True (5 days away)
        """
        if self.expiry_date is None:
            return False
        
        days_until_expiry = (self.expiry_date - datetime.utcnow()).days
        return 0 <= days_until_expiry <= days
    
    @property
    def is_expired(self):
        """
        Check if item has expired.
        
        Returns:
            True if past expiry date, False otherwise
        """
        if self.expiry_date is None:
            return False
        
        return datetime.utcnow() > self.expiry_date
    
    @property
    def days_until_expiry(self):
        """
        Calculate days until expiry.
        
        Returns:
            Number of days (can be negative if expired)
            None if no expiry date
            
        Example:
            item.days_until_expiry = 5  # Expires in 5 days
            item.days_until_expiry = -2  # Expired 2 days ago
        """
        if self.expiry_date is None:
            return None
        
        return (self.expiry_date - datetime.utcnow()).days