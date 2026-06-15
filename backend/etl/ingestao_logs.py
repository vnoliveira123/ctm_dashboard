import pandas as pd
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
from api.db.models import Execucao
from datetime import datetime

logger = logging.getLogger(__name__)

_FMT_LOG    = '%H:%M - %d/%m/%y'
_CHUNK_SIZE = 100_000   # linhas por lote


def ingerir_logs_incremental(arquivo_csv: str, db: Session) -> int:
    """
    Ingere LOG.csv em lotes de 100 K linhas sem carregar o arquivo inteiro
    na memória. Usa TRUNCATE + bulk_insert_mappings para máxima performance.
    """
    try:
        # Truncate é ordens de magnitude mais rápido que DELETE para 58 M+ linhas
        db.execute(text('TRUNCATE TABLE raw_execucoes RESTART IDENTITY'))
        db.commit()
        logger.info('raw_execucoes truncada')

        total      = 0
        chunk_num  = 0
        _now       = datetime.utcnow()
        cols_ok    = False

        reader = pd.read_csv(
            arquivo_csv,
            sep='|',
            encoding='utf-8',
            dtype=str,
            chunksize=_CHUNK_SIZE,
            on_bad_lines='skip',
        )

        for chunk in reader:
            chunk_num += 1

            # Valida colunas apenas no primeiro chunk
            if not cols_ok:
                for col in ('TABELA', 'JOB', 'GRUPO', 'STATUS', 'INICIO'):
                    if col not in chunk.columns:
                        logger.error(f'Coluna obrigatoria ausente: {col}')
                        return 0
                cols_ok = True

            # ── Datas (vetorizado) ────────────────────────────────────────────
            chunk['_inicio'] = pd.to_datetime(
                chunk['INICIO'], format=_FMT_LOG, errors='coerce'
            )
            chunk['_fim'] = pd.to_datetime(
                chunk['FIM'], format=_FMT_LOG, errors='coerce'
            )
            chunk = chunk[chunk['_inicio'].notna()].copy()
            if chunk.empty:
                continue

            # ── Duração: 'mm:ss' -> float minutos (vetorizado) ───────────────
            _parts = chunk['MINUTOS_PROC'].str.strip().str.split(':', n=1, expand=True)
            chunk['_min_proc'] = (
                pd.to_numeric(_parts[0], errors='coerce') +
                pd.to_numeric(_parts.get(1, pd.Series(['0'] * len(chunk))),
                              errors='coerce') / 60
            )
            chunk['_execucoes'] = (
                pd.to_numeric(chunk['EXECUCOES'], errors='coerce')
                .fillna(1).astype(int)
            )

            # ── Montar lista de dicts para bulk insert ────────────────────────
            # dt.to_pydatetime() converte toda a Series de uma vez
            inicio_list = [
                t.to_pydatetime() if pd.notna(t) else None
                for t in chunk['_inicio']
            ]
            fim_list = [
                t.to_pydatetime() if pd.notna(t) else None
                for t in chunk['_fim']
            ]

            tabela_list    = chunk['TABELA'].where(chunk['TABELA'].notna(), None).tolist()
            job_list       = chunk['JOB'].where(chunk['JOB'].notna(), None).tolist()
            grupo_list     = chunk['GRUPO'].where(chunk['GRUPO'].notna(), None).tolist()
            status_list    = chunk['STATUS'].where(chunk['STATUS'].notna(), None).tolist()
            hora_list      = chunk['HORA_PROC'].where(chunk['HORA_PROC'].notna(), None).tolist()
            min_proc_list  = chunk['_min_proc'].where(chunk['_min_proc'].notna(), None).tolist()
            exec_list      = chunk['_execucoes'].tolist()

            records = [
                {
                    'tabela':        tabela_list[i],
                    'job':           job_list[i],
                    'grupo':         grupo_list[i],
                    'inicio':        inicio_list[i],
                    'fim':           fim_list[i],
                    'status':        status_list[i],
                    'hora_proc':     hora_list[i],
                    'minutos_proc':  min_proc_list[i],
                    'execucoes':     exec_list[i],
                    'data_insercao': _now,
                }
                for i in range(len(chunk))
            ]

            db.bulk_insert_mappings(Execucao, records)
            db.commit()
            total += len(records)

            if chunk_num % 10 == 0:
                logger.info(
                    f'LOG ingestion: chunk {chunk_num} '
                    f'| {total:,} registros inseridos'
                )

        logger.info(f'LOG ingestao concluida: {total:,} registros')
        return total

    except Exception as e:
        logger.error(f'Erro ao ingerir LOGS: {e}')
        db.rollback()
        return 0
