import csv
import random

random.seed(42)

GRUPOS_PREFIX = ['PR12', 'PR21', 'PR31', 'PR41']
HORARIOS = ['00', '01', '03', '07', '10', '13', '16', '19', '23']
PERIODICIDADES = ['DIARIO', 'SEMANAL', 'MENSAL', 'ANUAL', 'TRIMESTRAL', 'SEMESTRAL', 'A PEDIDO']
CALENDARIOS = ['CAL_UTIL', 'CAL_MENSAL', 'CAL_ANUAL', 'CAL_SEMANAL', 'CAL_TODOS']
AMBIENTES = ['AL1', 'MZ1']
TASKTYPES = ['JOB', 'CYC']
EVENTOS_ISD = ['FORCE TABELA', 'FORCE JOB', 'ADICIONA CONDIÇÃO']
ALERTA_CONFIGS = ['EXECTIME', 'LATE', 'LATESUB']
TIPOS_ALERTA = ['OPER', 'TSO-P', 'U-ECS']
COMENTARIOS = [
    'PROCESSAMENTO DIARIO DE LOTE',
    'CARGA DE DADOS MENSAIS',
    'JOB DE RECONCILIACAO',
    'PROCESSAMENTO FINANCEIRO',
    'GERACAO DE RELATORIOS',
    'CARGA INCREMENTAL',
    'JOB DE BACKUP',
    'PROCESSAMENTO CONTABIL',
    'GERACAO DE EXTRATOS',
    'CARGA DE TABELAS DE PARAMETRO',
    'PROCESSAMENTO DE PAGAMENTOS',
    'RECONCILIACAO BANCARIA',
    'CARGA DE HISTORICO',
    'JOB DE INTERFACE',
    'PROCESSAMENTO DE ARQUIVOS',
]

# Table prefixes: 4 letters + 1 letter/digit (5th char), jobs within table add 3-digit suffix
TABLE_BASES = [
    'PGITA', 'PGITB', 'ACEVN', 'BRTXC', 'FINCA',
    'LOGD0', 'DAT1X', 'RPT2A', 'BAT3H', 'SCH4D',
    'CONC5', 'PAYM6', 'HIST7', 'INTR8', 'RECP9',
    'EXTB0', 'COBA1', 'FINB2', 'RELB3', 'PAGB4',
    'CONB5', 'INTC6', 'RECB7', 'CRGB8', 'DATB9',
]

def memlib_resource(grupo):
    memlibs = ['MX.JCLFILE', f'MX.CTMR.{grupo}.SCHEFILE', 'DUMMY']
    ml = random.choice(memlibs)
    if ml == 'DUMMY':
        rs = f'DM-{grupo}-INIT'
    elif ml == 'MX.JCLFILE':
        rs = f'NC-{grupo}-INIT'
    else:
        rs = f'CR-{grupo}-INIT'
    return ml, rs

def random_time(hour_min=6, hour_max=23):
    h = random.randint(hour_min, hour_max)
    m = random.choice([0, 15, 30, 45])
    return f'{h:02d}:{m:02d}'

def make_condition(job_from, job_to):
    return f'{job_from}-{job_to}-JBODAT'

def generate_table(table_base, grupo, num_jobs):
    """Generate rows for a single table with chained IN/OUT conditions."""
    rows = []
    jobs = [f'{table_base}{i:03d}' for i in range(num_jobs)]
    tabela = f'{table_base}000'
    tasktype = random.choice(TASKTYPES)
    carga = random.choice(['SIM', 'NAO'])
    horario = random.choice(HORARIOS)
    isd = random.choice(['SIM', 'NAO'])
    evento_isd = random.choice(EVENTOS_ISD) if isd == 'SIM' else ''
    periodicidade = random.choice(PERIODICIDADES)
    calendario = random.choice(CALENDARIOS)
    fromtime = random_time(6, 20)
    from_h, from_m = map(int, fromtime.split(':'))
    until_h = min(from_h + random.randint(1, 4), 23)
    untiltime = f'{until_h:02d}:{random.choice([0,15,30,45]):02d}'
    ambiente = random.choice(AMBIENTES)
    ml, rs = memlib_resource(grupo)

    for idx, job in enumerate(jobs):
        is_first = idx == 0
        is_last = idx == len(jobs) - 1

        # IN_CONDS
        if is_first:
            in_conds = ''
        else:
            in_conds = make_condition(jobs[idx - 1], job)

        # OUT_CONDS
        out_parts = []
        if not is_first:
            # delete the incoming condition
            out_parts.append(make_condition(jobs[idx - 1], job) + ' -')
        if not is_last:
            # generate condition for next job
            out_parts.append(make_condition(job, jobs[idx + 1]) + ' +')
        out_conds = '\n'.join(out_parts)

        tem_alerta = random.choice(['SIM', 'NAO'])
        alerta_config = random.choice(ALERTA_CONFIGS) if tem_alerta == 'SIM' else ''
        tipo_alerta = random.choice(TIPOS_ALERTA) if tem_alerta == 'SIM' else ''
        padrao = random.choice(['SIM', 'NAO'])
        maxwait = '05' if tasktype == 'JOB' else '00'
        confirm = 'Y' if random.random() < 0.2 else ''
        intersit_val = ''
        if random.random() < 0.3:
            ev = random.choice(EVENTOS_ISD)
            intersit_val = f'SIM; EVENTO: {ev}; {tabela}; AMBIENTE={ambiente}'

        rows.append({
            'TABELA': tabela,
            'JOB': job,
            'GRUPO': f'{grupo}-{tabela}',
            'TASKTYPE': tasktype,
            'CARGA': carga,
            'HORARIO_CARGA': horario,
            'ISD': isd,
            'EVENTO_ISD': evento_isd,
            'TEM_ALERTA': tem_alerta,
            'ALERTA_CONFIG': alerta_config,
            'TIPO_ALERTA': tipo_alerta,
            'PADRAO': padrao,
            'MAXQAIT': maxwait,
            'FROMTIME': fromtime,
            'UNTILTIME': untiltime,
            'CONFIRM': confirm,
            'MEMLIB': ml,
            'RESOURCE': rs,
            'PERIODICIDADE': periodicidade,
            'CALENDARIO': calendario,
            'INTERSIT': intersit_val,
            'IN_COUNDS': in_conds,
            'OUT_COUNDS': out_conds,
            'COMENTARIO': random.choice(COMENTARIOS),
        })
    return rows

FIELDNAMES = [
    'TABELA', 'JOB', 'GRUPO', 'TASKTYPE', 'CARGA', 'HORARIO_CARGA',
    'ISD', 'EVENTO_ISD', 'TEM_ALERTA', 'ALERTA_CONFIG', 'TIPO_ALERTA',
    'PADRAO', 'MAXQAIT', 'FROMTIME', 'UNTILTIME', 'CONFIRM', 'MEMLIB',
    'RESOURCE', 'PERIODICIDADE', 'CALENDARIO', 'INTERSIT',
    'IN_COUNDS', 'OUT_COUNDS', 'COMENTARIO',
]

all_rows = []
for base in TABLE_BASES:
    grupo = random.choice(GRUPOS_PREFIX)
    num_jobs = random.randint(5, 20)
    all_rows.extend(generate_table(base, grupo, num_jobs))

output_path = r'C:\Users\victo\OneDrive\Documentos\Programação\Projetos\log_dashboard\csv_input\CTM.csv'

with open(output_path, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=FIELDNAMES, delimiter='|')
    writer.writeheader()
    writer.writerows(all_rows)

print(f'Gerado: {len(all_rows)} linhas em {output_path}')
