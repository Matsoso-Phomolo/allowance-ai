import os
import time

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

import auth
import crud
import models
import schemas
from database import Base, SessionLocal, engine, get_db


app = FastAPI(title="AllowanceAI API", version="1.0.0")
START_TIME = time.time()

DEFAULT_FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://allowance-ai.onrender.com",
]
frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
allowed_origins = DEFAULT_FRONTEND_ORIGINS + ([frontend_url] if frontend_url else [])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


def ensure_sqlite_user_schema():
    if engine.url.get_backend_name() != "sqlite":
        return

    with engine.begin() as connection:
        table_names = {row[0] for row in connection.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}

        def columns(table_name):
            if table_name not in table_names:
                return set()
            return {row[1] for row in connection.exec_driver_sql(f"PRAGMA table_info({table_name})").fetchall()}

        for table_name in ["budgets", "expenses"]:
            if table_name in table_names and "user_id" not in columns(table_name):
                connection.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1")

        if "categories" in table_names:
            category_sql = connection.exec_driver_sql(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='categories'"
            ).scalar() or ""
            if "user_id" not in columns("categories") or "UNIQUE" in category_sql.upper():
                connection.exec_driver_sql("PRAGMA foreign_keys=off")
                connection.exec_driver_sql("ALTER TABLE categories RENAME TO categories_old")
                connection.exec_driver_sql(
                    """
                    CREATE TABLE categories (
                        id INTEGER NOT NULL PRIMARY KEY,
                        name VARCHAR NOT NULL,
                        planned_amount FLOAT NOT NULL,
                        user_id INTEGER NOT NULL DEFAULT 1,
                        FOREIGN KEY(user_id) REFERENCES users (id)
                    )
                    """
                )
                old_cols = columns("categories_old")
                user_select = "user_id" if "user_id" in old_cols else "1"
                connection.exec_driver_sql(
                    f"INSERT INTO categories (id, name, planned_amount, user_id) SELECT id, name, planned_amount, {user_select} FROM categories_old"
                )
                connection.exec_driver_sql("DROP TABLE categories_old")
                connection.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_categories_name ON categories (name)")
                connection.exec_driver_sql("PRAGMA foreign_keys=on")

        for table_name in ["daily_spending_log", "category_daily_totals"]:
            if table_name in table_names:
                connection.exec_driver_sql(f"DROP TABLE {table_name}")


def ensure_user_role_schema():
    backend = engine.url.get_backend_name()
    admin_emails = {
        email.strip().lower()
        for email in os.getenv("ALLOWANCEAI_ADMIN_EMAILS", "").split(",")
        if email.strip()
    }

    with engine.begin() as connection:
        if backend == "sqlite":
            table_names = {row[0] for row in connection.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
            if "users" not in table_names:
                return
            columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(users)").fetchall()}
            if "role" not in columns:
                connection.exec_driver_sql("ALTER TABLE users ADD COLUMN role VARCHAR NOT NULL DEFAULT 'user'")
        elif "postgresql" in backend:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR NOT NULL DEFAULT 'user'")

        connection.exec_driver_sql("UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''")
        for email in admin_emails:
            connection.execute(text("UPDATE users SET role = 'admin' WHERE lower(email) = :email"), {"email": email})


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_user_schema()
    ensure_user_role_schema()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for user in db.query(models.User).all():
            crud.rebuild_behavior_tracking(db, user)
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "AllowanceAI backend is running"}


@app.get("/health")
def health():
    return {"status": "ok", "service": "AllowanceAI backend"}


@app.get("/ready")
def ready(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ready", "database": "ok", "service": "AllowanceAI backend"}


def readiness_payload(db: Session) -> dict:
    db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "database": "ready",
        "service": "AllowanceAI backend",
        "uptime_seconds": round(time.time() - START_TIME, 2),
    }


@app.post("/api/auth/register", response_model=schemas.AuthResponse)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    user = crud.create_user(db, user_data)
    return crud.auth_response(user)


@app.post("/api/auth/login", response_model=schemas.AuthResponse)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, credentials)
    return crud.auth_response(user)


@app.get("/api/auth/me", response_model=schemas.UserResponse)
def me(current_user: models.User = Depends(auth.get_current_user)):
    return {"id": current_user.id, "name": current_user.name, "email": current_user.email, "role": current_user.role or "user"}


@app.put("/api/auth/profile", response_model=schemas.UserResponse)
def update_profile(
    profile: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.update_user_profile(db, current_user, profile)


@app.put("/api/auth/password")
def update_password(
    password_update: schemas.PasswordUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.update_user_password(db, current_user, password_update)


@app.get("/api/account/export")
def export_account_data(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.export_user_data(db, current_user)


@app.delete("/api/account")
def delete_account(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.delete_user_account(db, current_user)


@app.get("/api/notifications", response_model=list[schemas.NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.get_notifications(db, current_user)


@app.patch("/api/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.mark_all_notifications_read(db, current_user)


@app.patch("/api/notifications/{notification_id}/read", response_model=schemas.NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.mark_notification_read(db, notification_id, current_user)


@app.delete("/api/notifications/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.delete_notification(db, notification_id, current_user)


@app.get("/api/admin/stats")
def admin_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_admin_user),
):
    return crud.get_admin_stats(db)


@app.get("/api/admin/users", response_model=list[schemas.AdminUserResponse])
def admin_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_admin_user),
):
    return crud.get_admin_users(db)


@app.get("/api/admin/health")
def admin_health(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_admin_user),
):
    return readiness_payload(db)


@app.post("/api/budget")
def create_budget(
    budget: schemas.BudgetCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.create_budget(db, budget, current_user)


@app.get("/api/budget", response_model=schemas.BudgetSummary)
def get_budget(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_budget_summary(db, current_user)


@app.post("/api/categories")
def create_category(
    category: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.create_category(db, category, current_user)


@app.get("/api/categories", response_model=list[schemas.CategoryResponse])
def get_categories(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_categories(db, current_user)


@app.put("/api/categories/{category_id}")
def update_category(
    category_id: int,
    category: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.update_category(db, category_id, category, current_user)


@app.delete("/api/categories/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.delete_category(db, category_id, current_user)


@app.post("/api/expenses")
def add_expense(
    expense: schemas.ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.add_expense(db, expense, current_user)


@app.get("/api/expenses", response_model=list[schemas.ExpenseResponse])
def get_expenses(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_expenses(db, current_user)


@app.put("/api/expenses/{expense_id}")
def update_expense(
    expense_id: int,
    expense: schemas.ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.update_expense(db, expense_id, expense, current_user)


@app.delete("/api/expenses/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.delete_expense(db, expense_id, current_user)


@app.get("/api/alerts")
def get_alerts(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_alerts(db, current_user)


@app.get("/api/intelligence")
def get_intelligence(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_intelligence(db, current_user)


@app.get("/api/insights/monthly")
def get_monthly_insights(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_monthly_insights(db, current_user)


@app.post("/api/monthly-plan")
def create_monthly_plan(
    request: schemas.MonthlyPlanRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.create_monthly_plan(db, request, current_user)


@app.post("/api/evaluate-list")
def evaluate_shopping_list(
    request: schemas.ShoppingListRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.evaluate_shopping_list(db, request, current_user)


@app.get("/api/timetable")
def get_timetable(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_timetable(db, current_user)


@app.get("/api/reports/monthly")
def get_monthly_report(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_monthly_report(db, current_user)


@app.post("/api/can-i-buy", response_model=schemas.CanIBuyResponse)
def can_i_buy(
    request: schemas.CanIBuyRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.can_i_buy(db, request, current_user)
