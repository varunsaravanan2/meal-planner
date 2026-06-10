from sqlalchemy.orm import Session
from app.models.recipe import Recipe
from uuid import UUID
from typing import Optional, List


def get_recipe_by_id(db: Session, recipe_id: UUID, user_id: UUID) -> Optional[Recipe]:
    """
    Get a recipe by ID (only if it belongs to the user).
    
    Security: Users can only access their own recipes.
    
    Args:
        db: Database session
        recipe_id: Recipe UUID
        user_id: User UUID (for authorization)
        
    Returns:
        Recipe object if found and belongs to user, None otherwise
        
    Example:
        recipe = get_recipe_by_id(db, recipe_id, current_user.id)
        if recipe:
            print(f"Found: {recipe.title}")
        else:
            print("Recipe not found or access denied")
    """
    return db.query(Recipe).filter(
        Recipe.id == recipe_id,
        Recipe.user_id == user_id  # ← Security: only user's own recipes
    ).first()


def get_user_recipes(
    db: Session,
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    cuisine: Optional[str] = None
) -> List[Recipe]:
    """
    Get all recipes for a user with optional filtering and pagination.
    
    Filtering:
    - By category (e.g., "dinner", "dessert")
    - By cuisine (e.g., "Italian", "Mexican")
    
    Pagination:
    - skip: How many to skip (for page navigation)
    - limit: Max results to return
    
    Args:
        db: Database session
        user_id: User UUID
        skip: Number of recipes to skip (default 0)
        limit: Max recipes to return (default 100)
        category: Filter by category (optional)
        cuisine: Filter by cuisine (optional)
        
    Returns:
        List of Recipe objects
        
    Example:
        # Get first 10 recipes
        recipes = get_user_recipes(db, user.id, skip=0, limit=10)
        
        # Get next 10 recipes (page 2)
        recipes = get_user_recipes(db, user.id, skip=10, limit=10)
        
        # Get only dinner recipes
        recipes = get_user_recipes(db, user.id, category="dinner")
        
        # Get Italian recipes
        recipes = get_user_recipes(db, user.id, cuisine="Italian")
    """
    # Start with base query
    query = db.query(Recipe).filter(Recipe.user_id == user_id)
    
    # Add filters if provided
    if category:
        query = query.filter(Recipe.category == category)
    
    if cuisine:
        query = query.filter(Recipe.cuisine == cuisine)
    
    # Apply pagination and execute
    return query.offset(skip).limit(limit).all()


def count_user_recipes(
    db: Session,
    user_id: UUID,
    category: Optional[str] = None,
    cuisine: Optional[str] = None
) -> int:
    """
    Count total recipes for pagination.
    
    Args:
        db: Database session
        user_id: User UUID
        category: Filter by category (optional)
        cuisine: Filter by cuisine (optional)
        
    Returns:
        Total count of recipes matching filters
        
    Example:
        total = count_user_recipes(db, user.id)
        pages = (total + page_size - 1) // page_size  # Calculate total pages
    """
    query = db.query(Recipe).filter(Recipe.user_id == user_id)
    
    if category:
        query = query.filter(Recipe.category == category)
    
    if cuisine:
        query = query.filter(Recipe.cuisine == cuisine)
    
    return query.count()


def create_recipe(
    db: Session,
    user_id: UUID,
    title: str,
    ingredients: List[dict],
    steps: List[str],
    description: Optional[str] = None,
    prep_time: Optional[int] = None,
    cook_time: Optional[int] = None,
    servings: Optional[int] = None,
    nutrition: Optional[dict] = None,
    category: Optional[str] = None,
    cuisine: Optional[str] = None,
    image_url: Optional[str] = None,
    source_url: Optional[str] = None
) -> Recipe:
    """
    Create a new recipe.
    
    Args:
        db: Database session
        user_id: User UUID (owner of recipe)
        title: Recipe title
        ingredients: List of ingredient dicts
        steps: List of step strings
        description: Recipe description (optional)
        prep_time: Prep time in minutes (optional)
        cook_time: Cook time in minutes (optional)
        servings: Number of servings (optional)
        nutrition: Nutrition info dict (optional)
        category: Category (optional)
        cuisine: Cuisine type (optional)
        image_url: URL to image (optional)
        source_url: Original URL (optional)
        
    Returns:
        Created Recipe object
        
    Example:
        recipe = create_recipe(
            db=db,
            user_id=current_user.id,
            title="Pasta Carbonara",
            ingredients=[
                {"name": "spaghetti", "quantity": "400", "unit": "g"}
            ],
            steps=["Boil pasta", "Mix with sauce"],
            prep_time=10,
            cook_time=15
        )
    """
    db_recipe = Recipe(
        user_id=user_id,
        title=title,
        description=description,
        ingredients=ingredients,  # Stored as JSON
        steps=steps,              # Stored as JSON
        prep_time=prep_time,
        cook_time=cook_time,
        servings=servings,
        nutrition=nutrition,      # Stored as JSON
        category=category,
        cuisine=cuisine,
        image_url=image_url,
        source_url=source_url
    )
    
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)
    
    return db_recipe


def update_recipe(
    db: Session,
    recipe_id: UUID,
    user_id: UUID,
    update_data: dict
) -> Optional[Recipe]:
    """
    Update a recipe.
    
    Only updates fields that are provided in update_data.
    
    Args:
        db: Database session
        recipe_id: Recipe UUID
        user_id: User UUID (for authorization)
        update_data: Dict of fields to update
        
    Returns:
        Updated Recipe object if found, None otherwise
        
    Example:
        recipe = update_recipe(
            db=db,
            recipe_id=recipe_id,
            user_id=current_user.id,
            update_data={
                "title": "Updated Title",
                "prep_time": 20
            }
        )
    """
    # Get recipe (with security check)
    recipe = get_recipe_by_id(db, recipe_id, user_id)
    
    if not recipe:
        return None
    
    # Update only provided fields
    for key, value in update_data.items():
        if value is not None and hasattr(recipe, key):
            setattr(recipe, key, value)
    
    db.commit()
    db.refresh(recipe)
    
    return recipe


def delete_recipe(db: Session, recipe_id: UUID, user_id: UUID) -> bool:
    """
    Delete a recipe.
    
    Args:
        db: Database session
        recipe_id: Recipe UUID
        user_id: User UUID (for authorization)
        
    Returns:
        True if deleted, False if not found
        
    Example:
        success = delete_recipe(db, recipe_id, current_user.id)
        if success:
            print("Recipe deleted")
    """
    recipe = get_recipe_by_id(db, recipe_id, user_id)
    
    if not recipe:
        return False
    
    db.delete(recipe)
    db.commit()
    
    return True


def search_recipes(
    db: Session,
    user_id: UUID,
    query: str,
    skip: int = 0,
    limit: int = 100
) -> List[Recipe]:
    """
    Search recipes by title or ingredients.
    
    Uses ILIKE for case-insensitive search (PostgreSQL).
    
    Args:
        db: Database session
        user_id: User UUID
        query: Search term
        skip: Pagination skip
        limit: Pagination limit
        
    Returns:
        List of matching Recipe objects
        
    Example:
        # Search for recipes with "pasta" in title
        recipes = search_recipes(db, user.id, "pasta")
        
        # Search for recipes with "chicken"
        recipes = search_recipes(db, user.id, "chicken")
    """
    # ILIKE = case-insensitive LIKE
    # %query% = matches anywhere in the string
    search_pattern = f"%{query}%"
    
    return db.query(Recipe).filter(
        Recipe.user_id == user_id,
        # Search in title OR description
        (Recipe.title.ilike(search_pattern)) |
        (Recipe.description.ilike(search_pattern))
        # Note: Can't easily search in JSON ingredients with SQLAlchemy
        # For that, you'd need PostgreSQL full-text search
    ).offset(skip).limit(limit).all()