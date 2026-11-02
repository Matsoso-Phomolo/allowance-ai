"""Versioned deterministic taxonomy. Suggestions never claim external AI certainty."""
import re
import unicodedata
from sqlalchemy import func
import models
from item_models import CategoryPreference

TAXONOMY_VERSION = '2026-10-30'
TAXONOMY = [
    ('Groceries', 'Essential living', ['food', 'groceries'], ['rice', 'bread', 'milk', 'maize meal', 'papa', 'flour', 'eggs', 'beans', 'lentils', 'cooking oil', 'sugar', 'salt', 'vegetables', 'potatoes', 'chicken', 'beef', 'apples', 'cabbage']),
    ('Transport', 'Essential living', ['transport', 'travel'], ['taxi', 'bus fare', 'petrol', 'fuel', 'commute', 'taxi fare']),
    ('Housing', 'Essential living', ['housing', 'rent'], ['rent', 'lodging', 'accommodation']),
    ('Utilities', 'Essential living', ['utilities', 'electricity', 'water'], ['electricity', 'water bill', 'lec', 'gas refill']),
    ('Data Bundles', 'Connectivity', ['data bundles', 'econet data', 'airtime', 'connectivity'], ['airtime', 'data bundle', 'data bundles', 'econet', 'vodacom', 'wifi', 'internet']),
    ('Mokhatlo', 'Community commitments', ['mokhatlo', 'stokvel'], ['mokhatlo', 'stokvel', 'rotating savings club']),
    ('Family support', 'Community commitments', ['family support', 'remittances'], ['family support', 'remittance', 'funeral contribution']),
    ('Healthcare', 'Wellbeing', ['healthcare', 'medical'], ['medicine', 'clinic', 'doctor', 'pharmacy', 'prescription']),
    ('Education', 'Development', ['education', 'school'], ['school fees', 'tuition', 'textbook', 'stationery', 'exam fees']),
    ('Personal care', 'Wellbeing', ['personal care', 'cosmetics', 'toiletries'], ['soap', 'toothpaste', 'shampoo', 'lotion', 'deodorant', 'sanitary pads', 'haircut']),
    ('Household', 'Essential living', ['household', 'cleaning'], ['detergent', 'dishwashing', 'cleaning', 'toilet paper']),
    ('Clothing', 'Personal', ['clothing', 'clothes'], ['shirt', 'shoes', 'trousers', 'jacket', 'uniform']),
    ('Entertainment', 'Discretionary', ['entertainment', 'leisure'], ['cinema', 'netflix', 'concert', 'game subscription']),
    ('Debt repayments', 'Financial commitments', ['debt repayments', 'debt'], ['loan repayment', 'debt repayment', 'credit repayment']),
    ('Financial fees', 'Financial commitments', ['financial fees', 'bank fees'], ['bank fee', 'transaction fee', 'mpesa fee', 'ecocash fee']),
    ('Agriculture', 'Livelihood', ['agriculture', 'farming'], ['seeds', 'fertilizer', 'fertiliser', 'animal feed']),
]


def normalize(value):
    return re.sub(r'[^a-z0-9]+', ' ', unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower()).strip()


def contains(text, phrase):
    return f' {normalize(phrase)} ' in f' {text} '


def suggest(db, user, name, description=''):
    text = normalize(f'{name} {description}')
    categories = db.query(models.Category).filter(models.Category.user_id == user.id).order_by(models.Category.id).all()
    # An explicitly named existing category is the most direct signal.
    named = [c for c in categories if contains(text, c.name)]
    if len(named) == 1:
        return result(named[0].name, named[0].id, 'existing_category', 'high')
    preference = db.query(CategoryPreference).filter_by(user_id=user.id, product_key=normalize(name)).first()
    if preference:
        category = next((c for c in categories if c.id == preference.category_id), None)
        if category:
            return result(category.name, category.id, 'confirmed_preference', 'high')
    matches = [entry for entry in TAXONOMY if any(contains(text, word) for word in entry[3])]
    if len(matches) == 1:
        canonical, parent, aliases, _ = matches[0]
        category = next((c for c in categories if normalize(c.name) in [normalize(a) for a in aliases]), None)
        return {**result(category.name if category else canonical, category.id if category else None, 'dictionary', 'high'), 'parent': parent}
    return {**result(None, None, 'ambiguous' if matches or len(named) > 1 else 'unrecognized', 'needs_review'),
            'alternatives': sorted({m[0] for m in matches} | {c.name for c in named})}


def result(name, category_id, source, confidence):
    return {'category_name': name, 'category_id': category_id, 'source': source, 'confidence': confidence,
            'new_category_recommended': bool(name and not category_id), 'taxonomy_version': TAXONOMY_VERSION}


def get_or_create_category(db, user, name):
    # All callers hold the per-user write lock, avoiding redundant auto categories.
    key = normalize(name)
    existing = next((c for c in db.query(models.Category).filter_by(user_id=user.id) if normalize(c.name) == key), None)
    if existing:
        return existing
    category = models.Category(user_id=user.id, name=name.strip(), planned_amount=0)
    db.add(category)
    db.flush()
    return category


def assign(db, user, data):
    if data.category_id:
        category = db.query(models.Category).filter_by(id=data.category_id, user_id=user.id).first()
        if not category:
            from fastapi import HTTPException
            raise HTTPException(404, 'Category not found.')
    elif data.category_name:
        category = get_or_create_category(db, user, data.category_name)
    else:
        suggestion = suggest(db, user, data.item_name, data.description)
        category = get_or_create_category(db, user, suggestion['category_name']) if suggestion['category_name'] else None
        return category, suggestion['source'], suggestion['category_name']
    key = normalize(data.item_name)
    preference = db.query(CategoryPreference).filter_by(user_id=user.id, product_key=key).first()
    if not preference:
        preference = CategoryPreference(user_id=user.id, product_key=key)
    preference.category_id = category.id
    db.add(preference)
    db.flush()  # Subsequent rows must see this preference even with autoflush=False.
    return category, 'manual', category.name
