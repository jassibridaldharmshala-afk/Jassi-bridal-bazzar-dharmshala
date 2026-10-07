import io
import sys
from types import SimpleNamespace

import pytest
from PIL import Image
from app import image_background as background


def png(width=10, height=20):
    stream = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(stream, "PNG")
    return stream.getvalue()


def test_invalid_bytes_and_limits():
    for data in (b"", b"not-an-image", b"x" * (3 * 1024 * 1024 + 1)):
        with pytest.raises(ValueError):
            background.remove_background(data)
    with pytest.raises(ValueError):
        background.remove_background(png(5001, 5001))


def test_busy_worker_does_not_start_more_inference():
    background._lock.acquire()
    try:
        with pytest.raises(RuntimeError, match="busy"):
            background.remove_background(png())
    finally:
        background._lock.release()


def test_provider_keeps_input_and_returns_alpha_png(monkeypatch):
    calls = []
    def remove(image, session):
        image.putpixel((0, 0), (0, 0, 0, 0))
        return image
    monkeypatch.setitem(sys.modules, "rembg", SimpleNamespace(new_session=lambda *a, **k: calls.append(k) or object(), remove=remove))
    monkeypatch.setattr(background, "_session", None)
    source = png()
    result = Image.open(io.BytesIO(background.remove_background(source)))
    assert result.format == "PNG" and result.mode == "RGBA"
    assert result.getpixel((0, 0))[3] == 0
    assert Image.open(io.BytesIO(source)).mode == "RGB"
    background.remove_background(source)
    assert len(calls) == 1
    assert calls[0]["providers"] == ["CPUExecutionProvider"]
