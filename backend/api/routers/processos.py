from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from api.db.database import get_db
from api.db.queries import get_processos, get_stats_processo, get_stats_dashboard, get_periodicidades_disponiveis
from typing import Optional, List

router = APIRouter()


@router.get("/filtros")
async def listar_opcoes_filtro(db: Session = Depends(get_db)):
    """Retorna opções disponíveis para os filtros (valores distintos do banco)."""
    return {
        "periodicidades": get_periodicidades_disponiveis(db),
    }


@router.get("/")
async def listar_processos(
    tabela: Optional[str] = Query(None),
    job: Optional[str] = Query(None),
    grupo: Optional[str] = Query(None),
    periodicidade: Optional[str] = Query(None),
    confirm: Optional[str] = Query(None),
    memlib: Optional[str] = Query(None),
    carga: Optional[str] = Query(None),
    horarios_carga: Optional[str] = Query(None),
    isd: Optional[str] = Query(None),
    evento_isd: Optional[str] = Query(None),
    tem_alerta: Optional[str] = Query(None),
    padrao: Optional[str] = Query(None),
    tipo_alerta: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Listar processos cadastrados com filtros avançados."""
    skip = (page - 1) * limit

    tem_alerta_bool = None
    if tem_alerta == 'SIM':
        tem_alerta_bool = True
    elif tem_alerta == 'NAO':
        tem_alerta_bool = False

    horarios_list: Optional[List[str]] = None
    if horarios_carga:
        horarios_list = [h.strip() for h in horarios_carga.split(',') if h.strip()]

    resultado = get_processos(
        db, skip=skip, limit=limit,
        tabela=tabela, job=job, grupo_prefix=grupo,
        periodicidade=periodicidade, confirm=confirm, memlib=memlib,
        carga=carga, horarios_carga=horarios_list,
        isd=isd, evento_isd=evento_isd,
        tem_alerta=tem_alerta_bool, padrao=padrao, tipo_alerta=tipo_alerta,
    )

    return {
        "processos": [
            {
                "tabela": p.tabela,
                "job": p.job,
                "grupo": p.grupo,
                "tasktype": p.tasktype,
                "periodicidade": p.periodicidade,
                "carga": p.carga,
                "horario_carga": p.horario_carga,
                "isd": p.isd,
                "evento_isd": p.evento_isd,
                "tem_alerta": p.tem_alerta,
                "alerta_config": p.alerta_config,
                "tipo_alerta": p.tipo_alerta,
                "padrao": p.padrao,
                "confirm": p.confirm,
                "memlib": p.memlib,
                "resource": p.resource,
                "fromtime": p.fromtime,
                "untiltime": p.untiltime,
            }
            for p in resultado["processos"]
        ],
        "total": resultado["total"],
        "resumo": resultado["resumo"],
        "page": page,
        "limit": limit,
    }


@router.get("/stats")
async def obter_stats_dashboard(db: Session = Depends(get_db)):
    """Obter estatísticas gerais do dashboard."""
    return get_stats_dashboard(db)


@router.get("/{tabela}/{job}/{grupo}/stats")
async def obter_stats_processo(
    tabela: str, job: str, grupo: str,
    db: Session = Depends(get_db),
):
    """Obter estatísticas agregadas de um processo."""
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
        "ultima_execucao": stats.ultima_execucao,
    }
