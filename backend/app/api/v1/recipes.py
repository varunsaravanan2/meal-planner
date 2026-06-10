from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.schemas.recipe import (
    RecipeCreate,
    RecipeUpdate,
    RecipeResponse,
    RecipeExtractRequest,
    RecipeTextExtractRequest,
    RecipeListResponse
)
from app.crud.recipe import (
    get_recipe_by_id,
    get_user_recipes,
    count_user_recipes,
    create_recipe,
    update_recipe,
    delete_recipe,
    search_recipes
)
from app.services.recipe_extractor import extract_recipe_from_instagram, extract_recipe_from_text
from app.api.v1.auth import get_current_user_dependency
from app.models.user import User


# Create router
router = APIRouter()


@router.post(
    "/",
    response_model=RecipeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a recipe manually",
    description="Create a new recipe by providing all details"
)
def create_recipe_endpoint(
    recipe: RecipeCreate,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Create a new recipe manually.
    
    User provides all recipe details (title, ingredients, steps, etc.)
    This is the "manual entry" option (vs AI extraction).
    
    Process:
    1. Validate input (Pydantic does this automatically)
    2. Get current user (from JWT token)
    3. Create recipe in database
    4. Return created recipe
    
    Args:
        recipe: RecipeCreate schema with all recipe details
        current_user: Authenticated user (from dependency)
        db: Database session
    
    Returns:
        201 Created + RecipeResponse
        
    Example request:
    POST /api/v1/recipes
    Headers: Authorization: Bearer <token>
    Body:
    {
        "title": "Pasta Carbonara",
        "description": "Classic Italian pasta",
        "ingredients": [
            {"name": "spaghetti", "quantity": "400", "unit": "g"},
            {"name": "eggs", "quantity": "4", "unit": "whole"},
            {"name": "bacon", "quantity": "200", "unit": "g"},
            {"name": "parmesan", "quantity": "100", "unit": "g"}
        ],
        "steps": [
            "Boil pasta in salted water",
            "Fry bacon until crispy",
            "Beat eggs with parmesan",
            "Mix everything together"
        ],
        "prep_time": 10,
        "cook_time": 15,
        "servings": 4,
        "category": "dinner",
        "cuisine": "Italian"
    }
    
    Example response (201):
    {
        "id": "recipe-uuid-here",
        "user_id": "user-uuid-here",
        "title": "Pasta Carbonara",
        "ingredients": [...],
        "steps": [...],
        "total_time": 25,
        "created_at": "2026-01-13T10:30:00",
        ...
    }
    """
    try:
        # Create recipe using CRUD function
        # current_user.id → Recipe belongs to authenticated user
        new_recipe = create_recipe(
            db=db,
            user_id=current_user.id,
            title=recipe.title,
            description=recipe.description,
            ingredients=recipe.ingredients,
            steps=recipe.steps,
            prep_time=recipe.prep_time,
            cook_time=recipe.cook_time,
            servings=recipe.servings,
            nutrition=recipe.nutrition.dict() if recipe.nutrition else None,
            category=recipe.category,
            cuisine=recipe.cuisine,
            source_url=recipe.source_url
        )
        
        return new_recipe
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create recipe: {str(e)}"
        )


@router.post(
    "/extract",
    response_model=RecipeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Extract recipe from Instagram",
    description="AI-powered recipe extraction from Instagram post"
)
async def extract_recipe_endpoint(
    request: RecipeExtractRequest,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Extract recipe from Instagram post using AI.
    
    This is the "magic" endpoint!
    User provides Instagram URL → AI extracts recipe → Saves to database
    
    Process:
    1. Receive Instagram URL
    2. Fetch post content (caption, images)
    3. Use Claude AI to extract structured recipe data
    4. Validate extracted data
    5. Save to database
    6. Return created recipe
    
    Args:
        request: RecipeExtractRequest with instagram_url
        current_user: Authenticated user
        db: Database session
    
    Returns:
        201 Created + RecipeResponse (extracted recipe)
    
    Raises:
        400 Bad Request: Invalid URL or extraction failed
        500 Internal Server Error: Database error
        
    Example request:
    POST /api/v1/recipes/extract
    Headers: Authorization: Bearer <token>
    Body:
    {
        "instagram_url": "https://www.instagram.com/p/ABC123/"
    }
    
    Example response (201):
    {
        "id": "recipe-uuid",
        "title": "Pasta Carbonara",
        "ingredients": [...],
        "steps": [...],
        "source_url": "https://www.instagram.com/p/ABC123/",
        ...
    }
    
    Note: Currently not fully implemented!
    Need to implement fetch_instagram_post_content() first.
    See app/services/recipe_extractor.py for details.
    """
    try:
        # Step 1: Extract recipe using AI
        # This calls Claude API and returns structured data
        recipe_data = await extract_recipe_from_instagram(request.instagram_url)
        
        # Step 2: Create recipe in database
        new_recipe = create_recipe(
            db=db,
            user_id=current_user.id,
            title=recipe_data["title"],
            description=recipe_data.get("description"),
            ingredients=recipe_data["ingredients"],
            steps=recipe_data["steps"],
            prep_time=recipe_data.get("prep_time"),
            cook_time=recipe_data.get("cook_time"),
            servings=recipe_data.get("servings"),
            nutrition=recipe_data.get("nutrition"),
            category=recipe_data.get("category"),
            cuisine=recipe_data.get("cuisine"),
            source_url=recipe_data.get("source_url")
        )
        
        return new_recipe
        
    except NotImplementedError as e:
        # Instagram fetching not implemented yet
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(e)
        )
    except ValueError as e:
        # Validation failed
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Recipe extraction failed: {str(e)}"
        )
    except Exception as e:
        # Other errors (AI API, database, etc.)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract recipe: {str(e)}"
        )


@router.post(
    "/extract-text",
    response_model=RecipeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Extract recipe from text",
    description="AI-powered recipe extraction from plain text"
)
async def extract_recipe_from_text_endpoint(
    request: RecipeTextExtractRequest,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Extract recipe from plain text using AI.
    
    Alternative to Instagram extraction.
    User pastes recipe text → AI extracts → Saves to database
    
    Useful for:
    - Testing AI extraction
    - Recipes from other sources
    - When Instagram API not available
    
    Args:
        request: RecipeTextExtractRequest containing recipe text
        current_user: Authenticated user
        db: Database session
    
    Returns:
        201 Created + RecipeResponse
        
    Example request:
    POST /api/v1/recipes/extract-text
    Content-Type: application/json
    {
        "recipe_text": "Chocolate Chip Cookies..."
    }
    
    Example response (201):
    {
        "id": "recipe-uuid",
        "title": "Chocolate Chip Cookies",
        "ingredients": [...],
        "steps": [...],
        ...
    }
    """
    try:
        # Extract recipe from text using AI
        recipe_data = await extract_recipe_from_text(request.recipe_text)
        
        # Create recipe in database
        new_recipe = create_recipe(
            db=db,
            user_id=current_user.id,
            title=recipe_data["title"],
            description=recipe_data.get("description"),
            ingredients=recipe_data["ingredients"],
            steps=recipe_data["steps"],
            prep_time=recipe_data.get("prep_time"),
            cook_time=recipe_data.get("cook_time"),
            servings=recipe_data.get("servings"),
            nutrition=recipe_data.get("nutrition"),
            category=recipe_data.get("category"),
            cuisine=recipe_data.get("cuisine"),
            source_url=recipe_data.get("source_url")
        )
        
        return new_recipe
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Recipe extraction failed: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract recipe: {str(e)}"
        )


@router.get(
    "/",
    response_model=RecipeListResponse,
    summary="Get all recipes",
    description="Get paginated list of user's recipes with optional filters"
)
def get_recipes_endpoint(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(None, description="Filter by category"),
    cuisine: Optional[str] = Query(None, description="Filter by cuisine"),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get all recipes for current user with pagination and filters.
    
    Features:
    - Pagination (page + page_size)
    - Filter by category (breakfast, lunch, dinner, etc.)
    - Filter by cuisine (Italian, Mexican, etc.)
    
    Args:
        page: Page number (starts at 1)
        page_size: Items per page (max 100)
        category: Optional category filter
        cuisine: Optional cuisine filter
        current_user: Authenticated user
        db: Database session
    
    Returns:
        RecipeListResponse with recipes array and pagination info
        
    Example requests:
    
    GET /api/v1/recipes?page=1&page_size=10
    → First 10 recipes
    
    GET /api/v1/recipes?page=2&page_size=10
    → Next 10 recipes
    
    GET /api/v1/recipes?category=dinner
    → All dinner recipes
    
    GET /api/v1/recipes?cuisine=Italian&page=1&page_size=5
    → First 5 Italian recipes
    
    Example response (200):
    {
        "recipes": [
            {
                "id": "recipe-uuid-1",
                "title": "Pasta Carbonara",
                ...
            },
            {
                "id": "recipe-uuid-2",
                "title": "Pizza Margherita",
                ...
            }
        ],
        "total": 25,
        "page": 1,
        "page_size": 10,
        "total_pages": 3
    }
    """
    # Calculate skip for pagination
    # Page 1: skip 0, Page 2: skip 10, Page 3: skip 20, etc.
    skip = (page - 1) * page_size
    
    # Get recipes from database
    recipes = get_user_recipes(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=page_size,
        category=category,
        cuisine=cuisine
    )
    
    # Count total recipes (for pagination)
    total = count_user_recipes(
        db=db,
        user_id=current_user.id,
        category=category,
        cuisine=cuisine
    )
    
    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size  # Ceiling division
    
    return {
        "recipes": recipes,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get(
    "/search",
    response_model=List[RecipeResponse],
    summary="Search recipes",
    description="Search recipes by title or description"
)
def search_recipes_endpoint(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Search recipes by title or description.
    
    Case-insensitive search.
    Searches in title and description fields.
    
    Args:
        q: Search query (what to search for)
        limit: Max number of results (default 20)
        current_user: Authenticated user
        db: Database session
    
    Returns:
        List of matching RecipeResponse objects
        
    Example requests:
    
    GET /api/v1/recipes/search?q=pasta
    → All recipes with "pasta" in title/description
    
    GET /api/v1/recipes/search?q=chicken&limit=5
    → First 5 recipes with "chicken"
    
    Example response (200):
    [
        {
            "id": "recipe-uuid-1",
            "title": "Pasta Carbonara",
            ...
        },
        {
            "id": "recipe-uuid-2",
            "title": "Pasta Alfredo",
            ...
        }
    ]
    """
    recipes = search_recipes(
        db=db,
        user_id=current_user.id,
        query=q,
        limit=limit
    )
    
    return recipes


@router.get(
    "/{recipe_id}",
    response_model=RecipeResponse,
    summary="Get recipe by ID",
    description="Get a specific recipe"
)
def get_recipe_endpoint(
    recipe_id: UUID,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a specific recipe by ID.
    
    Security: Users can only access their own recipes.
    
    Args:
        recipe_id: Recipe UUID (from URL path)
        current_user: Authenticated user
        db: Database session
    
    Returns:
        RecipeResponse
        
    Raises:
        404 Not Found: Recipe doesn't exist or doesn't belong to user
        
    Example request:
    GET /api/v1/recipes/123e4567-e89b-12d3-a456-426614174000
    
    Example response (200):
    {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "title": "Pasta Carbonara",
        "ingredients": [...],
        "steps": [...],
        ...
    }
    """
    recipe = get_recipe_by_id(db, recipe_id, current_user.id)
    
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )
    
    return recipe


@router.put(
    "/{recipe_id}",
    response_model=RecipeResponse,
    summary="Update recipe",
    description="Update an existing recipe"
)
def update_recipe_endpoint(
    recipe_id: UUID,
    recipe_update: RecipeUpdate,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Update an existing recipe.
    
    Only updates fields that are provided.
    Fields not in the request body are left unchanged.
    
    Args:
        recipe_id: Recipe UUID
        recipe_update: RecipeUpdate schema with fields to update
        current_user: Authenticated user
        db: Database session
    
    Returns:
        Updated RecipeResponse
        
    Raises:
        404 Not Found: Recipe doesn't exist or doesn't belong to user
        
    Example request:
    PUT /api/v1/recipes/123e4567-e89b-12d3-a456-426614174000
    Body:
    {
        "title": "Updated Recipe Name",
        "prep_time": 20
    }
    
    Example response (200):
    {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "title": "Updated Recipe Name",
        "prep_time": 20,
        ...
        (other fields unchanged)
    }
    """
    # Convert Pydantic model to dict, exclude unset fields
    update_data = recipe_update.model_dump(exclude_unset=True)
    
    # Handle nutrition object (convert to dict if present)
    if "nutrition" in update_data and update_data["nutrition"]:
        update_data["nutrition"] = update_data["nutrition"].dict()
    
    # Update recipe
    updated_recipe = update_recipe(
        db=db,
        recipe_id=recipe_id,
        user_id=current_user.id,
        update_data=update_data
    )
    
    if not updated_recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )
    
    return updated_recipe


@router.delete(
    "/{recipe_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete recipe",
    description="Delete a recipe permanently"
)
def delete_recipe_endpoint(
    recipe_id: UUID,
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Delete a recipe permanently.
    
    This action cannot be undone!
    
    Args:
        recipe_id: Recipe UUID
        current_user: Authenticated user
        db: Database session
    
    Returns:
        204 No Content (no response body)
        
    Raises:
        404 Not Found: Recipe doesn't exist or doesn't belong to user
        
    Example request:
    DELETE /api/v1/recipes/123e4567-e89b-12d3-a456-426614174000
    
    Example response (204):
    (empty response body)
    """
    success = delete_recipe(db, recipe_id, current_user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )
    
    # 204 No Content returns no body
    return None


@router.get(
    "/stats/summary",
    summary="Get recipe statistics",
    description="Get summary statistics about user's recipes"
)
def get_recipe_stats(
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get statistics about user's recipes.
    
    Returns counts by category, cuisine, total recipes, etc.
    
    Args:
        current_user: Authenticated user
        db: Database session
    
    Returns:
        Statistics dict
        
    Example response (200):
    {
        "total_recipes": 25,
        "by_category": {
            "dinner": 10,
            "dessert": 5,
            "breakfast": 7,
            "lunch": 3
        },
        "by_cuisine": {
            "Italian": 8,
            "Mexican": 5,
            "Japanese": 4,
            "American": 8
        },
        "avg_prep_time": 15,
        "avg_cook_time": 25,
        "total_time_saved": 1000
    }
    """
    from sqlalchemy import func
    from app.models.recipe import Recipe
    
    # Total recipes
    total = db.query(func.count(Recipe.id)).filter(
        Recipe.user_id == current_user.id
    ).scalar()
    
    # Count by category
    by_category = db.query(
        Recipe.category,
        func.count(Recipe.id)
    ).filter(
        Recipe.user_id == current_user.id,
        Recipe.category.isnot(None)
    ).group_by(Recipe.category).all()
    
    # Count by cuisine
    by_cuisine = db.query(
        Recipe.cuisine,
        func.count(Recipe.id)
    ).filter(
        Recipe.user_id == current_user.id,
        Recipe.cuisine.isnot(None)
    ).group_by(Recipe.cuisine).all()
    
    # Average times
    avg_times = db.query(
        func.avg(Recipe.prep_time),
        func.avg(Recipe.cook_time)
    ).filter(
        Recipe.user_id == current_user.id
    ).first()
    
    return {
        "total_recipes": total,
        "by_category": {cat: count for cat, count in by_category},
        "by_cuisine": {cuisine: count for cuisine, count in by_cuisine},
        "avg_prep_time": round(avg_times[0], 1) if avg_times[0] else None,
        "avg_cook_time": round(avg_times[1], 1) if avg_times[1] else None,
    }
