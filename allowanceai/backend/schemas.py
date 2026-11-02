from datetime import date, datetime
from typing import Optional, Annotated
from decimal import Decimal
from pydantic import AfterValidator
from finance import valid_money
MoneyInput = Annotated[Decimal, AfterValidator(valid_money)]

from pydantic import AliasChoices, BaseModel, Field, field_serializer


class MoneyResponse(BaseModel):
    @field_serializer('*', when_used='json')
    def exact_decimal(self, value):
        return format(value, 'f') if isinstance(value, Decimal) else value


class BudgetCreate(BaseModel):
    month: str = Field(..., pattern=r"^[1-9][0-9]{3}-(0[1-9]|1[0-2])$", examples=["2026-05"])
    allowance: MoneyInput = Field(..., ge=0)
    savings_target: MoneyInput = Field(0, ge=0)


class BudgetSummary(MoneyResponse):
    configured: bool = False
    month: str | None = None
    allowance: Decimal
    total_planned: Decimal
    total_spent: Decimal
    remaining_money: Decimal
    savings_target: Decimal
    budget_status: str


class CategoryCreate(BaseModel):
    month: str | None = Field(None, pattern=r"^[1-9][0-9]{3}-(0[1-9]|1[0-2])$")
    name: str = Field(..., min_length=1)
    planned_amount: MoneyInput = Field(..., ge=0)


class CategoryResponse(MoneyResponse):
    month: str | None = None
    allocation_origin: str | None = None
    id: int
    name: str
    planned_amount: Decimal
    spent_amount: Decimal
    remaining_amount: Decimal
    percentage_used: float
    status: str
    status_label: str | None = None

    class Config:
        from_attributes = True


class ExpenseCreate(BaseModel):
    operation_key: str | None = Field(None, min_length=8, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")
    item_name: str = Field(..., min_length=1)
    amount: MoneyInput = Field(..., gt=0)
    category_name: str = Field(..., min_length=1)
    expense_date: Optional[date] = None


class ExpenseResponse(MoneyResponse):
    purchase_event_id: int | None = None
    originating_item_id: int | None = None
    id: int
    item_name: str
    amount: Decimal
    category_name: str
    expense_date: date


class CanIBuyRequest(BaseModel):
    item_name: str = Field(..., min_length=1)
    amount: MoneyInput = Field(..., gt=0)
    category_name: str = Field(..., min_length=1)


class CanIBuyResponse(MoneyResponse):
    approved: bool
    money_after_purchase: Decimal
    category_after_purchase: Decimal
    advice: str
    status: str | None = None
    confidence: float | None = None
    reasoning: str | None = None
    recommendations: list[str] = []
    metrics: dict = {}
    risk_score: float | None = None


class FixedCommitments(BaseModel):
    data_bundles: MoneyInput = Field(
        0,
        ge=0,
        validation_alias=AliasChoices("Data Bundles", "Econet Data"),
        serialization_alias="Data Bundles",
    )
    mokhatlo: MoneyInput = Field(0, ge=0, alias="Mokhatlo")
    savings: MoneyInput = Field(0, ge=0, alias="Savings")


class UserPreferences(BaseModel):
    food_priority: str = "medium"
    snack_level: str = "medium"
    cosmetics_level: str = "medium"


class MonthlyPlanRequest(BaseModel):
    allowance: MoneyInput = Field(..., gt=0)
    month: str
    fixed_commitments: FixedCommitments
    user_preferences: UserPreferences


class ShoppingListItem(BaseModel):
    item_name: str = Field(..., min_length=1)
    amount: MoneyInput = Field(..., gt=0)
    category_name: str = Field(..., min_length=1)


class ShoppingListRequest(BaseModel):
    items: list[ShoppingListItem]


class ShoppingListItemCreate(BaseModel):
    item_name: str = Field(..., min_length=1)
    amount: MoneyInput = Field(..., gt=0)
    category_name: str = Field(..., min_length=1)


class ShoppingListItemResponse(MoneyResponse):
    id: int
    item_name: str
    amount: Decimal
    category_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class ShoppingListCreate(BaseModel):
    name: str = Field(..., min_length=1)
    items: list[ShoppingListItemCreate] = Field(..., min_length=1)


class ShoppingListUpdate(BaseModel):
    name: str | None = Field(None, min_length=1)
    items: list[ShoppingListItemCreate] | None = Field(None, min_length=1)


class ShoppingListResponse(MoneyResponse):
    id: int
    name: str
    total_cost: Decimal
    approved: bool
    advice: str
    created_at: datetime
    updated_at: datetime
    items: list[ShoppingListItemResponse] = []

    class Config:
        from_attributes = True


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
    role: str = "user"


class AdminUserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: str | None = None


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
