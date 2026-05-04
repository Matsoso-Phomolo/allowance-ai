from datetime import date

from sqlalchemy.orm import Session

import models


DEFAULT_CATEGORIES = [
    ("Food", 500),
    ("Snacks", 200),
    ("Cosmetics", 150),
    ("Econet Data", 250),
    ("Mokhatlo", 200),
    ("Savings", 100),
    ("Emergency", 100),
]


def seed_default_data(db: Session, user_id: int = 1):
    if db.query(models.Budget).filter(models.Budget.user_id == user_id).count() == 0:
        current_month = date.today().strftime("%Y-%m")
        db.add(models.Budget(month=current_month, allowance=1500, savings_target=100, user_id=user_id))

    if db.query(models.Category).filter(models.Category.user_id == user_id).count() == 0:
        for name, amount in DEFAULT_CATEGORIES:
            db.add(models.Category(name=name, planned_amount=amount, user_id=user_id))

    db.commit()
