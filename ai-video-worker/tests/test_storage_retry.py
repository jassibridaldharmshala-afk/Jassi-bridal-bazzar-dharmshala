import hashlib
from types import SimpleNamespace

import pytest
import requests
from botocore.exceptions import ClientError
from app.storage_client import StorageClient, StorageError


@pytest.fixture
def image(tmp_path):
    path = tmp_path / "candidate.jpg"
    from PIL import Image
    Image.new("RGB", (12, 18), "red").save(path, "JPEG", quality=98)
    return path


@pytest.fixture
def cloud(monkeypatch):
    for key, value in dict(CLOUDINARY_CLOUD_NAME="test", CLOUDINARY_API_KEY="test-key", CLOUDINARY_API_SECRET="test-secret", CLOUDINARY_FOLDER="test-folder").items():
        monkeypatch.setenv(key, value)
    client = StorageClient.__new__(StorageClient)
    client.provider = "cloudinary"
    stored, calls = {}, []

    def get(url, **kwargs):
        from urllib.parse import unquote
        key = unquote(url.split("/upload/", 1)[1])
        payload = stored.get(key)
        return SimpleNamespace(ok=bool(payload), status_code=200 if payload else 404, json=lambda: payload)

    def post(url, data, **kwargs):
        calls.append(data.copy())
        signed = "&".join(f"{name}={data[name]}" for name in sorted(data) if name not in ("api_key", "signature"))
        assert data["signature"] == hashlib.sha1((signed + "test-secret").encode()).hexdigest()
        assert data["overwrite"] == "false"
        key = data["folder"] + "/" + data["public_id"]
        payload = dict(public_id=key, secure_url="https://example.invalid/" + key + ".jpg")
        stored[key] = payload
        return SimpleNamespace(ok=True, json=lambda: payload)

    monkeypatch.setattr(requests, "get", get)
    monkeypatch.setattr(requests, "post", post)
    return client, stored, calls, post


def test_cloudinary_retry_reuses_frame_and_isolates_jobs_and_changed_content(cloud, image):
    client, stored, calls, _ = cloud
    first = client.upload_candidate(image, "job-one", 1, 2.5)
    assert client.upload_candidate(image, "job-one", 2, 2.5) == first
    other = client.upload_candidate(image, "job-two", 1, 2.5)
    assert other["storageKey"] != first["storageKey"]
    from PIL import Image
    Image.new("RGB", (12, 18), "blue").save(image, "JPEG", quality=98)
    changed = client.upload_candidate(image, "job-one", 1, 2.5)
    assert changed["storageKey"] != first["storageKey"]
    assert len(calls) == len(stored) == 3 * (1 + len(first['variants']))


def test_cloudinary_committed_upload_with_lost_response_does_not_send_bytes_again(cloud, image, monkeypatch):
    client, stored, calls, post = cloud

    def interrupted(*args, **kwargs):
        response = post(*args, **kwargs)
        if len(calls) == 1:
            raise requests.Timeout("synthetic lost response")
        return response

    monkeypatch.setattr(requests, "post", interrupted)
    with pytest.raises(requests.Timeout):
        client.upload_candidate(image, "job-one", 1, 2.5)
    recovered = client.upload_candidate(image, "job-one", 1, 2.5)
    assert recovered["storageKey"] in stored
    assert len(calls) == 1 + len(recovered['variants'])


def test_cloudinary_lookup_failure_does_not_upload_or_overwrite(cloud, image, monkeypatch):
    client, _, calls, _ = cloud
    monkeypatch.setattr(requests, "get", lambda *a, **k: SimpleNamespace(ok=False, status_code=403))
    with pytest.raises(StorageError):
        client.upload_candidate(image, "job-one", 1, 2.5)
    assert calls == []


def test_r2_ambiguous_commit_is_recovered_by_head_and_different_jobs_do_not_share_keys(image, monkeypatch):
    monkeypatch.setenv("R2_BUCKET_NAME", "test-bucket")
    monkeypatch.setenv("R2_PUBLIC_URL", "https://example.invalid")
    client = StorageClient.__new__(StorageClient)
    client.provider = "r2"
    stored, writes = set(), []

    def head(Bucket, Key):
        if Key not in stored:
            raise ClientError({"Error": {"Code": "404"}}, "HeadObject")

    def upload(path, bucket, key, **kwargs):
        stored.add(key)
        writes.append(key)
        if len(writes) == 1:
            raise RuntimeError("synthetic lost response")

    client.s3 = SimpleNamespace(head_object=head, upload_file=upload)
    with pytest.raises(StorageError):
        client.upload_candidate(image, "job-one", 1, 2.5)
    first = client.upload_candidate(image, "job-one", 1, 2.5)
    assert len(writes) == 1 + len(first['variants'])
    second = client.upload_candidate(image, "job-two", 1, 2.5)
    assert first["storageKey"] != second["storageKey"]
    assert len(writes) == 2 * (1 + len(first['variants']))


def test_r2_permission_failure_is_not_treated_as_a_missing_file(image, monkeypatch):
    monkeypatch.setenv("R2_BUCKET_NAME", "test-bucket")
    client = StorageClient.__new__(StorageClient)
    client.provider = "r2"

    def forbidden(**kwargs):
        raise ClientError({"Error": {"Code": "403"}}, "HeadObject")

    writes = []
    client.s3 = SimpleNamespace(head_object=forbidden, upload_file=lambda *a, **k: writes.append(a))
    with pytest.raises(StorageError):
        client.upload_candidate(image, "job-one", 1, 2.5)
    assert writes == []

def test_display_versions_are_lossless_resizes_and_master_bytes_survive(tmp_path, monkeypatch):
    from PIL import Image
    from io import BytesIO
    monkeypatch.setenv("R2_BUCKET_NAME", "test-bucket")
    monkeypatch.setenv("R2_PUBLIC_URL", "https://example.invalid")
    path = tmp_path / "detailed.jpg"
    Image.new("RGB", (2048, 128), "red").save(path, "JPEG", quality=98)
    native = path.read_bytes()
    stored = {}
    client = StorageClient.__new__(StorageClient)
    client.provider = "r2"
    def head(Bucket, Key):
        if Key not in stored:
            raise ClientError({"Error": {"Code": "404"}}, "HeadObject")
    def upload(filename, bucket, key, **kwargs):
        from pathlib import Path
        stored[key] = Path(filename).read_bytes()
    client.s3 = SimpleNamespace(head_object=head, upload_file=upload)
    result = client.upload_candidate(path, "quality-job", 1, 1.0)
    assert stored[result["storageKey"]] == native == path.read_bytes()
    assert [row["width"] for row in result["variants"]] == [320, 640, 1200, 2000]
    with Image.open(path) as master:
        for row in result["variants"]:
            with Image.open(BytesIO(stored[row["publicId"]])) as display:
                expected = master.resize((row["width"], row["height"]), Image.Resampling.LANCZOS)
                assert display.tobytes() == expected.tobytes()
    count = len(stored)
    assert client.upload_candidate(path, "quality-job", 1, 1.0) == result
    assert len(stored) == count
