import React, { useState } from 'react';
import * as d3 from 'd3';
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TextField, Button, CircularProgress, Alert, Pagination, Card,
  CardContent, Typography, Chip, FormControl, InputLabel, Select, MenuItem,
  OutlinedInput, Checkbox, ListItemText, Divider, Collapse, Grid,
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
  useJobsSemExecucao, useAlertasNaoPadrao,
  FiltrosProcesso, JobSemExecucao, AlertaNaoPadrao,
} from '../hooks/useProcessos';

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
  tabela: '', job: '', grupo: '', periodicidade: '', confirm: '', memlib: '',
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
  const R = 75; const IR = 42; const CX = 110; const CY = 100;
  const pie   = d3.pie<{ periodicidade: string; total: number }>().value(d => d.total).sort(null);
  const arc   = d3.arc<d3.PieArcDatum<{ periodicidade: string; total: number }>>().innerRadius(IR).outerRadius(R);
  const label = d3.arc<d3.PieArcDatum<{ periodicidade: string; total: number }>>().innerRadius(R + 14).outerRadius(R + 14);
  const slices = pie(data);
  const total  = d3.sum(data, d => d.total);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      <svg width={220} height={200} style={{ flexShrink: 0 }}>
        <g transform={`translate(${CX},${CY})`}>
          {slices.map((s, i) => (
            <g key={i}>
              <path d={arc(s) ?? ''} fill={CORES_PERIOD[i % CORES_PERIOD.length]} stroke="white" strokeWidth={2}>
                <title>{s.data.periodicidade}: {s.data.total}</title>
              </path>
              {(s.endAngle - s.startAngle) > 0.3 && (
                <text transform={`translate(${label.centroid(s)})`}
                      textAnchor="middle" fontSize={9} fill="white" fontWeight="bold" dy="0.35em">
                  {Math.round(s.data.total / total * 100)}%
                </text>
              )}
            </g>
          ))}
          <text textAnchor="middle" dy="0.35em" fontSize={11} fontWeight="bold" fill="#333">
            {total}
          </text>
        </g>
      </svg>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
        {data.map((d, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: CORES_PERIOD[i % CORES_PERIOD.length], flexShrink: 0 }} />
            <Typography variant="caption" noWrap sx={{ maxWidth: 130 }}>{d.periodicidade}</Typography>
            <Typography variant="caption" fontWeight={700} color="text.secondary">{d.total}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// ── 2. Barras horizontais — Top tabelas por jobs ──────────────────────────────
const GraficoJobsPorTabela: React.FC<{ data: { tabela: string; total_jobs: number }[] }> = ({ data }) => {
  if (!data.length) return null;
  const W = 380; const BH = 16; const GAP = 6; const ML = 100;
  const xScale = d3.scaleLinear().domain([0, d3.max(data, d => d.total_jobs) || 1]).range([0, W]);
  const totalH  = data.length * (BH + GAP);

  return (
    <svg width={ML + W + 40} height={totalH + 10} style={{ width: '100%', maxWidth: ML + W + 40 }}>
      {data.map((d, i) => {
        const y  = i * (BH + GAP);
        const bw = xScale(d.total_jobs);
        return (
          <g key={i} transform={`translate(0,${y})`}>
            <text x={ML - 6} y={BH / 2} textAnchor="end" fontSize={9} fill="#555" dominantBaseline="middle">
              {trunc(d.tabela, 11)}
            </text>
            <rect x={ML} width={bw} height={BH} rx={3} fill="#1976d2" opacity={0.85}>
              <title>{d.tabela}: {d.total_jobs} jobs</title>
            </rect>
            <text x={ML + bw + 4} y={BH / 2} fontSize={9} fill="#333" dominantBaseline="middle" fontWeight="bold">
              {d.total_jobs}
            </text>
          </g>
        );
      })}
    </svg>
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
  <FormControl size="small" sx={{ minWidth }}>
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

  const { data, isLoading, error } = useProcessos(filtrosAtivos, page);
  const { data: opcoes }           = useFiltrosDisponiveis();
  const { data: graficos }         = useGraficosProcessos();
  const { data: semExec }          = useJobsSemExecucao(50);
  const { data: alertasNP }        = useAlertasNaoPadrao();

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
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField label="Tabela" value={filtros.tabela} size="small" sx={{ minWidth: 160 }}
                         onChange={e => set('tabela')(e.target.value)} />
              <TextField label="Job"    value={filtros.job}    size="small" sx={{ minWidth: 160 }}
                         onChange={e => set('job')(e.target.value)} />
              <SelectFiltro label="Grupo" value={filtros.grupo || ''} onChange={set('grupo')}
                opcoes={GRUPOS.map(g => ({ value: g, label: g }))} />
              <SelectFiltro label="Periodicidade" value={filtros.periodicidade || ''} onChange={set('periodicidade')}
                opcoes={(opcoes?.periodicidades || []).map(p => ({ value: p, label: p }))} minWidth={180} />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <SelectFiltro label="Confirm" value={filtros.confirm || ''} onChange={set('confirm')}
                opcoes={[{ value: 'SIM', label: 'Sim' }, { value: 'NAO', label: 'Não' }]} />
              <SelectFiltro label="Memlib" value={filtros.memlib || ''} onChange={set('memlib')}
                opcoes={MEMLIBS.map(m => ({ value: m, label: m }))} minWidth={230} />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <SelectFiltro label="Carga Automática" value={filtros.carga || ''} onChange={set('carga')}
                opcoes={[{ value: 'SIM', label: 'Sim' }, { value: 'NAO', label: 'Não' }]} minWidth={180} />
              {filtros.carga === 'SIM' && (
                <FormControl size="small" sx={{ minWidth: 220 }}>
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
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <SelectFiltro label="ISD" value={filtros.isd || ''} onChange={set('isd')}
                opcoes={[{ value: 'SIM', label: 'Sim' }, { value: 'NAO', label: 'Não' }]} />
              {filtros.isd === 'SIM' && (
                <SelectFiltro label="Tipo de Evento ISD" value={filtros.evento_isd || ''} onChange={set('evento_isd')}
                  opcoes={EVENTOS_ISD.map(e => ({ value: e, label: e }))} minWidth={220} />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <SelectFiltro label="Alerta" value={filtros.tem_alerta || ''} onChange={set('tem_alerta')}
                opcoes={[{ value: 'SIM', label: 'Sim' }, { value: 'NAO', label: 'Não' }]} />
              {filtros.tem_alerta === 'SIM' && (
                <SelectFiltro label="Padrão de Alerta" value={filtros.padrao || ''} onChange={set('padrao')}
                  opcoes={[{ value: 'SIM', label: 'Sim (Padrão)' }, { value: 'NAO', label: 'Não (Customizado)' }]} minWidth={200} />
              )}
              {filtros.tem_alerta === 'NAO' && (
                <SelectFiltro label="Tipo de Alerta" value={filtros.tipo_alerta || ''} onChange={set('tipo_alerta')}
                  opcoes={TIPOS_ALERTA.map(t => ({ value: t, label: t }))} />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, pt: 0.5 }}>
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

      {/* ── Jobs Sem Execução ── */}
      {semExec && semExec.jobs.length > 0 && (
        <Paper variant="outlined" sx={{ mb: 3, p: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
            Jobs Sem Execução (CTM × LOG) — {semExec.total} encontrado{semExec.total !== 1 ? 's' : ''}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  {['Tabela', 'Job', 'Grupo', 'Periodicidade', 'Carga'].map(c => (
                    <TableCell key={c} sx={{ fontWeight: 700, fontSize: '0.78rem' }}>{c}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {semExec.jobs.map((j: JobSemExecucao, i: number) => (
                  <TableRow key={i} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{j.tabela}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{j.job}</TableCell>
                    <TableCell>
                      <Chip label={j.grupo?.split('-')[0] ?? j.grupo} size="small" variant="outlined" color="default" />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem' }}>{j.periodicidade ?? '-'}</TableCell>
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
        </Paper>
      )}

      {/* ── Alertas Não Padronizados ── */}
      {alertasNP && alertasNP.alertas.length > 0 && (
        <Paper variant="outlined" sx={{ mb: 3, p: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
            Alertas Não Padronizados (tipo_alerta ≠ U-ECS) — {alertasNP.alertas.length} job{alertasNP.alertas.length !== 1 ? 's' : ''}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'error.light' }}>
                  {['Tabela', 'Job', 'Grupo', 'Tipo Alerta', 'Execuções'].map(c => (
                    <TableCell key={c} sx={{ fontWeight: 700, fontSize: '0.78rem' }}>{c}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {alertasNP.alertas.map((a: AlertaNaoPadrao, i: number) => (
                  <TableRow key={i} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{a.tabela}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{a.job}</TableCell>
                    <TableCell>
                      <Chip label={a.grupo?.split('-')[0] ?? a.grupo} size="small" variant="outlined" color="default" />
                    </TableCell>
                    <TableCell>
                      <Chip label={a.tipo_alerta} size="small" color="error" />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem' }}>{a.total_exec.toLocaleString('pt-BR')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

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
