import pandas as pd
import numpy as np
import logging
from sqlalchemy.orm import Session
from api.db.models import Execucao
from datetime import datetime

logger = logging.getLogger(__name__)

_FMT_LOG = '%H:%M - %d/%m/%y'


def _parse_dt(val) -> datetime | None:
    """Parseia 'hh:mm - dd/mm/yy' para datetime."""
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    try:
        return datetime.strptime(str(val).strip(), _FMT_LOG)
    except ValueError:
        return None


def _parse_minutos(val) -> float | None:
    """Converte 'mm:ss' para float de minutos totais (ex: '10:58' → 10.967)."""
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    try:
        partes = str(val).strip().split(':')
        if len(partes) == 2:
            return int(partes[0]) + int(partes[1]) / 60
        return float(val)
    except (ValueError, ZeroDivisionError):
        return None


def _clean(val):
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    s = str(val).strip()
    return s if s else None


def ingerir_logs_incremental(arquivo_csv: str, db: Session) -> int:
    """
    Ingere o arquivo CSV de logs de execução.
    Limpa raw_execucoes antes de reinserir (carga completa idempotente).
    Retorna número de registros inseridos.
    """
    try:
        df = pd.read_csv(arquivo_csv, sep='|', encoding='utf-8', dtype=str)
        print(f'LOGS lidos: {len(df)} linhas')

        colunas_obrigatorias = ['TABELA', 'JOB', 'GRUPO', 'STATUS']
        for col in colunas_obrigatorias:
            if col not in df.columns:
                logger.error(f'Coluna obrigatória ausente: {col}')
                return 0

        # Carga completa: limpa tabela antes de reinserir
        db.query(Execucao).delete()
        db.flush()

        registros = []
        for _, row in df.iterrows():
            inicio = _parse_dt(row.get('INICIO'))
            fim    = _parse_dt(row.get('FIM'))

            if inicio is None:
                logger.warning(f'INICIO inválido — job={row.get("JOB")} valor="{row.get("INICIO")}"')
                continue

            registros.append(Execucao(
                tabela=_clean(row.get('TABELA')),
                job=_clean(row.get('JOB')),
                grupo=_clean(row.get('GRUPO')),
                inicio=inicio,
                fim=fim,
                status=_clean(row.get('STATUS')),
                hora_proc=_clean(row.get('HORA_PROC')),
                minutos_proc=_parse_minutos(row.get('MINUTOS_PROC')),
                execucoes=int(row.get('EXECUCOES', 1) or 1),
            ))

            if len(registros) % 1000 == 0:
                db.bulk_save_objects(registros)
                db.flush()
                registros = []

        if registros:
            db.bulk_save_objects(registros)

        db.commit()
        total = db.query(Execucao).count()
        logger.info(f'LOGS ingeridos: {total} registros')
        return total

    except Exception as e:
        logger.error(f'Erro ao ingerir LOGS: {e}')
        db.rollback()
        return 0
