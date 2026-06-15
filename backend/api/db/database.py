from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from config import DATABASE_URL
from api.db.models import Base

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Índices que aceleram os filtros mais usados nas queries de execuções e processos
_INDEXES = [
    # mat_execucoes_timeline — todas as queries de gráficos e listagem passam por aqui
    "CREATE INDEX IF NOT EXISTS ix_timeline_tabela_job  ON mat_execucoes_timeline (tabela, job)",
    "CREATE INDEX IF NOT EXISTS ix_timeline_data        ON mat_execucoes_timeline (data_execucao)",
    "CREATE INDEX IF NOT EXISTS ix_timeline_status      ON mat_execucoes_timeline (status)",
    "CREATE INDEX IF NOT EXISTS ix_timeline_grupo       ON mat_execucoes_timeline (grupo)",
    # Índice de expressão: filtragem por rotina (left(tabela, 4)) na timeline e execuções
    "CREATE INDEX IF NOT EXISTS ix_timeline_rotina      ON mat_execucoes_timeline (left(tabela, 4))",
    # raw_processos — filtros da tela de Processos e Fluxos
    "CREATE INDEX IF NOT EXISTS ix_processos_tabela     ON raw_processos (tabela)",
    "CREATE INDEX IF NOT EXISTS ix_processos_grupo      ON raw_processos (grupo)",
    "CREATE INDEX IF NOT EXISTS ix_processos_carga      ON raw_processos (carga)",
    "CREATE INDEX IF NOT EXISTS ix_processos_isd        ON raw_processos (isd)",
    "CREATE INDEX IF NOT EXISTS ix_processos_alerta     ON raw_processos (tem_alerta)",
    # Índice de expressão: filtragem por rotina em raw_processos
    "CREATE INDEX IF NOT EXISTS ix_processos_rotina     ON raw_processos (left(tabela, 4))",
    # raw_execucoes — watermark incremental e joins com timeline
    "CREATE INDEX IF NOT EXISTS ix_execucoes_tabela_job ON raw_execucoes (tabela, job)",
    "CREATE INDEX IF NOT EXISTS ix_execucoes_inicio     ON raw_execucoes (inicio)",
    "CREATE INDEX IF NOT EXISTS ix_execucoes_status     ON raw_execucoes (status)",
    # fluxos_processos — navegação de grafo (busca por origem e destino)
    "CREATE INDEX IF NOT EXISTS ix_fluxos_origem        ON fluxos_processos (tabela_origem, job_origem)",
    "CREATE INDEX IF NOT EXISTS ix_fluxos_destino       ON fluxos_processos (tabela_destino, job_destino)",
]

def init_db():
    '''Cria tabelas e índices no banco de dados.'''
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        for ddl in _INDEXES:
            conn.execute(text(ddl))
        conn.commit()
    print('✅ Banco de dados inicializado')

def get_db():
    '''Fornece conexão com o banco de dados.'''
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
