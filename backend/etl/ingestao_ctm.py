import pandas as pd
import numpy as np
from pathlib import Path
import logging
from sqlalchemy.orm import Session
from api.db.models import Processo
from datetime import datetime

logger = logging.getLogger(__name__)


def _clean(value):
    """Converte NaN/None para None e strings vazias para None."""
    if value is None:
        return None
    if isinstance(value, float) and np.isnan(value):
        return None
    v = str(value).strip()
    return v if v else None


def ingerir_ctm(arquivo_csv: str, db: Session) -> int:
    """
    Ingere o arquivo CSV de processos Control-M.
    Faz UPSERT no banco de dados.
    Retorna número de registros processados.
    """
    try:
        df = pd.read_csv(arquivo_csv, sep='|', encoding='utf-8', dtype=str)
        print(f'CTM lido: {len(df)} linhas')

        colunas_obrigatorias = ['TABELA', 'JOB', 'GRUPO']
        for col in colunas_obrigatorias:
            if col not in df.columns:
                logger.error(f'Coluna obrigatória ausente: {col}')
                return 0

        contador = 0
        for _, row in df.iterrows():
            try:
                tabela = _clean(row.get('TABELA'))
                job = _clean(row.get('JOB'))
                grupo = _clean(row.get('GRUPO'))

                if not tabela or not job or not grupo:
                    continue

                processo_existente = db.query(Processo).filter(
                    Processo.tabela == tabela,
                    Processo.job == job,
                    Processo.grupo == grupo,
                ).first()

                maxqait_raw = _clean(row.get('MAXQAIT'))
                maxqait_val = int(maxqait_raw) if maxqait_raw and maxqait_raw.isdigit() else None

                tem_alerta_val = str(row.get('TEM_ALERTA', '')).strip().upper() == 'SIM'

                campos = dict(
                    tabela=tabela,
                    job=job,
                    grupo=grupo,
                    tasktype=_clean(row.get('TASKTYPE')),
                    carga=_clean(row.get('CARGA')),
                    horario_carga=_clean(row.get('HORARIO_CARGA')),
                    isd=_clean(row.get('ISD')),
                    evento_isd=_clean(row.get('EVENTO_ISD')),
                    tem_alerta=tem_alerta_val,
                    alerta_config=_clean(row.get('ALERTA_CONFIG')),
                    tipo_alerta=_clean(row.get('TIPO_ALERTA')),
                    padrao=_clean(row.get('PADRAO')),
                    maxqait=maxqait_val,
                    fromtime=_clean(row.get('FROMTIME')),
                    untiltime=_clean(row.get('UNTILTIME')),
                    confirm=_clean(row.get('CONFIRM')),
                    memlib=_clean(row.get('MEMLIB')),
                    resource=_clean(row.get('RESOURCE')),
                    periodicidade=_clean(row.get('PERIODICIDADE')),
                    calendario=_clean(row.get('CALENDARIO')),
                    intersit=_clean(row.get('INTERSIT')),
                    in_counds=_clean(row.get('IN_COUNDS')),
                    out_counds=_clean(row.get('OUT_COUNDS')),
                    comentario=_clean(row.get('COMENTARIO')),
                )

                if processo_existente:
                    for key, value in campos.items():
                        setattr(processo_existente, key, value)
                    processo_existente.data_atualizacao = datetime.utcnow()
                else:
                    db.add(Processo(**campos))

                contador += 1

                if contador % 100 == 0:
                    db.flush()

            except Exception as e:
                logger.error(f'Erro ao processar linha (job={row.get("JOB")}): {e}')
                db.rollback()
                continue

        db.commit()
        logger.info(f'CTM ingerido: {contador} registros')
        return contador

    except Exception as e:
        logger.error(f'Erro ao ingerir CTM: {e}')
        db.rollback()
        return 0
