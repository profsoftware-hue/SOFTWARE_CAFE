from __future__ import annotations

from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError


MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024  # 2MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png"}
MAX_DIMENSION = 1200


def _assert_inside_base(base: Path, candidate: Path) -> None:
    base_resolved = base.resolve()
    candidate_resolved = candidate.resolve()
    if base_resolved not in candidate_resolved.parents and candidate_resolved != base_resolved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ruta de imagen inválida")


async def process_and_store_product_image(upload_dir: Path, image_file: UploadFile) -> tuple[str, str, int]:
    if image_file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato inválido. Solo se permite JPG o PNG.",
        )

    payload = await image_file.read()
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La imagen está vacía")

    if len(payload) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen supera el límite de 2 MB",
        )

    try:
        source = Image.open(BytesIO(payload))
        source.load()
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archivo de imagen no válido") from exc

    if image_file.content_type == "image/jpeg":
        ext = ".jpg"
        mime = "image/jpeg"
        if source.mode != "RGB":
            source = source.convert("RGB")
    else:
        ext = ".png"
        mime = "image/png"

    source.thumbnail((MAX_DIMENSION, MAX_DIMENSION))

    relative_path = Path("products") / f"{uuid4().hex}{ext}"
    absolute_path = upload_dir / relative_path
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    _assert_inside_base(upload_dir, absolute_path)

    if ext == ".jpg":
        source.save(absolute_path, format="JPEG", optimize=True, quality=88)
    else:
        source.save(absolute_path, format="PNG", optimize=True)

    size_bytes = absolute_path.stat().st_size
    if size_bytes > MAX_IMAGE_SIZE_BYTES:
        absolute_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen resultante supera el límite de 2 MB",
        )

    return str(relative_path).replace("\\", "/"), mime, size_bytes


def remove_stored_image(upload_dir: Path, relative_path: str | None) -> None:
    if not relative_path:
        return

    absolute_path = upload_dir / relative_path
    if absolute_path.exists() and absolute_path.is_file():
        _assert_inside_base(upload_dir, absolute_path)
        absolute_path.unlink(missing_ok=True)
