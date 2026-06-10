def test_create_recipe(client, auth_headers):
    response = client.post(
        "/api/v1/recipes/",
        headers=auth_headers,
        json={
            "title": "Simple Pasta",
            "description": "Weeknight dinner",
            "ingredients": [
                {"name": "spaghetti", "quantity": "400", "unit": "g"},
                {"name": "olive oil", "quantity": "2", "unit": "tbsp"},
            ],
            "steps": [
                "Boil the pasta.",
                "Toss with olive oil.",
            ],
            "prep_time": 5,
            "cook_time": 12,
            "servings": 2,
            "category": "dinner",
            "cuisine": "Italian",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Simple Pasta"
    assert body["total_time"] == 17
    assert body["user_id"]


def test_extract_text_recipe(client, auth_headers, monkeypatch):
    async def fake_extract_recipe_from_text(recipe_text: str):
        assert "banana bread" in recipe_text.lower()
        return {
            "title": "Banana Bread",
            "description": "Moist quick bread",
            "ingredients": [
                {"name": "bananas", "quantity": "3", "unit": "whole"},
                {"name": "flour", "quantity": "2", "unit": "cups"},
            ],
            "steps": [
                "Mash the bananas.",
                "Mix everything and bake.",
            ],
            "prep_time": 10,
            "cook_time": 55,
            "servings": 8,
            "category": "dessert",
            "cuisine": "American",
            "nutrition": None,
            "source_url": None,
        }

    monkeypatch.setattr(
        "app.api.v1.recipes.extract_recipe_from_text",
        fake_extract_recipe_from_text,
    )

    response = client.post(
        "/api/v1/recipes/extract-text",
        headers=auth_headers,
        json={
            "recipe_text": (
                "Banana bread\nIngredients: 3 bananas, 2 cups flour\n"
                "Instructions: Mash, mix, bake."
            )
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Banana Bread"
    assert len(body["ingredients"]) == 2
    assert body["category"] == "dessert"
