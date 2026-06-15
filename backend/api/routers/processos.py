from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from api.db.database import get_db
from api.db.queries import get_processos, get_stats_processo, get_stats_dashboard
from typing import Optional

router = APIRouter()

@router.get("/")
async def listar_processos(
    grupo: Optional[str] = Query(None),
    periodicidade: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    '''Listar processos cadastrados com filtros.'''
    skip = (page - 1) * limit
    resultado = get_processos(db, skip=skip, limit=limit, grupo=grupo, periodicidade=periodicidade)
    
    return {
        "processos": [
            {
                "tabela": p.tabela,
                "job": p.job,
                "grupo": p.grupo,
                "periodicidade": p.periodicidade,
                "status": "OK" if not p.tem_alerta else "ALERTA"
            } for p in resultado['processos']
        ],
        "total": resultado['total'],
        "page": page,
        "limit": limit
    }

@router.get("/stats")
async def obter_stats_dashboard(db: Session = Depends(get_db)):
    '''Obter estatísticas gerais do dashboard.'''
    return get_stats_dashboard(db)

@router.get("/{tabela}/{job}/{grupo}/stats")
async def obter_stats_processo(
    tabela: str,
    job: str,
    grupo: str,
    db: Session = Depends(get_db)
):
    '''Obter estatísticas aggregadas de um processo.'''
    stats = get_stats_processo(db, tabela=tabela, job=job, grupo=grupo)
    
    if not stats:
        return {"error": "Processo não encontrado"}
    
    return {
        "processo": f"{tabela}.{job}",
        "grupo": grupo,
        "execucoes_totais": stats.total_execucoes,
        "execucoes_sucesso": stats.execucoes_sucesso,
        "execucoes_falha": stats.execucoes_falha,
        "taxa_sucesso": stats.taxa_sucesso,
        "duracao_media_minutos": stats.duracao_media,
        "ultima_execucao": stats.ultima_execucao
    }
