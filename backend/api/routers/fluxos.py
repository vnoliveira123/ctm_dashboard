from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from api.db.database import get_db
from api.db.queries import get_fluxos_grafo, get_rotinas_processos
from typing import Optional

router = APIRouter()


@router.get("/rotinas")
async def listar_rotinas_processos(db: Session = Depends(get_db)):
    """Retorna prefixos de 4 letras distintos das tabelas de processos."""
    return {"rotinas": get_rotinas_processos(db)}


@router.get("/grafo")
async def obter_grafo_fluxos(
    grupo:         Optional[str] = Query(None),
    tabela:        Optional[str] = Query(None),
    job:           Optional[str] = Query(None),
    rotina:        Optional[str] = Query(None),
    posicao:       Optional[str] = Query(None),
    carga:         Optional[str] = Query(None),
    horario_carga: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Retorna nós e arestas para o grafo de fluxo, com filtros."""
    return get_fluxos_grafo(
        db,
        grupo=grupo, tabela=tabela, job=job,
        rotina=rotina, posicao=posicao, carga=carga,
        horario_carga=horario_carga,
    )
