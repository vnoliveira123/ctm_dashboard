from sqlalchemy.orm import Session
from sqlalchemy import desc, func, case, or_, and_, extract
from api.db.models import Processo, Execucao, Fluxo, ProcessoStats, ExecucaoTimeline
from datetime import datetime, timedelta
from typing import Optional, List


# ══════════════════════════════════════════════════════════════════
# PROCESSOS
# ══════════════════════════════════════════════════════════════════

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
    if padrao == 'SIM':
        query = query.filter(Processo.tipo_alerta == 'U-ECS')
    elif padrao == 'NAO':
        query = query.filter(Processo.tipo_alerta != 'U-ECS')
    if tipo_alerta:
        query = query.filter(Processo.tipo_alerta == tipo_alerta)
    return query


def get_processos(db: Session, skip=0, limit=20,
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
        Processo.grupo == grupo,
    ).first()


def get_periodicidades_disponiveis(db: Session) -> List[str]:
    rows = (db.query(Processo.periodicidade)
            .filter(Processo.periodicidade != None)
            .distinct().order_by(Processo.periodicidade).all())
    return [r[0] for r in rows if r[0]]


# ══════════════════════════════════════════════════════════════════
# EXECUÇÕES
# ══════════════════════════════════════════════════════════════════

def _build_exec_filter(query, tabela=None, job=None, grupo_prefix=None,
                        rotina=None, data_inicio=None, data_fim=None, status=None):
    if tabela:
        query = query.filter(ExecucaoTimeline.tabela.ilike(f'%{tabela}%'))
    if job:
        query = query.filter(ExecucaoTimeline.job.ilike(f'%{job}%'))
    if grupo_prefix:
        query = query.filter(ExecucaoTimeline.grupo.like(f'{grupo_prefix}-%'))
    if rotina:
        query = query.filter(ExecucaoTimeline.tabela.like(f'{rotina}%'))
    if data_inicio:
        query = query.filter(ExecucaoTimeline.data_execucao >= data_inicio)
    if data_fim:
        fim = datetime.fromisoformat(data_fim) + timedelta(days=1)
        query = query.filter(ExecucaoTimeline.data_execucao < fim)
    if status:
        query = query.filter(ExecucaoTimeline.status == status)
    return query


def get_execucoes(db: Session, skip=0, limit=20,
                  tabela=None, job=None, grupo_prefix=None,
                  rotina=None, data_inicio=None, data_fim=None, status=None):
    query = _build_exec_filter(
        db.query(ExecucaoTimeline),
        tabela, job, grupo_prefix, rotina, data_inicio, data_fim, status,
    )
    total = query.count()
    execucoes = query.order_by(desc(ExecucaoTimeline.data_execucao)).offset(skip).limit(limit).all()
    return {'execucoes': execucoes, 'total': total}


def get_execucoes_graficos(db: Session,
                            tabela=None, job=None, grupo_prefix=None,
                            rotina=None, data_inicio=None, data_fim=None):
    base = _build_exec_filter(
        db.query(ExecucaoTimeline),
        tabela, job, grupo_prefix, rotina, data_inicio, data_fim,
    )

    # ── Resumo ───────────────────────────────────────────────────
    total    = base.count()
    ok_count = base.filter(ExecucaoTimeline.status == 'OK').count()
    nok_count = total - ok_count
    avg_dur  = base.with_entities(func.avg(ExecucaoTimeline.duracao_minutos)).scalar() or 0

    top_job_row = (
        base.with_entities(
            ExecucaoTimeline.job,
            func.max(ExecucaoTimeline.duracao_minutos).label('max_dur'),
        )
        .filter(ExecucaoTimeline.duracao_minutos != None)
        .group_by(ExecucaoTimeline.job)
        .order_by(desc('max_dur'))
        .first()
    )

    # ── Volume por data (stacked OK / NOT OK) ────────────────────
    volume_rows = (
        base.with_entities(
            func.date(ExecucaoTimeline.data_execucao).label('dt'),
            func.count(ExecucaoTimeline.id).label('total'),
            func.sum(case((ExecucaoTimeline.status == 'OK',  1), else_=0)).label('ok'),
            func.sum(case((ExecucaoTimeline.status == 'NOT OK', 1), else_=0)).label('nok'),
        )
        .group_by(func.date(ExecucaoTimeline.data_execucao))
        .order_by(func.date(ExecucaoTimeline.data_execucao))
        .all()
    )

    # ── Top 10 por duração média ──────────────────────────────────
    top_dur_rows = (
        base.with_entities(
            ExecucaoTimeline.job,
            func.avg(ExecucaoTimeline.duracao_minutos).label('avg_dur'),
            func.max(ExecucaoTimeline.duracao_minutos).label('max_dur'),
        )
        .filter(ExecucaoTimeline.duracao_minutos != None)
        .group_by(ExecucaoTimeline.job)
        .order_by(desc('avg_dur'))
        .limit(10)
        .all()
    )

    # ── Execuções por hora do dia ─────────────────────────────────
    hora_rows = (
        base.with_entities(
            extract('hour', ExecucaoTimeline.data_execucao).label('hora'),
            func.count(ExecucaoTimeline.id).label('total'),
        )
        .group_by(extract('hour', ExecucaoTimeline.data_execucao))
        .order_by('hora')
        .all()
    )

    # ── Execuções de jobs com ISD = SIM ──────────────────────────
    isd_base = (
        db.query(
            ExecucaoTimeline.job,
            func.count(ExecucaoTimeline.id).label('total'),
        )
        .join(Processo, and_(
            ExecucaoTimeline.tabela == Processo.tabela,
            ExecucaoTimeline.job    == Processo.job,
        ))
        .filter(Processo.isd == 'SIM')
    )
    if data_inicio:
        isd_base = isd_base.filter(ExecucaoTimeline.data_execucao >= data_inicio)
    if data_fim:
        fim = datetime.fromisoformat(data_fim) + timedelta(days=1)
        isd_base = isd_base.filter(ExecucaoTimeline.data_execucao < fim)
    if rotina:
        isd_base = isd_base.filter(ExecucaoTimeline.tabela.like(f'{rotina}%'))
    if grupo_prefix:
        isd_base = isd_base.filter(ExecucaoTimeline.grupo.like(f'{grupo_prefix}-%'))

    isd_rows = (
        isd_base.group_by(ExecucaoTimeline.job)
        .order_by(desc('total'))
        .limit(15)
        .all()
    )

    # ── Série temporal (apenas quando job específico filtrado) ────
    timeseries = []
    if job:
        ts_rows = (
            base.with_entities(
                ExecucaoTimeline.data_execucao,
                ExecucaoTimeline.duracao_minutos,
                ExecucaoTimeline.status,
            )
            .order_by(ExecucaoTimeline.data_execucao)
            .limit(500)
            .all()
        )
        timeseries = [
            {
                'data': r.data_execucao.isoformat() if r.data_execucao else None,
                'duracao': float(r.duracao_minutos or 0),
                'status': r.status,
            }
            for r in ts_rows
        ]

    return {
        'resumo': {
            'total': total,
            'ok': ok_count,
            'nok': nok_count,
            'duracao_media': round(float(avg_dur), 2),
            'job_maior_duracao': top_job_row.job if top_job_row else '-',
            'maior_duracao': round(float(top_job_row.max_dur), 2) if top_job_row and top_job_row.max_dur else 0,
        },
        'volume_por_data': [
            {'data': str(r.dt), 'total': r.total, 'ok': int(r.ok or 0), 'nok': int(r.nok or 0)}
            for r in volume_rows
        ],
        'top_duracao': [
            {'job': r.job, 'avg_dur': round(float(r.avg_dur or 0), 2), 'max_dur': round(float(r.max_dur or 0), 2)}
            for r in top_dur_rows
        ],
        'por_hora': [
            {'hora': int(r.hora), 'total': r.total}
            for r in hora_rows
        ],
        'isd_execucoes': [
            {'job': r.job, 'total': r.total}
            for r in isd_rows
        ],
        'timeseries': timeseries,
    }


def get_rotinas_disponiveis(db: Session) -> List[str]:
    rows = (
        db.query(func.left(ExecucaoTimeline.tabela, 4).label('rotina'))
        .distinct()
        .order_by('rotina')
        .all()
    )
    return [r.rotina for r in rows if r.rotina]


# ══════════════════════════════════════════════════════════════════
# STATS
# ══════════════════════════════════════════════════════════════════

def get_stats_processo(db: Session, tabela: str, job: str, grupo: str):
    return db.query(ProcessoStats).filter(
        ProcessoStats.tabela == tabela,
        ProcessoStats.job    == job,
        ProcessoStats.grupo  == grupo,
    ).first()


def get_stats_dashboard(db: Session):
    total_processos  = db.query(func.count(Processo.id)).scalar()
    total_execucoes  = db.query(func.count(ExecucaoTimeline.id)).scalar()
    execucoes_sucesso = db.query(func.count(ExecucaoTimeline.id)).filter(
        ExecucaoTimeline.status == 'OK'
    ).scalar()
    taxa_sucesso = (execucoes_sucesso / total_execucoes * 100) if total_execucoes > 0 else 0
    return {
        'total_processos': total_processos,
        'total_execucoes': total_execucoes,
        'taxa_sucesso': taxa_sucesso,
    }


# ══════════════════════════════════════════════════════════════════
# FLUXOS
# ══════════════════════════════════════════════════════════════════

def get_fluxos_grafo(db: Session, grupo: str = None):
    fluxos = db.query(Fluxo)
    if grupo:
        fluxos = fluxos.filter(Fluxo.grupo_origem == grupo)
    fluxos = fluxos.all()

    nodes = {}
    for f in fluxos:
        ko = f"{f.tabela_origem}_{f.job_origem}"
        kd = f"{f.tabela_destino}_{f.job_destino}"
        if ko not in nodes:
            nodes[ko] = {'id': ko, 'label': f.job_origem, 'grupo': f.grupo_origem}
        if kd not in nodes:
            nodes[kd] = {'id': kd, 'label': f.job_destino, 'grupo': f.grupo_origem}

    edges = [
        {'source': f"{f.tabela_origem}_{f.job_origem}",
         'target': f"{f.tabela_destino}_{f.job_destino}",
         'condicao': f.condicao or ''}
        for f in fluxos
    ]
    return {'nodes': list(nodes.values()), 'edges': edges}
