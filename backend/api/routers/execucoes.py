from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from api.db.database import get_db
from api.db.queries import get_execucoes, get_execucoes_graficos, get_rotinas_disponiveis
from typing import Optional

router = APIRouter()


@router.get("/rotinas")
async def listar_rotinas(db: Session = Depends(get_db)):
    """Retorna prefixos de 4 letras distintos das tabelas (rotinas)."""
    return {"rotinas": get_rotinas_disponiveis(db)}


@router.get("/graficos")
async def obter_graficos(
    tabela: Optional[str] = Query(None),
    job: Optional[str] = Query(None),
    grupo: Optional[str] = Query(None),
    rotina: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Retorna todos os dados agregados para os gráficos do painel."""
    return get_execucoes_graficos(
        db,
        tabela=tabela, job=job, grupo_prefix=grupo,
        rotina=rotina, data_inicio=data_inicio, data_fim=data_fim,
        status=status,
    )


@router.get("/")
async def listar_execucoes(
    tabela: Optional[str] = Query(None),
    job: Optional[str] = Query(None),
    grupo: Optional[str] = Query(None),
    rotina: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Listar execuções com filtros avançados e paginação."""
    skip = (page - 1) * limit
    resultado = get_execucoes(
        db, skip=skip, limit=limit,
        tabela=tabela, job=job, grupo_prefix=grupo,
        rotina=rotina, data_inicio=data_inicio, data_fim=data_fim, status=status,
    )
    return {
        "execucoes": [
            {
                "tabela": e.tabela,
                "job": e.job,
                "grupo": e.grupo,
                "data_execucao": e.data_execucao.isoformat() if e.data_execucao else None,
                "status": e.status,
                "duracao_minutos": round(float(e.duracao_minutos), 2) if e.duracao_minutos else None,
            }
            for e in resultado["execucoes"]
        ],
        "total": resultado["total"],
        "page": page,
        "limit": limit,
    }
