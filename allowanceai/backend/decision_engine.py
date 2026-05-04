import calendar
from datetime import date


PROTECTED_CATEGORIES = {"savings", "emergency"}
ESSENTIAL_CATEGORIES = {"food", "econet data", "data", "mokhatlo"}
FLEXIBLE_CATEGORIES = {"snacks", "cosmetics", "other"}
SPEED_SENSITIVE_CATEGORIES = {"snacks", "fruit", "fruits", "sweets", "simbas", "chips"}
REDUCTION_ORDER = {"snacks": 0, "cosmetics": 1}


def decision(status: str, confidence: float, reasoning: str, recommendations=None, metrics=None) -> dict:
    return {
        "status": status,
        "confidence": round(max(0, min(confidence, 1)), 2),
        "reasoning": reasoning,
        "recommendations": recommendations or [],
        "metrics": metrics or {},
    }


def status_from_risk(risk_score: float) -> str:
    if risk_score <= 30:
        return "SAFE"
    if risk_score <= 70:
        return "WARNING"
    return "DANGER"


def get_category_priority(category_name: str) -> str:
    normalized = category_name.strip().lower()
    if normalized in PROTECTED_CATEGORIES:
        return "Protected"
    if normalized in ESSENTIAL_CATEGORIES:
        return "Essential"
    return "Flexible"


def is_speed_sensitive_category(category_name: str) -> bool:
    return category_name.strip().lower() in SPEED_SENSITIVE_CATEGORIES


def get_budget_status(remaining_money: float, allowance: float) -> str:
    if allowance <= 0:
        return "warning"
    risk = risk_from_balance(remaining_money, allowance)
    return status_from_risk(risk).lower()


def get_category_status(percentage_used: float) -> str:
    if percentage_used >= 100:
        return "danger"
    if percentage_used >= 75:
        return "warning"
    return "safe"


def risk_from_balance(remaining_money: float, allowance: float) -> int:
    if allowance <= 0 or remaining_money < 0:
        return 100
    used_ratio = 1 - (remaining_money / allowance)
    return round(max(0, min(used_ratio * 100, 100)))


def trend_from_values(values: list[float]) -> str:
    if len(values) < 3:
        return "stable"
    midpoint = len(values) // 2
    first_avg = sum(values[:midpoint]) / max(midpoint, 1)
    second_values = values[midpoint:]
    second_avg = sum(second_values) / max(len(second_values), 1)
    if second_avg > first_avg * 1.15:
        return "increasing"
    if second_avg < first_avg * 0.85:
        return "decreasing"
    return "stable"


def consistency_score(values: list[float]) -> float:
    if len(values) < 2:
        return 0.45
    avg = sum(values) / len(values)
    if avg <= 0:
        return 0.7
    variance = sum((value - avg) ** 2 for value in values) / len(values)
    coefficient = (variance ** 0.5) / avg
    return max(0.25, min(1 - coefficient, 0.95))


def behavior_summary(behavior: dict | None) -> dict:
    behavior = behavior or {}
    daily_logs = behavior.get("daily_spending_log", [])
    category_logs = behavior.get("category_daily_totals", [])
    daily_values = [row["total_amount"] for row in daily_logs]
    category_values: dict[str, list[float]] = {}
    for row in category_logs:
        category_values.setdefault(row["category_name"], []).append(row["total_amount"])

    category_spend_trends = {
        category: trend_from_values(values) for category, values in category_values.items()
    }
    repeat_patterns = {
        category: {
            "active_days": len([value for value in values if value > 0]),
            "avg_spend_when_active": round(sum(values) / max(len([value for value in values if value > 0]), 1), 2),
            "trend": trend_from_values(values),
        }
        for category, values in category_values.items()
        if is_speed_sensitive_category(category)
    }
    return {
        "avg_daily_spend": round(sum(daily_values) / max(len(daily_values), 1), 2),
        "trend": trend_from_values(daily_values),
        "consistency": round(consistency_score(daily_values), 2),
        "data_points": len(daily_values),
        "category_spend_trends": category_spend_trends,
        "repeat_spending_patterns": repeat_patterns,
    }


def confidence_from_behavior(behavior_metrics: dict) -> float:
    data_points = behavior_metrics.get("data_points", 0)
    consistency = behavior_metrics.get("consistency", 0.45)
    data_factor = min(data_points / 10, 1)
    return round(max(0.35, min((data_factor * 0.45) + (consistency * 0.45) + 0.1, 0.95)), 2)


def category_risk(category: dict, category_velocity: float = 0) -> int:
    if category["remaining_amount"] < 0:
        return 90
    base = min(category["percentage_used"], 100)
    if is_speed_sensitive_category(category["name"]) and category_velocity > 1:
        base += min((category_velocity - 1) * 25, 25)
    return round(max(0, min(base, 100)))


def month_context(today: date | None = None) -> dict:
    today = today or date.today()
    days_in_month = calendar.monthrange(today.year, today.month)[1]
    elapsed_days = max(today.day, 1)
    remaining_days = max(days_in_month - today.day, 0)
    planning_days = max(remaining_days, 1)
    return {
        "today": today,
        "days_in_month": days_in_month,
        "elapsed_days": elapsed_days,
        "remaining_days": remaining_days,
        "planning_days": planning_days,
    }


def flexible_reduction_advice(amount_needed: float) -> str:
    if amount_needed <= 0:
        return "Keep flexible spending controlled before touching protected money."
    return (
        f"Reduce flexible spending by about R{amount_needed:.2f}: cut Snacks first, then Cosmetics, then other flexible spending."
    )


def build_budget_intelligence(summary: dict, categories: list[dict], today: date | None = None, behavior: dict | None = None) -> dict:
    ctx = month_context(today)
    behavior_metrics = behavior_summary(behavior)
    remaining_money = summary["remaining_money"]
    total_spent = summary["total_spent"]
    speed_sensitive_spent = sum(c["spent_amount"] for c in categories if is_speed_sensitive_category(c["name"]))
    monthly_purchase_spent = total_spent - speed_sensitive_spent
    safe_daily_spend = remaining_money / ctx["planning_days"] if remaining_money > 0 else 0
    spending_velocity = speed_sensitive_spent / ctx["elapsed_days"] if ctx["elapsed_days"] else 0
    projected_total_spend = monthly_purchase_spent + (spending_velocity * ctx["days_in_month"])
    projected_month_end_balance = summary["allowance"] - projected_total_spend
    velocity_ratio = spending_velocity / safe_daily_spend if safe_daily_spend > 0 else 0
    spending_too_fast = velocity_ratio > 1 and speed_sensitive_spent > 0

    predicted_finish_day = None
    if spending_velocity > 0 and projected_month_end_balance < 0:
        remaining_after_monthly = summary["allowance"] - monthly_purchase_spent
        predicted_finish_day = max(int(remaining_after_monthly / spending_velocity), ctx["today"].day)
        predicted_finish_day = min(predicted_finish_day, ctx["days_in_month"])

    balance_risk = risk_from_balance(projected_month_end_balance, summary["allowance"])
    velocity_risk = min(round(max(velocity_ratio - 1, 0) * 45), 45)
    trend_risk = 12 if behavior_metrics["trend"] == "increasing" else 0
    protected_pressure = max(
        [
            100 - category["percentage_used"]
            for category in categories
            if get_category_priority(category["name"]) == "Protected" and category["percentage_used"] > 0
        ]
        or [0]
    )
    protected_pressure_risk = 12 if protected_pressure and protected_pressure < 35 else 0
    imbalance_risk = max([category_risk(category) for category in categories] or [0]) * 0.25
    risk_score = round(max(balance_risk, min(balance_risk + velocity_risk + trend_risk + protected_pressure_risk + imbalance_risk, 100)))
    status = status_from_risk(risk_score)

    category_predictions = []
    for category in categories:
        speed_sensitive = is_speed_sensitive_category(category["name"])
        daily_spend = category["spent_amount"] / ctx["elapsed_days"] if ctx["elapsed_days"] else 0
        safe_category_daily = category["remaining_amount"] / ctx["planning_days"] if category["remaining_amount"] > 0 else 0
        projected_spend = daily_spend * ctx["days_in_month"] if speed_sensitive else category["spent_amount"]
        projected_balance = category["planned_amount"] - projected_spend
        category_velocity = daily_spend / safe_category_daily if safe_category_daily > 0 else 0
        cat_risk = category_risk(category, category_velocity)
        category_trend = behavior_metrics["category_spend_trends"].get(category["name"], "stable")
        if category_trend == "increasing":
            cat_risk = min(cat_risk + 10, 100)
        elif category_trend == "decreasing":
            cat_risk = max(cat_risk - 5, 0)
        survival_status = status_from_risk(cat_risk)
        finish_day = None
        if speed_sensitive and daily_spend > 0 and projected_balance < 0:
            finish_day = max(int(category["planned_amount"] / daily_spend), ctx["today"].day)

        category_predictions.append(
            {
                "name": category["name"],
                "priority": get_category_priority(category["name"]),
                "spending_pattern": "Repeat-use" if speed_sensitive else "Monthly/one-off",
                "remaining_amount": round(category["remaining_amount"], 2),
                "safe_daily_spend": round(safe_category_daily, 2),
                "current_daily_spend": round(daily_spend, 2),
                "category_velocity": round(category_velocity, 2),
                "trend": category_trend,
                "projected_month_end_balance": round(projected_balance, 2),
                "survival_status": survival_status,
                "risk_score": cat_risk,
                "predicted_finish_day": finish_day,
            }
        )

    recommendations = build_recommendations(
        categories=categories,
        category_predictions=category_predictions,
        current_daily_spend=spending_velocity,
        safe_daily_spend=safe_daily_spend,
        projected_month_end_balance=projected_month_end_balance,
        behavior_metrics=behavior_metrics,
    )

    if predicted_finish_day:
        recommendations.insert(0, f"At your current repeat-use spending rate, your money may finish by day {predicted_finish_day}.")
    elif status == "SAFE":
        recommendations.insert(0, "Your money is projected to last until month end.")

    base = decision(
        status=status,
        confidence=confidence_from_behavior(behavior_metrics),
        reasoning="Budget health uses projected balance, spending velocity, category imbalance, protected-fund pressure, and spending trends.",
        recommendations=recommendations,
        metrics={
            "risk_score": risk_score,
            "spending_velocity": round(spending_velocity, 2),
            "avg_daily_spend": behavior_metrics["avg_daily_spend"],
            "trend": behavior_metrics["trend"],
            "data_points": behavior_metrics["data_points"],
            "velocity_ratio": round(velocity_ratio, 2),
            "projected_finish_day": predicted_finish_day,
            "category_spend_trends": behavior_metrics["category_spend_trends"],
            "repeat_spending_patterns": behavior_metrics["repeat_spending_patterns"],
        },
    )
    return {
        **base,
        "remaining_days": ctx["remaining_days"],
        "safe_daily_spend": round(safe_daily_spend, 2),
        "current_daily_spend": round(spending_velocity, 2),
        "projected_month_end_balance": round(projected_month_end_balance, 2),
        "predicted_money_finish_day": predicted_finish_day,
        "budget_health": status,
        "risk_score": risk_score,
        "spending_velocity": round(spending_velocity, 2),
        "avg_daily_spend": behavior_metrics["avg_daily_spend"],
        "trend": behavior_metrics["trend"],
        "category_spend_trends": behavior_metrics["category_spend_trends"],
        "repeat_spending_patterns": behavior_metrics["repeat_spending_patterns"],
        "spending_too_fast": spending_too_fast,
        "category_predictions": category_predictions,
    }


def build_recommendations(
    categories: list[dict],
    category_predictions: list[dict],
    current_daily_spend: float,
    safe_daily_spend: float,
    projected_month_end_balance: float,
    behavior_metrics: dict | None = None,
) -> list[str]:
    recommendations = []
    behavior_metrics = behavior_metrics or {}
    protected_pool = sum(c["remaining_amount"] for c in categories if get_category_priority(c["name"]) == "Protected" and c["remaining_amount"] > 0)

    for prediction in category_predictions:
        if prediction["priority"] != "Flexible" or prediction["survival_status"] == "SAFE":
            continue
        if prediction["spending_pattern"] == "Repeat-use":
            daily_reduction = max(prediction["current_daily_spend"] - prediction["safe_daily_spend"], 0)
            recommendations.append(
                f"You are spending {prediction['name']} too fast. Reduce {prediction['name']} by R{daily_reduction:.2f} per day."
            )
        elif prediction["remaining_amount"] < 0:
            recommendations.append(
                f"{prediction['name']} is over budget by R{abs(prediction['remaining_amount']):.2f}. Choose a cheaper item or remove one flexible expense."
            )

    if current_daily_spend > safe_daily_spend:
        recommendations.append(flexible_reduction_advice(current_daily_spend - safe_daily_spend))
    if projected_month_end_balance < 0:
        recommendations.append(flexible_reduction_advice(abs(projected_month_end_balance)))
    if behavior_metrics.get("trend") == "increasing":
        recommendations.append("Your spending trend is increasing. Slow repeat-use purchases this week to avoid future pressure.")
    if protected_pool > 0:
        recommendations.append("Keep Savings and Emergency protected unless there is a real emergency.")
    if not recommendations:
        recommendations.append("Keep tracking expenses and protect Savings, Emergency, and essential commitments.")
    return recommendations


def build_alerts(summary: dict, categories: list[dict], today: date | None = None, behavior: dict | None = None) -> list[dict]:
    alerts = []
    intelligence = build_budget_intelligence(summary, categories, today, behavior)
    for category in categories:
        cat_risk = category_risk(category)
        if category["remaining_amount"] < 0:
            alerts.append(
                {
                    "type": "danger",
                    "message": f"{category['name']} is over budget by R{abs(category['remaining_amount']):.2f}.",
                    **decision(
                        "DANGER",
                        intelligence["confidence"],
                        f"{category['name']} has exceeded its planned amount.",
                        [flexible_reduction_advice(abs(category["remaining_amount"]))],
                        {"risk_score": cat_risk, "category_velocity": 0, "trend": intelligence["category_spend_trends"].get(category["name"], "stable")},
                    ),
                }
            )
        elif category["percentage_used"] >= 75:
            status = status_from_risk(cat_risk)
            alerts.append(
                {
                    "type": status.lower(),
                    "message": f"{category['name']} has used {category['percentage_used']:.0f}% of its budget.",
                    **decision(
                        status,
                        0.78,
                        f"{category['name']} is nearing its planned limit.",
                        ["Avoid increasing protected or essential category pressure."],
                        {"risk_score": cat_risk, "category_velocity": 0},
                    ),
                }
            )

    snack = next((c for c in categories if c["name"].lower() == "snacks"), None)
    if snack and (today or date.today()).day < 15 and snack["percentage_used"] > 50:
        alerts.append(
            {
                "type": "warning",
                "message": "Warning: snacks are being spent too fast before the middle of the month.",
                **decision(
                    "WARNING",
                    0.84,
                    "Snacks are repeat-use spending and more than half the category is used before mid-month.",
                    ["Reduce Snacks first before touching Food, Savings, Emergency, or Mokhatlo."],
                    {"risk_score": 65, "spending_velocity": intelligence["spending_velocity"]},
                ),
            }
        )

    if not alerts:
        alerts.append(
            {
                "type": "safe",
                "message": "You are on track. Keep spending carefully.",
                **decision("SAFE", 0.8, "No category is over its warning threshold.", [], {"risk_score": intelligence["risk_score"]}),
            }
        )
    return alerts


def can_i_buy_decision(
    item_name: str,
    amount: float,
    category_name: str,
    remaining_money: float,
    category_remaining: float,
    category_spent: float,
    category_planned: float,
    today: date | None = None,
    behavior: dict | None = None,
) -> dict:
    behavior_metrics = behavior_summary(behavior)
    money_after_purchase = remaining_money - amount
    category_after_purchase = category_remaining - amount
    projected_percentage = ((category_spent + amount) / category_planned * 100) if category_planned else 100
    risk_score = max(risk_from_balance(money_after_purchase, remaining_money + category_spent), min(round(projected_percentage), 100))
    recommendations = []

    if get_category_priority(category_name) == "Protected":
        risk_score = 90
        recommendations.append("Do not spend from protected categories unless this is a real emergency.")
    if amount > remaining_money:
        risk_score = 100
        recommendations.append(flexible_reduction_advice(amount - remaining_money))
    if category_after_purchase < 0:
        risk_score = max(risk_score, 78)
        recommendations.append(f"Reduce {category_name} spending or choose a cheaper {item_name}.")
    if category_name.lower() == "snacks" and (today or date.today()).day < 15 and projected_percentage > 50:
        risk_score = max(risk_score, 65)
        recommendations.append("Snacks are being used too early. Reduce snack purchases for the rest of the month.")
    if behavior_metrics["category_spend_trends"].get(category_name) == "increasing":
        risk_score = min(risk_score + 8, 100)
        recommendations.append(f"{category_name} spending is increasing. Choose a smaller purchase or delay it.")

    status = status_from_risk(risk_score)
    approved = status != "DANGER"
    if amount > remaining_money or get_category_priority(category_name) == "Protected":
        approved = False

    if approved and status == "SAFE":
        advice = f"Approved, but spend carefully on {item_name}."
    elif approved:
        advice = f"Approved with warning: this purchase increases {category_name} risk."
    else:
        advice = "Rejected, this will break your budget or touch protected money."

    base = decision(
        status,
        confidence_from_behavior(behavior_metrics),
        f"Decision uses remaining money, {category_name} balance, priority, repeat-use timing, and spending trend.",
        recommendations,
        {
            "risk_score": risk_score,
            "trend": behavior_metrics["category_spend_trends"].get(category_name, "stable"),
            "avg_daily_spend": behavior_metrics["avg_daily_spend"],
            "money_after_purchase": round(money_after_purchase, 2),
            "category_after_purchase": round(category_after_purchase, 2),
            "projected_category_used": round(projected_percentage, 2),
        },
    )
    return {
        **base,
        "approved": approved,
        "money_after_purchase": round(money_after_purchase, 2),
        "category_after_purchase": round(category_after_purchase, 2),
        "advice": advice,
        "risk_score": risk_score,
    }


def preference_multiplier(level: str, low: float, medium: float, high: float) -> float:
    normalized = (level or "medium").strip().lower()
    if normalized == "low":
        return low
    if normalized == "high":
        return high
    return medium


def generate_monthly_plan(allowance: float, month: str, fixed_commitments: dict, user_preferences: dict, behavior: dict | None = None) -> dict:
    behavior_metrics = behavior_summary(behavior)
    protected = {
        "Econet Data": round(fixed_commitments.get("Econet Data", 0), 2),
        "Mokhatlo": round(fixed_commitments.get("Mokhatlo", 0), 2),
        "Savings": round(fixed_commitments.get("Savings", 0), 2),
    }
    emergency = max(round(allowance * 0.07, 2), 50 if allowance >= 800 else 0)
    protected["Emergency"] = emergency
    protected_total = sum(protected.values())
    flexible_pool = max(allowance - protected_total, 0)
    food_weight = preference_multiplier(user_preferences.get("food_priority"), 0.42, 0.5, 0.58)
    snack_weight = preference_multiplier(user_preferences.get("snack_level"), 0.08, 0.13, 0.18)
    cosmetics_weight = preference_multiplier(user_preferences.get("cosmetics_level"), 0.05, 0.1, 0.15)
    transport_weight = 0.08
    total_weight = food_weight + snack_weight + cosmetics_weight + transport_weight
    plan = {
        "Food": round(flexible_pool * food_weight / total_weight, 2),
        "Snacks": round(flexible_pool * snack_weight / total_weight, 2),
        "Cosmetics": round(flexible_pool * cosmetics_weight / total_weight, 2),
        "Transport": round(flexible_pool * transport_weight / total_weight, 2),
        **protected,
    }
    total_planned = round(sum(plan.values()), 2)
    if total_planned > allowance and plan["Transport"] > 0:
        plan["Transport"] = round(max(plan["Transport"] - (total_planned - allowance), 0), 2)
        total_planned = round(sum(plan.values()), 2)
    unallocated = round(allowance - total_planned, 2)
    risk_score = 15 if unallocated >= 0 else 92
    if protected_total > allowance:
        risk_score = 100
    status = status_from_risk(risk_score)
    recommendations = [
        "Savings and Emergency are protected first.",
        "Keep Mokhatlo and Econet Data stable as essential commitments.",
        "If money is tight, reduce Snacks first, then Cosmetics, then other flexible spending.",
    ]
    if unallocated > 0:
        recommendations.append(f"Keep R{unallocated:.2f} unallocated as a buffer.")
    if protected_total > allowance:
        recommendations.insert(0, "Fixed commitments exceed the allowance. Set flexible spending to R0 and review commitments.")
    base = decision(
        status,
        0.82,
        "Plan protects Savings and Emergency, then essentials, then flexible preferences and past spending behavior.",
        recommendations,
        {
            "risk_score": risk_score,
            "protected_total": round(protected_total, 2),
            "flexible_pool": round(flexible_pool, 2),
            "avg_daily_spend": behavior_metrics["avg_daily_spend"],
            "trend": behavior_metrics["trend"],
        },
    )
    return {
        **base,
        "month": month,
        "allowance": round(allowance, 2),
        "suggested_budget": plan,
        "total_planned": total_planned,
        "unallocated": unallocated,
        "risk_score": risk_score,
    }


def reduction_rank(item: dict) -> tuple[int, float]:
    normalized = item["category_name"].strip().lower()
    if normalized in REDUCTION_ORDER:
        priority = REDUCTION_ORDER[normalized]
    elif get_category_priority(item["category_name"]) == "Flexible":
        priority = 2
    elif get_category_priority(item["category_name"]) == "Essential":
        priority = 3
    else:
        priority = 4
    return (priority, -item["amount"])


def evaluate_shopping_list(items: list[dict], summary: dict, categories: list[dict], behavior: dict | None = None) -> dict:
    behavior_metrics = behavior_summary(behavior)
    total_cost = round(sum(item["amount"] for item in items), 2)
    category_lookup = {c["name"].lower(): c for c in categories}
    money_after_purchase = round(summary["remaining_money"] - total_cost, 2)
    category_impacts = []
    risk_score = risk_from_balance(money_after_purchase, summary["allowance"])

    for item in items:
        category = category_lookup.get(item["category_name"].lower())
        remaining_before = category["remaining_amount"] if category else 0
        remaining_after = round(remaining_before - item["amount"], 2)
        priority = get_category_priority(item["category_name"])
        impact_status = "SAFE"
        if priority == "Protected":
            impact_status = "PROTECTED"
            risk_score = max(risk_score, 92)
        elif remaining_after < 0:
            impact_status = "OVER_BUDGET"
            risk_score = max(risk_score, 78)
        if behavior_metrics["category_spend_trends"].get(item["category_name"]) == "increasing":
            risk_score = min(risk_score + 5, 100)
        category_impacts.append(
            {
                "item_name": item["item_name"],
                "category_name": item["category_name"],
                "amount": round(item["amount"], 2),
                "remaining_after": remaining_after,
                "status": impact_status,
                "priority": priority,
            }
        )

    status = status_from_risk(risk_score)
    approved = status != "DANGER"
    items_to_remove = []
    if not approved:
        running_money = money_after_purchase
        blocked_categories = {i["category_name"].lower() for i in category_impacts if i["status"] in {"OVER_BUDGET", "PROTECTED"}}
        for item in sorted(items, key=reduction_rank):
            if running_money < 0 or item["category_name"].lower() in blocked_categories:
                items_to_remove.append({"item_name": item["item_name"], "amount": round(item["amount"], 2), "category_name": item["category_name"]})
                running_money += item["amount"]
            if running_money >= 0 and not blocked_categories:
                break

    advice = "Approved. This list fits your remaining money and category limits." if approved else "Not affordable as-is. Remove Snacks first, then Cosmetics, then other flexible items. Do not reduce Savings or Emergency."
    recommendations = [] if approved else [flexible_reduction_advice(abs(min(money_after_purchase, 0)))]
    base = decision(
        status,
        confidence_from_behavior(behavior_metrics),
        "Shopping list risk checks affordability, category balances, protected funds, and category trends.",
        recommendations,
        {
            "risk_score": risk_score,
            "total_cost": total_cost,
            "money_after_purchase": money_after_purchase,
            "trend": behavior_metrics["trend"],
            "category_spend_trends": behavior_metrics["category_spend_trends"],
        },
    )
    return {
        **base,
        "total_cost": total_cost,
        "approved": approved,
        "money_after_purchase": money_after_purchase,
        "category_impacts": category_impacts,
        "items_to_remove_if_not_affordable": items_to_remove,
        "advice": advice,
        "risk_score": risk_score,
    }


def build_spending_timetable(categories: list[dict], behavior: dict | None = None) -> dict:
    behavior_metrics = behavior_summary(behavior)
    timetable = {}
    max_risk = 0
    for category in categories:
        if category["name"].lower() in {"food", "snacks"}:
            weekly_limit = round(category["remaining_amount"] / 4, 2) if category["remaining_amount"] > 0 else 0
            cat_risk = category_risk(category)
            max_risk = max(max_risk, cat_risk)
            timetable[category["name"]] = [
                {
                    "week": week,
                    "limit": weekly_limit,
                    "risk_score": cat_risk,
                    "trend": behavior_metrics["category_spend_trends"].get(category["name"], "stable"),
                }
                for week in range(1, 5)
            ]
    status = status_from_risk(max_risk)
    base = decision(
        status,
        confidence_from_behavior(behavior_metrics),
        "Timetable divides remaining Food and Snacks budgets into weekly limits using category trends.",
        ["Keep Snacks tighter than Food if money starts getting low."],
        {"risk_score": max_risk, "category_spend_trends": behavior_metrics["category_spend_trends"]},
    )
    return {
        **base,
        "timetable": timetable,
        "advice": "Use weekly limits for repeat planning. Keep Snacks tighter than Food if money starts getting low.",
        "risk_score": max_risk,
    }
