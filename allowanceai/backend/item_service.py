"""One write transaction per action; no helper commits during confirmation.

PostgreSQL locks the authenticated user's row before any ledger mutation. This
serializes confirmation/edit/apply operations across plans for that user, while
allowing different users to operate independently. Unique keys remain the final
idempotency safeguard. Version checks reject stale editors.
"""
from collections import defaultdict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from functools import wraps
import hashlib
import json
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
import models
import item_models as im
import category_engine
from finance import financial_write, MAX_MONEY

ZERO = Decimal('0')
CENT = Decimal('0.01')


def decimal(value):
    return Decimal(str(value or 0))


def money(value):
    return decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def text(value):
    return format(money(value), '.2f')


atomic = financial_write


def owned_plan(db, user, plan_id, version=None):
    plan = db.query(im.SpendingPlan).filter_by(id=plan_id, user_id=user.id).populate_existing().first()
    if not plan:
        raise HTTPException(404, 'Plan not found.')
    if version is not None and plan.version != version:
        raise HTTPException(409, 'This plan changed. Reload before continuing.')
    return plan


def owned_item(db, plan, item_id):
    item = db.query(im.PlannedItem).filter_by(id=item_id, plan_id=plan.id).first()
    if not item:
        raise HTTPException(404, 'Item not found.')
    return item


def purchased(db, item_id):
    return decimal(db.query(func.coalesce(func.sum(im.PurchaseLine.quantity), 0)).filter_by(item_id=item_id).scalar())


def serialize(db, user, plan):
    items = db.query(im.PlannedItem).filter_by(plan_id=plan.id).order_by(im.PlannedItem.position, im.PlannedItem.id).all()
    events = db.query(im.PurchaseEvent).filter_by(plan_id=plan.id, user_id=user.id).order_by(im.PurchaseEvent.id.desc()).all()
    lines = db.query(im.PurchaseLine).join(im.PurchaseEvent).filter(im.PurchaseEvent.plan_id == plan.id, im.PurchaseEvent.user_id == user.id).all()
    categories = {c.id: c for c in db.query(models.Category).filter_by(user_id=user.id)}
    by_item, by_event = defaultdict(list), defaultdict(list)
    for line in lines:
        by_item[line.item_id].append(line)
        by_event[line.event_id].append(line)
    totals = defaultdict(lambda: {'planned': ZERO, 'actual': ZERO})
    rows, planned, actual, pending_estimate = [], ZERO, ZERO, ZERO
    for item in items:
        quantity = sum((decimal(line.quantity) for line in by_item[item.id]), ZERO)
        spent = sum((line.total for line in by_item[item.id]), ZERO)
        remaining = max(ZERO, item.quantity - quantity)
        active = item.state == 'active'
        estimate = money(item.quantity * item.estimated_unit_price) if active else ZERO
        pending = money(remaining * item.estimated_unit_price) if active else ZERO
        category = categories.get(item.category_id)
        name = category.name if category else 'Needs review'
        totals[name]['planned'] += estimate
        # Actual group names use immutable purchase snapshots, even after item edits.
        for line in by_item[item.id]:
            totals[line.category_name]['actual'] += line.total
        planned += estimate
        actual += spent
        pending_estimate += pending
        status = item.state if not active else ('purchased' if remaining == 0 else 'partial' if quantity else 'pending')
        rows.append({
            'id': item.id, 'item_name': item.item_name, 'description': item.description,
            'package_size': str(item.package_size), 'measurement_unit': item.measurement_unit, 'package_type': item.package_type,
            'quantity': str(item.quantity), 'estimated_unit_price': text(item.estimated_unit_price),
            'planned_total': text(money(item.quantity * item.estimated_unit_price)),
            'category_id': item.category_id, 'category_name': category.name if category else None,
            'category_source': item.category_source, 'suggested_category': item.suggested_category,
            'priority': item.priority, 'planned_date': item.planned_date, 'position': item.position, 'state': item.state,
            'purchased_quantity': str(quantity), 'remaining_quantity': str(remaining), 'actual_total': text(spent), 'status': status,
        })
    history = []
    for event in events:
        event_lines = by_event[event.id]
        history.append({'id': event.id, 'purchase_date': event.purchase_date, 'created_at': event.created_at,
                        'total': text(sum((line.total for line in event_lines), ZERO)),
                        'items': [{'item_id': line.item_id, 'item_name': line.item_name, 'category_name': line.category_name,
                                   'package_description': line.package_description, 'quantity': str(line.quantity),
                                   'actual_unit_price': text(line.actual_unit_price), 'total': text(line.total), 'expense_id': line.expense_id}
                                  for line in event_lines]})
    estimated_purchased = sum((money(line.quantity * line.estimated_unit_price) for line in lines), ZERO)
    original_remaining = plan.allowance - plan.reserved_savings - planned
    remaining = plan.allowance - plan.reserved_savings - actual - pending_estimate
    return {'id': plan.id, 'kind': plan.kind, 'name': plan.name, 'month': plan.month,
            'allowance': text(plan.allowance), 'reserved_savings': text(plan.reserved_savings), 'version': plan.version,
            'legacy_list_id': plan.legacy_list_id, 'items': rows, 'purchases': history,
            'summary': {'planned_expenditure': text(planned), 'actual_expenditure': text(actual),
                        'pending_estimate': text(pending_estimate), 'expected_remaining': text(remaining),
                        'remaining_after_purchases_and_savings': text(plan.allowance - plan.reserved_savings - actual),
                        'purchased_price_variance': text(actual - estimated_purchased),
                        'original_plan_remaining': text(original_remaining),
                        'over_allocated': remaining < 0,
                        'categories': [{'name': name, 'planned': text(value['planned']), 'actual': text(value['actual'])}
                                       for name, value in sorted(totals.items())]}}


def list_plans(db, user, kind=None):
    query = db.query(im.SpendingPlan).filter_by(user_id=user.id)
    if kind:
        query = query.filter_by(kind=kind)
    return [serialize(db, user, plan) for plan in query.order_by(im.SpendingPlan.id.desc())]


@atomic
def create_plan(db, user, data):
    plan = im.SpendingPlan(user_id=user.id, **data.model_dump())
    db.add(plan)
    db.flush()
    return serialize(db, user, plan)


@atomic
def update_plan(db, user, plan_id, data):
    plan = owned_plan(db, user, plan_id, data.version)
    if data.kind != plan.kind:
        raise HTTPException(422, 'Plan type cannot change.')
    for key, value in data.model_dump(exclude={'version'}).items():
        setattr(plan, key, value)
    plan.version += 1
    db.flush()
    return serialize(db, user, plan)


def set_item(db, user, item, data):
    values = data.model_dump(exclude={'version', 'category_id', 'category_name'})
    if item.id and purchased(db, item.id):
        # A past purchase cannot change its product or category identity via editing.
        for key in ['item_name', 'description', 'package_size', 'measurement_unit', 'package_type']:
            if getattr(item, key) != values[key]:
                raise HTTPException(409, 'Purchased product details are immutable. Add another item for a different product.')
        if data.category_name or (data.category_id and data.category_id != item.category_id):
            raise HTTPException(409, 'A purchased item cannot be recategorized. Its audit history is retained.')
        if data.quantity < purchased(db, item.id):
            raise HTTPException(409, 'Planned quantity cannot be less than the quantity already purchased.')
    preserve_manual = item.id and item.category_source == 'manual' and not data.category_id and not data.category_name
    if not preserve_manual and not (item.id and purchased(db, item.id)):
        category, source, suggestion = category_engine.assign(db, user, data)
        item.category_id = category.id if category else None
        item.category_source, item.suggested_category = source, suggestion
    for key, value in values.items():
        setattr(item, key, value)


@atomic
def add_items(db, user, plan_id, data):
    plan = owned_plan(db, user, plan_id, data.version)
    position = db.query(func.coalesce(func.max(im.PlannedItem.position), -1)).filter_by(plan_id=plan.id).scalar() + 1
    for index, entry in enumerate(data.items):
        item = im.PlannedItem(plan_id=plan.id, position=position + index)
        set_item(db, user, item, entry)
        db.add(item)
    plan.version += 1
    db.flush()
    return serialize(db, user, plan)


@atomic
def update_item(db, user, plan_id, item_id, data):
    plan = owned_plan(db, user, plan_id, data.version)
    item = owned_item(db, plan, item_id)
    set_item(db, user, item, data)
    plan.version += 1
    db.flush()
    return serialize(db, user, plan)


@atomic
def remove_item(db, user, plan_id, item_id, version):
    plan = owned_plan(db, user, plan_id, version)
    item = owned_item(db, plan, item_id)
    if purchased(db, item.id):
        raise HTTPException(409, 'Purchased items must be cancelled rather than removed; history is preserved.')
    db.delete(item)
    plan.version += 1
    db.flush()
    return serialize(db, user, plan)


@atomic
def reorder(db, user, plan_id, data):
    plan = owned_plan(db, user, plan_id, data.version)
    items = db.query(im.PlannedItem).filter_by(plan_id=plan.id).all()
    if len(data.item_ids) != len(set(data.item_ids)) or set(data.item_ids) != {item.id for item in items}:
        raise HTTPException(422, 'Provide every item in this plan exactly once.')
    positions = {item_id: index for index, item_id in enumerate(data.item_ids)}
    for item in items:
        item.position = positions[item.id]
    plan.version += 1
    db.flush()
    return serialize(db, user, plan)


def request_hash(plan_id, data):
    payload = {'plan_id': plan_id, 'date': str(data.purchase_date),
               'items': sorted([{'id': row.item_id, 'quantity': str(row.quantity.normalize()), 'price': text(row.actual_unit_price)}
                                for row in data.items], key=lambda row: row['id'])}
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def prepare_purchase(db, user, plan, data):
    rows = []
    for selection in data.items:
        item = owned_item(db, plan, selection.item_id)
        if item.state != 'active':
            raise HTTPException(409, 'Skipped or cancelled items cannot be purchased. Reopen them first.')
        fractional = item.package_type in {'loose', 'service'} and item.measurement_unit != 'each'
        if not fractional and selection.quantity != selection.quantity.to_integral_value():
            raise HTTPException(422, 'Purchase a whole number of packages.')
        if selection.quantity > item.quantity - purchased(db, item.id):
            raise HTTPException(409, 'Purchase quantity exceeds the remaining planned quantity.')
        category = db.query(models.Category).filter_by(id=item.category_id, user_id=user.id).first()
        if not category:
            raise HTTPException(422, f'Choose a category for {item.item_name} before purchasing.')
        total = money(selection.quantity * selection.actual_unit_price)
        if total <= 0 or total >= Decimal('10000000000000000'):
            raise HTTPException(422, 'The purchase total is outside the supported monetary range.')
        rows.append((item, selection, category, total))
    return rows


def preview_purchase(db, user, plan_id, data):
    plan = owned_plan(db, user, plan_id, data.version)
    rows = prepare_purchase(db, user, plan, data)
    return {'total': text(sum((row[3] for row in rows), ZERO)),
            'items': [{'item_name': item.item_name, 'quantity': str(selection.quantity), 'total': text(total)}
                      for item, selection, category, total in rows]}


@atomic
def confirm_purchase(db, user, plan_id, data):
    fingerprint = request_hash(plan_id, data)
    event = db.query(im.PurchaseEvent).filter_by(user_id=user.id, idempotency_key=data.idempotency_key).first()
    if event:
        if event.request_hash != fingerprint:
            raise HTTPException(409, 'This confirmation key was already used for a different purchase.')
        return {'event_id': event.id, 'replayed': True, 'plan': serialize(db, user, owned_plan(db, user, plan_id))}
    plan = owned_plan(db, user, plan_id, data.version)
    rows = prepare_purchase(db, user, plan, data)
    event = im.PurchaseEvent(plan_id=plan.id, user_id=user.id, idempotency_key=data.idempotency_key,
                             request_hash=fingerprint, purchase_date=data.purchase_date)
    db.add(event)
    db.flush()
    for item, selection, category, total in rows:
        expense = models.Expense(user_id=user.id, item_name=item.item_name, category_id=category.id,
                                 amount=total, expense_date=data.purchase_date)
        db.add(expense)
        db.flush()
        db.add(im.PurchaseLine(event_id=event.id, item_id=item.id, expense_id=expense.id,
                              quantity=selection.quantity, actual_unit_price=selection.actual_unit_price,
                              estimated_unit_price=item.estimated_unit_price, total=total, item_name=item.item_name,
                              category_name=category.name,
                              package_description=f'{item.package_size} {item.measurement_unit} {item.package_type}'))
    plan.version += 1
    db.flush()
    # Rebuild the existing derived analytics in this SAME transaction.
    import crud
    crud.rebuild_behavior_tracking(db, user, commit=False)
    db.flush()
    return {'event_id': event.id, 'replayed': False, 'plan': serialize(db, user, plan)}


@atomic
def apply_budget(db, user, plan_id, version):
    plan = owned_plan(db, user, plan_id, version)
    if plan.kind != 'monthly':
        raise HTTPException(422, 'Only a monthly plan can apply budget allocations.')
    items = db.query(im.PlannedItem).filter_by(plan_id=plan.id, state='active').all()
    totals = defaultdict(lambda: ZERO)
    for item in items:
        if not item.category_id:
            raise HTTPException(422, 'Resolve all active item categories before applying allocations.')
        category = db.query(models.Category).filter_by(id=item.category_id, user_id=user.id).first()
        if not category:
            raise HTTPException(404, 'Category not found.')
        totals[category.id] += money(item.quantity * item.estimated_unit_price)
    import crud
    budget = crud.get_current_budget(db, user, plan.month)
    if not budget:
        budget = models.Budget(user_id=user.id, month=plan.month)
        db.add(budget)
    budget.allowance, budget.savings_target = plan.allowance, plan.reserved_savings
    for category_id, total in totals.items():
        category = db.query(models.Category).filter_by(id=category_id, user_id=user.id).one()
        crud.set_allocation(db, user, category, plan.month, total)
    plan.version += 1
    db.flush()
    return {'plan': serialize(db, user, plan), 'message': 'Budget saved for this month only. Included category allocations were replaced; other allocations for this month were retained. No expenses created.'}


@atomic
def import_legacy(db, user, list_id):
    legacy = db.query(models.ShoppingList).filter_by(id=list_id, user_id=user.id).first()
    if not legacy:
        raise HTTPException(404, 'Shopping list not found.')
    plan = db.query(im.SpendingPlan).filter_by(legacy_list_id=list_id, user_id=user.id).first()
    if plan:
        return serialize(db, user, plan)
    plan = im.SpendingPlan(user_id=user.id, kind='shopping', name=legacy.name, month=date.today().strftime('%Y-%m'),
                           allowance=0, reserved_savings=0, legacy_list_id=legacy.id)
    db.add(plan)
    db.flush()
    for position, old in enumerate(legacy.items):
        category = category_engine.get_or_create_category(db, user, old.category_name)
        db.add(im.PlannedItem(plan_id=plan.id, item_name=old.item_name, quantity=1, package_size=1,
                              measurement_unit='each', package_type='piece', estimated_unit_price=money(old.amount),
                              category_id=category.id, category_source='legacy', suggested_category=category.name,
                              position=position))
    db.flush()
    return serialize(db, user, plan)
