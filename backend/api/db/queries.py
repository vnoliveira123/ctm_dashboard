from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_
from api.db.models import Processo, Execucao, Fluxo, ProcessoStats, ExecucaoTimeline
from datetime import datetime, timedelta
from typing import Optional, List


# ===== PROCESSOS =====

def _aplicar_filtros_processo(query, tabela=None, job=None, grupo_prefix=None,
                               periodicidade=None, confirm=None, memlib=None,
                               carga=None, horarios_carga=None,
                               isd=None, evento_isd=None,
                               tem_alerta=None, padrao=None, tipo_alerta=None):
    if tabela:
        query = query.filter(Processo.tabela.ilike(f'%{tabela}%'))
    if job:
        query = query.filter(Processo.job.ilike(f'%{job}%'))
    if grupo_prefix:
        query = query.filter(Processo.grupo.like(f'{grupo_prefix}-%'))
    if periodicidade:
        query = query.filter(Processo.periodicidade == periodicidade)
    if confirm == 'SIM':
        query = query.filter(Processo.confirm == 'Y')
    elif confirm == 'NAO':
        query = query.filter(or_(Processo.confirm == None, Processo.confirm == ''))
    if memlib:
        query = query.filter(Processo.memlib == memlib)
    if carga:
        query = query.filter(Processo.carga == carga)
    if horarios_carga:
        query = query.filter(Processo.horario_carga.in_(horarios_carga))
    if isd:
        query = query.filter(Processo.isd == isd)
    if evento_isd:
        query = query.filter(Processo.evento_isd == evento_isd)
    if tem_alerta is not None:
        query = query.filter(Processo.tem_alerta == tem_alerta)
    if padrao:
        query = query.filter(Processo.padrao == padrao)
    if tipo_alerta:
        query = query.filter(Processo.tipo_alerta == tipo_alerta)
    return query


def get_processos(db: Session, skip: int = 0, limit: int = 20,
                  tabela=None, job=None, grupo_prefix=None,
                  periodicidade=None, confirm=None, memlib=None,
                  carga=None, horarios_carga=None,
                  isd=None, evento_isd=None,
                  tem_alerta=None, padrao=None, tipo_alerta=None):

    filtros = dict(tabela=tabela, job=job, grupo_prefix=grupo_prefix,
                   periodicidade=periodicidade, confirm=confirm, memlib=memlib,
                   carga=carga, horarios_carga=horarios_carga,
                   isd=isd, evento_isd=evento_isd,
                   tem_alerta=tem_alerta, padrao=padrao, tipo_alerta=tipo_alerta)

    base = _aplicar_filtros_processo(db.query(Processo), **filtros)
    total = base.count()

    def _count_distinct_tabela(**extra):
        q = _aplicar_filtros_processo(db.query(Processo), **{**filtros, **extra})
        return q.with_entities(func.count(func.distinct(Processo.tabela))).scalar() or 0

    resumo = {
        'total_jobs': total,
        'total_tabelas': base.with_entities(func.count(func.distinct(Processo.tabela))).scalar() or 0,
        'tabelas_carga': _count_distinct_tabela(carga='SIM'),
        'tabelas_isd': _count_distinct_tabela(isd='SIM'),
        'tabelas_alerta': _count_distinct_tabela(tem_alerta=True),
    }

    processos = base.order_by(Processo.tabela, Processo.job).offset(skip).limit(limit).all()
    return {'processos': processos, 'total': total, 'resumo': resumo}


def get_processo_by_id(db: Session, tabela: str, job: str, grupo: str):
    return db.query(Processo).filter(
        Processo.tabela == tabela,
        Processo.job == job,
        Processo.grupo == grupo
    ).first()


def get_periodicidades_disponiveis(db: Session) -> List[str]:
    rows = (db.query(Processo.periodicidade)
            .filter(Processo.periodicidade != None)
            .distinct()
            .order_by(Processo.periodicidade)
            .all())
    return [r[0] for r in rows if r[0]]


# ===== EXECUÇÕES =====
def get_execucoes(db: Session, skip: int = 0, limit: int = 20,
                  job: str = None, data_inicio: str = None,
                  data_fim: str = None, status: str = None):
    query = db.query(ExecucaoTimeline)

    if job:
        query = query.filter(ExecucaoTimeline.job == job)
    if status:
        query = query.filter(ExecucaoTimeline.status == status)
    if data_inicio and data_fim:
        inicio = datetime.fromisoformat(data_inicio)
        fim = datetime.fromisoformat(data_fim)
        query = query.filter(ExecucaoTimeline.data_execucao.between(inicio, fim))

    total = query.count()
    execucoes = query.order_by(desc(ExecucaoTimeline.data_execucao)).offset(skip).limit(limit).all()
    return {'execucoes': execucoes, 'total': total}


# ===== STATS =====
def get_stats_processo(db: Session, tabela: str, job: str, grupo: str):
    return db.query(ProcessoStats).filter(
        ProcessoStats.tabela == tabela,
        ProcessoStats.job == job,
        ProcessoStats.grupo == grupo
    ).first()


def get_stats_dashboard(db: Session):
    total_processos = db.query(func.count(Processo.id)).scalar()
    total_execucoes = db.query(func.count(ExecucaoTimeline.id)).scalar()
    execucoes_sucesso = db.query(func.count(ExecucaoTimeline.id)).filter(
        ExecucaoTimeline.status == 'SUCCESS'
    ).scalar()
    taxa_sucesso = (execucoes_sucesso / total_execucoes * 100) if total_execucoes > 0 else 0
    return {
        'total_processos': total_processos,
        'total_execucoes': total_execucoes,
        'taxa_sucesso': taxa_sucesso,
    }


# ===== FLUXOS =====
def get_fluxos_grafo(db: Session, grupo: str = None):
    fluxos = db.query(Fluxo)
    if grupo:
        fluxos = fluxos.filter(Fluxo.grupo_origem == grupo)
    fluxos = fluxos.all()

    nodes = {}
    for fluxo in fluxos:
        key_origem = f"{fluxo.tabela_origem}_{fluxo.job_origem}"
        key_destino = f"{fluxo.tabela_destino}_{fluxo.job_destino}"
        if key_origem not in nodes:
            nodes[key_origem] = {'id': key_origem, 'label': fluxo.job_origem, 'grupo': fluxo.grupo_origem}
        if key_destino not in nodes:
            nodes[key_destino] = {'id': key_destino, 'label': fluxo.job_destino, 'grupo': fluxo.grupo_origem}

    edges = [
        {'source': f"{f.tabela_origem}_{f.job_origem}",
         'target': f"{f.tabela_destino}_{f.job_destino}",
         'condicao': f.condicao or ''}
        for f in fluxos
    ]
    return {'nodes': list(nodes.values()), 'edges': edges}
