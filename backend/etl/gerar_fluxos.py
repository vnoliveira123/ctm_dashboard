import logging
from sqlalchemy.orm import Session
from api.db.models import Processo, Fluxo

logger = logging.getLogger(__name__)

def _parse_out_counds(out_counds_raw: str) -> list[tuple[str, str]]:
    """
    Parseia OUT_COUNDS e retorna lista de (condicao, sinal).
    Cada linha tem formato: 'JOB1-JOB2-JBODAT +' ou 'JOB1-JOB2-JBODAT -'
    Retorna só as linhas com '+' (geração de evento/dependência).
    """
    if not out_counds_raw:
        return []
    resultados = []
    for linha in out_counds_raw.splitlines():
        linha = linha.strip()
        if not linha:
            continue
        if linha.endswith('+'):
            condicao = linha[:-1].strip()
            resultados.append((condicao, '+'))
        elif linha.endswith('-'):
            condicao = linha[:-1].strip()
            resultados.append((condicao, '-'))
    return resultados


def gerar_fluxos_automaticos(db: Session) -> int:
    """
    Gera fluxos a partir de OUT_COUNDS/IN_COUNDS dos processos CTM.
    Lógica:
      - Para cada processo com OUT_COUNDS contendo '+', identifica a condição gerada.
      - Busca o processo que tem essa condição em IN_COUNDS.
      - Cria o fluxo: origem → destino com essa condição.
    """
    try:
        processos = db.query(Processo).all()
        logger.info(f'Analisando {len(processos)} processos para dependências...')

        # Índice: condição → processo que a consome (IN_COUNDS)
        indice_in: dict[str, Processo] = {}
        for p in processos:
            if p.in_counds:
                # IN_COUNDS é uma única condição por job
                cond = p.in_counds.strip()
                if cond:
                    indice_in[cond] = p

        # Conjunto de fluxos já existentes para evitar duplicatas
        existentes = set(
            (f.job_origem, f.job_destino, f.condicao)
            for f in db.query(Fluxo.job_origem, Fluxo.job_destino, Fluxo.condicao).all()
        )

        novos_fluxos = []
        for origem in processos:
            if not origem.out_counds:
                continue
            for condicao, sinal in _parse_out_counds(origem.out_counds):
                if sinal != '+':
                    continue
                destino = indice_in.get(condicao)
                if not destino:
                    continue
                chave = (origem.job, destino.job, condicao)
                if chave in existentes:
                    continue
                existentes.add(chave)
                novos_fluxos.append(Fluxo(
                    tabela_origem=origem.tabela,
                    job_origem=origem.job,
                    grupo_origem=origem.grupo,
                    tabela_destino=destino.tabela,
                    job_destino=destino.job,
                    condicao=condicao,
                    tipo_fluxo='CTM',
                    descricao=f'{origem.job} -> {destino.job} via {condicao}',
                ))

        if novos_fluxos:
            db.bulk_save_objects(novos_fluxos)
            db.commit()

        logger.info(f'Fluxos gerados: {len(novos_fluxos)}')
        return len(novos_fluxos)

    except Exception as e:
        logger.error(f'Erro ao gerar fluxos: {e}')
        db.rollback()
        return 0
