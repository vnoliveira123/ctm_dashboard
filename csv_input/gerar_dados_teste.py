"""
Gera linhas de teste no CTM.csv cobrindo todos os cenários de fluxo.
Execute: python csv_input/gerar_dados_teste.py
"""
import os

CSV_PATH = os.path.join(os.path.dirname(__file__), "CTM.csv")

# Colunas: TABELA|JOB|GRUPO|TASKTYPE|CARGA|HORARIO_CARGA|ISD|EVENTO_ISD|
#           TEM_ALERTA|ALERTA_CONFIG|TIPO_ALERTA|PADRAO|MAXQAIT|FROMTIME|UNTILTIME|
#           CONFIRM|MEMLIB|RESOURCE|PERIODICIDADE|CALENDARIO|INTERSIT|IN_COUNDS|OUT_COUNDS|COMENTARIO


def row(tabela, job, grupo, carga="SIM", horario="07", isd="NAO", evento_isd="",
        tem_alerta="NAO", alerta_cfg="", tipo_alerta="", padrao="SIM",
        maxqait="00", fromtime="07:00", untiltime="08:00", confirm="",
        memlib="MX.JCLFILE", resource="NC-PR21-INIT", periodicidade="DIARIO",
        calendario="CAL_TODOS", intersit="", in_counds="", out_counds="",
        comentario=""):
    fields = [
        tabela, job, grupo, "JOB", carga, horario, isd, evento_isd,
        tem_alerta, alerta_cfg, tipo_alerta, padrao, maxqait, fromtime, untiltime,
        confirm, memlib, resource, periodicidade, calendario, intersit,
        in_counds, out_counds, comentario,
    ]
    return "|".join(fields)


linhas = [
    # ─────────────────────────────────────────────────────────────────────────
    # CENÁRIO 1 — Fluxo simples: início sem IN, fim com OUT apenas no último JOB
    #   TSFL0000(início) → TSFL0001(meio) → TSFL0002(fim → PA12 controle)
    # ─────────────────────────────────────────────────────────────────────────
    row("TSFL0", "TSFL0000", "PR21-TSFL0",
        carga="SIM", resource="NC-PR21-INIT",
        in_counds="",
        out_counds="TSFL0000-TSFL0001-JBODAT+",
        comentario="FLUXO SIMPLES - INICIO SEM IN_COUNDS"),
    row("TSFL0", "TSFL0001", "PR21-TSFL0",
        carga="SIM", resource="NC-PR21-INIT",
        in_counds="TSFL0000-TSFL0001-JBODAT",
        out_counds="TSFL0000-TSFL0001-JBODAT-TSFL0001-TSFL0002-JBODAT+",
        comentario="FLUXO SIMPLES - JOB MEIO"),
    row("TSFL0", "TSFL0002", "PR21-TSFL0",
        carga="SIM", resource="NC-PR21-INIT",
        in_counds="TSFL0001-TSFL0002-JBODAT",
        out_counds="TSFL0001-TSFL0002-JBODAT-TSFL0002-PA12000-JBODAT+",
        comentario="FLUXO SIMPLES - FIM (CONTROLE EFETUADO VIA PA12)"),

    # ─────────────────────────────────────────────────────────────────────────
    # Tabela de controle PA12 — recebe condição de TSFL0002
    # Nome PA12 corresponde ao padrão ^[A-Za-z]{2}\d{2}
    # ─────────────────────────────────────────────────────────────────────────
    row("PA12", "PA12000", "PA12-PA12",
        carga="NAO", memlib="DUMMY", resource="DM-PA12-CTRL",
        in_counds="TSFL0002-PA12000-JBODAT",
        out_counds="TSFL0002-PA12000-JBODAT-",
        comentario="TABELA CONTROLE PA12 - RECEBE CONDICAO DE TSFL0"),

    # ─────────────────────────────────────────────────────────────────────────
    # CENÁRIO 2 — Semáforo LIBERADO-JBSTAT
    #   início lê LIBERADO (sem deletar), fim restaura com JBSTAT+
    # ─────────────────────────────────────────────────────────────────────────
    row("TLIB0", "TLIB0000", "PR12-TLIB0",
        carga="SIM", resource="NC-PR12-INIT",
        in_counds="LIBERADO-TLIB0-JBSTAT",          # lê semáforo sem deletar
        out_counds="LIBERADO-TLIB0-JBSTAT-TLIB0000-TLIB0001-JBODAT+",
        comentario="SEMAFORO LIBERADO - INICIO (LE JBSTAT SEM DELETAR)"),
    row("TLIB0", "TLIB0001", "PR12-TLIB0",
        carga="SIM", resource="NC-PR12-INIT",
        in_counds="TLIB0000-TLIB0001-JBODAT",
        out_counds="TLIB0000-TLIB0001-JBODAT-TLIB0001-TLIB0002-JBODAT+",
        comentario="SEMAFORO LIBERADO - MEIO"),
    row("TLIB0", "TLIB0002", "PR12-TLIB0",
        carga="SIM", resource="NC-PR12-INIT",
        in_counds="TLIB0001-TLIB0002-JBODAT",
        out_counds="TLIB0001-TLIB0002-JBODAT-LIBERADO-TLIB0-JBSTAT+",  # restaura semáforo
        comentario="SEMAFORO LIBERADO - FIM (RESTAURA JBSTAT+) SUSCETIVEL CONTROLE"),

    # ─────────────────────────────────────────────────────────────────────────
    # CENÁRIO 3 — Controle cross-table (teste de loop aparente)
    #   TCTLA dispara TCTLB via JBODAT; TCTLB fim restaura semáforo de TCTLA (JBSTAT+)
    #   gerar_fluxos deve ignorar o JBSTAT+ e NÃO criar aresta TCTLB→TCTLA
    # ─────────────────────────────────────────────────────────────────────────
    row("TCTLA0", "TCTLA0000", "PR31-TCTLA0",
        carga="SIM", horario="19", fromtime="19:00", untiltime="23:00",
        resource="NC-PR31-INIT",
        in_counds="LIBERADO-TCTLA0-JBSTAT",          # semáforo da própria tabela
        out_counds="TCTLA0000-TCTLA0001-JBODAT+",
        comentario="CROSS-TABLE TCTLA - INICIO COM SEMAFORO"),
    row("TCTLA0", "TCTLA0001", "PR31-TCTLA0",
        carga="SIM", horario="19", fromtime="19:00", untiltime="23:00",
        resource="NC-PR31-INIT",
        in_counds="TCTLA0000-TCTLA0001-JBODAT",
        out_counds="TCTLA0000-TCTLA0001-JBODAT-TCTLA0001-TCTLB0000-JBODAT+",
        comentario="CROSS-TABLE TCTLA - FIM (DISPARA TCTLB VIA JBODAT)"),

    row("TCTLB0", "TCTLB0000", "PR41-TCTLB0",
        carga="SIM", horario="19", fromtime="19:00", untiltime="23:00",
        resource="NC-PR41-INIT",
        in_counds="TCTLA0001-TCTLB0000-JBODAT",
        out_counds="TCTLA0001-TCTLB0000-JBODAT-TCTLB0000-TCTLB0001-JBODAT+",
        comentario="CROSS-TABLE TCTLB - INICIO (RECEBE DISPARO DE TCTLA)"),
    row("TCTLB0", "TCTLB0001", "PR41-TCTLB0",
        carga="SIM", horario="19", fromtime="19:00", untiltime="23:00",
        resource="NC-PR41-INIT",
        in_counds="TCTLB0000-TCTLB0001-JBODAT",
        # restaura semáforo da TCTLA → loop aparente
        out_counds="TCTLB0000-TCTLB0001-JBODAT-LIBERADO-TCTLA0-JBSTAT+",
        comentario="CROSS-TABLE TCTLB - FIM (RESTAURA SEMAFORO TCTLA - LOOP APARENTE IGNORADO)"),

    # ─────────────────────────────────────────────────────────────────────────
    # CENÁRIO 4 — Tabelas sem amarrações (vários JOBs início, sem condições)
    # ─────────────────────────────────────────────────────────────────────────
    row("TSOL0", "TSOL0000", "PR21-TSOL0",
        carga="SIM", horario="08", fromtime="08:00", untiltime="09:00",
        in_counds="", out_counds="",
        comentario="TABELA SOLTA - JOB INICIO 1 SEM CONEXAO"),
    row("TSOL0", "TSOL0001", "PR21-TSOL0",
        carga="NAO", horario="", fromtime="08:00", untiltime="09:00",
        in_counds="", out_counds="",
        comentario="TABELA SOLTA - JOB SEM CARGA E SEM CONEXAO"),
    row("TSOL0", "TSOL0002", "PR21-TSOL0",
        carga="SIM", horario="08", fromtime="08:00", untiltime="09:00",
        in_counds="", out_counds="",
        comentario="TABELA SOLTA - JOB INICIO 3 SEM CONEXAO"),
    row("TSOL0", "TSOL0003", "PR21-TSOL0",
        carga="SIM", horario="08", fromtime="08:00", untiltime="09:00",
        in_counds="", out_counds="",
        comentario="TABELA SOLTA - JOB INICIO 4 SEM CONEXAO"),

    # ─────────────────────────────────────────────────────────────────────────
    # CENÁRIO 5 — Semáforo JBSTAT com nome diferente de LIBERADO (ABERTO)
    # ─────────────────────────────────────────────────────────────────────────
    row("TSTAT0", "TSTAT0000", "PR12-TSTAT0",
        carga="SIM", resource="NC-PR12-INIT",
        in_counds="ABERTO-TSTAT0-JBSTAT",            # semáforo com nome "ABERTO"
        out_counds="TSTAT0000-TSTAT0001-JBODAT+",
        comentario="STAT NOME ABERTO - INICIO (LE JBSTAT SEM DELETAR)"),
    row("TSTAT0", "TSTAT0001", "PR12-TSTAT0",
        carga="SIM", resource="NC-PR12-INIT",
        in_counds="TSTAT0000-TSTAT0001-JBODAT",
        out_counds="TSTAT0000-TSTAT0001-JBODAT-TSTAT0001-TSTAT0002-JBODAT+",
        comentario="STAT NOME ABERTO - MEIO"),
    row("TSTAT0", "TSTAT0002", "PR12-TSTAT0",
        carga="SIM", resource="NC-PR12-INIT",
        in_counds="TSTAT0001-TSTAT0002-JBODAT",
        out_counds="TSTAT0001-TSTAT0002-JBODAT-ABERTO-TSTAT0-JBSTAT+TSTAT0002-PA12000-JBODAT+",
        comentario="STAT NOME ABERTO - FIM (RESTAURA JBSTAT+)"),

    # ─────────────────────────────────────────────────────────────────────────
    # PADRÕES EXTRAS — JBSTAT-, JBPREV, JOBNEXT, JBODAT read-only
    # ─────────────────────────────────────────────────────────────────────────

    # JBSTAT- : início lê e DELETA o semáforo (deletado no OUT com -)
    row("TJBST0", "TJBST0000", "PR12-TJBST0",
        carga="SIM", resource="NC-PR12-INIT",
        in_counds="LIBERADO-TJBST0-JBSTAT",
        # deleta JBSTAT (padrão JBSTAT-)
        out_counds="TJBST0000-TJBST0001-JBODAT+LIBERADO-TJBST0-JBSTAT-",
        comentario="PADRAO JBSTAT- : INICIO LE E DELETA SEMAFORO NO OUT"),
    row("TJBST0", "TJBST0001", "PR12-TJBST0",
        carga="SIM", resource="NC-PR12-INIT",
        in_counds="TJBST0000-TJBST0001-JBODAT",
        out_counds="TJBST0000-TJBST0001-JBODAT-LIBERADO-TJBST0-JBSTAT+",  # fim restaura
        comentario="PADRAO JBSTAT- : FIM RESTAURA SEMAFORO (JBSTAT+)"),

    # JBPREV : lê condição do dia anterior
    row("TPREV0", "TPREV0000", "PR21-TPREV0",
        carga="SIM", resource="NC-PR21-INIT",
        # lê condição de ontem e deleta no OUT
        in_counds="TPREV-ATIVO-JBPREV",
        out_counds="TPREV-ATIVO-JBPREV-TPREV0000-TPREV0001-JBODAT+",
        comentario="PADRAO JBPREV : INICIO LE E DELETA CONDICAO DO DIA ANTERIOR"),
    row("TPREV0", "TPREV0001", "PR21-TPREV0",
        carga="SIM", resource="NC-PR21-INIT",
        in_counds="TPREV0000-TPREV0001-JBODAT",
        out_counds="TPREV0000-TPREV0001-JBODAT-",
        comentario="PADRAO JBPREV : FIM"),

    # JOBNEXT : produz condição para o próximo dia
    row("TNEXT0", "TNEXT0000", "PR21-TNEXT0",
        carga="SIM", horario="22", fromtime="22:00", untiltime="23:59",
        resource="NC-PR21-INIT",
        in_counds="",
        # produz condição de amanhã (JOBNEXT+)
        out_counds="TNEXT-INICIO-JOBNEXT+",
        comentario="PADRAO JOBNEXT : PRODUZ CONDICAO PARA O PROXIMO DIA"),
    row("TNEXT0", "TNEXT0001", "PR21-TNEXT0",
        carga="SIM", horario="22", fromtime="22:00", untiltime="23:59",
        resource="NC-PR21-INIT",
        # lê JOBNEXT (condição produzida ontem) sem deletar → read-only JBODAT equivalente
        in_counds="TNEXT-INICIO-JOBNEXT",
        out_counds="TNEXT-INICIO-JOBNEXT-TNEXT0001-TNEXT0002-JBODAT+",
        comentario="PADRAO JOBNEXT : LE CONDICAO DO DIA ANTERIOR E DELETA"),
    row("TNEXT0", "TNEXT0002", "PR21-TNEXT0",
        carga="SIM", horario="22", fromtime="22:00", untiltime="23:59",
        resource="NC-PR21-INIT",
        in_counds="TNEXT0001-TNEXT0002-JBODAT",
        out_counds="TNEXT0001-TNEXT0002-JBODAT-",
        comentario="PADRAO JOBNEXT : FIM"),

    # JBODAT read-only : IN_COUNDS lê condição mas OUT_COUNDS não a deleta (persiste)
    row("TRDOL0", "TRDOL0000", "PR21-TRDOL0",
        carga="SIM", resource="NC-PR21-INIT",
        in_counds="",
        out_counds="TRDOL-EVENTO-JBODAT+",           # produz evento
        comentario="JBODAT READ-ONLY : PRODUZ EVENTO"),
    row("TRDOL0", "TRDOL0001", "PR21-TRDOL0",
        carga="SIM", resource="NC-PR21-INIT",
        # lê evento SEM deletar no OUT (read-only)
        in_counds="TRDOL-EVENTO-JBODAT",
        # encadeia próximo JOB mas não deleta o evento
        out_counds="TRDOL0001-TRDOL0002-JBODAT+",
        comentario="JBODAT READ-ONLY : LE EVENTO SEM DELETAR E ENCADEIA"),
    row("TRDOL0", "TRDOL0002", "PR21-TRDOL0",
        carga="SIM", resource="NC-PR21-INIT",
        in_counds="TRDOL0001-TRDOL0002-JBODAT",
        out_counds="TRDOL0001-TRDOL0002-JBODAT-",
        comentario="JBODAT READ-ONLY : FIM"),
]

with open(CSV_PATH, "a", encoding="utf-8", newline="\n") as f:
    for linha in linhas:
        f.write(linha + "\n")

print(f"Adicionadas {len(linhas)} linhas de teste em {CSV_PATH}")
