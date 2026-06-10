import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

if TEST_DATABASE_URL:
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")


@pytest.fixture(scope="session")
def app_and_db():
    if not TEST_DATABASE_URL:
        pytest.skip("Set TEST_DATABASE_URL to run the API test suite.")

    from app.database import Base, get_db
    from app.main import app
    from app.models import inventory, recipe, user  # noqa: F401

    engine = create_engine(TEST_DATABASE_URL)
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    yield app, Base, engine, TestingSessionLocal, get_db

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture()
def client(app_and_db):
    app, Base, engine, TestingSessionLocal, get_db = app_and_db

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client: TestClient):
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "chef@example.com",
            "password": "supersecure123",
        },
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "chef@example.com",
            "password": "supersecure123",
        },
    )
    assert login_response.status_code == 200

    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
