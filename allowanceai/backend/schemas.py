from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class BudgetCreate(BaseModel):
    month: str = Field(..., examples=["2026-05"])
    allowance: float = Field(..., gt=0)
    savings_target: float = Field(0, ge=0)


class BudgetSummary(BaseModel):
    allowance: float
    total_planned: float
    total_spent: float
    remaining_money: float
    savings_target: float
    budget_status: str


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1)
    planned_amount: float = Field(..., ge=0)


class CategoryResponse(BaseModel):
    id: int
    name: str
    planned_amount: float
    spent_amount: float
    remaining_amount: float
    percentage_used: float
    status: str

    class Config:
        from_attributes = True


class ExpenseCreate(BaseModel):
    item_name: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    category_name: str = Field(..., min_length=1)
    expense_date: Optional[date] = None


class ExpenseResponse(BaseModel):
    id: int
    item_name: str
    amount: float
    category_name: str
    expense_date: date


class CanIBuyRequest(BaseModel):
    item_name: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    category_name: str = Field(..., min_length=1)


class CanIBuyResponse(BaseModel):
    approved: bool
    money_after_purchase: float
    category_after_purchase: float
    advice: str
    status: str | None = None
    confidence: float | None = None
    reasoning: str | None = None
    recommendations: list[str] = []
    metrics: dict = {}
    risk_score: float | None = None


class FixedCommitments(BaseModel):
    econet_data: float = Field(0, ge=0, alias="Econet Data")
    mokhatlo: float = Field(0, ge=0, alias="Mokhatlo")
    savings: float = Field(0, ge=0, alias="Savings")


class UserPreferences(BaseModel):
    food_priority: str = "medium"
    snack_level: str = "medium"
    cosmetics_level: str = "medium"


class MonthlyPlanRequest(BaseModel):
    allowance: float = Field(..., gt=0)
    month: str
    fixed_commitments: FixedCommitments
    user_preferences: UserPreferences


class ShoppingListItem(BaseModel):
    item_name: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    category_name: str = Field(..., min_length=1)


class ShoppingListRequest(BaseModel):
    items: list[ShoppingListItem]


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: str
    password: str


class UserProfileUpdate(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)


class PasswordUpdate(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


class UserResponse(BaseModel):
    id: int
    name: str
    email: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
