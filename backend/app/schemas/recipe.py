from pydantic import BaseModel, Field, HttpUrl, ConfigDict
from datetime import datetime
from uuid import UUID
from typing import Optional, List, Dict


class IngredientBase(BaseModel):
    """
    Schema for a single ingredient.
    
    This defines the structure of each ingredient in the list.
    
    Example:
        {
            "name": "flour",
            "quantity": "2",
            "unit": "cups"
        }
    """
    name: str = Field(..., description="Ingredient name", examples=["flour", "eggs", "sugar"])
    quantity: str = Field(..., description="Amount", examples=["2", "1.5", "1/2"])
    unit: str = Field(..., description="Unit of measurement", examples=["cups", "tbsp", "whole"])


class NutritionInfo(BaseModel):
    """
    Schema for nutrition information.
    
    All fields are optional (not all recipes have nutrition data).
    
    Example:
        {
            "calories": 450,
            "protein": 25,
            "carbs": 50,
            "fat": 15
        }
    """
    calories: Optional[float] = Field(None)
    protein_g: Optional[float] = Field(None)
    carbs_g: Optional[float] = Field(None)
    fat_g: Optional[float] = Field(None)
    saturated_fat_g: Optional[float] = Field(None)
    fiber_g: Optional[float] = Field(None)
    sugar_g: Optional[float] = Field(None)
    sodium_mg: Optional[float] = Field(None)
    cholesterol_mg: Optional[float] = Field(None)


class RecipeBase(BaseModel):
    """
    Base recipe schema with common fields.
    
    Other schemas inherit from this to avoid repetition.
    """
    title: str = Field(..., min_length=1, max_length=200, description="Recipe title")
    description: Optional[str] = Field(None, description="Recipe description")
    ingredients: List[Dict] = Field(..., description="List of ingredients")
    # We use List[Dict] instead of List[IngredientBase] for flexibility
    # AI extraction might not perfectly match our ingredient schema
    
    steps: List[str] = Field(..., description="Cooking steps")
    prep_time: Optional[int] = Field(None, ge=0, description="Preparation time in minutes")
    cook_time: Optional[int] = Field(None, ge=0, description="Cooking time in minutes")
    servings: Optional[int] = Field(None, ge=1, description="Number of servings")
    nutrition: Optional[NutritionInfo] = None
    category: Optional[str] = Field(None, examples=["dinner", "dessert", "breakfast"])
    cuisine: Optional[str] = Field(None, examples=["Italian", "Mexican", "Japanese"])
    is_favorite: bool = False


class RecipeCreate(RecipeBase):
    """
    Schema for creating a recipe manually.
    
    Used when: POST /api/v1/recipes (manual entry)
    
    Note: user_id is NOT here - we get it from the authenticated user.
    
    Example:
        {
            "title": "Pasta Carbonara",
            "ingredients": [
                {"name": "spaghetti", "quantity": "400", "unit": "g"},
                {"name": "eggs", "quantity": "4", "unit": "whole"}
            ],
            "steps": ["Boil pasta", "Mix eggs", "Combine"],
            "prep_time": 10,
            "cook_time": 15,
            "servings": 4
        }
    """
    source_url: Optional[str] = Field(None, description="Original URL (if from web)")


class RecipeExtractRequest(BaseModel):
    """
    Schema for requesting AI recipe extraction.
    
    Used when: POST /api/v1/recipes/extract
    
    User provides Instagram URL, AI extracts recipe data.
    
    Example:
        {
            "instagram_url": "https://www.instagram.com/p/ABC123/"
        }
    """
    instagram_url: str = Field(
        ...,
        description="Instagram post URL containing a recipe",
        examples=["https://www.instagram.com/p/ABC123/"]
    )


class RecipeTextExtractRequest(BaseModel):
    """
    Schema for requesting AI recipe extraction from plain text.

    Used when: POST /api/v1/recipes/extract-text

    Example:
        {
            "recipe_text": "2 eggs\\n1 cup flour\\nMix and bake"
        }
    """
    recipe_text: str = Field(
        ...,
        min_length=10,
        description="Plain text containing a recipe or copied social caption",
        examples=[
            "Pasta Carbonara\nIngredients: 400g spaghetti, 4 eggs\n"
            "Instructions: Boil pasta, fry bacon, combine with eggs."
        ]
    )


class RecipeUpdate(BaseModel):
    """
    Schema for updating a recipe.
    
    All fields are optional - only update what's provided.
    
    Example:
        {
            "title": "Updated Recipe Name"
        }
    or
        {
            "prep_time": 15,
            "cook_time": 20
        }
    """
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    ingredients: Optional[List[Dict]] = None
    steps: Optional[List[str]] = None
    prep_time: Optional[int] = Field(None, ge=0)
    cook_time: Optional[int] = Field(None, ge=0)
    servings: Optional[int] = Field(None, ge=1)
    nutrition: Optional[NutritionInfo] = None
    category: Optional[str] = None
    cuisine: Optional[str] = None
    is_favorite: Optional[bool] = None


class RecipeResponse(RecipeBase):
    """
    Schema for returning recipe data.
    
    Used when: Returning recipes in API responses
    
    Includes all recipe data plus:
    - id (UUID)
    - user_id (who owns it)
    - timestamps
    - source info
    
    Example response:
        {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "user_id": "user-uuid-here",
            "title": "Pasta Carbonara",
            "ingredients": [...],
            "steps": [...],
            "prep_time": 10,
            "cook_time": 15,
            "servings": 4,
            "total_time": 25,
            "image_url": "https://...",
            "source_url": "https://instagram.com/...",
            "created_at": "2026-01-13T10:30:00",
            "updated_at": "2026-01-13T10:30:00"
        }
    """
    id: UUID
    user_id: UUID
    image_url: Optional[str] = None
    source_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    total_time: Optional[int] = None  # Calculated field (prep_time + cook_time)
    
    model_config = ConfigDict(
        from_attributes=True,
        # Allows conversion from SQLAlchemy Recipe object
        
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "user_id": "user-uuid-here",
                "title": "Pasta Carbonara",
                "description": "Classic Italian pasta dish",
                "ingredients": [
                    {"name": "spaghetti", "quantity": "400", "unit": "g"},
                    {"name": "eggs", "quantity": "4", "unit": "whole"}
                ],
                "steps": [
                    "Boil pasta in salted water",
                    "Fry bacon until crispy",
                    "Mix eggs with cheese",
                    "Combine everything"
                ],
                "prep_time": 10,
                "cook_time": 15,
                "servings": 4,
                "total_time": 25,
                "category": "dinner",
                "cuisine": "Italian",
                "created_at": "2026-01-13T10:30:00",
                "updated_at": "2026-01-13T10:30:00"
            }
        }
    )


class RecipeListResponse(BaseModel):
    """
    Schema for paginated list of recipes.
    
    Used when: GET /api/v1/recipes (list endpoint)
    
    Includes pagination info.
    
    Example:
        {
            "recipes": [recipe1, recipe2, recipe3],
            "total": 25,
            "page": 1,
            "page_size": 10,
            "total_pages": 3
        }
    """
    recipes: List[RecipeResponse]
    total: int = Field(..., description="Total number of recipes")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Items per page")
    total_pages: int = Field(..., description="Total number of pages")
