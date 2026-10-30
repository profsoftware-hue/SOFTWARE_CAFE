import os


# En pruebas unitarias no debe usarse la base real del proyecto. En integración
# (TEST_DATABASE_URL definido) se respetan las variables del entorno/CI.
if not os.getenv("TEST_DATABASE_URL"):
    os.environ.setdefault("DB_HOST", "localhost")
    os.environ.setdefault("DB_PORT", "5432")
    os.environ.setdefault("DB_NAME", "test")
    os.environ.setdefault("DB_USER", "test")
    os.environ.setdefault("DB_PASSWORD", "test")
    os.environ.setdefault("DB_DIALECT", "postgresql")

os.environ.setdefault("SECRET_KEY", "unit-test-secret-key-with-more-than-32-characters")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
