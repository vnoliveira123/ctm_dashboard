from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from api.db.database import get_db
from api.db.queries import get_execucoes, get_execucoes_graficos, get_rotinas_disponiveis, get_sla_jobs
from api.middleware.cache import get_or_cache
from typing import Optional, List
from datetime import datetime, timedelta

router = APIRouter()


@router.get("/rotinas")
async def listar_rotinas(db: Session = Depends(get_db)):
    return get_or_cache(
        "cache:execucoes:rotinas", 600,
        lambda: {"rotinas": get_rotinas_disponiveis(db)},
    )


@router.get("/sla")
async def obter_sla_jobs(
    sla_minutos: float = Query(30.0, ge=0),
    db: Session = Depends(get_db),
):
    """Jobs cuja duração média excede o limiar de SLA (em minutos)."""
    def _fetch():
        jobs = get_sla_jobs(db, sla_minutos=sla_minutos)
        return {"jobs": jobs, "sla_minutos": sla_minutos}
    return get_or_cache(f"cache:execucoes:sla:{sla_minutos}", 300, _fetch)


def _default_date_range(data_inicio: Optional[str], data_fim: Optional[str]):
    if not data_inicio and not data_fim:
        today = datetime.utcnow().date()
        return (today - timedelta(days=30)).isoformat(), today.isoformat()
    return data_inicio, data_fim


@router.get("/graficos")
async def obter_graficos(
    tabela: List[str] = Query(default=[]),
    job: List[str] = Query(default=[]),
    grupo: List[str] = Query(default=[]),
    rotina: List[str] = Query(default=[]),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    data_inicio, data_fim = _default_date_range(data_inicio, data_fim)
    return get_execucoes_graficos(
        db,
        tabelas=tabela, jobs=job, grupos=grupo,
        rotinas=rotina, data_inicio=data_inicio, data_fim=data_fim,
        status=status,
    )


@router.get("/")
async def listar_execucoes(
    tabela: List[str] = Query(default=[]),
    job: List[str] = Query(default=[]),
    grupo: List[str] = Query(default=[]),
    rotina: List[str] = Query(default=[]),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    data_inicio, data_fim = _default_date_range(data_inicio, data_fim)
    skip = (page - 1) * limit
    resultado = get_execucoes(
        db, skip=skip, limit=limit,
        tabelas=tabela, jobs=job, grupos=grupo,
        rotinas=rotina, data_inicio=data_inicio, data_fim=data_fim, status=status,
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
