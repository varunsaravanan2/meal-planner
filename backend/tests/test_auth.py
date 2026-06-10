def test_register_login_and_get_current_user(client):
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@example.com",
            "password": "supersecure123",
        },
    )

    assert register_response.status_code == 201
    register_body = register_response.json()
    assert register_body["email"] == "test@example.com"
    assert "id" in register_body

    login_response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "test@example.com",
            "password": "supersecure123",
        },
    )

    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert me_response.status_code == 200
    assert me_response.json()["email"] == "test@example.com"


def test_login_rejects_bad_password(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@example.com",
            "password": "supersecure123",
        },
    )

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "test@example.com",
            "password": "wrong-password",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"
