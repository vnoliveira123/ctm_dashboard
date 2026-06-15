import logging
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from api.db.models import Execucao, ProcessoStats, ExecucaoTimeline
from datetime import datetime

logger = logging.getLogger(__name__)

def agregar_processos(db: Session) -> int:
    '''
    Agrega dados de execuções e atualiza ProcessoStats.
    '''
    try:
        # Buscar execuções agrupadas por processo
        resultados = db.query(
            Execucao.tabela,
            Execucao.job,
            Execucao.grupo,
            func.count(Execucao.id).label('total'),
            func.sum(case((Execucao.status == 'SUCCESS', 1), else_=0)).label('sucesso'),
            func.sum(case((Execucao.status == 'FAILED', 1), else_=0)).label('falha'),
            func.avg(Execucao.minutos_proc).label('duracao_media'),
            func.max(Execucao.fim).label('ultima_execucao')
        ).group_by(Execucao.tabela, Execucao.job, Execucao.grupo).all()
        
        contador = 0
        for resultado in resultados:
            total = resultado.total or 0
            sucesso = resultado.sucesso or 0
            taxa_sucesso = (sucesso / total * 100) if total > 0 else 0
            
            # Atualizar ou criar stat
            stat = db.query(ProcessoStats).filter(
                ProcessoStats.tabela == resultado.tabela,
                ProcessoStats.job == resultado.job,
                ProcessoStats.grupo == resultado.grupo
            ).first()
            
            if stat:
                stat.total_execucoes = total
                stat.execucoes_sucesso = sucesso
                stat.execucoes_falha = resultado.falha or 0
                stat.taxa_sucesso = taxa_sucesso
                stat.duracao_media = resultado.duracao_media or 0.0
                stat.ultima_execucao = resultado.ultima_execucao
            else:
                stat = ProcessoStats(
                    tabela=resultado.tabela,
                    job=resultado.job,
                    grupo=resultado.grupo,
                    total_execucoes=total,
                    execucoes_sucesso=sucesso,
                    execucoes_falha=resultado.falha or 0,
                    taxa_sucesso=taxa_sucesso,
                    duracao_media=resultado.duracao_media or 0.0,
                    ultima_execucao=resultado.ultima_execucao
                )
                db.add(stat)
            
            contador += 1
        
        db.commit()
        logger.info(f'✅ Stats de processos atualizados: {contador}')
        return contador
        
    except Exception as e:
        logger.error(f'❌ Erro ao agregar processos: {e}')
        return 0

def agregar_execucoes_timeline(db: Session) -> int:
    '''
    Agrega dados de execuções para timeline.
    '''
    try:
        # Buscar execuções
        execucoes = db.query(Execucao).all()
        
        contador = 0
        for exec in execucoes:
            # Verificar se já existe na timeline
            timeline = db.query(ExecucaoTimeline).filter(
                ExecucaoTimeline.tabela == exec.tabela,
                ExecucaoTimeline.job == exec.job,
                ExecucaoTimeline.grupo == exec.grupo,
                ExecucaoTimeline.data_execucao == exec.inicio
            ).first()
            
            if not timeline:
                nova_timeline = ExecucaoTimeline(
                    tabela=exec.tabela,
                    job=exec.job,
                    grupo=exec.grupo,
                    data_execucao=exec.inicio,
                    status=exec.status,
                    duracao_minutos=exec.minutos_proc
                )
                db.add(nova_timeline)
                contador += 1
        
        db.commit()
        logger.info(f'✅ Timeline atualizada: {contador} registros')
        return contador
        
    except Exception as e:
        logger.error(f'❌ Erro ao agregar timeline: {e}')
        return 0
