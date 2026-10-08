import hashlib
import os
from pathlib import Path
import time

import boto3
import requests
from botocore.exceptions import ClientError


class StorageError(RuntimeError):
    code = "STORAGE_FAILURE"


class StorageClient:
    def __init__(self):
        self.provider = self._configured_provider()
        self.s3 = None
        if self.provider == "r2":
            self.s3 = boto3.client(
                "s3",
                region_name="auto",
                endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
                aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            )

    @staticmethod
    def _configured_provider() -> str:
        r2 = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"]
        if all(os.getenv(name) for name in r2):
            return "r2"
        cloudinary = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]
        if all(os.getenv(name) for name in cloudinary):
            return "cloudinary"
        raise StorageError("R2 or Cloudinary storage is not configured for the processor.")

    def download(self, source: dict, destination: Path) -> Path:
        try:
            if source["provider"] == "r2":
                if not self.s3:
                    raise StorageError("The processor cannot access the configured R2 bucket.")
                self.s3.download_file(os.environ["R2_BUCKET_NAME"], source["storageKey"], str(destination))
            else:
                response = requests.get(source.get("url", ""), stream=True, timeout=120)
                response.raise_for_status()
                with destination.open("xb") as output:
                    for chunk in response.iter_content(1024 * 1024):
                        if chunk:
                            output.write(chunk)
        except StorageError:
            raise
        except Exception as exc:
            raise StorageError("The stored reel could not be downloaded.") from exc
        return destination

    def _upload_candidate_master(self, image_path: Path, job_id: str, group_number: int, timestamp: float, extension="jpg", content_type="image/jpeg") -> dict:
        # Job isolation plus a content version: retries reuse an immutable frame,
        # while a different job or genuinely changed frame cannot overwrite it.
        digest = hashlib.sha256()
        with image_path.open("rb") as image:
            for chunk in iter(lambda: image.read(1024 * 1024), b""):
                digest.update(chunk)
        identity = hashlib.sha256(f"{job_id}:{int(timestamp * 1000)}:{digest.hexdigest()}".encode()).hexdigest()
        key = f"reel-imports/candidates/retry-{identity}.{extension}"
        if self.provider == "r2":
            try:
                exists = False
                try:
                    self.s3.head_object(Bucket=os.environ["R2_BUCKET_NAME"], Key=key)
                    exists = True
                except ClientError as exc:
                    if str(exc.response.get("Error", {}).get("Code", "")) not in ("404", "NotFound", "NoSuchKey"):
                        raise
                if not exists:
                    self.s3.upload_file(
                        str(image_path),
                        os.environ["R2_BUCKET_NAME"],
                        key,
                        ExtraArgs={"ContentType": content_type, "CacheControl": "private, max-age=86400"},
                    )
            except Exception as exc:
                raise StorageError("A candidate frame could not be uploaded to R2.") from exc
            return {
                "provider": "r2",
                "storageKey": key,
                "url": f"{os.environ['R2_PUBLIC_URL'].rstrip('/')}/{key}",
            }
        return self._upload_cloudinary(image_path, key)

    def upload_candidate(self, image_path: Path, job_id: str, group_number: int, timestamp: float) -> dict:
        from PIL import Image, ImageOps
        import tempfile
        master = self._upload_candidate_master(image_path, job_id, group_number, timestamp)
        variants = []
        with Image.open(image_path) as source:
            image = ImageOps.exif_transpose(source)
            image.load()
            widths = sorted({min(image.width, width) for width in (320, 640, 1200, 2000)})
            with tempfile.TemporaryDirectory(prefix="display-versions-") as directory:
                for width in widths:
                    height = max(1, round(image.height * width / image.width))
                    display = image.resize((width, height), Image.Resampling.LANCZOS)
                    target = Path(directory) / f"{width}.webp"
                    display.save(target, "WEBP", lossless=True, method=4)
                    stored = self._upload_candidate_master(target, job_id, group_number, timestamp, "webp", "image/webp")
                    variants.append({**stored, "publicId": stored["storageKey"], "width": width, "height": height, "mimeType": "image/webp", "sizeBytes": target.stat().st_size})
        return {**master, "variants": variants}

    def _upload_cloudinary(self, image_path: Path, key: str) -> dict:
        timestamp = int(time.time())
        folder = f"{os.getenv('CLOUDINARY_FOLDER', 'samira-products')}/reel-imports/candidates"
        public_id = key.rsplit("/", 1)[-1].rsplit(".", 1)[0]
        resource_id = f"{folder}/{public_id}"
        from urllib.parse import quote
        existing = requests.get(
            f"https://api.cloudinary.com/v1_1/{os.environ['CLOUDINARY_CLOUD_NAME']}/resources/image/upload/{quote(resource_id, safe='')}",
            auth=(os.environ["CLOUDINARY_API_KEY"], os.environ["CLOUDINARY_API_SECRET"]), timeout=30,
        )
        if existing.ok:
            payload = existing.json()
            if not payload.get("public_id") or not payload.get("secure_url"):
                raise StorageError("Cloudinary did not return the stored candidate frame.")
            return {"provider": "cloudinary", "storageKey": payload["public_id"], "url": payload["secure_url"]}
        if existing.status_code != 404:
            raise StorageError("The previous Cloudinary candidate upload could not be checked.")
        parameters = {"folder": folder, "public_id": public_id, "timestamp": timestamp, "overwrite": "false"}
        signature_text = "&".join(f"{name}={parameters[name]}" for name in sorted(parameters)) + os.environ["CLOUDINARY_API_SECRET"]
        signature = hashlib.sha1(signature_text.encode("utf-8")).hexdigest()
        with image_path.open("rb") as image:
            response = requests.post(
                f"https://api.cloudinary.com/v1_1/{os.environ['CLOUDINARY_CLOUD_NAME']}/image/upload",
                data={
                    "api_key": os.environ["CLOUDINARY_API_KEY"],
                    **parameters,
                    "signature": signature,
                },
                files={"file": (image_path.name, image, "image/webp" if image_path.suffix == ".webp" else "image/jpeg")},
                timeout=120,
            )
        if not response.ok:
            raise StorageError("A candidate frame could not be uploaded to Cloudinary.")
        payload = response.json()
        if not payload.get("public_id") or not payload.get("secure_url"):
            raise StorageError("Cloudinary did not return the uploaded candidate frame.")
        return {"provider": "cloudinary", "storageKey": payload["public_id"], "url": payload["secure_url"]}
