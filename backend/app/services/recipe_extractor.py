import anthropic
import instaloader
from app.config import settings
from typing import Dict
import json


PROMPT_TEMPLATE = """
You are a recipe extraction assistant. Extract recipe information from this text.

Recipe Text:
{source_text}

Extract the following information and return ONLY a JSON object with this exact structure:
{{
    "title": "Recipe name",
    "description": "Brief description",
    "ingredients": [
        {{"name": "ingredient name", "quantity": "amount", "unit": "measurement unit"}}
    ],
    "steps": ["Step 1 instruction", "Step 2 instruction"],
    "prep_time": <number in minutes or null>,
    "cook_time": <number in minutes or null>,
    "servings": <number or null>,
    "category": "breakfast/lunch/dinner/snack/dessert or null",
    "cuisine": "cuisine type or null",
    "nutrition": {{
        "calories": <number per serving or null>,
        "protein": <grams or null>,
        "carbs": <grams or null>,
        "fat": <grams or null>
    }}
}}

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- If information is not available, use null
- Ingredient quantities should be strings (e.g., "2", "1.5", "1/2")
- Steps should be clear, actionable instructions
- Times should be in minutes

Return the JSON now:
"""


def _build_prompt(source_text: str) -> str:
    return PROMPT_TEMPLATE.format(source_text=source_text)


def _get_anthropic_client() -> anthropic.Anthropic:
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY is not configured")
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def _parse_extracted_response(response_text: str) -> Dict:
    cleaned = response_text.strip()

    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]

    cleaned = cleaned.strip()

    try:
        recipe_data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"AI extraction failed: Invalid JSON response - {str(exc)}") from exc

    return validate_extracted_recipe(recipe_data)


def _extract_recipe_from_source(source_text: str) -> Dict:
    client = _get_anthropic_client()

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        temperature=0.3,
        messages=[
            {"role": "user", "content": _build_prompt(source_text)}
        ]
    )

    return _parse_extracted_response(message.content[0].text)


async def extract_recipe_from_instagram(instagram_url: str) -> Dict:
    """
    Extract recipe information from Instagram post using Claude AI.
    
    This is the "magic" function that:
    1. Takes an Instagram URL
    2. Fetches the post content (caption, images)
    3. Uses Claude AI to extract structured recipe data
    4. Returns recipe as a Python dict
    
    Process:
    1. Fetch Instagram post content (caption)
    2. Send caption to Claude with structured prompt
    3. Claude extracts: title, ingredients, steps, timing, etc.
    4. Parse Claude's JSON response
    5. Return as dict ready for database
    
    Args:
        instagram_url: URL to Instagram post
        Example: "https://www.instagram.com/p/ABC123/"
        
    Returns:
        Dict with recipe data:
        {
            "title": "Recipe Name",
            "description": "Description",
            "ingredients": [
                {"name": "flour", "quantity": "2", "unit": "cups"}
            ],
            "steps": ["Step 1", "Step 2"],
            "prep_time": 15,
            "cook_time": 30,
            "servings": 4,
            "category": "dinner",
            "cuisine": "Italian",
            "nutrition": {
                "calories": 450,
                "protein": 25
            }
        }
        
    Raises:
        Exception: If Instagram fetch fails or AI extraction fails
        
    Note: This is a simplified version!
    Real implementation needs:
    - Instagram API or web scraping to get post content
    - Error handling for rate limits
    - Caching to avoid re-processing same posts
    - Image analysis (Claude can analyze recipe images!)
    """
    
    # Step 1: Fetch Instagram post content
    # For now, this is a placeholder
    # Real implementation options:
    # 1. Instagram Basic Display API (requires auth)
    # 2. instaloader library (web scraping)
    # 3. Apify or similar scraping service
    

    post_content = await fetch_instagram_post_content(instagram_url)
    
    recipe_data = _extract_recipe_from_source(post_content)
    recipe_data["source_url"] = instagram_url
    return recipe_data


async def fetch_instagram_post_content(url: str) -> str:
    """
    Fetch Instagram post content (caption, text).
    
    This is a PLACEHOLDER function.
    
    Real implementation options:
    
    Option 1: Instagram Basic Display API (official, requires auth)
    - Need to register app with Meta
    - Users need to authorize your app
    - Limited to user's own posts
    - Most reliable but complex setup
    
    Option 2: instaloader library (web scraping)
```python
    import instaloader
    L = instaloader.Instaloader()
    shortcode = url.split("/p/")[1].rstrip("/")
    post = instaloader.Post.from_shortcode(L.context, shortcode)
    return post.caption
```
    - Easy to use
    - No API key needed
    - Might break if Instagram changes their HTML
    - May hit rate limits
    
    Option 3: Paid scraping service (Apify, ScraperAPI)
    - Most reliable
    - Handles rate limits, proxies
    - Costs money
    
    Option 4: Manual paste (simplest for MVP!)
    - User copies Instagram caption
    - Pastes into text field
    - No scraping needed
    - Best for testing
    
    For now, we'll return a placeholder.
    In production, implement one of the above options.
    
    Args:
        url: Instagram post URL
        
    Returns:
        Post content (caption text)
        
    Raises:
        Exception: If fetch fails
    """
    # TODO: Implement actual Instagram fetching
    # For now, return error message
    shortcode = url.split("/p/")[1].rstrip("/")
    L = instaloader.Instaloader()
    post = instaloader.Post.from_shortcode(L.context, shortcode)
    return post.caption

    raise NotImplementedError(
        "Instagram fetching not implemented yet. "
        "Please use the manual recipe creation endpoint instead. "
        "See app/services/recipe_extractor.py for implementation options."
    )
    
    # Example return for testing (uncomment to test AI extraction):
    # return """
    # PASTA CARBONARA 🍝
    # 
    # Ingredients:
    # - 400g spaghetti
    # - 4 eggs
    # - 200g bacon
    # - 100g parmesan cheese
    # - Salt and pepper
    # 
    # Instructions:
    # 1. Boil pasta in salted water until al dente
    # 2. Fry bacon until crispy
    # 3. Beat eggs with grated parmesan
    # 4. Drain pasta, mix with bacon
    # 5. Remove from heat, add egg mixture
    # 6. Toss quickly to create creamy sauce
    # 
    # Prep: 10 min | Cook: 15 min | Serves: 4
    # """


def validate_extracted_recipe(recipe_data: Dict) -> Dict:
    """
    Validate and clean extracted recipe data.
    
    Sometimes AI extraction isn't perfect. This function:
    - Checks required fields exist
    - Validates data types
    - Cleans up formatting
    - Sets defaults for missing fields
    
    Args:
        recipe_data: Raw extracted recipe dict
        
    Returns:
        Validated and cleaned recipe dict
        
    Raises:
        ValueError: If required fields are missing or invalid
        
    Example:
        raw_data = {
            "title": "Pasta",
            "ingredients": [{"name": "pasta", "quantity": "400", "unit": "g"}],
            "steps": ["Cook pasta"],
            "prep_time": "10",  # Wrong type (string instead of int)
        }
        
        clean_data = validate_extracted_recipe(raw_data)
        # prep_time is now None (invalid string converted)
    """
    # Required fields
    if not recipe_data.get("title"):
        raise ValueError("Recipe must have a title")
    
    if not recipe_data.get("ingredients") or len(recipe_data["ingredients"]) == 0:
        raise ValueError("Recipe must have at least one ingredient")
    
    if not recipe_data.get("steps") or len(recipe_data["steps"]) == 0:
        raise ValueError("Recipe must have at least one step")
    
    # Validate ingredients structure
    for i, ingredient in enumerate(recipe_data["ingredients"]):
        if not isinstance(ingredient, dict):
            raise ValueError(f"Ingredient {i+1} must be a dict")
        if "name" not in ingredient:
            raise ValueError(f"Ingredient {i+1} missing 'name' field")
        
        # Ensure quantity and unit exist (can be empty string)
        if "quantity" not in ingredient:
            ingredient["quantity"] = ""
        if "unit" not in ingredient:
            ingredient["unit"] = ""
    
    # Validate steps are strings
    for i, step in enumerate(recipe_data["steps"]):
        if not isinstance(step, str):
            raise ValueError(f"Step {i+1} must be a string")
    
    # Validate numeric fields (convert or set to None if invalid)
    for field in ["prep_time", "cook_time", "servings"]:
        if recipe_data.get(field) is not None:
            try:
                # Try to convert to int
                value = int(recipe_data[field])
                if value < 0:
                    recipe_data[field] = None
                else:
                    recipe_data[field] = value
            except (ValueError, TypeError):
                recipe_data[field] = None
    
    # Clean up nutrition if present
    if recipe_data.get("nutrition"):
        nutrition = recipe_data["nutrition"]
        for field in ["calories", "protein", "carbs", "fat", "fiber", "sugar"]:
            if nutrition.get(field) is not None:
                try:
                    # Try to convert to number
                    value = float(nutrition[field])
                    if value < 0:
                        nutrition[field] = None
                    else:
                        nutrition[field] = value
                except (ValueError, TypeError):
                    nutrition[field] = None
    
    return recipe_data


async def extract_recipe_from_text(recipe_text: str) -> Dict:
    """
    Extract recipe from plain text (not Instagram URL).
    
    This is an alternative to Instagram extraction.
    User can paste recipe text directly.
    
    Useful for:
    - Testing AI extraction without Instagram
    - Extracting from other sources (websites, books, notes)
    - When Instagram API is not available
    
    Args:
        recipe_text: Plain text containing recipe
        
    Returns:
        Dict with extracted recipe data
        
    Example:
        text = '''
        Chocolate Chip Cookies
        
        Ingredients:
        - 2 cups flour
        - 1 cup butter
        - 1 cup sugar
        - 2 eggs
        - 1 tsp vanilla
        - 2 cups chocolate chips
        
        Instructions:
        1. Cream butter and sugar
        2. Add eggs and vanilla
        3. Mix in flour
        4. Fold in chocolate chips
        5. Bake at 350°F for 12 minutes
        
        Makes 24 cookies
        '''
        
        recipe = await extract_recipe_from_text(text)
    """
    return _extract_recipe_from_source(recipe_text)
