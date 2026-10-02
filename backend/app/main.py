from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from sqlalchemy import text
from app.database import get_db
from fastapi import Depends
from sqlalchemy.orm import Session
from app.routers import auth, parties, transactions, dashboard, chat, reminders, smart_entry, bank_import, analytics, skus

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Bakaaya API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(parties.router)
app.include_router(transactions.router)
app.include_router(dashboard.router)
app.include_router(chat.router)
app.include_router(reminders.router)
app.include_router(smart_entry.router)
app.include_router(bank_import.router)
app.include_router(analytics.router)
app.include_router(skus.router)

@app.get("/")
def root():
    return {"status": "ok", "service": "bakaaya-api", "version": "0.3.0"}

@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "healthy"}
