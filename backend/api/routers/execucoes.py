from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from api.db.database import get_db
from api.db.queries import get_execucoes
from typing import Optional

router = APIRouter()

@router.get("/")
async def listar_execucoes(
    job: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    '''Listar execuções com paginação e filtros.'''
    skip = (page - 1) * limit
    resultado = get_execucoes(
        db, skip=skip, limit=limit, job=job, 
        data_inicio=data_inicio, data_fim=data_fim, status=status
    )
    
    return {
        "execucoes": [
            {
                "tabela": e.tabela,
                "job": e.job,
                "grupo": e.grupo,
                "data_execucao": e.data_execucao,
                "status": e.status,
                "duracao_minutos": e.duracao_minutos
            } for e in resultado['execucoes']
        ],
        "total": resultado['total'],
        "page": page,
        "limit": limit
    }
