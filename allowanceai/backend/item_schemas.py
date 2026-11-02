from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator

Money = Decimal
UNITS = Literal['each', 'kg', 'g', 'l', 'ml', 'm', 'hour']
PACKAGES = Literal['piece', 'bag', 'bottle', 'box', 'pack', 'carton', 'loose', 'service']


class StrictInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

    @field_validator('*', mode='after')
    @classmethod
    def finite_decimal(cls, value):
        if isinstance(value, Decimal) and not value.is_finite():
            raise ValueError('Non-finite financial values are not supported.')
        return value


class PlanInput(StrictInput):
    kind: Literal['monthly', 'shopping']
    name: str = Field(min_length=1, max_length=160)
    month: str = Field(pattern=r'^[1-9][0-9]{3}-(0[1-9]|1[0-2])$')
    allowance: Decimal = Field(default=Decimal(0), ge=0, max_digits=16, decimal_places=2)
    reserved_savings: Decimal = Field(default=Decimal(0), ge=0, max_digits=16, decimal_places=2)


class PlanUpdate(PlanInput):
    version: int = Field(ge=1)


class ItemInput(StrictInput):
    item_name: str = Field(min_length=1, max_length=160)
    description: str = Field(default='', max_length=1000)
    package_size: Decimal = Field(default=Decimal(1), gt=0, max_digits=12, decimal_places=3)
    measurement_unit: UNITS = 'each'
    package_type: PACKAGES = 'piece'
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=3)
    estimated_unit_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    category_id: int | None = Field(default=None, ge=1)
    category_name: str | None = Field(default=None, min_length=1, max_length=160)
    priority: Literal['essential', 'normal', 'optional'] = 'normal'
    planned_date: date | None = None
    state: Literal['active', 'skipped', 'cancelled'] = 'active'

    @model_validator(mode='after')
    def quantity_unit(self):
        fractional = self.package_type in {'loose', 'service'} and self.measurement_unit != 'each'
        if not fractional and self.quantity != self.quantity.to_integral_value():
            raise ValueError('Packaged items require a whole number of packages. Use loose/service for measured quantities.')
        if self.category_id and self.category_name:
            raise ValueError('Choose an existing category or a new category name, not both.')
        if self.package_type == 'loose' and self.package_size != 1:
            raise ValueError('Loose items are priced per measurement unit; package size must be 1.')
        return self


class ItemBatch(StrictInput):
    version: int = Field(ge=1)
    items: list[ItemInput] = Field(min_length=1)


class ItemUpdate(ItemInput):
    version: int = Field(ge=1)


class VersionInput(StrictInput):
    version: int = Field(ge=1)


class ReorderInput(VersionInput):
    item_ids: list[int]


class PurchaseSelection(StrictInput):
    item_id: int = Field(ge=1)
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=3)
    actual_unit_price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class PurchaseInput(VersionInput):
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r'^[A-Za-z0-9_-]+$')
    purchase_date: date
    items: list[PurchaseSelection] = Field(min_length=1)

    @model_validator(mode='after')
    def distinct_items(self):
        if len({item.item_id for item in self.items}) != len(self.items):
            raise ValueError('Select each item once.')
        if self.purchase_date > date.today():
            raise ValueError('Actual purchases cannot have a future date.')
        return self


class SuggestionInput(StrictInput):
    item_name: str = Field(min_length=1, max_length=160)
    description: str = Field(default='', max_length=1000)
