import logging
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from api.db.models import Execucao, ProcessoStats, ExecucaoTimeline
from datetime import datetime

logger = logging.getLogger(__name__)

# Status do LOG.csv
_OK  = 'OK'
_NOK = 'NOT OK'


def agregar_processos(db: Session) -> int:
    """Agrega execuções por processo e atualiza mat_processos_stats."""
    try:
        resultados = db.query(
            Execucao.tabela,
            Execucao.job,
            Execucao.grupo,
            func.count(Execucao.id).label('total'),
            func.sum(case((Execucao.status == _OK,  1), else_=0)).label('sucesso'),
            func.sum(case((Execucao.status == _NOK, 1), else_=0)).label('falha'),
            func.avg(Execucao.minutos_proc).label('duracao_media'),
            func.max(Execucao.fim).label('ultima_execucao'),
        ).group_by(Execucao.tabela, Execucao.job, Execucao.grupo).all()

        contador = 0
        for r in resultados:
            total   = r.total or 0
            sucesso = r.sucesso or 0
            taxa    = (sucesso / total * 100) if total > 0 else 0.0

            stat = db.query(ProcessoStats).filter(
                ProcessoStats.tabela == r.tabela,
                ProcessoStats.job    == r.job,
                ProcessoStats.grupo  == r.grupo,
            ).first()

            valores = dict(
                total_execucoes=total,
                execucoes_sucesso=sucesso,
                execucoes_falha=r.falha or 0,
                taxa_sucesso=taxa,
                duracao_media=float(r.duracao_media or 0.0),
                ultima_execucao=r.ultima_execucao,
                data_atualizacao=datetime.utcnow(),
            )

            if stat:
                for k, v in valores.items():
                    setattr(stat, k, v)
            else:
                db.add(ProcessoStats(tabela=r.tabela, job=r.job, grupo=r.grupo, **valores))

            contador += 1

        db.commit()
        logger.info(f'Stats de processos atualizados: {contador}')
        return contador

    except Exception as e:
        logger.error(f'Erro ao agregar processos: {e}')
        db.rollback()
        return 0


def agregar_execucoes_timeline(db: Session) -> int:
    """
    Popula mat_execucoes_timeline a partir de raw_execucoes.
    Recria a tabela a cada execução do ETL para manter consistência.
    """
    try:
        # Limpa e reinsere para manter idempotência
        db.query(ExecucaoTimeline).delete()
        db.flush()

        execucoes = db.query(Execucao).filter(Execucao.inicio != None).all()

        novos = [
            ExecucaoTimeline(
                tabela=e.tabela,
                job=e.job,
                grupo=e.grupo,
                data_execucao=e.inicio,
                status=e.status,
                duracao_minutos=e.minutos_proc,
                data_atualizacao=datetime.utcnow(),
            )
            for e in execucoes
        ]

        if novos:
            # Insere em lotes de 1000
            for i in range(0, len(novos), 1000):
                db.bulk_save_objects(novos[i:i + 1000])
                db.flush()

        db.commit()
        logger.info(f'Timeline atualizada: {len(novos)} registros')
        return len(novos)

    except Exception as e:
        logger.error(f'Erro ao agregar timeline: {e}')
        db.rollback()
        return 0
