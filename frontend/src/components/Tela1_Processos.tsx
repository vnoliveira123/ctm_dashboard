import React, { useState } from 'react';
import * as d3 from 'd3';
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TextField, Button, CircularProgress, Alert, Pagination, Card,
  CardContent, Typography, Chip, FormControl, InputLabel, Select, MenuItem,
  OutlinedInput, Checkbox, ListItemText, Divider, Collapse, Grid, Autocomplete,
} from '@mui/material';
import FilterListIcon          from '@mui/icons-material/FilterList';
import ClearIcon               from '@mui/icons-material/Clear';
import WorkIcon                from '@mui/icons-material/Work';
import TableChartIcon          from '@mui/icons-material/TableChart';
import AutorenewIcon           from '@mui/icons-material/Autorenew';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AccountTreeIcon         from '@mui/icons-material/AccountTree';
import PowerOffIcon            from '@mui/icons-material/PowerOff';
import {
  useProcessos, useFiltrosDisponiveis, useGraficosProcessos,
  useJobsSemExecucao, useAlertasNaoPadrao, useJanelaCarga,
  FiltrosProcesso, JobSemExecucao, AlertaNaoPadrao, JanelaCargaItem,
} from '../hooks/useProcessos';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

// ── Constantes ────────────────────────────────────────────────────────────────
const GRUPOS      = ['PR12', 'PR21', 'PR31', 'PR41'];
const HORARIOS    = ['00', '01', '03', '07', '10', '13', '16', '19', '23'];
const MEMLIBS     = ['MX.JCLFILE','MX.CTMR.PR12.SCHEFILE','MX.CTMR.PR21.SCHEFILE','MX.CTMR.PR31.SCHEFILE','MX.CTMR.PR41.SCHEFILE','DUMMY'];
const EVENTOS_ISD = ['FORCE TABELA', 'FORCE JOB', 'ADICIONA CONDIÇÃO'];
const TIPOS_ALERTA = ['OPER', 'TSO-P', 'U-ECS'];

const CORES_PERIOD = [
  '#1976d2','#2e7d32','#e65100','#7b1fa2','#c62828',
  '#00838f','#f57f17','#4527a0','#ad1457','#558b2f',
];

const FILTROS_VAZIOS: FiltrosProcesso = {
  tabela: '', job: '', rotina: '', grupo: '', periodicidade: '', tasktype: '', confirm: '', memlib: '',
  carga: '', horarios_carga: [], isd: '', evento_isd: '',
  tem_alerta: '', padrao: '', tipo_alerta: '',
};

const trunc = (s: string, n: number) => s.length > n ? s.slice(0, n) + '…' : s;

// ── Wrapper de gráfico ────────────────────────────────────────────────────────
const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Card variant="outlined" sx={{ height: '100%' }}>
    <CardContent sx={{ pb: '16px !important' }}>
      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </CardContent>
  </Card>
);

// ── 1. Pizza — Periodicidades ─────────────────────────────────────────────────
const GraficoPeriodPizza: React.FC<{ data: { periodicidade: string; total: number }[] }> = ({ data }) => {
  if (!data.length) return null;
  const R = 100; const IR = 56; const CX = 190; const CY = 120;
  const VW = 560; const VH = 260;
  const pie   = d3.pie<{ periodicidade: string; total: number }>().value(d => d.total).sort(null);
  const arc   = d3.arc<d3.PieArcDatum<{ periodicidade: string; total: number }>>().innerRadius(IR).outerRadius(R);
  const arcLbl = d3.arc<d3.PieArcDatum<{ periodicidade: string; total: number }>>().innerRadius(R * 0.72).outerRadius(R * 0.72);
  const slices = pie(data);
  const total  = d3.sum(data, d => d.total);

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%">
      <g transform={`translate(${CX},${CY})`}>
        {slices.map((s, i) => (
          <g key={i}>
            <path d={arc(s) ?? ''} fill={CORES_PERIOD[i % CORES_PERIOD.length]} stroke="white" strokeWidth={2}>
              <title>{s.data.periodicidade}: {s.data.total}</title>
            </path>
            {(s.endAngle - s.startAngle) > 0.25 && (
              <text transform={`translate(${arcLbl.centroid(s)})`}
                    textAnchor="middle" fontSize={11} fill="white" fontWeight="bold" dy="0.35em">
                {Math.round(s.data.total / total * 100)}%
              </text>
            )}
          </g>
        ))}
        <text textAnchor="middle" dy="-0.2em" fontSize={15} fontWeight="bold" fill="#333">{total}</text>
        <text textAnchor="middle" dy="1.2em" fontSize={10} fill="#999">jobs</text>
      </g>
      {/* Legenda lateral */}
      <g transform={`translate(${CX + R + 24}, ${CY - (data.length * 18) / 2})`}>
        {data.map((d, i) => (
          <g key={i} transform={`translate(0,${i * 22})`}>
            <rect width={12} height={12} rx={2} fill={CORES_PERIOD[i % CORES_PERIOD.length]} />
            <text x={18} y={10} fontSize={11} fill="#444">{d.periodicidade}</text>
            <text x={180} y={10} fontSize={11} fill="#888" fontWeight="bold" textAnchor="end">
              {d.total}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
};

// ── 2. Barras horizontais — Top tabelas por jobs (scroll) ────────────────────
const GraficoJobsPorTabela: React.FC<{ data: { tabela: string; total_jobs: number }[] }> = ({ data }) => {
  if (!data.length) return null;
  const barH = 20, VW = 520, ML = 100, MR = 32, MT = 8, MB = 8;
  const IW_G = VW - ML - MR;
  const IH   = data.length * (barH + 4);
  const x = d3.scaleLinear().domain([0, d3.max(data, d => d.total_jobs) || 1]).range([0, IW_G]).nice();
  const y = d3.scaleBand().domain(data.map(d => d.tabela)).range([0, IH]).padding(0.15);

  return (
    <Box sx={{ aspectRatio: `${VW} / 222`, overflowY: 'auto' }}>
      <svg viewBox={`0 0 ${VW} ${IH + MT + MB}`} width="100%"
           style={{ minHeight: IH + MT + MB }}>
        <g transform={`translate(${ML},${MT})`}>
          {x.ticks(5).map(t => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={0} y2={IH} stroke="#f0f0f0" />
              <text x={x(t)} y={IH + 14} textAnchor="middle" fontSize={9} fill="#888">{t}</text>
            </g>
          ))}
          {data.map(d => (
            <g key={d.tabela}>
              <rect x={0} y={y(d.tabela)!} width={x(d.total_jobs)} height={y.bandwidth()}
                    fill="#1976d2" rx={2} opacity={0.85}>
                <title>{d.tabela}: {d.total_jobs} jobs</title>
              </rect>
              <text x={-4} y={(y(d.tabela) ?? 0) + y.bandwidth() / 2} dy="0.35em"
                    textAnchor="end" fontSize={10} fill="#555">
                {trunc(d.tabela, 11)}
              </text>
              <text x={x(d.total_jobs) + 4} y={(y(d.tabela) ?? 0) + y.bandwidth() / 2} dy="0.35em"
                    fontSize={9} fill="#333" fontWeight="bold">
                {d.total_jobs}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </Box>
  );
};

// ── 3. Gráfico comparativo (carga / ISD / alertas) ───────────────────────────
const GraficoComparativo: React.FC<{
  sim: number; nao: number; total: number;
  labelSim: string; labelNao: string;
  corSim: string;
}> = ({ sim, nao, total, labelSim, labelNao, corSim }) => {
  const pSim = total ? (sim / total) * 100 : 0;
  const pNao = 100 - pSim;
  return (
    <Box>
      {/* Barra proporcional */}
      <Box sx={{ display: 'flex', height: 32, borderRadius: 1, overflow: 'hidden', mb: 1 }}>
        <Box sx={{
          width: `${pSim}%`, bgcolor: corSim, display: 'flex', alignItems: 'center',
          justifyContent: 'center', transition: 'width 0.4s',
        }}>
          {pSim > 12 && (
            <Typography variant="caption" color="white" fontWeight={700}>
              {Math.round(pSim)}%
            </Typography>
          )}
        </Box>
        <Box sx={{
          flex: 1, bgcolor: '#e0e0e0', display: 'flex', alignItems: 'center',
          justifyContent: 'center',
        }}>
          {pNao > 12 && (
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {Math.round(pNao)}%
            </Typography>
          )}
        </Box>
      </Box>
      {/* Legenda */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: corSim }} />
          <Typography variant="caption">{labelSim}: <strong>{sim}</strong></Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#e0e0e0', border: '1px solid #bbb' }} />
          <Typography variant="caption">{labelNao}: <strong>{nao}</strong></Typography>
        </Box>
      </Box>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}>
        Total: {total}
      </Typography>
    </Box>
  );
};

// ── Cards de resumo ───────────────────────────────────────────────────────────
const ResumoCard: React.FC<{
  icon: React.ReactNode; label: string; value: number; color: string;
  subLabel?: string; subValue?: number;
}> = ({ icon, label, value, color, subLabel, subValue }) => (
  <Card sx={{ flex: '1 1 160px', minWidth: 140, borderTop: `3px solid ${color}` }}>
    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, color }}>
        {icon}
        <Typography variant="caption" color="text.secondary" fontWeight={500}>{label}</Typography>
      </Box>
      <Typography variant="h5" fontWeight="bold">{value.toLocaleString('pt-BR')}</Typography>
      {subLabel !== undefined && subValue !== undefined && (
        <>
          <Divider sx={{ my: 0.75 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">{subLabel}</Typography>
            <Typography variant="body2" fontWeight="bold" color={color}>{subValue.toLocaleString('pt-BR')}</Typography>
          </Box>
        </>
      )}
    </CardContent>
  </Card>
);

// ── Filtro select reutilizável ────────────────────────────────────────────────
const SelectFiltro: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  opcoes: { value: string; label: string }[]; minWidth?: number;
}> = ({ label, value, onChange, opcoes, minWidth = 160 }) => (
  <FormControl size="small" sx={{ minWidth, flexShrink: 0 }}>
    <InputLabel>{label}</InputLabel>
    <Select value={value} label={label} onChange={e => onChange(e.target.value as string)}>
      <MenuItem value=""><em>Todos</em></MenuItem>
      {opcoes.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
    </Select>
  </FormControl>
);

// ── Componente principal ──────────────────────────────────────────────────────
export const Tela1Processos: React.FC = () => {
  const [filtros, setFiltros]             = useState<FiltrosProcesso>(FILTROS_VAZIOS);
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltrosProcesso>(FILTROS_VAZIOS);
  const [page, setPage]                   = useState(1);
  const [expandido, setExpandido]         = useState(true);
  const [exibirSemExec, setExibirSemExec]       = useState(false);
  const [exibirAlertasNP, setExibirAlertasNP]   = useState(false);
  const [exibirJanela, setExibirJanela]         = useState(false);

  const { data, isLoading, error } = useProcessos(filtrosAtivos, page);
  const { data: opcoes }           = useFiltrosDisponiveis();
  const { data: graficos }         = useGraficosProcessos(filtrosAtivos);
  const { data: semExec }          = useJobsSemExecucao(50);
  const { data: alertasNP }        = useAlertasNaoPadrao();
  const { data: janelaData }       = useJanelaCarga({
    dias:   7,
    tabela: filtrosAtivos.tabela || undefined,
    rotina: filtrosAtivos.rotina || undefined,
  });

  const set = (campo: keyof FiltrosProcesso) => (valor: any) => {
    setFiltros(prev => {
      const novo = { ...prev, [campo]: valor };
      if (campo === 'carga'      && valor !== 'SIM') novo.horarios_carga = [];
      if (campo === 'isd'        && valor !== 'SIM') novo.evento_isd = '';
      if (campo === 'tem_alerta') { novo.padrao = ''; novo.tipo_alerta = ''; }
      return novo;
    });
  };

  const aplicar = () => { setFiltrosAtivos(filtros); setPage(1); };
  const limpar  = () => { setFiltros(FILTROS_VAZIOS); setFiltrosAtivos(FILTROS_VAZIOS); setPage(1); };

  const resumo      = data?.resumo;
  const totalPaginas = Math.ceil((data?.total || 0) / 20);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>Processos Cadastrados</Typography>

      {/* ── Filtros ── */}
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
             onClick={() => setExpandido(v => !v)}>
          <FilterListIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight={600}>Filtros</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {expandido ? 'Recolher ▲' : 'Expandir ▼'}
          </Typography>
        </Box>
        <Collapse in={expandido}>
          <Divider />
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Linha única com scroll horizontal — todos os filtros lado a lado */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', overflowX: 'auto', pb: 0.5 }}>
              <TextField label="Tabela" value={filtros.tabela} size="small"
                         sx={{ minWidth: 140, flexShrink: 0 }}
                         onChange={e => set('tabela')(e.target.value)} />
              <TextField label="Job" value={filtros.job} size="small"
                         sx={{ minWidth: 140, flexShrink: 0 }}
                         onChange={e => set('job')(e.target.value)} />
              <Autocomplete
                options={opcoes?.rotinas || []}
                value={filtros.rotina || null}
                onChange={(_, v) => set('rotina')(v ?? '')}
                size="small"
                sx={{ minWidth: 130, flexShrink: 0 }}
                renderInput={params => <TextField {...params} label="Rotina" />}
              />
              <SelectFiltro label="Grupo" value={filtros.grupo || ''} onChange={set('grupo')}
                opcoes={GRUPOS.map(g => ({ value: g, label: g }))} minWidth={130} />
              <SelectFiltro label="Tipo" value={filtros.tasktype || ''} onChange={set('tasktype')}
                opcoes={(opcoes?.tasktypes || []).map(t => ({ value: t, label: t }))} minWidth={120} />
              <SelectFiltro label="Periodicidade" value={filtros.periodicidade || ''} onChange={set('periodicidade')}
                opcoes={(opcoes?.periodicidades || []).map(p => ({ value: p, label: p }))} minWidth={150} />
              <SelectFiltro label="Confirm" value={filtros.confirm || ''} onChange={set('confirm')}
                opcoes={[{ value: 'SIM', label: 'Sim' }, { value: 'NAO', label: 'Não' }]} minWidth={120} />
              <SelectFiltro label="Memlib" value={filtros.memlib || ''} onChange={set('memlib')}
                opcoes={MEMLIBS.map(m => ({ value: m, label: m }))} minWidth={200} />
              <SelectFiltro label="Carga" value={filtros.carga || ''} onChange={set('carga')}
                opcoes={[{ value: 'SIM', label: 'Sim' }, { value: 'NAO', label: 'Não' }]} minWidth={110} />
              {filtros.carga === 'SIM' && (
                <FormControl size="small" sx={{ minWidth: 180, flexShrink: 0 }}>
                  <InputLabel>Horário de Carga</InputLabel>
                  <Select multiple value={filtros.horarios_carga || []}
                          onChange={e => set('horarios_carga')(e.target.value as string[])}
                          input={<OutlinedInput label="Horário de Carga" />}
                          renderValue={sel => (sel as string[]).join(', ') || 'Todos'}>
                    {HORARIOS.map(h => (
                      <MenuItem key={h} value={h}>
                        <Checkbox checked={(filtros.horarios_carga || []).includes(h)} size="small" />
                        <ListItemText primary={`${h}h`} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <SelectFiltro label="ISD" value={filtros.isd || ''} onChange={set('isd')}
                opcoes={[{ value: 'SIM', label: 'Sim' }, { value: 'NAO', label: 'Não' }]} minWidth={110} />
              {filtros.isd === 'SIM' && (
                <SelectFiltro label="Evento ISD" value={filtros.evento_isd || ''} onChange={set('evento_isd')}
                  opcoes={EVENTOS_ISD.map(e => ({ value: e, label: e }))} minWidth={190} />
              )}
              <SelectFiltro label="Alerta" value={filtros.tem_alerta || ''} onChange={set('tem_alerta')}
                opcoes={[{ value: 'SIM', label: 'Sim' }, { value: 'NAO', label: 'Não' }]} minWidth={120} />
              {filtros.tem_alerta === 'SIM' && (
                <SelectFiltro label="Padrão" value={filtros.padrao || ''} onChange={set('padrao')}
                  opcoes={[{ value: 'SIM', label: 'Padrão' }, { value: 'NAO', label: 'Customizado' }]} minWidth={150} />
              )}
              {filtros.tem_alerta === 'NAO' && (
                <SelectFiltro label="Tipo Alerta" value={filtros.tipo_alerta || ''} onChange={set('tipo_alerta')}
                  opcoes={TIPOS_ALERTA.map(t => ({ value: t, label: t }))} minWidth={140} />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" size="small" onClick={aplicar}>Aplicar Filtros</Button>
              <Button variant="outlined"  size="small" startIcon={<ClearIcon />} onClick={limpar}>Limpar</Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* ── Cards de Resumo ── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <ResumoCard icon={<WorkIcon fontSize="small" />}
          label="Total de JOBs" value={resumo?.total_jobs ?? 0} color="#1976d2" />
        <ResumoCard icon={<TableChartIcon fontSize="small" />}
          label="Tabelas" value={resumo?.total_tabelas ?? 0} color="#7b1fa2" />
        <ResumoCard icon={<AutorenewIcon fontSize="small" />}
          label="Tabelas em Carga" value={resumo?.tabelas_carga ?? 0} color="#2e7d32" />
        <ResumoCard icon={<AccountTreeIcon fontSize="small" />}
          label="Tabelas com ISD" value={resumo?.tabelas_isd ?? 0} color="#e65100" />
        <ResumoCard icon={<NotificationsActiveIcon fontSize="small" />}
          label="Tabelas com Alertas" value={resumo?.tabelas_alerta ?? 0} color="#c62828"
          subLabel="JOBs com alerta" subValue={resumo?.jobs_alerta ?? 0} />
        <ResumoCard icon={<PowerOffIcon fontSize="small" />}
          label="Jobs Inativos (CTM×LOG)" value={semExec?.total ?? 0} color="#78909c" />
      </Box>

      {/* ── Gráficos ── */}
      {graficos && (
        <>
          {/* Linha 1: Pizza + Barras */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={5}>
              <ChartCard title="Distribuição por Periodicidade">
                <GraficoPeriodPizza data={graficos.periodicidades} />
              </ChartCard>
            </Grid>
            <Grid item xs={12} md={7}>
              <ChartCard title="Top 15 Tabelas por Número de JOBs">
                <GraficoJobsPorTabela data={graficos.jobs_por_tabela} />
              </ChartCard>
            </Grid>
          </Grid>

          {/* Linha 2: Três comparativos */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <ChartCard title="Carga Automática — Tabelas">
                <GraficoComparativo
                  sim={graficos.carga.sim} nao={graficos.carga.nao} total={graficos.carga.total}
                  labelSim="Com carga" labelNao="Sem carga" corSim="#2e7d32" />
              </ChartCard>
            </Grid>
            <Grid item xs={12} md={4}>
              <ChartCard title="ISD — Tabelas">
                <GraficoComparativo
                  sim={graficos.isd.sim} nao={graficos.isd.nao} total={graficos.isd.total}
                  labelSim="Com ISD" labelNao="Sem ISD" corSim="#e65100" />
              </ChartCard>
            </Grid>
            <Grid item xs={12} md={4}>
              <ChartCard title="Alertas — JOBs">
                <GraficoComparativo
                  sim={graficos.alertas.sim} nao={graficos.alertas.nao} total={graficos.alertas.total}
                  labelSim="Com alerta" labelNao="Sem alerta" corSim="#c62828" />
              </ChartCard>
            </Grid>
          </Grid>
        </>
      )}

      {/* ── Análise: Jobs Sem Execução + Alertas Não Padronizados (lado a lado) ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Jobs Inativos (CTM × LOG) */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ height: '100%' }}>
            <Box
              sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
              onClick={() => setExibirSemExec(v => !v)}
            >
              <PowerOffIcon fontSize="small" color="action" />
              <Typography variant="subtitle2" fontWeight={600}>Jobs Inativos (CTM × LOG)</Typography>
              <Chip label={semExec?.total ?? 0} size="small" sx={{ ml: 0.5 }} />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                {exibirSemExec ? 'Recolher ▲' : 'Expandir ▼'}
              </Typography>
            </Box>
            <Collapse in={exibirSemExec}>
              <Divider />
              {semExec && semExec.jobs.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.100' }}>
                        {['Tabela', 'Job', 'Grupo', 'Periodicidade', 'Carga'].map(c => (
                          <TableCell key={c} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{c}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {semExec.jobs.map((j: JobSemExecucao, i: number) => (
                        <TableRow key={i} hover>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{j.tabela}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{j.job}</TableCell>
                          <TableCell>
                            <Chip label={j.grupo?.split('-')[0] ?? j.grupo} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{j.periodicidade ?? '-'}</TableCell>
                          <TableCell>
                            {j.carga === 'SIM'
                              ? <Chip label="Sim" size="small" color="success" />
                              : <Chip label="Não" size="small" variant="outlined" />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ px: 2, py: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Nenhum job inativo — todos os processos cadastrados possuem execuções no período.
                  </Typography>
                </Box>
              )}
            </Collapse>
          </Paper>
        </Grid>

        {/* Alertas Não Padronizados (≠ U-ECS) */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ height: '100%' }}>
            <Box
              sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
              onClick={() => setExibirAlertasNP(v => !v)}
            >
              <NotificationsActiveIcon fontSize="small" color="error" />
              <Typography variant="subtitle2" fontWeight={600}>Alertas Não Padronizados (≠ U-ECS)</Typography>
              <Chip label={alertasNP?.alertas.length ?? 0} size="small" color="error" sx={{ ml: 0.5 }} />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                {exibirAlertasNP ? 'Recolher ▲' : 'Expandir ▼'}
              </Typography>
            </Box>
            <Collapse in={exibirAlertasNP}>
              <Divider />
              {alertasNP && alertasNP.alertas.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'error.light' }}>
                        {['Tabela', 'Job', 'Grupo', 'Tipo Alerta', 'Execuções'].map(c => (
                          <TableCell key={c} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{c}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {alertasNP.alertas.map((a: AlertaNaoPadrao, i: number) => (
                        <TableRow key={i} hover>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{a.tabela}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{a.job}</TableCell>
                          <TableCell>
                            <Chip label={a.grupo?.split('-')[0] ?? a.grupo} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Chip label={a.tipo_alerta} size="small" color="error" />
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{a.total_exec.toLocaleString('pt-BR')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ px: 2, py: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Nenhum alerta fora do padrão U-ECS encontrado.
                  </Typography>
                </Box>
              )}
            </Collapse>
          </Paper>
        </Grid>
      </Grid>

      {/* ── Janela de Carga ── */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Box
          sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
          onClick={() => setExibirJanela(v => !v)}
        >
          <AccessTimeIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight={600}>Janela de Carga — Análise de Pontualidade</Typography>
          {janelaData?.janela && (
            <Box sx={{ display: 'flex', gap: 0.5, ml: 0.5 }}>
              {(() => {
                const atrasadas = janelaData.janela.filter(j => j.status === 'atrasada').length;
                const noPrazo   = janelaData.janela.filter(j => j.status === 'no_prazo').length;
                return (
                  <>
                    {atrasadas > 0 && <Chip label={`${atrasadas} atrasada${atrasadas !== 1 ? 's' : ''}`} size="small" color="error" />}
                    {noPrazo   > 0 && <Chip label={`${noPrazo} no prazo`}                               size="small" color="success" variant="outlined" />}
                  </>
                );
              })()}
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {exibirJanela ? 'Recolher ▲' : 'Expandir ▼'}
          </Typography>
        </Box>
        <Collapse in={exibirJanela}>
          <Divider />
          {!janelaData?.janela.length ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, fontStyle: 'italic' }}>
              Nenhuma tabela com carga programada encontrada nos últimos 7 dias.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    {['Tabela', 'Horário CTM', 'Última Execução', 'Primeiro Início', 'Atraso', 'Situação'].map(c => (
                      <TableCell key={c} sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{c}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(janelaData?.janela ?? []).map((j: JanelaCargaItem, i: number) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{j.tabela}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>{String(j.hora_programada).padStart(2, '0')}h00</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>{j.dia}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {String(j.hora_real).padStart(2, '0')}:{String(j.min_real).padStart(2, '0')}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: j.delta_minutos > 30 ? 'error.main' : 'text.primary', fontWeight: j.delta_minutos > 30 ? 600 : 400 }}>
                        {j.delta_minutos > 0 ? `+${j.delta_minutos} min` : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={j.status === 'no_prazo' ? 'No Prazo' : 'Atrasada'}
                          size="small"
                          color={j.status === 'no_prazo' ? 'success' : 'error'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Collapse>
      </Paper>

      {/* ── Tabela ── */}
      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">Erro ao carregar processos. Verifique se a API está respondendo.</Alert>}

      {data && !isLoading && (
        <>
          {data.processos.length === 0 ? (
            <Alert severity="info">Nenhum processo encontrado para os filtros selecionados.</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    {['Tabela','Job','Grupo','Tipo','Periodicidade','Carga','Horário','ISD','Confirm','Alerta'].map(col => (
                      <TableCell key={col} sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{col}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.processos.map((p, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.tabela}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.job}</TableCell>
                      <TableCell>
                        <Chip label={p.grupo?.split('-')[0] ?? p.grupo} size="small" variant="outlined" color="primary" />
                      </TableCell>
                      <TableCell>
                        <Chip label={p.tasktype ?? '-'} size="small"
                              color={p.tasktype === 'JOB' ? 'default' : 'secondary'} variant="outlined" />
                      </TableCell>
                      <TableCell>{p.periodicidade ?? '-'}</TableCell>
                      <TableCell>
                        {p.carga === 'SIM'
                          ? <Chip label={`Sim • ${p.horario_carga}h`} size="small" color="success" />
                          : <Chip label="Não" size="small" variant="outlined" />}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {p.fromtime && p.untiltime ? `${p.fromtime} – ${p.untiltime}` : '-'}
                      </TableCell>
                      <TableCell>
                        {p.isd === 'SIM'
                          ? <Chip label="Sim" size="small" color="warning" />
                          : <Chip label="Não" size="small" variant="outlined" />}
                      </TableCell>
                      <TableCell>
                        {p.confirm === 'Y' ? <Chip label="Sim" size="small" color="info" /> : '-'}
                      </TableCell>
                      <TableCell>
                        {p.tem_alerta
                          ? p.tipo_alerta === 'U-ECS'
                            ? <Chip label="U-ECS (Padrão)" size="small" color="success" />
                            : <Chip label={`${p.tipo_alerta ?? 'Alerta'} (Fora padrão)`} size="small" color="error" />
                          : <Chip label="Não" size="small" variant="outlined" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {data.total} registro{data.total !== 1 ? 's' : ''} encontrado{data.total !== 1 ? 's' : ''}
            </Typography>
            <Pagination count={totalPaginas} page={page} onChange={(_, v) => setPage(v)}
                        color="primary" size="small" />
          </Box>
        </>
      )}
    </Box>
  );
};
