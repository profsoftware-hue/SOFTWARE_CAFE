from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.user import User


router = APIRouter(prefix="/uploads", tags=["Uploads"])


def _safe_file_path(relative_path: str) -> Path:
    base = settings.upload_dir.resolve()
    candidate = (settings.upload_dir / relative_path).resolve()
    if base not in candidate.parents and candidate != base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")
    return candidate


@router.get("/{file_path:path}")
def read_upload(file_path: str, _: User = Depends(get_current_user)) -> FileResponse:
    absolute_path = _safe_file_path(file_path)
    if not absolute_path.exists() or not absolute_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")
    return FileResponse(path=absolute_path)
