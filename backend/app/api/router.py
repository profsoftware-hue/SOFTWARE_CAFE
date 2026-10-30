from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.catalogs import router as catalogs_router
from app.api.routes.inventory import router as inventory_router
from app.api.routes.products import router as products_router
from app.api.routes.reports import router as reports_router
from app.api.routes.uploads import router as uploads_router
from app.api.routes.users import router as users_router


api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(catalogs_router)
api_router.include_router(products_router)
api_router.include_router(inventory_router)
api_router.include_router(reports_router)
api_router.include_router(uploads_router)
