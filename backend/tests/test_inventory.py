def test_add_inventory_item(client, auth_headers):
    response = client.post(
        "/api/v1/inventory/",
        headers=auth_headers,
        json={
            "item_name": "Milk",
            "quantity": 1,
            "unit": "carton",
            "category": "dairy",
            "location": "fridge",
            "min_quantity": 2,
            "is_staple": True,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["item_name"] == "Milk"
    assert body["is_low_stock"] is True
    assert body["location"] == "fridge"


def test_filter_inventory_by_category(client, auth_headers):
    client.post(
        "/api/v1/inventory/",
        headers=auth_headers,
        json={
            "item_name": "Milk",
            "quantity": 1,
            "unit": "carton",
            "category": "dairy",
            "location": "fridge",
        },
    )
    client.post(
        "/api/v1/inventory/",
        headers=auth_headers,
        json={
            "item_name": "Rice",
            "quantity": 2,
            "unit": "kg",
            "category": "grains",
            "location": "pantry",
        },
    )

    response = client.get(
        "/api/v1/inventory/?category=dairy",
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["item_name"] == "Milk"
