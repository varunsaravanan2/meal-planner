import boto3
import uuid
from app.config import settings

def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )

def upload_photo(file_bytes: bytes, filename: str, user_id: str) -> tuple[str, str]:
    ext = filename.rsplit(".", 1)[-1]   # get extension: jpg, png, etc.
    s3_key = f"progress/{user_id}/{uuid.uuid4()}.{ext}"
    
    client = get_s3_client()
    client.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=s3_key,
        Body=file_bytes,
        ContentType=f"image/{ext}",
    )
    
    url = f"{settings.R2_PUBLIC_URL}/{s3_key}"
    return s3_key, url

def delete_photo(s3_key: str) -> None:
    client = get_s3_client()
    client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=s3_key)
