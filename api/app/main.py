from fastapi import FastAPI

from app.routes import auth, upload, portal
from app.storage import ensure_bucket

app = FastAPI(title="portal-api")

app.include_router(auth.router, prefix="/api")
app.include_router(upload.router, prefix="")
app.include_router(portal.router, prefix="/api")


@app.on_event("startup")
def startup_event():
    ensure_bucket()


@app.get("/api/health")
def health():
    return {"status": "ok"}
