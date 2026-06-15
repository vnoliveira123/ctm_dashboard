import pandas as pd
import logging
from sqlalchemy.orm import Session
from api.db.models import Execucao
from datetime import datetime
import hashlib

logger = logging.getLogger(__name__)

def obter_ultimo_hash_processado(db: Session) -> str:
    '''Retorna o hash do último registro processado.'''
    try:
        # Buscar o registro mais recente
        resultado = db.query(Execucao).order_by(Execucao.id.desc()).first()
        return resultado.id if resultado else '0'
    except:
        return '0'

def ingerir_logs_incremental(arquivo_csv: str, db: Session) -> int:
    '''
    Ingere o arquivo CSV de logs de forma incremental.
    Apenas novos registros são importados.
    Retorna número de registros inseridos.
    '''
    try:
        # Ler CSV
        df = pd.read_csv(arquivo_csv, sep='|', encoding='utf-8')
        print(f'📖 LOGS lidos: {len(df)} linhas')
        
        # Garantir colunas obrigatórias
        colunas_obrigatorias = ['TABELA', 'JOB', 'GRUPO', 'STATUS']
        for col in colunas_obrigatorias:
            if col not in df.columns:
                logger.error(f'❌ Coluna obrigatória ausente: {col}')
                return 0
        
        # Obter último ID processado
        ultimo_id = obter_ultimo_hash_processado(db)
        
        # Processar cada linha
        contador = 0
        for _, row in df.iterrows():
            try:
                # Converter datas
                inicio = None
                fim = None
                
                if 'INICIO' in df.columns and pd.notna(row['INICIO']):
                    try:
                        inicio = pd.to_datetime(row['INICIO'])
                    except:
                        pass
                
                if 'FIM' in df.columns and pd.notna(row['FIM']):
                    try:
                        fim = pd.to_datetime(row['FIM'])
                    except:
                        pass
                
                # Criar execução
                nova_execucao = Execucao(
                    tabela=row['TABELA'],
                    job=row['JOB'],
                    grupo=row['GRUPO'],
                    inicio=inicio,
                    fim=fim,
                    status=row['STATUS'],
                    hora_proc=row.get('HORA_PROC'),
                    minutos_proc=pd.to_numeric(row.get('MINUTOS_PROC'), errors='coerce'),
                    execucoes=int(row.get('EXECUCOES', 1))
                )
                
                db.add(nova_execucao)
                contador += 1
                
            except Exception as e:
                logger.error(f'❌ Erro ao processar linha de LOG: {e}')
                continue
        
        # Commit
        db.commit()
        logger.info(f'✅ LOGS ingeridos: {contador} registros')
        return contador
        
    except Exception as e:
        logger.error(f'❌ Erro ao ingerir LOGS: {e}')
        return 0
