from typing import Literal
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import auth
import item_schemas as schemas
import item_service as service
import category_engine
from database import get_db

router = APIRouter(prefix='/api', dependencies=[])


@router.post('/items/suggest-category')
def suggest_category(data: schemas.SuggestionInput, db: Session = Depends(get_db), user=Depends(auth.get_current_user)):
    return category_engine.suggest(db, user, data.item_name, data.description)


@router.get('/items/taxonomy')
def taxonomy(user=Depends(auth.get_current_user)):
    return {'version': category_engine.TAXONOMY_VERSION, 'classifier': 'deterministic',
            'categories': [{'name': row[0], 'parent': row[1], 'products': row[3]} for row in category_engine.TAXONOMY]}


@router.get('/plans')
def list_plans(kind: Literal['monthly', 'shopping'] | None = None, db: Session = Depends(get_db), user=Depends(auth.get_current_user)):
    return service.list_plans(db, user, kind)


@router.post('/plans')
def create_plan(data: schemas.PlanInput, db: Session = Depends(get_db), user=Depends(auth.get_current_user)):
    return service.create_plan(db, user, data)


@router.get('/plans/{plan_id}')
def get_plan(plan_id: int, db: Session = Depends(get_db), user=Depends(auth.get_current_user)):
    return service.serialize(db, user, service.owned_plan(db, user, plan_id))


@router.put('/plans/{plan_id}')
def update_plan(plan_id: int, data: schemas.PlanUpdate, db: Session = Depends(get_db), user=Depends(auth.get_current_user)):
    return service.update_plan(db, user, plan_id, data)


@router.post('/plans/{plan_id}/items')
def add_items(plan_id: int, data: schemas.ItemBatch, db: Session = Depends(get_db), user=Depends(auth.get_current_user)):
    return service.add_items(db, user, plan_id, data)


@router.put('/plans/{plan_id}/items/{item_id}')
def update_item(plan_id: int, item_id: int, data: schemas.ItemUpdate, db: Session = Depends(get_db), user=Depends(auth.get_current_user)):
    return service.update_item(db, user, plan_id, item_id, data)


@router.delete('/plans/{plan_id}/items/{item_id}')
def remove_item(plan_id: int, item_id: int, data: schemas.VersionInput, db: Session = Depends(get_db), user=Depends(auth.get_current_user)):
    return service.remove_item(db, user, plan_id, item_id, data.version)


@router.post('/plans/{plan_id}/reorder')
def reorder(plan_id: int, data: schemas.ReorderInput, db: Session = Depends(get_db), user=Depends(auth.get_current_user)):
    return service.reorder(db, user, plan_id, data)


@router.post('/plans/{plan_id}/purchase-preview')
def preview(plan_id: int, data: schemas.PurchaseInput, db: Session = Depends(get_db), user=Depends(auth.get_current_user)):
    return service.preview_purchase(db, user, plan_id, data)


@router.post('/plans/{plan_id}/purchases')
def confirm(plan_id: int, data: schemas.PurchaseInput, db: Session = Depends(get_db), user=Depends(auth.get_current_user)):
    return service.confirm_purchase(db, user, plan_id, data)


@router.post('/plans/{plan_id}/apply-budget')
def apply(plan_id: int, data: schemas.VersionInput, db: Session = Depends(get_db), user=Depends(auth.get_current_user)):
    return service.apply_budget(db, user, plan_id, data.version)


@router.post('/shopping-lists/{list_id}/import-items')
def import_legacy(list_id: int, db: Session = Depends(get_db), user=Depends(auth.get_current_user)):
    return service.import_legacy(db, user, list_id)
