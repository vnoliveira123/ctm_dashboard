from sqlalchemy import create_engine
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

def init_db():
    '''Cria todas as tabelas no banco de dados.'''
    Base.metadata.create_all(bind=engine)
    print('✅ Banco de dados inicializado')

def get_db():
    '''Fornece conexão com o banco de dados.'''
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
