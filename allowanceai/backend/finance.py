"""Authoritative money policy and shared per-account transaction boundary."""
from decimal import Decimal, ROUND_HALF_UP
from functools import wraps
from inspect import signature
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, OperationalError

ZERO = Decimal('0')
CENT = Decimal('0.01')
MAX_MONEY = Decimal('9999999999999999.99')


def decimal(value):
    return value if isinstance(value, Decimal) else Decimal(str(value or 0))


def money(value):
    return decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def valid_money(value):
    value = decimal(value)
    if not value.is_finite() or value < 0 or value > MAX_MONEY or value != money(value):
        raise ValueError('Money must be finite, nonnegative, within range and have at most two decimal places.')
    return value


def rounded(value, digits=None):
    if isinstance(value, Decimal):
        result = value.quantize(Decimal(1).scaleb(-(digits or 0)), rounding=ROUND_HALF_UP)
        return int(result) if digits is None else result
    return round(value) if digits is None else round(value, digits)


def lock_user(db, user):
    import models
    db.query(models.User).filter_by(id=user.id).with_for_update().populate_existing().one()


def financial_write(action):
    """Commit only after source, derived writes AND response construction succeed.

    All financial writers use this same lock order. Unknown commit outcomes must
    retry with the same operation key; never automatically retry a new operation.
    """
    contract = signature(action)
    @wraps(action)
    def run(*args, **kwargs):
        bound = contract.bind(*args, **kwargs)
        db, user = bound.arguments['db'], bound.arguments['user']
        try:
            lock_user(db, user)
            result = action(*args, **kwargs)
            db.flush()
            # Freeze/serialize responses before commit, including ORM-created
            # records which expire on commit under production session settings.
            from fastapi.encoders import jsonable_encoder
            result = jsonable_encoder(result, custom_encoder={Decimal: lambda value: format(value, 'f')})
            db.commit()
            return result
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(409, 'The record conflicts with existing data. Reload before retrying; keep the same operation key.') from exc
        except OperationalError as exc:
            db.rollback()
            raise HTTPException(503, 'The database operation could not complete. Retry with the same operation key.') from exc
        except Exception:
            db.rollback()
            raise
    return run
