"""Optional, CPU-only background provider. Originals and storage are owned by the API."""
import io
import threading

from PIL import Image, ImageOps, UnidentifiedImageError

_lock = threading.Lock()
_session = None


def remove_background(data: bytes) -> bytes:
    if not data or len(data) > 20 * 1024 * 1024:
        raise ValueError("Choose an image under 20 MB.")
    # Bound decoding as well as inference; never block the async HTTP event loop.
    if not _lock.acquire(blocking=False):
        raise RuntimeError("Background processor busy. Please retry.")
    try:
        try:
            with Image.open(io.BytesIO(data)) as source:
                if source.format not in {"JPEG", "PNG", "WEBP"} or source.width * source.height > 25_000_000:
                    raise ValueError("Unsupported image or excessive dimensions.")
                source.load()
                image = ImageOps.exif_transpose(source).convert("RGBA")
        except (UnidentifiedImageError, Image.DecompressionBombError) as error:
            raise ValueError("Invalid image.") from error
        from rembg import new_session, remove
        global _session
        if _session is None:
            _session = new_session("u2netp", providers=["CPUExecutionProvider"])
        result = remove(image, session=_session)
        if not result.getchannel("A").getbbox():
            raise ValueError("No foreground found. Keep the original or try another photo.")
        output = io.BytesIO()
        result.save(output, format="PNG", compress_level=9)
        if output.tell() > 20 * 1024 * 1024:
            raise ValueError("The edited photo exceeds 20 MB. Keep the original or edit a closer view.")
        return output.getvalue()
    finally:
        _lock.release()


if __name__ == "__main__":
    import sys
    # The API may run the same provider locally without starting another server.
    sys.stdout.buffer.write(remove_background(sys.stdin.buffer.read(20 * 1024 * 1024 + 1)))
