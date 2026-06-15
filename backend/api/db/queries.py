from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from api.db.models import Processo, Execucao, Fluxo, ProcessoStats, ExecucaoTimeline
from datetime import datetime, timedelta

# ===== PROCESSOS =====
def get_processos(db: Session, skip: int = 0, limit: int = 20, 
                   grupo: str = None, periodicidade: str = None):
    '''Retorna processos com filtros.'''
    query = db.query(Processo)
    
    if grupo:
        query = query.filter(Processo.grupo == grupo)
    if periodicidade:
        query = query.filter(Processo.periodicidade == periodicidade)
    
    total = query.count()
    processos = query.offset(skip).limit(limit).all()
    
    return {'processos': processos, 'total': total}

def get_processo_by_id(db: Session, tabela: str, job: str, grupo: str):
    '''Retorna um processo específico.'''
    return db.query(Processo).filter(
        Processo.tabela == tabela,
        Processo.job == job,
        Processo.grupo == grupo
    ).first()

# ===== EXECUÇÕES =====
def get_execucoes(db: Session, skip: int = 0, limit: int = 20,
                   job: str = None, data_inicio: str = None, 
                   data_fim: str = None, status: str = None):
    '''Retorna execuções com filtros.'''
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
    '''Retorna estatísticas agregadas de um processo.'''
    return db.query(ProcessoStats).filter(
        ProcessoStats.tabela == tabela,
        ProcessoStats.job == job,
        ProcessoStats.grupo == grupo
    ).first()

def get_stats_dashboard(db: Session):
    '''Retorna estatísticas gerais do dashboard.'''
    total_processos = db.query(func.count(Processo.id)).scalar()
    total_execucoes = db.query(func.count(ExecucaoTimeline.id)).scalar()
    
    execucoes_sucesso = db.query(func.count(ExecucaoTimeline.id)).filter(
        ExecucaoTimeline.status == 'SUCCESS'
    ).scalar()
    
    taxa_sucesso = (execucoes_sucesso / total_execucoes * 100) if total_execucoes > 0 else 0
    
    return {
        'total_processos': total_processos,
        'total_execucoes': total_execucoes,
        'taxa_sucesso': taxa_sucesso
    }

# ===== FLUXOS =====
def get_fluxos_grafo(db: Session, grupo: str = None):
    '''Retorna estrutura de grafo para D3.js.'''
    fluxos = db.query(Fluxo)
    
    if grupo:
        fluxos = fluxos.filter(Fluxo.grupo_origem == grupo)
    
    fluxos = fluxos.all()
    
    # Montar nodes
    nodes = {}
    for fluxo in fluxos:
        key_origem = f"{fluxo.tabela_origem}_{fluxo.job_origem}"
        key_destino = f"{fluxo.tabela_destino}_{fluxo.job_destino}"
        
        if key_origem not in nodes:
            nodes[key_origem] = {
                'id': key_origem,
                'label': fluxo.job_origem,
                'grupo': fluxo.grupo_origem
            }
        if key_destino not in nodes:
            nodes[key_destino] = {
                'id': key_destino,
                'label': fluxo.job_destino,
                'grupo': fluxo.grupo_origem
            }
    
    # Montar edges
    edges = [
        {
            'source': f"{fluxo.tabela_origem}_{fluxo.job_origem}",
            'target': f"{fluxo.tabela_destino}_{fluxo.job_destino}",
            'condicao': fluxo.condicao or ''
        }
        for fluxo in fluxos
    ]
    
    return {
        'nodes': list(nodes.values()),
        'edges': edges
    }
