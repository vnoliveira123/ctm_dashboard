import React, { useState } from 'react';
import * as d3 from 'd3';
import {
  Box, Paper, Typography, TextField, Button, Chip, CircularProgress, Alert,
  Pagination, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  FormControl, InputLabel, Select, MenuItem, Divider, Collapse, Card, CardContent, Grid,
  Autocomplete, Checkbox,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import TimerIcon from '@mui/icons-material/Timer';
import SpeedIcon from '@mui/icons-material/Speed';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import {
  useExecucoes, useGraficosExecucoes, useRotinasDisponiveis, useSlaJobs,
  FiltrosExecucao, VolumeData, TopDurData, HoraData, IsdData, TimeseriesItem, SlaItem,
} from '../hooks/useExecucoes';

const GRUPOS = ['PR12', 'PR21', 'PR31', 'PR41'];

function getFiltrosIniciais(): FiltrosExecucao {
  const hoje = new Date();
  const fim = hoje.toISOString().split('T')[0];
  const d = new Date(hoje);
  d.setDate(d.getDate() - 30);
  return { tabela: [], job: [], grupo: [], rotina: [], data_inicio: d.toISOString().split('T')[0], data_fim: fim, status: '' };
}
const FILTROS_VAZIOS: FiltrosExecucao = { tabela: [], job: [], grupo: [], rotina: [], data_inicio: '', data_fim: '', status: '' };

// ── Helpers D3 ───────────────────────────────────────────────────────────────

const W = 560;
const MARGIN = { top: 16, right: 24, bottom: 46, left: 52 };
const IW = W - MARGIN.left - MARGIN.right;

function Eixo({ scale, ticks, orient, innerSize }: {
  scale: d3.ScaleLinear<number,number> | d3.ScaleBand<string>;
  ticks?: number[]; orient: 'bottom'|'left'; innerSize: number;
}) {
  if (orient === 'bottom') {
    const band = scale as d3.ScaleBand<string>;
    const domain = band.domain();
    const step = Math.ceil(domain.length / 8);
    return (
      <g transform={`translate(0,${innerSize})`}>
        <line x1={0} x2={IW} stroke="#ccc" />
        {domain.filter((_, i) => i % step === 0).map(v => (
          <text key={v} x={(band(v) || 0) + band.bandwidth() / 2}
                y={18} textAnchor="middle" fontSize={9} fill="#888"
                transform={`rotate(-30,${(band(v) || 0) + band.bandwidth() / 2},18)`}>
            {v.length > 7 ? v.slice(-7) : v}
          </text>
        ))}
      </g>
    );
  }
  const lin = scale as d3.ScaleLinear<number,number>;
  return (
    <g>
      <line y1={0} y2={innerSize} stroke="#ccc" />
      {(ticks ?? lin.ticks(5)).map(t => (
        <g key={t} transform={`translate(0,${lin(t)})`}>
          <line x2={IW} stroke="#f0f0f0" />
          <text x={-6} dy="0.35em" textAnchor="end" fontSize={9} fill="#888">{t}</text>
        </g>
      ))}
    </g>
  );
}

// ── Chart 1: Volume por data (barras empilhadas) ─────────────────────────────
const GraficoVolumeDiario: React.FC<{ data: VolumeData[] }> = ({ data }) => {
  if (!data.length) return <SemDados />;
  const IH = 160;
  const x = d3.scaleBand().domain(data.map(d => d.data)).range([0, IW]).padding(0.15);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.total) || 1]).range([IH, 0]).nice();
  return (
    <svg viewBox={`0 0 ${W} ${IH + MARGIN.top + MARGIN.bottom}`} width="100%">
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
        <Eixo scale={y} orient="left" innerSize={IH} />
        <Eixo scale={x} orient="bottom" innerSize={IH} />
        {data.map(d => (
          <g key={d.data}>
            <rect x={x(d.data)!} y={y(d.ok)} width={x.bandwidth()} height={IH - y(d.ok)}
                  fill="#4caf50" opacity={0.85} />
            <rect x={x(d.data)!} y={y(d.total)} width={x.bandwidth()} height={Math.max(0, y(d.ok) - y(d.total))}
                  fill="#f44336" opacity={0.85} />
          </g>
        ))}
        <Legend items={[{ color: '#4caf50', label: 'OK' }, { color: '#f44336', label: 'NOT OK' }]} x={IW - 90} y={-8} />
      </g>
    </svg>
  );
};

// ── Chart 2: Duração por job (barras horizontais, scroll) ────────────────────
const GraficoTopDuracao: React.FC<{ data: TopDurData[] }> = ({ data }) => {
  if (!data.length) return <SemDados />;
  const barH = 20, gap = 4;
  const IH = data.length * (barH + gap);
  const x = d3.scaleLinear().domain([0, d3.max(data, d => d.avg_dur) || 1]).range([0, IW]).nice();
  const y = d3.scaleBand().domain(data.map(d => d.job)).range([0, IH]).padding(0.15);
  return (
    <Box sx={{ aspectRatio: '560 / 222', overflowY: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${IH + MARGIN.top + MARGIN.bottom}`} width="100%"
           style={{ minHeight: IH + MARGIN.top + MARGIN.bottom }}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {x.ticks(5).map(t => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={0} y2={IH} stroke="#f0f0f0" />
              <text x={x(t)} y={IH + 16} textAnchor="middle" fontSize={9} fill="#888">{t.toFixed(0)}</text>
            </g>
          ))}
          {data.map(d => (
            <g key={d.job}>
              <rect x={0} y={y(d.job)!} width={x(d.avg_dur)} height={y.bandwidth()} fill="#7b1fa2" rx={2} />
              <text x={-4} y={(y(d.job) || 0) + y.bandwidth() / 2} dy="0.35em"
                    textAnchor="end" fontSize={10} fill="#555">
                {d.job.slice(-10)}
              </text>
              <text x={x(d.avg_dur) + 4} y={(y(d.job) || 0) + y.bandwidth() / 2} dy="0.35em"
                    fontSize={9} fill="#666">{d.avg_dur.toFixed(1)} min</text>
            </g>
          ))}
          <text x={IW / 2} y={IH + 36} textAnchor="middle" fontSize={10} fill="#999">Duração média (min)</text>
        </g>
      </svg>
    </Box>
  );
};

// ── Chart 3: Pizza OK vs NOT OK ───────────────────────────────────────────────
const GraficoPizza: React.FC<{ ok: number; nok: number }> = ({ ok, nok }) => {
  const total = ok + nok;
  if (!total) return <SemDados />;
  const R = 80, RI = 48, CX = 140, CY = 100, VW = 560, VH = 222;
  const pieData = d3.pie<{ label: string; value: number; color: string }>().value(d => d.value)([
    { label: 'OK',     value: ok,  color: '#4caf50' },
    { label: 'NOT OK', value: nok, color: '#f44336' },
  ]);
  const arc    = d3.arc<d3.PieArcDatum<{ label: string; value: number; color: string }>>().innerRadius(RI).outerRadius(R);
  const arcLbl = d3.arc<d3.PieArcDatum<{ label: string; value: number; color: string }>>().innerRadius(R * 0.72).outerRadius(R * 0.72);
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%">
      <g transform={`translate(${CX},${CY})`}>
        {pieData.map((s, i) => (
          <g key={i}>
            <path d={arc(s) || ''} fill={s.data.color} />
            {s.data.value / total > 0.05 && (
              <text transform={`translate(${arcLbl.centroid(s)})`} textAnchor="middle"
                    dy="0.35em" fontSize={12} fill="white" fontWeight="bold">
                {Math.round(s.data.value / total * 100)}%
              </text>
            )}
          </g>
        ))}
        <text textAnchor="middle" dy="-0.3em" fontSize={16} fontWeight="bold" fill="#333">
          {total.toLocaleString('pt-BR')}
        </text>
        <text textAnchor="middle" dy="1.1em" fontSize={10} fill="#999">execuções</text>
      </g>
      {/* Legenda lateral */}
      <g transform={`translate(${CX + R + 24}, ${CY - 30})`}>
        {[{ color: '#4caf50', label: 'OK', value: ok }, { color: '#f44336', label: 'NOT OK', value: nok }].map((it, i) => (
          <g key={it.label} transform={`translate(0,${i * 36})`}>
            <rect width={14} height={14} rx={3} fill={it.color} />
            <text x={20} y={11} fontSize={12} fill="#555" fontWeight="bold">{it.label}</text>
            <text x={20} y={26} fontSize={11} fill="#888">{it.value.toLocaleString('pt-BR')}</text>
          </g>
        ))}
      </g>
    </svg>
  );
};

// ── Chart 4: Por hora do dia (stacked OK/NOK, pior hora destacada) ────────────
const GraficoHorario: React.FC<{ data: HoraData[] }> = ({ data }) => {
  if (!data.length) return <SemDados />;
  const allHours = Array.from({ length: 24 }, (_, i) => ({
    hora: i, total: 0, ok: 0, nok: 0,
  }));
  data.forEach(d => {
    allHours[d.hora] = { hora: d.hora, total: d.total, ok: d.ok ?? 0, nok: d.nok ?? 0 };
  });
  const worstHora = allHours.reduce((mx, h) => h.nok > mx.nok ? h : mx, allHours[0]);
  const IH = 160;
  const x = d3.scaleBand().domain(allHours.map(d => String(d.hora))).range([0, IW]).padding(0.15);
  const y = d3.scaleLinear().domain([0, d3.max(allHours, d => d.total) || 1]).range([IH, 0]).nice();
  return (
    <svg viewBox={`0 0 ${W} ${IH + MARGIN.top + MARGIN.bottom}`} width="100%">
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
        <Eixo scale={y} orient="left" innerSize={IH} />
        {allHours.map(d => {
          const bx = x(String(d.hora))!;
          const bw = x.bandwidth();
          const isWorst = d.hora === worstHora.hora && d.nok > 0;
          return (
            <g key={d.hora}>
              {isWorst && (
                <rect x={bx - 1} y={y(d.total) - 2} width={bw + 2} height={IH - y(d.total) + 4}
                      fill="none" stroke="#ff9800" strokeWidth={2} rx={2} />
              )}
              {/* OK — base verde */}
              <rect x={bx} y={y(d.ok)} width={bw} height={IH - y(d.ok)} fill="#4caf50" rx={2} />
              {/* NOT OK — topo vermelho */}
              {d.nok > 0 && (
                <rect x={bx} y={y(d.total)} width={bw}
                      height={Math.max(0, y(d.ok) - y(d.total))} fill="#f44336" rx={2} />
              )}
              {d.hora % 3 === 0 && (
                <text x={bx + bw / 2} y={IH + 16} textAnchor="middle" fontSize={9} fill="#888">
                  {d.hora}h
                </text>
              )}
            </g>
          );
        })}
        <line y1={IH} y2={IH} x1={0} x2={IW} stroke="#ccc" />
        <text x={IW / 2} y={IH + 36} textAnchor="middle" fontSize={10} fill="#999">Hora do dia</text>
        <Legend items={[
          { color: '#4caf50', label: 'OK' },
          { color: '#f44336', label: 'NOT OK' },
          { color: '#ff9800', label: 'Pior hora' },
        ]} x={IW - 90} y={-8} />
      </g>
    </svg>
  );
};

// ── Chart 5: Execuções ISD (scroll) ──────────────────────────────────────────
// viewBox mais largo que os outros gráficos para compensar a largura total do grid
const W_ISD  = 1100;
const IW_ISD = W_ISD - MARGIN.left - MARGIN.right;

const GraficoISD: React.FC<{ data: IsdData[] }> = ({ data }) => {
  if (!data.length) return <SemDados msg="Nenhum job com ISD ativo no período selecionado." />;
  const barH = 16, IH = data.length * (barH + 4);
  const x = d3.scaleLinear().domain([0, d3.max(data, d => d.total) || 1]).range([0, IW_ISD]).nice();
  const y = d3.scaleBand().domain(data.map(d => d.job)).range([0, IH]).padding(0.2);
  return (
    <Box sx={{ maxHeight: 96, overflowY: 'auto' }}>
      <svg viewBox={`0 0 ${W_ISD} ${IH + MARGIN.top + MARGIN.bottom}`} width="100%"
           style={{ minHeight: IH + MARGIN.top + MARGIN.bottom }}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {x.ticks(5).map(t => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={0} y2={IH} stroke="#f0f0f0" />
              <text x={x(t)} y={IH + 16} textAnchor="middle" fontSize={9} fill="#888">{t}</text>
            </g>
          ))}
          {data.map(d => (
            <g key={d.job}>
              <rect x={0} y={y(d.job)!} width={x(d.total)} height={y.bandwidth()} fill="#e65100" rx={2} />
              <text x={-4} y={(y(d.job) || 0) + y.bandwidth() / 2} dy="0.35em"
                    textAnchor="end" fontSize={10} fill="#555">{d.job.slice(-10)}</text>
              <text x={x(d.total) + 4} y={(y(d.job) || 0) + y.bandwidth() / 2} dy="0.35em"
                    fontSize={9} fill="#666">{d.total}</text>
            </g>
          ))}
          <text x={IW_ISD / 2} y={IH + 36} textAnchor="middle" fontSize={10} fill="#999">Nº de execuções</text>
        </g>
      </svg>
    </Box>
  );
};

// ── Chart 6: Série temporal do JOB filtrado ───────────────────────────────────
// vw permite usar viewBox mais largo para gráficos em linha inteira (xs=12),
// compensando a largura dupla e mantendo a mesma altura visual que os charts md=6.
const GraficoSerie: React.FC<{ data: TimeseriesItem[]; job?: string; ih?: number; vw?: number }> = ({ data, job, ih = 160, vw = W }) => {
  if (!job) return <SemDados msg='Aplique o filtro "Job" para ver a série temporal de execuções.' />;
  if (!data.length) return <SemDados msg="Sem execuções para o JOB no período." />;
  const IH  = ih;
  const iw  = vw - MARGIN.left - MARGIN.right;
  const dates = data.map(d => new Date(d.data));
  const x = d3.scaleTime().domain(d3.extent(dates) as [Date, Date]).range([0, iw]);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.duracao) || 1]).range([IH, 0]).nice();
  const lineGen = d3.line<TimeseriesItem>().x(d => x(new Date(d.data))).y(d => y(d.duracao));
  return (
    <svg viewBox={`0 0 ${vw} ${IH + MARGIN.top + MARGIN.bottom}`} width="100%">
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
        {y.ticks(5).map(t => (
          <g key={t}>
            <line x1={0} x2={iw} y1={y(t)} y2={y(t)} stroke="#f0f0f0" />
            <text x={-6} y={y(t)} dy="0.35em" textAnchor="end" fontSize={9} fill="#888">{t.toFixed(1)}</text>
          </g>
        ))}
        <path d={lineGen(data) || ''} fill="none" stroke="#1976d2" strokeWidth={1.5} />
        {data.map((d, i) => (
          <circle key={i} cx={x(new Date(d.data))} cy={y(d.duracao)} r={3.5}
                  fill={d.status === 'OK' ? '#4caf50' : '#f44336'} stroke="white" strokeWidth={0.8} />
        ))}
        {x.ticks(8).map(t => (
          <text key={+t} x={x(t)} y={IH + 18} textAnchor="middle" fontSize={9} fill="#888">
            {d3.timeFormat('%d/%m')(t)}
          </text>
        ))}
        <line x1={0} x2={iw} y1={IH} y2={IH} stroke="#ccc" />
        <text x={-28} y={IH / 2} transform={`rotate(-90,-28,${IH / 2})`} textAnchor="middle" fontSize={9} fill="#999">min</text>
        <Legend items={[{ color: '#4caf50', label: 'OK' }, { color: '#f44336', label: 'NOT OK' }]} x={iw - 90} y={-8} />
      </g>
    </svg>
  );
};

// ── Helpers visuais ───────────────────────────────────────────────────────────
const SemDados: React.FC<{ msg?: string }> = ({ msg = 'Sem dados para o período selecionado.' }) => (
  <Typography variant="body2" color="text.secondary" sx={{ p: 2, fontStyle: 'italic' }}>{msg}</Typography>
);

const Legend: React.FC<{ items: { color: string; label: string }[]; x: number; y: number }> = ({ items, x, y }) => (
  <g transform={`translate(${x},${y})`}>
    {items.map((it, i) => (
      <g key={it.label} transform={`translate(0,${i * 14})`}>
        <rect width={10} height={10} fill={it.color} />
        <text x={13} y={9} fontSize={9} fill="#555">{it.label}</text>
      </g>
    ))}
  </g>
);

const InsightCard: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; color: string }> = ({ icon, label, value, color }) => (
  <Card sx={{ flex: '1 1 150px', minWidth: 140, borderTop: `3px solid ${color}` }}>
    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, color }}>
        {icon}
        <Typography variant="caption" color="text.secondary" fontWeight={500}>{label}</Typography>
      </Box>
      <Typography variant="h5" fontWeight="bold" sx={{ fontSize: '1.3rem' }}>{value}</Typography>
    </CardContent>
  </Card>
);

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Paper variant="outlined" sx={{ p: 2 }}>
    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>{title}</Typography>
    {children}
  </Paper>
);

// ── Componente principal ──────────────────────────────────────────────────────
export const Tela2Execucoes: React.FC = () => {
  const [filtros, setFiltros] = useState<FiltrosExecucao>(getFiltrosIniciais());
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltrosExecucao>(getFiltrosIniciais());
  const [tabelaInput, setTabelaInput] = useState('');
  const [jobInput, setJobInput]       = useState('');
  const [page, setPage] = useState(1);
  const [expandido, setExpandido] = useState(true);
  const [slaMin, setSlaMin] = useState(30);
  const [slaInput, setSlaInput] = useState('30');
  const [exibirSla, setExibirSla] = useState(false);

  const { data, isLoading, error }   = useExecucoes(filtrosAtivos, page);
  const { data: graficos }           = useGraficosExecucoes(filtrosAtivos);
  const { data: rotinasData }        = useRotinasDisponiveis();
  const { data: slaData }            = useSlaJobs(slaMin);

  const setStr = (campo: 'data_inicio' | 'data_fim' | 'status') => (v: string) =>
    setFiltros(prev => ({ ...prev, [campo]: v }));
  const setArr = (campo: 'tabela' | 'job' | 'grupo' | 'rotina') => (v: string[]) =>
    setFiltros(prev => ({ ...prev, [campo]: v }));

  const aplicar = () => {
    const f = { ...filtros };
    if (tabelaInput.trim()) { f.tabela = [...(f.tabela ?? []), tabelaInput.trim()]; setTabelaInput(''); }
    if (jobInput.trim())    { f.job    = [...(f.job    ?? []), jobInput.trim()];    setJobInput(''); }
    setFiltrosAtivos(f);
    setPage(1);
  };
  const limpar = () => {
    setFiltros(getFiltrosIniciais()); setFiltrosAtivos(getFiltrosIniciais());
    setTabelaInput(''); setJobInput(''); setPage(1);
  };

  const resumo = graficos?.resumo;
  const totalPag = Math.ceil((data?.total || 0) / 20);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>Detalhes de Processamento</Typography>

      {/* Filtros */}
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
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Autocomplete
                multiple freeSolo options={[]}
                value={filtros.tabela ?? []}
                inputValue={tabelaInput}
                onInputChange={(_, v) => setTabelaInput(v)}
                onChange={(_, v) => { setArr('tabela')(v as string[]); setTabelaInput(''); }}
                renderTags={(value, getTagProps) =>
                  value.map((v, i) => <Chip label={v} size="small" {...getTagProps({ index: i })} />)
                }
                renderInput={(params) => <TextField {...params} label="Tabela" size="small" sx={{ minWidth: 200 }} placeholder="Digite e pressione Enter" />}
              />
              <Autocomplete
                multiple freeSolo options={[]}
                value={filtros.job ?? []}
                inputValue={jobInput}
                onInputChange={(_, v) => setJobInput(v)}
                onChange={(_, v) => { setArr('job')(v as string[]); setJobInput(''); }}
                renderTags={(value, getTagProps) =>
                  value.map((v, i) => <Chip label={v} size="small" {...getTagProps({ index: i })} />)
                }
                renderInput={(params) => <TextField {...params} label="Job" size="small" sx={{ minWidth: 200 }} placeholder="Digite e pressione Enter" />}
              />
              <Autocomplete
                multiple disableCloseOnSelect options={GRUPOS}
                value={filtros.grupo ?? []}
                onChange={(_, v) => setArr('grupo')(v)}
                renderOption={(props, option, { selected }) => (
                  <li {...props}><Checkbox checked={selected} size="small" sx={{ mr: 1 }} />{option}</li>
                )}
                renderTags={(value, getTagProps) =>
                  value.map((v, i) => <Chip label={v} size="small" {...getTagProps({ index: i })} />)
                }
                renderInput={(params) => <TextField {...params} label="Grupo" size="small" sx={{ minWidth: 160 }} />}
              />
              <Autocomplete
                multiple disableCloseOnSelect options={rotinasData?.rotinas ?? []}
                value={filtros.rotina ?? []}
                onChange={(_, v) => setArr('rotina')(v)}
                renderOption={(props, option, { selected }) => (
                  <li {...props}><Checkbox checked={selected} size="small" sx={{ mr: 1 }} />{option}</li>
                )}
                renderTags={(value, getTagProps) =>
                  value.map((v, i) => <Chip label={v} size="small" {...getTagProps({ index: i })} />)
                }
                renderInput={(params) => <TextField {...params} label="Rotina" size="small" sx={{ minWidth: 160 }} />}
              />
              <TextField label="Data Início" type="date" value={filtros.data_inicio} size="small"
                         InputLabelProps={{ shrink: true }} onChange={e => setStr('data_inicio')(e.target.value)} />
              <TextField label="Data Fim" type="date" value={filtros.data_fim} size="small"
                         InputLabelProps={{ shrink: true }} onChange={e => setStr('data_fim')(e.target.value)} />
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Status</InputLabel>
                <Select value={filtros.status} label="Status" onChange={e => setStr('status')(e.target.value as string)}>
                  <MenuItem value=""><em>Todos</em></MenuItem>
                  <MenuItem value="OK">
                    <Chip label="OK" size="small" color="success" sx={{ pointerEvents: 'none' }} />
                  </MenuItem>
                  <MenuItem value="NOT OK">
                    <Chip label="NOT OK" size="small" color="error" sx={{ pointerEvents: 'none' }} />
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" size="small" onClick={aplicar}>Aplicar Filtros</Button>
              <Button variant="outlined"  size="small" startIcon={<ClearIcon />} onClick={limpar}>Limpar</Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* Insight Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <InsightCard icon={<TimerIcon fontSize="small" />} label="Execuções"
          value={resumo?.total?.toLocaleString('pt-BR') ?? 0} color="#1976d2" />
        <InsightCard icon={<CheckCircleIcon fontSize="small" />} label="OK"
          value={resumo?.ok?.toLocaleString('pt-BR') ?? 0} color="#2e7d32" />
        <InsightCard icon={<CancelIcon fontSize="small" />} label="NOT OK"
          value={resumo?.nok?.toLocaleString('pt-BR') ?? 0} color="#c62828" />
        <InsightCard icon={<SpeedIcon fontSize="small" />} label="Duração Média"
          value={resumo ? `${resumo.duracao_media.toFixed(1)} min` : '-'} color="#e65100" />
        <InsightCard icon={<EmojiEventsIcon fontSize="small" />} label="Maior Duração"
          value={
            resumo?.job_maior_duracao && resumo.job_maior_duracao !== '-'
              ? <Box><Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem' }}>
                  {resumo.job_maior_duracao}
                </Typography>{resumo.maior_duracao.toFixed(1)} min</Box>
              : '-'
          } color="#7b1fa2" />
      </Box>

      {/* Série temporal — largura total, altura compacta */}
      <ChartCard title={`Série Temporal de Execuções${filtrosAtivos.job?.[0] ? ` — ${filtrosAtivos.job[0]}` : ''}`}>
        <GraficoSerie data={graficos?.timeseries ?? []} job={filtrosAtivos.job?.[0]} ih={160} vw={1120} />
      </ChartCard>

      {/* Gráficos — grid 2 colunas */}
      <Grid container spacing={2} sx={{ mt: 2, mb: 3 }}>
        {/* Linha 1: Volume por data | Hora do dia */}
        <Grid item xs={12} md={6}>
          <ChartCard title="Volume de Execuções por Data">
            <GraficoVolumeDiario data={graficos?.volume_por_data ?? []} />
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="Execuções por Hora do Dia">
            <GraficoHorario data={graficos?.por_hora ?? []} />
          </ChartCard>
        </Grid>
        {/* Linha 2: Pizza | Duração por job */}
        <Grid item xs={12} md={6}>
          <ChartCard title="Status: OK vs NOT OK">
            <GraficoPizza ok={resumo?.ok ?? 0} nok={resumo?.nok ?? 0} />
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="Jobs por Duração Média (min)">
            <GraficoTopDuracao data={graficos?.top_duracao ?? []} />
          </ChartCard>
        </Grid>
        {/* Linha 3: ISD largura total */}
        <Grid item xs={12}>
          <ChartCard title="Jobs com ISD — Volume de Execuções">
            <GraficoISD data={graficos?.isd_execucoes ?? []} />
          </ChartCard>
        </Grid>
      </Grid>

      {/* SLA por Job — colapsável */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Box
          sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', flexWrap: 'wrap' }}
          onClick={() => setExibirSla(v => !v)}
        >
          <SpeedIcon fontSize="small" color="warning" />
          <Typography variant="subtitle2" fontWeight={600}>SLA por Job — Duração Média Acima do Limiar</Typography>
          {slaData?.jobs.length ? (
            <Chip label={`${slaData.jobs.length} job${slaData.jobs.length !== 1 ? 's' : ''}`} size="small" color="warning" sx={{ ml: 0.5 }} />
          ) : null}
          {/* Input de limiar no cabeçalho — para não perder ao colapsar */}
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }} onClick={e => e.stopPropagation()}>
            <TextField
              label="Limiar (min)" type="number" size="small" sx={{ width: 120 }}
              value={slaInput}
              onChange={e => setSlaInput(e.target.value)}
              onBlur={() => { const v = parseFloat(slaInput); if (!isNaN(v) && v >= 0) setSlaMin(v); }}
              onKeyDown={e => { if (e.key === 'Enter') { const v = parseFloat(slaInput); if (!isNaN(v) && v >= 0) setSlaMin(v); } }}
              inputProps={{ min: 0, step: 1 }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {exibirSla ? 'Recolher ▲' : 'Expandir ▼'}
          </Typography>
        </Box>
        <Collapse in={exibirSla}>
          <Divider />
          {!slaData?.jobs.length ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, fontStyle: 'italic' }}>
              Nenhum job com duração média acima de {slaMin} min.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'warning.light' }}>
                    {['Tabela', 'Job', 'Duração Média (min)', 'Duração Máx (min)', 'Execuções'].map(c => (
                      <TableCell key={c} sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{c}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(slaData?.jobs ?? []).map((j: SlaItem, i: number) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{j.tabela}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{j.job}</TableCell>
                      <TableCell>
                        <Chip label={`${j.avg_dur.toFixed(1)} min`} size="small" color="warning" />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>{j.max_dur.toFixed(1)}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>{j.total_exec.toLocaleString('pt-BR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Collapse>
      </Paper>

      {/* Tabela */}
      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
      {error    && <Alert severity="error">Erro ao carregar execuções. Verifique se a API está respondendo.</Alert>}

      {data && !isLoading && (
        <>
          {data.execucoes.length === 0
            ? <Alert severity="info">Nenhuma execução encontrada para os filtros selecionados.</Alert>
            : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      {['Tabela', 'Job', 'Grupo', 'Data / Hora', 'Status', 'Duração (min)'].map(c => (
                        <TableCell key={c} sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{c}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.execucoes.map((e, i) => (
                      <TableRow key={i} hover>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{e.tabela}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{e.job}</TableCell>
                        <TableCell>
                          <Chip label={e.grupo?.split('-')[0]} size="small" variant="outlined" color="primary" />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>
                          {e.data_execucao ? new Date(e.data_execucao).toLocaleString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={e.status}
                            size="small"
                            color={e.status === 'OK' ? 'success' : 'error'}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>
                          {e.duracao_minutos != null ? e.duracao_minutos.toFixed(2) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )
          }
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {data.total.toLocaleString('pt-BR')} registro{data.total !== 1 ? 's' : ''}
            </Typography>
            <Pagination count={totalPag} page={page} onChange={(_, v) => setPage(v)} color="primary" size="small" />
          </Box>
        </>
      )}
    </Box>
  );
};
