from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from datetime import datetime

from database import Base


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(String, nullable=False, index=True)
    allowance = Column(Float, nullable=False)
    savings_target = Column(Float, nullable=False, default=0)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, default=1)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    planned_amount = Column(Float, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, default=1)

    expenses = relationship("Expense", back_populates="category")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    expense_date = Column(Date, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, default=1)

    category = relationship("Category", back_populates="expenses")


class DailySpendingLog(Base):
    __tablename__ = "daily_spending_log"

    id = Column(Integer, primary_key=True, index=True)
    spending_date = Column(Date, nullable=False, index=True)
    total_amount = Column(Float, nullable=False, default=0)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, default=1)


class CategoryDailyTotal(Base):
    __tablename__ = "category_daily_totals"

    id = Column(Integer, primary_key=True, index=True)
    spending_date = Column(Date, nullable=False, index=True)
    category_name = Column(String, nullable=False, index=True)
    total_amount = Column(Float, nullable=False, default=0)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, default=1)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, nullable=False, default="info")
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
