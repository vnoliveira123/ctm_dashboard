from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from api.db.database import get_db
from api.db.queries import get_fluxos_grafo
from typing import Optional

router = APIRouter()

@router.get("/grafo")
async def obter_grafo_fluxos(
    grupo: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    '''Obter estrutura de grafo para visualização D3.js.'''
    return get_fluxos_grafo(db, grupo=grupo)
