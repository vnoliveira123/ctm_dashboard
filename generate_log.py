import csv
import random
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

random.seed(99)

CTM_PATH = Path(__file__).parent / 'csv_input' / 'CTM.csv'
LOG_PATH = Path(__file__).parent / 'csv_input' / 'LOG.csv'

# Período de geração: 7 meses (01/11/2025 a 14/06/2026)
START_DATE = datetime(2025, 11, 1)
END_DATE   = datetime(2026, 6, 14)

FIELDNAMES = ['TABELA', 'JOB', 'GRUPO', 'INICIO', 'FIM', 'STATUS', 'HORA_PROC', 'MINUTOS_PROC', 'EXECUCOES']


# ── Datas de execução por periodicidade ─────────────────────────────────────

def datas_de_execucao(periodicidade: str) -> list[datetime]:
    datas = []
    cur = START_DATE
    p = (periodicidade or 'DIARIO').upper()

    if p in ('DIARIO', 'DAILY'):
        while cur <= END_DATE:
            if cur.weekday() < 5:          # seg–sex
                datas.append(cur)
            cur += timedelta(days=1)

    elif p in ('SEMANAL', 'WEEKLY'):
        # toda segunda-feira
        while cur.weekday() != 0:
            cur += timedelta(days=1)
        while cur <= END_DATE:
            datas.append(cur)
            cur += timedelta(weeks=1)

    elif p in ('MENSAL', 'MONTHLY'):
        # dia 1 de cada mês (ou mais próximo dia útil)
        cur = START_DATE.replace(day=1)
        while cur <= END_DATE:
            datas.append(cur)
            m = cur.month + 1 if cur.month < 12 else 1
            y = cur.year if cur.month < 12 else cur.year + 1
            cur = cur.replace(year=y, month=m, day=1)

    elif p == 'TRIMESTRAL':
        for year in (2025, 2026):
            for month in (1, 4, 7, 10):
                d = datetime(year, month, 15)
                if START_DATE <= d <= END_DATE:
                    datas.append(d)

    elif p == 'SEMESTRAL':
        for year in (2025, 2026):
            for month in (1, 7):
                d = datetime(year, month, 15)
                if START_DATE <= d <= END_DATE:
                    datas.append(d)

    elif p == 'ANUAL':
        d = datetime(2026, 1, 15)
        if START_DATE <= d <= END_DATE:
            datas.append(d)

    else:   # A PEDIDO e outros
        total = (END_DATE - START_DATE).days
        for _ in range(random.randint(8, 20)):
            datas.append(START_DATE + timedelta(days=random.randint(0, total)))
        datas.sort()

    return datas


# ── Helpers de formatação ────────────────────────────────────────────────────

def fmt(dt: datetime) -> str:
    """hh:mm - dd/mm/yy"""
    return dt.strftime('%H:%M - %d/%m/%y')

def hora_proc(delta: timedelta) -> str:
    """hh:mm  (total em horas e minutos)"""
    tot = int(delta.total_seconds())
    return f'{tot // 3600:02d}:{(tot % 3600) // 60:02d}'

def minutos_proc(delta: timedelta) -> str:
    """mm:ss  (total em minutos e segundos)"""
    tot = int(delta.total_seconds())
    return f'{tot // 60:02d}:{tot % 60:02d}'

def parse_horario(fromtime: str, horario_carga: str) -> tuple[int, int]:
    """Retorna (hora, minuto) de início esperado do job."""
    if fromtime:
        try:
            h, m = fromtime.split(':')
            return int(h), int(m)
        except Exception:
            pass
    try:
        return int(str(horario_carga).strip()), 0
    except Exception:
        return 7, 0

def dia_operacional(dt: datetime) -> datetime:
    """Virada às 07h: retorna o início do dia operacional ao qual dt pertence."""
    corte = dt.replace(hour=7, minute=0, second=0, microsecond=0)
    return corte if dt >= corte else corte - timedelta(days=1)


# ── Geração de execuções ─────────────────────────────────────────────────────

def gerar_execucoes(row: dict, data_base: datetime) -> list[dict]:
    """
    Gera 1–3 registros de execução para um job em uma data operacional.
    EXECUCOES é preenchido com o total de corridas naquele dia operacional.
    """
    tabela = row['TABELA']
    job    = row['JOB']
    grupo  = row['GRUPO']

    base_h, base_m = parse_horario(row.get('FROMTIME', ''), row.get('HORARIO_CARGA', '07'))

    # Variação de ±20 minutos no horário de início
    jitter = timedelta(minutes=random.randint(-20, 20))
    inicio = data_base.replace(hour=base_h, minute=base_m, second=0) + jitter

    # Duração: distribuição realista (maioria 1–15 min, alguns até 90 min)
    dur_min = int(random.choices(
        population=list(range(1, 91)),
        weights=[max(1, 25 - abs(i - 6)) for i in range(1, 91)]
    )[0])
    dur_sec = random.randint(0, 59)

    # Número de execuções no dia operacional (reprocessamentos são raros)
    n_exec = random.choices([1, 2, 3], weights=[85, 12, 3])[0]

    registros = []
    cur_inicio = inicio
    for run in range(n_exec):
        delta = timedelta(minutes=dur_min + random.randint(-1, 3), seconds=dur_sec)
        if delta.total_seconds() < 60:
            delta = timedelta(minutes=1)
        cur_fim = cur_inicio + delta

        # 1ª execução: 88% OK; reruns: maioria OK (já é reprocessamento)
        prob_ok = 0.88 if run == 0 else 0.92
        status = 'OK' if random.random() < prob_ok else 'NOT OK'

        registros.append({
            'TABELA':       tabela,
            'JOB':          job,
            'GRUPO':        grupo,
            'INICIO':       fmt(cur_inicio),
            'FIM':          fmt(cur_fim),
            'STATUS':       status,
            'HORA_PROC':    hora_proc(delta),
            'MINUTOS_PROC': minutos_proc(delta),
            'EXECUCOES':    n_exec,
        })

        # Próxima execução começa 10–40 min após o fim da anterior
        cur_inicio = cur_fim + timedelta(minutes=random.randint(10, 40))

    return registros


# ── Main ─────────────────────────────────────────────────────────────────────

with open(CTM_PATH, encoding='utf-8', newline='') as f:
    jobs = list(csv.DictReader(f, delimiter='|'))

print(f'Lendo {len(jobs)} jobs do CTM...')

all_records = []
for job in jobs:
    per = job.get('PERIODICIDADE', 'DIARIO')
    for data in datas_de_execucao(per):
        all_records.extend(gerar_execucoes(job, data))

# Ordenar por INICIO (campo texto – converte para comparação)
def sort_key(r):
    try:
        return datetime.strptime(r['INICIO'], '%H:%M - %d/%m/%y')
    except Exception:
        return datetime.min

all_records.sort(key=sort_key)

with open(LOG_PATH, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=FIELDNAMES, delimiter='|')
    writer.writeheader()
    writer.writerows(all_records)

# Estatísticas
ok  = sum(1 for r in all_records if r['STATUS'] == 'OK')
nok = sum(1 for r in all_records if r['STATUS'] == 'NOT OK')
re_ = sum(1 for r in all_records if r['EXECUCOES'] > 1)
jobs_unicos = len({(r['TABELA'], r['JOB']) for r in all_records})

print(f'Gerado: {len(all_records):,} registros')
print(f'  OK: {ok:,}  |  NOT OK: {nok:,}  |  Taxa OK: {ok/len(all_records)*100:.1f}%')
print(f'  Reprocessamentos (EXECUCOES > 1): {re_:,}')
print(f'  Jobs únicos: {jobs_unicos}')
print(f'  Arquivo: {LOG_PATH}')
