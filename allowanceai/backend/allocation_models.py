"""Month-scoped category allocations; legacy Category.planned_amount is archival."""
from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, UniqueConstraint, CheckConstraint
from database import Base


class CategoryAllocation(Base):
    __tablename__ = 'category_allocations'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey('categories.id'), nullable=False, index=True)
    month = Column(String(7), nullable=False, index=True)
    amount = Column(Numeric(), nullable=False)
    origin = Column(String(32), nullable=False, default='explicit')
    __table_args__ = (
        UniqueConstraint('user_id', 'category_id', 'month', name='uq_category_month_allocation'),
        CheckConstraint('amount >= 0', name='ck_category_allocation_amount'),
    )


class ExpenseOperation(Base):
    __tablename__ = 'expense_operations'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    operation_key = Column(String(100), nullable=False)
    request_hash = Column(String(64), nullable=False)
    response_json = Column(String, nullable=False)
    __table_args__ = (UniqueConstraint('user_id', 'operation_key', name='uq_manual_expense_operation'),)
