from sqlalchemy import Column, String, Integer, DateTime, JSON, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class Recipe(Base):
    """
    Recipe model - represents recipes saved from Instagram.
    
    Relationships:
    - Belongs to one User (user who saved it)
    - Has many ingredients (stored as JSON for simplicity)
    
    Why JSON for ingredients?
    - Flexible structure (different recipes have different ingredient formats)
    - No need for separate ingredients table (simpler for now)
    - Easy to work with in Python (list of dicts)
    
    Alternative approach (more complex, more powerful):
    - Separate Ingredient model with many-to-many relationship
    - Better for searching "all recipes with chicken"
    - We'll keep it simple for now
    
    Example recipe data:
        recipe = Recipe(
            user_id=user.id,
            title="Pasta Carbonara",
            ingredients=[
                {"name": "spaghetti", "quantity": "400", "unit": "g"},
                {"name": "eggs", "quantity": "4", "unit": "whole"},
                {"name": "bacon", "quantity": "200", "unit": "g"}
            ],
            steps=[
                "Boil pasta",
                "Cook bacon until crispy",
                "Mix eggs with cheese",
                "Combine all ingredients"
            ],
            prep_time=10,
            cook_time=15,
            servings=4
        )
    """
    
    __tablename__ = "recipes"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key - links to users table
    # ForeignKey("users.id") → References the id column in users table
    # nullable=False → Every recipe must belong to a user
    # index=True → Fast lookups for "all recipes by user X"
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Recipe basic info
    title = Column(String, nullable=False)
    # Text = Longer text field (no length limit)
    # String = VARCHAR(limited length)
    description = Column(Text, nullable=True)
    
    # Ingredients as JSON
    # JSON column stores Python lists/dicts as JSON in PostgreSQL
    # Example: [{"name": "flour", "quantity": "2", "unit": "cups"}, ...]
    # nullable=False → Recipe must have ingredients
    ingredients = Column(JSON, nullable=False)
    
    # Steps as JSON (list of strings)
    # Example: ["Step 1", "Step 2", "Step 3"]
    steps = Column(JSON, nullable=False)
    
    # Timing (in minutes)
    prep_time = Column(Integer, nullable=True)  # Preparation time
    cook_time = Column(Integer, nullable=True)  # Cooking time
    
    # Servings
    servings = Column(Integer, nullable=True)
    
    # Nutrition info as JSON (optional)
    # Example: {"calories": 450, "protein": 25, "carbs": 50, "fat": 15}
    nutrition = Column(JSON, nullable=True)
    
    # Source info
    image_url = Column(String, nullable=True)  # URL to recipe image
    source_url = Column(String, nullable=True)  # Original Instagram post URL
    
    # Category/tags
    category = Column(String, nullable=True)  # e.g., "dinner", "dessert", "breakfast"
    cuisine = Column(String, nullable=True)    # e.g., "Italian", "Mexican", "Japanese"
    
    is_favorite = Column(Boolean, default=False, nullable=False, server_default='false')

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to User
    # back_populates="recipes" → Creates user.recipes attribute
    # This is a many-to-one relationship:
    #   - Many recipes belong to one user
    #   - One user has many recipes
    # 
    # Usage:
    #   recipe.user → Get the User object who owns this recipe
    #   user.recipes → Get all Recipe objects for this user
    user = relationship("User", back_populates="recipes")
    
    def __repr__(self):
        return f"<Recipe(title='{self.title}', user_id='{self.user_id}')>"
    
    @property
    def total_time(self):
        """
        Calculate total time (prep + cook).
        
        @property makes this act like an attribute, not a method.
        Usage: recipe.total_time (not recipe.total_time())
        
        Returns:
            Total minutes, or None if times not set
        """
        if self.prep_time and self.cook_time:
            return self.prep_time + self.cook_time
        return None