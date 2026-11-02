"""Shared item ledger. Monetary values in this module are Decimal / NUMERIC."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Date, DateTime, Numeric, ForeignKey, UniqueConstraint, CheckConstraint
from database import Base


class SpendingPlan(Base):
    __tablename__ = "spending_plans"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String(16), nullable=False)
    name = Column(String(160), nullable=False)
    month = Column(String(7), nullable=False, index=True)
    allowance = Column(Numeric(18, 2), nullable=False, default=0)
    reserved_savings = Column(Numeric(18, 2), nullable=False, default=0)
    version = Column(Integer, nullable=False, default=1)
    legacy_list_id = Column(Integer, ForeignKey("shopping_lists.id"), unique=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    __table_args__ = (
        CheckConstraint("kind IN ('monthly', 'shopping')", name="ck_plan_kind"),
        CheckConstraint("allowance >= 0 AND reserved_savings >= 0", name="ck_plan_money"),
    )


class PlannedItem(Base):
    __tablename__ = "planned_items"
    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, ForeignKey("spending_plans.id"), nullable=False, index=True)
    item_name = Column(String(160), nullable=False)
    description = Column(String(1000), nullable=False, default="")
    package_size = Column(Numeric(16, 3), nullable=False, default=1)
    measurement_unit = Column(String(16), nullable=False, default="each")
    package_type = Column(String(16), nullable=False, default="piece")
    quantity = Column(Numeric(16, 3), nullable=False)
    estimated_unit_price = Column(Numeric(18, 2), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True, index=True)
    category_source = Column(String(32), nullable=False, default="unresolved")
    suggested_category = Column(String(100), nullable=True)
    priority = Column(String(12), nullable=False, default="normal")
    planned_date = Column(Date, nullable=True)
    position = Column(Integer, nullable=False, default=0)
    state = Column(String(12), nullable=False, default="active")
    __table_args__ = (
        CheckConstraint("quantity > 0 AND package_size > 0 AND estimated_unit_price >= 0", name="ck_item_values"),
        CheckConstraint("state IN ('active', 'skipped', 'cancelled')", name="ck_item_state"),
    )


class CategoryPreference(Base):
    __tablename__ = "category_preferences"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    product_key = Column(String(200), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    __table_args__ = (UniqueConstraint("user_id", "product_key", name="uq_category_preference"),)


class PurchaseEvent(Base):
    __tablename__ = "purchase_events"
    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, ForeignKey("spending_plans.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    idempotency_key = Column(String(100), nullable=False)
    request_hash = Column(String(64), nullable=False)
    purchase_date = Column(Date, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key", name="uq_purchase_request"),)


class PurchaseLine(Base):
    __tablename__ = "purchase_lines"
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("purchase_events.id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("planned_items.id"), nullable=False, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=False, unique=True)
    quantity = Column(Numeric(16, 3), nullable=False)
    actual_unit_price = Column(Numeric(18, 2), nullable=False)
    estimated_unit_price = Column(Numeric(18, 2), nullable=False)
    total = Column(Numeric(18, 2), nullable=False)
    # Immutable snapshots survive later edits to the plan or category name.
    item_name = Column(String(160), nullable=False)
    category_name = Column(String(160), nullable=False)
    package_description = Column(String(200), nullable=False)
    __table_args__ = (
        UniqueConstraint("event_id", "item_id", name="uq_purchase_event_item"),
        CheckConstraint("quantity > 0 AND actual_unit_price > 0 AND total > 0", name="ck_purchase_values"),
    )
