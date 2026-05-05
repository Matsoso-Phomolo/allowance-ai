from datetime import date

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

import auth
import decision_engine
import models
import schemas


def create_user(db: Session, user_data: schemas.UserCreate):
    email = user_data.email.strip().lower()
    existing = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")
    user = models.User(name=user_data.name.strip(), email=email, password_hash=auth.hash_password(user_data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    from seed import seed_default_data

    seed_default_data(db, user.id)
    return user


def authenticate_user(db: Session, credentials: schemas.UserLogin):
    user = db.query(models.User).filter(func.lower(models.User.email) == credentials.email.strip().lower()).first()
    if not user or not auth.verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return user


def auth_response(user: models.User) -> dict:
    return {
        "access_token": auth.create_access_token(user),
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email},
    }


def update_user_profile(db: Session, user: models.User, profile: schemas.UserProfileUpdate) -> dict:
    email = profile.email.strip().lower()
    name = profile.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")

    duplicate = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == email, models.User.id != user.id)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=400, detail="Email already in use.")

    user.name = name
    user.email = email
    db.commit()
    db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email}


def update_user_password(db: Session, user: models.User, password_update: schemas.PasswordUpdate) -> dict:
    if not auth.verify_password(password_update.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    user.password_hash = auth.hash_password(password_update.new_password)
    db.commit()
    return {"message": "Password updated."}


def create_budget(db: Session, budget: schemas.BudgetCreate, user: models.User):
    db_budget = models.Budget(
        month=budget.month,
        allowance=budget.allowance,
        savings_target=budget.savings_target,
        user_id=user.id,
    )
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    return db_budget


def get_current_budget(db: Session, user: models.User):
    return db.query(models.Budget).filter(models.Budget.user_id == user.id).order_by(models.Budget.id.desc()).first()


def get_total_spent(db: Session, user: models.User) -> float:
    return db.query(func.coalesce(func.sum(models.Expense.amount), 0)).filter(models.Expense.user_id == user.id).scalar() or 0


def get_total_planned(db: Session, user: models.User) -> float:
    return db.query(func.coalesce(func.sum(models.Category.planned_amount), 0)).filter(models.Category.user_id == user.id).scalar() or 0


def rebuild_behavior_tracking(db: Session, user: models.User):
    db.query(models.DailySpendingLog).filter(models.DailySpendingLog.user_id == user.id).delete()
    db.query(models.CategoryDailyTotal).filter(models.CategoryDailyTotal.user_id == user.id).delete()

    daily_rows = (
        db.query(models.Expense.expense_date, func.coalesce(func.sum(models.Expense.amount), 0))
        .filter(models.Expense.user_id == user.id)
        .group_by(models.Expense.expense_date)
        .all()
    )
    for spending_date, total_amount in daily_rows:
        db.add(models.DailySpendingLog(spending_date=spending_date, total_amount=total_amount or 0, user_id=user.id))

    category_rows = (
        db.query(models.Expense.expense_date, models.Category.name, func.coalesce(func.sum(models.Expense.amount), 0))
        .join(models.Category, models.Expense.category_id == models.Category.id)
        .filter(models.Expense.user_id == user.id)
        .group_by(models.Expense.expense_date, models.Category.name)
        .all()
    )
    for spending_date, category_name, total_amount in category_rows:
        db.add(
            models.CategoryDailyTotal(
                spending_date=spending_date,
                category_name=category_name,
                total_amount=total_amount or 0,
                user_id=user.id,
            )
        )
    db.commit()


def get_behavior_metrics(db: Session, user: models.User) -> dict:
    daily_logs = db.query(models.DailySpendingLog).filter(models.DailySpendingLog.user_id == user.id).order_by(models.DailySpendingLog.spending_date.asc()).all()
    category_logs = (
        db.query(models.CategoryDailyTotal)
        .filter(models.CategoryDailyTotal.user_id == user.id)
        .order_by(models.CategoryDailyTotal.category_name.asc(), models.CategoryDailyTotal.spending_date.asc())
        .all()
    )
    return {
        "daily_spending_log": [
            {"date": log.spending_date.isoformat(), "total_amount": round(log.total_amount, 2)} for log in daily_logs
        ],
        "category_daily_totals": [
            {
                "date": log.spending_date.isoformat(),
                "category_name": log.category_name,
                "total_amount": round(log.total_amount, 2),
            }
            for log in category_logs
        ],
    }


def get_budget_summary(db: Session, user: models.User) -> dict:
    budget = get_current_budget(db, user)
    if not budget:
        return {
            "allowance": 0,
            "total_planned": 0,
            "total_spent": 0,
            "remaining_money": 0,
            "savings_target": 0,
            "budget_status": "warning",
        }

    total_planned = get_total_planned(db, user)
    total_spent = get_total_spent(db, user)
    remaining_money = budget.allowance - total_spent

    return {
        "allowance": round(budget.allowance, 2),
        "total_planned": round(total_planned, 2),
        "total_spent": round(total_spent, 2),
        "remaining_money": round(remaining_money, 2),
        "savings_target": round(budget.savings_target, 2),
        "budget_status": decision_engine.get_budget_status(remaining_money, budget.allowance),
    }


def create_category(db: Session, category: schemas.CategoryCreate, user: models.User):
    existing = db.query(models.Category).filter(func.lower(models.Category.name) == category.name.lower(), models.Category.user_id == user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists.")

    db_category = models.Category(name=category.name.strip(), planned_amount=category.planned_amount, user_id=user.id)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


def get_category_by_id(db: Session, category_id: int, user: models.User):
    category = db.query(models.Category).filter(models.Category.id == category_id, models.Category.user_id == user.id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")
    return category


def get_category_by_name(db: Session, name: str, user: models.User):
    return db.query(models.Category).filter(func.lower(models.Category.name) == name.lower(), models.Category.user_id == user.id).first()


def update_category(db: Session, category_id: int, category_update: schemas.CategoryCreate, user: models.User):
    category = get_category_by_id(db, category_id, user)
    duplicate = (
        db.query(models.Category)
        .filter(func.lower(models.Category.name) == category_update.name.lower(), models.Category.id != category_id, models.Category.user_id == user.id)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=400, detail="Another category already uses that name.")

    category.name = category_update.name.strip()
    category.planned_amount = category_update.planned_amount
    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, category_id: int, user: models.User):
    category = get_category_by_id(db, category_id, user)
    expense_count = db.query(models.Expense).filter(models.Expense.category_id == category.id, models.Expense.user_id == user.id).count()
    if expense_count:
        raise HTTPException(status_code=400, detail="Cannot delete a category that has expenses.")

    db.delete(category)
    db.commit()
    return {"message": "Category deleted."}


def get_categories(db: Session, user: models.User) -> list[dict]:
    categories = db.query(models.Category).filter(models.Category.user_id == user.id).order_by(models.Category.name.asc()).all()
    results = []

    for category in categories:
        spent = (
            db.query(func.coalesce(func.sum(models.Expense.amount), 0))
            .filter(models.Expense.category_id == category.id, models.Expense.user_id == user.id)
            .scalar()
            or 0
        )
        remaining = category.planned_amount - spent
        percentage = (spent / category.planned_amount * 100) if category.planned_amount else 100
        status = decision_engine.get_category_status(percentage, category.name, remaining)

        results.append(
            {
                "id": category.id,
                "name": category.name,
                "planned_amount": round(category.planned_amount, 2),
                "spent_amount": round(spent, 2),
                "remaining_amount": round(remaining, 2),
                "percentage_used": round(percentage, 2),
                "status": status,
                "status_label": decision_engine.get_category_status_label(category.name, percentage, remaining),
            }
        )

    return results


def add_expense(db: Session, expense: schemas.ExpenseCreate, user: models.User):
    category = get_category_by_name(db, expense.category_name, user)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")

    db_expense = models.Expense(
        item_name=expense.item_name.strip(),
        amount=expense.amount,
        category_id=category.id,
        expense_date=expense.expense_date or date.today(),
        user_id=user.id,
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    rebuild_behavior_tracking(db, user)
    updated_category = next(
        category_data for category_data in get_categories(db, user) if category_data["id"] == category.id
    )
    return {
        "expense": {
            "id": db_expense.id,
            "item_name": db_expense.item_name,
            "amount": round(db_expense.amount, 2),
            "category_name": db_expense.category.name,
            "expense_date": db_expense.expense_date,
        },
        "feedback": decision_engine.expense_entry_feedback(updated_category),
    }


def get_expense_by_id(db: Session, expense_id: int, user: models.User):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id, models.Expense.user_id == user.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found.")
    return expense


def update_expense(db: Session, expense_id: int, expense_update: schemas.ExpenseCreate, user: models.User):
    expense = get_expense_by_id(db, expense_id, user)
    category = get_category_by_name(db, expense_update.category_name, user)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")

    expense.item_name = expense_update.item_name.strip()
    expense.amount = expense_update.amount
    expense.category_id = category.id
    expense.expense_date = expense_update.expense_date or expense.expense_date
    db.commit()
    db.refresh(expense)
    rebuild_behavior_tracking(db, user)
    updated_category = next(
        category_data for category_data in get_categories(db, user) if category_data["id"] == category.id
    )
    return {
        "expense": {
            "id": expense.id,
            "item_name": expense.item_name,
            "amount": round(expense.amount, 2),
            "category_name": expense.category.name,
            "expense_date": expense.expense_date,
        },
        "feedback": decision_engine.expense_entry_feedback(updated_category),
    }


def delete_expense(db: Session, expense_id: int, user: models.User):
    expense = get_expense_by_id(db, expense_id, user)
    db.delete(expense)
    db.commit()
    rebuild_behavior_tracking(db, user)
    return {"message": "Expense deleted."}


def get_expenses(db: Session, user: models.User) -> list[dict]:
    expenses = db.query(models.Expense).filter(models.Expense.user_id == user.id).order_by(models.Expense.expense_date.desc(), models.Expense.id.desc()).all()
    return [
        {
            "id": expense.id,
            "item_name": expense.item_name,
            "amount": round(expense.amount, 2),
            "category_name": expense.category.name,
            "expense_date": expense.expense_date,
        }
        for expense in expenses
    ]


def get_alerts(db: Session, user: models.User) -> list[dict]:
    return decision_engine.build_alerts(
        get_budget_summary(db, user),
        get_categories(db, user),
        behavior=get_behavior_metrics(db, user),
    )


def get_intelligence(db: Session, user: models.User) -> dict:
    return decision_engine.build_budget_intelligence(
        get_budget_summary(db, user),
        get_categories(db, user),
        behavior=get_behavior_metrics(db, user),
    )


def create_monthly_plan(db: Session, request: schemas.MonthlyPlanRequest, user: models.User) -> dict:
    fixed_commitments = request.fixed_commitments.model_dump(by_alias=True)
    user_preferences = request.user_preferences.model_dump()
    return decision_engine.generate_monthly_plan(
        allowance=request.allowance,
        month=request.month,
        fixed_commitments=fixed_commitments,
        user_preferences=user_preferences,
        behavior=get_behavior_metrics(db, user),
    )


def evaluate_shopping_list(db: Session, request: schemas.ShoppingListRequest, user: models.User) -> dict:
    items = [item.model_dump() for item in request.items]
    return decision_engine.evaluate_shopping_list(
        items,
        get_budget_summary(db, user),
        get_categories(db, user),
        behavior=get_behavior_metrics(db, user),
    )


def get_timetable(db: Session, user: models.User) -> dict:
    return decision_engine.build_spending_timetable(get_categories(db, user), behavior=get_behavior_metrics(db, user))


def get_monthly_report(db: Session, user: models.User) -> dict:
    summary = get_budget_summary(db, user)
    categories = get_categories(db, user)
    expenses = get_expenses(db, user)
    intelligence = get_intelligence(db, user)
    top_expenses = sorted(expenses, key=lambda expense: expense["amount"], reverse=True)[:5]
    overspending_categories = [
        category for category in categories if category["remaining_amount"] < 0 or category["status"] in {"warning", "danger"}
    ]

    if intelligence["status"] == "SAFE":
        final_verdict = "Your allowance is under control. Keep tracking expenses and protect savings."
    elif intelligence["status"] == "WARNING":
        final_verdict = "Your budget needs attention. Reduce flexible spending before it becomes dangerous."
    else:
        final_verdict = "Your budget is at high risk. Stop flexible spending and review expenses immediately."

    return {
        "allowance": summary["allowance"],
        "total_spent": summary["total_spent"],
        "remaining_money": summary["remaining_money"],
        "savings_target": summary["savings_target"],
        "category_summary": categories,
        "top_expenses": top_expenses,
        "overspending_categories": overspending_categories,
        "risk_score": intelligence["risk_score"],
        "budget_health": intelligence["budget_health"],
        "recommendations": intelligence["recommendations"],
        "final_verdict": final_verdict,
        "decision": {
            "status": intelligence["status"],
            "confidence": intelligence["confidence"],
            "reasoning": intelligence["reasoning"],
            "metrics": intelligence["metrics"],
        },
    }


def can_i_buy(db: Session, request: schemas.CanIBuyRequest, user: models.User) -> dict:
    category = get_category_by_name(db, request.category_name, user)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")

    summary = get_budget_summary(db, user)
    category_info = next((item for item in get_categories(db, user) if item["id"] == category.id), None)

    return decision_engine.can_i_buy_decision(
        item_name=request.item_name,
        amount=request.amount,
        category_name=category.name,
        remaining_money=summary["remaining_money"],
        category_remaining=category_info["remaining_amount"],
        category_spent=category_info["spent_amount"],
        category_planned=category_info["planned_amount"],
        behavior=get_behavior_metrics(db, user),
    )
