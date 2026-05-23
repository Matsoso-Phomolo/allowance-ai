import calendar
from datetime import date, datetime, timedelta

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
    create_notification(
        db,
        user,
        "Welcome to AllowanceAI",
        "Your account is ready. Start by checking your default budget categories and adjusting them to match your month.",
        "success",
    )
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
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role or "user"},
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
    create_notification(db, user, "Profile updated", "Your profile details were updated successfully.", "success")
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role or "user"}


def update_user_password(db: Session, user: models.User, password_update: schemas.PasswordUpdate) -> dict:
    if not auth.verify_password(password_update.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    user.password_hash = auth.hash_password(password_update.new_password)
    db.commit()
    create_notification(db, user, "Password changed", "Your AllowanceAI password was updated.", "info")
    return {"message": "Password updated."}


def create_notification(
    db: Session,
    user: models.User,
    title: str,
    message: str,
    notification_type: str = "info",
    dedupe_hours: int = 24,
):
    cutoff = datetime.utcnow() - timedelta(hours=dedupe_hours)
    existing = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == user.id,
            models.Notification.title == title,
            models.Notification.message == message,
            models.Notification.created_at >= cutoff,
        )
        .first()
    )
    if existing:
        return existing

    notification = models.Notification(
        user_id=user.id,
        title=title,
        message=message,
        type=notification_type,
        is_read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def serialize_notification(notification: models.Notification) -> dict:
    return {
        "id": notification.id,
        "title": notification.title,
        "message": notification.message,
        "type": notification.type,
        "is_read": bool(notification.is_read),
        "created_at": notification.created_at,
    }


def generate_budget_notifications(db: Session, user: models.User):
    summary = get_budget_summary(db, user)
    categories = get_categories(db, user)
    intelligence = get_intelligence(db, user)
    today_day = date.today().day

    for category in categories:
        if category["remaining_amount"] < 0:
            create_notification(
                db,
                user,
                f"{category['name']} is over budget",
                f"{category['name']} is over budget by R{abs(category['remaining_amount']):.2f}. Adjust the expense or reduce flexible spending first.",
                "danger",
            )

    snacks = next((category for category in categories if category["name"].strip().lower() == "snacks"), None)
    if snacks and today_day < 15 and snacks["percentage_used"] > 50:
        create_notification(
            db,
            user,
            "Snacks are moving too fast",
            f"Snacks are already {snacks['percentage_used']:.0f}% used before mid-month. Slow snacks spending to protect the rest of the month.",
            "warning",
        )

    allowance = summary.get("allowance", 0) or 0
    remaining = summary.get("remaining_money", 0) or 0
    if allowance > 0 and 0 <= remaining <= allowance * 0.15:
        create_notification(
            db,
            user,
            "Low remaining balance",
            f"You have R{remaining:.2f} left from R{allowance:.2f}. Keep flexible spending tight until the month ends.",
            "warning",
        )
    elif remaining < 0:
        create_notification(
            db,
            user,
            "Allowance is overdrawn",
            f"Your spending is R{abs(remaining):.2f} above your allowance. Reduce flexible categories before touching protected money.",
            "danger",
        )

    if intelligence.get("budget_health") == "DANGER" or intelligence.get("status") == "DANGER":
        finish_day = intelligence.get("predicted_money_finish_day")
        suffix = f" Around day {finish_day}." if finish_day else ""
        create_notification(
            db,
            user,
            "Month survival risk",
            f"Current spending may not last to month end.{suffix} Review recommendations in Budget Intelligence.",
            "danger",
        )

    savings_target = summary.get("savings_target", 0) or 0
    savings = next((category for category in categories if category["name"].strip().lower() == "savings"), None)
    if savings_target > 0 and savings and savings["planned_amount"] >= savings_target:
        create_notification(
            db,
            user,
            "Savings target protected",
            f"Your savings plan covers the R{savings_target:.2f} target for this month.",
            "success",
            dedupe_hours=168,
        )


def get_monthly_insights(db: Session, user: models.User, notify: bool = True) -> dict:
    current_start, current_end = month_bounds()
    previous_start, previous_end = month_bounds(shift_month(current_start, -1))
    budget = get_current_budget(db, user)
    allowance = budget.allowance if budget else 0

    categories = get_categories(db, user)
    current_expenses = expenses_between(db, user, current_start, current_end)
    previous_expenses = expenses_between(db, user, previous_start, previous_end)
    current_spend = category_spend_for_expenses(current_expenses)
    previous_spend = category_spend_for_expenses(previous_expenses)
    monthly_categories = category_views_for_spend(categories, current_spend)
    current_total_spent = round(sum(current_spend.values()), 2)
    summary = {
        "allowance": round(allowance, 2),
        "total_planned": round(sum(category["planned_amount"] for category in categories), 2),
        "total_spent": current_total_spent,
        "remaining_money": round(allowance - current_total_spent, 2),
        "savings_target": round(budget.savings_target if budget else 0, 2),
        "budget_status": decision_engine.get_budget_status(allowance - current_total_spent, allowance),
    }
    behavior = behavior_for_expenses(current_expenses)
    intelligence = decision_engine.build_budget_intelligence(summary, monthly_categories, behavior=behavior)
    trend_map = behavior.get("category_spend_trends", {})
    today_day = date.today().day

    spent_categories = [category for category in monthly_categories if category["spent_amount"] > 0]
    most_expensive = max(spent_categories, key=lambda category: category["spent_amount"], default=None)

    growth_rows = []
    for category in monthly_categories:
        current_amount = current_spend.get(category["name"], 0)
        previous_amount = previous_spend.get(category["name"], 0)
        if current_amount <= 0:
            continue
        growth_amount = current_amount - previous_amount
        growth_ratio = current_amount if previous_amount == 0 else growth_amount / previous_amount
        growth_rows.append((growth_ratio, growth_amount, category))
    fastest_growing = max(growth_rows, key=lambda item: (item[0], item[1]), default=None)
    fastest_growing_category = fastest_growing[2] if fastest_growing else None

    item_counts: dict[str, int] = {}
    category_counts: dict[str, int] = {}
    for expense in current_expenses:
        item_key = expense.item_name.strip().lower()
        if item_key:
            item_counts[item_key] = item_counts.get(item_key, 0) + 1
        category_counts[expense.category.name] = category_counts.get(expense.category.name, 0) + 1
    most_frequent_item = max(item_counts.items(), key=lambda item: item[1], default=None)
    most_frequent_category = max(category_counts.items(), key=lambda item: item[1], default=None)

    savings = next((category for category in monthly_categories if category["name"].strip().lower() == "savings"), None)
    emergency = next((category for category in monthly_categories if category["name"].strip().lower() == "emergency"), None)
    snacks = next((category for category in monthly_categories if category["name"].strip().lower() == "snacks"), None)
    overspent = [category for category in monthly_categories if category["remaining_amount"] < 0]

    savings_target = summary.get("savings_target", 0) or 0
    savings_protected = bool(savings and savings_target > 0 and savings["planned_amount"] >= savings_target and savings["spent_amount"] == 0)
    emergency_used = bool(emergency and emergency["spent_amount"] > 0)
    mid_month_limit = allowance * min(today_day, 15) / 30 if allowance > 0 else 0
    overspending_before_mid_month = bool(today_day <= 15 and current_total_spent > mid_month_limit and current_total_spent > 0)
    snacks_fast = bool(snacks and today_day <= 15 and snacks["percentage_used"] > 50)
    repeat_patterns = behavior.get("repeat_spending_patterns", {})
    repeated_snacks = any(
        name.strip().lower() == "snacks" and pattern.get("active_days", 0) >= 3
        for name, pattern in repeat_patterns.items()
    )
    snack_item_repeats = sum(count for item, count in item_counts.items() if "snack" in item or "chips" in item or "sweets" in item)
    repeated_snacks = repeated_snacks or snack_item_repeats >= 3
    category_imbalance = bool(
        monthly_categories
        and any(category["percentage_used"] >= 90 for category in monthly_categories)
        and any(category["percentage_used"] <= 20 for category in monthly_categories if category["planned_amount"] > 0)
    )

    risk_score = intelligence.get("risk_score", 0) or 0
    status = intelligence.get("budget_health") or intelligence.get("status") or "SAFE"
    risky_parts = []
    if overspent:
        risky_parts.append(f"{overspent[0]['name']} is over budget by R{abs(overspent[0]['remaining_amount']):.2f}")
    if snacks_fast:
        risky_parts.append("snacks spending is moving too quickly before mid-month")
    elif repeated_snacks:
        risky_parts.append("snacks spending is becoming a repeated pattern")
    if overspending_before_mid_month:
        risky_parts.append("overall spending is ahead of a safe mid-month pace")
    if emergency_used:
        risky_parts.append("emergency money has been used this month")
    if category_imbalance:
        risky_parts.append("some categories are nearly finished while others are barely used")
    if not risky_parts:
        risky_parts.append("no major risky pattern is currently visible")

    best_saving_behavior = "Savings target is protected and untouched." if savings_protected else "Savings target is not fully protected yet."
    if emergency and not emergency_used:
        best_saving_behavior += " Emergency money is still untouched."

    recommendations = []
    if snacks_fast and snacks:
        remaining_days = max(intelligence.get("remaining_days", 1) or 1, 1)
        overspeed = max(snacks["spent_amount"] - (snacks["planned_amount"] * today_day / 30), 0)
        daily_cut = overspeed / remaining_days
        recommendations.append(f"Reduce snacks by about R{daily_cut:.2f}/day to stay closer to plan.")
    if overspent:
        category = overspent[0]
        recommendations.append(f"Adjust {category['name']} by R{abs(category['remaining_amount']):.2f} or reduce flexible spending first.")
    if overspending_before_mid_month:
        safe_daily = intelligence.get("safe_daily_spend", 0) or 0
        recommendations.append(f"Keep flexible spending near R{safe_daily:.2f}/day until the month catches up.")
    if not savings_protected and savings_target > 0:
        recommendations.append(f"Protect the R{savings_target:.2f} savings target before increasing flexible categories.")
    if emergency_used:
        recommendations.append("Avoid using Emergency again unless it is truly unavoidable.")
    if len(recommendations) < 3:
        recommendations.append("Check Can I Buy before new flexible purchases this week.")
    if len(recommendations) < 3:
        recommendations.append("Keep fixed obligations paid, then spend from flexible categories carefully.")
    if len(recommendations) < 3:
        recommendations.append("Review Monthly Insights weekly so changes are caught before month end.")

    frequent_label = most_frequent_item[0].title() if most_frequent_item else (
        most_frequent_category[0] if most_frequent_category else "None yet"
    )
    fastest_growing_label = fastest_growing_category["name"] if fastest_growing_category else "None yet"
    if fastest_growing:
        previous_amount = previous_spend.get(fastest_growing_category["name"], 0)
        growth_note = (
            f" It moved from R{previous_amount:.2f} last month to R{fastest_growing_category['spent_amount']:.2f} this month."
        )
    else:
        growth_note = ""

    insights = {
        "most_expensive_category": most_expensive["name"] if most_expensive else "None yet",
        "fastest_growing_category": fastest_growing_label,
        "most_frequent_expense_type": frequent_label,
        "best_saving_behavior": best_saving_behavior,
        "risky_behavior": "; ".join(risky_parts).capitalize() + ".",
        "month_end_summary": (
            f"Budget health is {status}. You have R{summary.get('remaining_money', 0):.2f} left, "
            f"with a projected month-end balance of R{intelligence.get('projected_month_end_balance', 0):.2f}."
        ),
        "what_changed_this_month": (
            f"Overall spending trend is {behavior.get('trend', 'stable')}. "
            f"{most_expensive['name'] if most_expensive else 'No category'} is taking the largest share so far."
            f"{growth_note}"
        ),
        "risk_explanation": (
            f"Risk score is {risk_score}/100 because of spending velocity, mid-month pace, category balance, emergency use, and protected fund pressure."
        ),
        "recommendations": recommendations[:3],
        "status": status,
        "risk_score": risk_score,
        "metrics": {
            "avg_daily_spend": behavior.get("avg_daily_spend", 0),
            "trend": behavior.get("trend", "stable"),
            "category_spend_trends": trend_map,
            "repeat_spending_patterns": behavior.get("repeat_spending_patterns", {}),
            "repeated_snack_spending": repeated_snacks,
            "overspending_before_mid_month": overspending_before_mid_month,
            "emergency_used": emergency_used,
            "savings_protected": savings_protected,
            "category_imbalance": category_imbalance,
            "current_month": current_start.strftime("%Y-%m"),
            "previous_month": previous_start.strftime("%Y-%m"),
        },
    }

    if notify:
        generate_insight_notifications(db, user, insights)

    return insights


def generate_insight_notifications(db: Session, user: models.User, insights: dict):
    if insights.get("status") == "DANGER" or (insights.get("risk_score", 0) or 0) >= 71:
        create_notification(
            db,
            user,
            "Behavior risk is high",
            f"{insights['risky_behavior']} Open Monthly Insights for the recommended next steps.",
            "danger",
        )

    had_danger = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user.id, models.Notification.title == "Behavior risk is high")
        .order_by(models.Notification.created_at.desc(), models.Notification.id.desc())
        .first()
    )
    latest_improvement = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user.id, models.Notification.title == "Behavior improved")
        .order_by(models.Notification.created_at.desc(), models.Notification.id.desc())
        .first()
    )
    if (
        had_danger
        and insights.get("status") == "SAFE"
        and (not latest_improvement or latest_improvement.created_at < had_danger.created_at)
    ):
        create_notification(
            db,
            user,
            "Behavior improved",
            "Your monthly behavior has moved from danger back to safe. Keep the current spending pace.",
            "success",
            dedupe_hours=168,
        )

    if insights.get("metrics", {}).get("savings_protected"):
        create_notification(
            db,
            user,
            "Savings target protected",
            "Monthly Insights confirms your savings target is protected and untouched.",
            "success",
            dedupe_hours=168,
        )


def get_notifications(db: Session, user: models.User) -> list[dict]:
    generate_budget_notifications(db, user)
    generate_insight_notifications(db, user, get_monthly_insights(db, user, notify=False))
    notifications = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user.id)
        .order_by(models.Notification.created_at.desc(), models.Notification.id.desc())
        .limit(50)
        .all()
    )
    return [serialize_notification(notification) for notification in notifications]


def mark_notification_read(db: Session, notification_id: int, user: models.User) -> dict:
    notification = (
        db.query(models.Notification)
        .filter(models.Notification.id == notification_id, models.Notification.user_id == user.id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return serialize_notification(notification)


def mark_all_notifications_read(db: Session, user: models.User) -> dict:
    updated = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user.id, models.Notification.is_read == False)  # noqa: E712
        .update({"is_read": True}, synchronize_session=False)
    )
    db.commit()
    return {"message": "Notifications marked as read.", "updated": updated}


def delete_notification(db: Session, notification_id: int, user: models.User) -> dict:
    notification = (
        db.query(models.Notification)
        .filter(models.Notification.id == notification_id, models.Notification.user_id == user.id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")

    db.delete(notification)
    db.commit()
    return {"message": "Notification deleted."}


def export_user_data(db: Session, user: models.User) -> dict:
    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "budgets": [
            {
                "id": budget.id,
                "month": budget.month,
                "allowance": round(budget.allowance, 2),
                "savings_target": round(budget.savings_target, 2),
            }
            for budget in db.query(models.Budget).filter(models.Budget.user_id == user.id).order_by(models.Budget.id.asc()).all()
        ],
        "categories": get_categories(db, user),
        "expenses": get_expenses(db, user),
        "reports": {
            "monthly": get_monthly_report(db, user),
            "intelligence": get_intelligence(db, user),
            "alerts": get_alerts(db, user),
        },
        "behavior_tracking": get_behavior_metrics(db, user),
        "saved_shopping_lists": get_shopping_lists(db, user),
        "notifications": get_notifications(db, user),
    }


def delete_user_account(db: Session, user: models.User) -> dict:
    shopping_list_ids = [row[0] for row in db.query(models.ShoppingList.id).filter(models.ShoppingList.user_id == user.id).all()]
    if shopping_list_ids:
        db.query(models.ShoppingListItem).filter(models.ShoppingListItem.shopping_list_id.in_(shopping_list_ids)).delete(synchronize_session=False)
        db.query(models.ShoppingList).filter(models.ShoppingList.id.in_(shopping_list_ids)).delete(synchronize_session=False)
    db.query(models.CategoryDailyTotal).filter(models.CategoryDailyTotal.user_id == user.id).delete()
    db.query(models.DailySpendingLog).filter(models.DailySpendingLog.user_id == user.id).delete()
    db.query(models.Notification).filter(models.Notification.user_id == user.id).delete()
    db.query(models.Expense).filter(models.Expense.user_id == user.id).delete()
    db.query(models.Category).filter(models.Category.user_id == user.id).delete()
    db.query(models.Budget).filter(models.Budget.user_id == user.id).delete()
    db.delete(user)
    db.commit()
    return {"message": "Account deleted."}


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
    raw_behavior = {
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
    return {**raw_behavior, **decision_engine.behavior_summary(raw_behavior)}


def month_bounds(target: date | None = None) -> tuple[date, date]:
    target = target or date.today()
    last_day = calendar.monthrange(target.year, target.month)[1]
    return date(target.year, target.month, 1), date(target.year, target.month, last_day)


def shift_month(target: date, months: int) -> date:
    month_index = (target.year * 12 + target.month - 1) + months
    year = month_index // 12
    month = month_index % 12 + 1
    day = min(target.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def expenses_between(db: Session, user: models.User, start_date: date, end_date: date) -> list[models.Expense]:
    return (
        db.query(models.Expense)
        .filter(
            models.Expense.user_id == user.id,
            models.Expense.expense_date >= start_date,
            models.Expense.expense_date <= end_date,
        )
        .order_by(models.Expense.expense_date.desc(), models.Expense.id.desc())
        .all()
    )


def category_spend_for_expenses(expenses: list[models.Expense]) -> dict[str, float]:
    totals: dict[str, float] = {}
    for expense in expenses:
        category_name = expense.category.name
        totals[category_name] = totals.get(category_name, 0) + (expense.amount or 0)
    return totals


def category_views_for_spend(categories: list[dict], category_spend: dict[str, float]) -> list[dict]:
    monthly_categories = []
    for category in categories:
        spent = round(category_spend.get(category["name"], 0), 2)
        remaining = round(category["planned_amount"] - spent, 2)
        percentage = round((spent / category["planned_amount"] * 100) if category["planned_amount"] else 100, 2)
        monthly_categories.append(
            {
                **category,
                "spent_amount": spent,
                "remaining_amount": remaining,
                "percentage_used": percentage,
                "status": decision_engine.get_category_status(percentage, category["name"], remaining),
                "status_label": decision_engine.get_category_status_label(category["name"], percentage, remaining),
            }
        )
    return monthly_categories


def behavior_for_expenses(expenses: list[models.Expense]) -> dict:
    daily_totals: dict[date, float] = {}
    category_daily_totals: dict[tuple[date, str], float] = {}
    for expense in expenses:
        daily_totals[expense.expense_date] = daily_totals.get(expense.expense_date, 0) + (expense.amount or 0)
        key = (expense.expense_date, expense.category.name)
        category_daily_totals[key] = category_daily_totals.get(key, 0) + (expense.amount or 0)

    raw_behavior = {
        "daily_spending_log": [
            {"date": spending_date.isoformat(), "total_amount": round(total, 2)}
            for spending_date, total in sorted(daily_totals.items())
        ],
        "category_daily_totals": [
            {
                "date": spending_date.isoformat(),
                "category_name": category_name,
                "total_amount": round(total, 2),
            }
            for (spending_date, category_name), total in sorted(category_daily_totals.items())
        ],
    }
    return {**raw_behavior, **decision_engine.behavior_summary(raw_behavior)}


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


def evaluate_shopping_list_items(db: Session, user: models.User, items: list[dict]) -> dict:
    return decision_engine.evaluate_shopping_list(
        items,
        get_budget_summary(db, user),
        get_categories(db, user),
        behavior=get_behavior_metrics(db, user),
    )


def serialize_shopping_list(shopping_list: models.ShoppingList) -> dict:
    return {
        "id": shopping_list.id,
        "name": shopping_list.name,
        "total_cost": round(shopping_list.total_cost, 2),
        "approved": bool(shopping_list.approved),
        "advice": shopping_list.advice,
        "created_at": shopping_list.created_at,
        "updated_at": shopping_list.updated_at,
        "items": [
            {
                "id": item.id,
                "item_name": item.item_name,
                "amount": round(item.amount, 2),
                "category_name": item.category_name,
                "created_at": item.created_at,
            }
            for item in sorted(shopping_list.items, key=lambda row: row.id)
        ],
    }


def get_shopping_list_by_id(db: Session, list_id: int, user: models.User) -> models.ShoppingList:
    shopping_list = (
        db.query(models.ShoppingList)
        .filter(models.ShoppingList.id == list_id, models.ShoppingList.user_id == user.id)
        .first()
    )
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found.")
    return shopping_list


def get_shopping_lists(db: Session, user: models.User) -> list[dict]:
    shopping_lists = (
        db.query(models.ShoppingList)
        .filter(models.ShoppingList.user_id == user.id)
        .order_by(models.ShoppingList.updated_at.desc(), models.ShoppingList.id.desc())
        .all()
    )
    return [serialize_shopping_list(shopping_list) for shopping_list in shopping_lists]


def create_shopping_list(db: Session, request: schemas.ShoppingListCreate, user: models.User) -> dict:
    items = [item.model_dump() for item in request.items]
    evaluation = evaluate_shopping_list_items(db, user, items)
    shopping_list = models.ShoppingList(
        user_id=user.id,
        name=request.name.strip() or "Shopping list",
        total_cost=evaluation["total_cost"],
        approved=evaluation["approved"],
        advice=evaluation["advice"],
    )
    shopping_list.items = [
        models.ShoppingListItem(
            item_name=item["item_name"].strip(),
            amount=item["amount"],
            category_name=item["category_name"].strip(),
        )
        for item in items
    ]
    db.add(shopping_list)
    db.commit()
    db.refresh(shopping_list)
    create_notification(db, user, "Shopping list saved", "Shopping list saved successfully.", "success")
    return serialize_shopping_list(shopping_list)


def update_shopping_list(db: Session, list_id: int, request: schemas.ShoppingListUpdate, user: models.User) -> dict:
    shopping_list = get_shopping_list_by_id(db, list_id, user)
    if request.name is not None:
        shopping_list.name = request.name.strip() or shopping_list.name

    if request.items is not None:
        items = [item.model_dump() for item in request.items]
        evaluation = evaluate_shopping_list_items(db, user, items)
        shopping_list.total_cost = evaluation["total_cost"]
        shopping_list.approved = evaluation["approved"]
        shopping_list.advice = evaluation["advice"]
        shopping_list.items = [
            models.ShoppingListItem(
                item_name=item["item_name"].strip(),
                amount=item["amount"],
                category_name=item["category_name"].strip(),
            )
            for item in items
        ]

    shopping_list.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(shopping_list)
    return serialize_shopping_list(shopping_list)


def delete_shopping_list(db: Session, list_id: int, user: models.User) -> dict:
    shopping_list = get_shopping_list_by_id(db, list_id, user)
    db.delete(shopping_list)
    db.commit()
    return {"message": "Shopping list deleted."}


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


def get_admin_stats(db: Session) -> dict:
    total_spending = db.query(func.coalesce(func.sum(models.Expense.amount), 0)).scalar() or 0
    return {
        "total_users": db.query(models.User).count(),
        "total_budgets": db.query(models.Budget).count(),
        "total_categories": db.query(models.Category).count(),
        "total_expenses": db.query(models.Expense).count(),
        "total_tracked_spending": round(total_spending, 2),
    }


def get_admin_users(db: Session) -> list[dict]:
    users = db.query(models.User).order_by(models.User.created_at.desc(), models.User.id.desc()).all()
    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role or "user",
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
        for user in users
    ]
