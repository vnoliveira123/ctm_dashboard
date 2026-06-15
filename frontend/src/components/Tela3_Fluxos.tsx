import React, { useEffect, useMemo, useRef, useState } from 'react';
import dagre from 'dagre';
import * as d3 from 'd3';
import {
  Box, TextField, Button, CircularProgress, Alert, Typography, Paper,
  FormControl, InputLabel, Select, MenuItem, Divider, Collapse, Chip,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon      from '@mui/icons-material/Clear';
import { useFluxosGrafo, useRotinasFluxos, FiltrosFluxo, GrafoNode, GrafoEdge } from '../hooks/useFluxos';

// ── Constantes ────────────────────────────────────────────────────────────────
const NW = 144;   // node width
const NH = 58;    // node height
const GRUPOS   = ['PR12', 'PR21', 'PR31', 'PR41'];
const HORARIOS = ['00', '01', '03', '07', '10', '13', '16', '19', '23'];
const FILTROS_VAZIOS: FiltrosFluxo = { grupo: '', tabela: '', job: '', rotina: '', posicao: '', carga: '', horario_carga: '' };

const COR: Record<string, string> = {
  inicio: '#2e7d32',
  meio:   '#1565c0',
  fim:    '#b71c1c',
};
const LABEL: Record<string, string> = { inicio: 'Início', meio: 'Meio', fim: 'Fim' };

// ── Tipos do layout ───────────────────────────────────────────────────────────
interface LayoutNode extends GrafoNode { x: number; y: number }
interface LayoutEdge extends GrafoEdge { points: { x: number; y: number }[] }
interface Layout { nodes: LayoutNode[]; edges: LayoutEdge[]; w: number; h: number }

// ── Helpers ───────────────────────────────────────────────────────────────────
const trunc = (s: string, n: number) => s.length > n ? s.slice(0, n) + '…' : s;

function edgePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

// ── Ícone SVG por posição ─────────────────────────────────────────────────────
const PosIcon: React.FC<{ posicao: string; cx: number; cy: number }> = ({ posicao, cx, cy }) => {
  const c = COR[posicao] ?? COR.meio;
  if (posicao === 'inicio')
    return (
      <g>
        <circle cx={cx} cy={cy} r={8} fill={c} />
        <path d={`M${cx-3.5} ${cy}L${cx-1} ${cy+3}L${cx+4} ${cy-3}`}
              stroke="white" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  if (posicao === 'fim')
    return (
      <g>
        <circle cx={cx} cy={cy} r={8} fill={c} />
        <rect x={cx-4} y={cy-4} width={8} height={8} rx={1} fill="white" />
      </g>
    );
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={c} />
      <circle cx={cx} cy={cy} r={4} fill="white" />
      <circle cx={cx} cy={cy} r={2} fill={c} />
    </g>
  );
};

// ── Card de nó ────────────────────────────────────────────────────────────────
const NodeCard: React.FC<{ node: LayoutNode }> = ({ node }) => {
  const x   = node.x - NW / 2;
  const y   = node.y - NH / 2;
  const cor = COR[node.posicao] ?? COR.meio;
  const SH  = 20;  // strip height

  return (
    <g style={{ cursor: 'default' }}>
      {/* Sombra */}
      <rect x={x+2} y={y+2} width={NW} height={NH} rx={5} fill="rgba(0,0,0,0.10)" />
      {/* Corpo */}
      <rect x={x} y={y} width={NW} height={NH} rx={5} fill="white" stroke={cor} strokeWidth={2} />
      {/* Ícone posição */}
      <PosIcon posicao={node.posicao} cx={x+16} cy={y+19} />
      {/* Nome do job */}
      <text x={x+30} y={y+14} fontSize={10} fontWeight="bold" fill="#1a1a1a" dy="0.35em">
        {trunc(node.label, 14)}
      </text>
      {/* Dot de carga */}
      {node.carga === 'SIM' && (
        <circle cx={x+NW-10} cy={y+10} r={5} fill="#ff8f00" stroke="white" strokeWidth={1.5} />
      )}
      {/* Strip inferior com nome da tabela */}
      <rect x={x+2} y={y+NH-SH-2} width={NW-4} height={SH} rx={3} fill="#e64a19" opacity={0.9} />
      <text x={node.x} y={y+NH-SH+8} textAnchor="middle" fontSize={9} fill="white" fontWeight={600} dy="0.2em">
        {trunc(node.tabela, 18)}
      </text>
      <title>{`${node.tabela} / ${node.label}\nGrupo: ${node.grupo}\nPosição: ${LABEL[node.posicao] ?? node.posicao}${node.carga === 'SIM' ? '\n⚡ Carga automática' : ''}`}</title>
    </g>
  );
};

// ── Legenda ───────────────────────────────────────────────────────────────────
const Legenda: React.FC = () => (
  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
    {Object.entries(COR).map(([pos, cor]) => (
      <Box key={pos} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: cor }} />
        <Typography variant="caption" fontWeight={600}>{LABEL[pos]}</Typography>
      </Box>
    ))}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ff8f00' }} />
      <Typography variant="caption" fontWeight={600}>Carga automática</Typography>
    </Box>
  </Box>
);

// ── Componente principal ──────────────────────────────────────────────────────
export const Tela3Fluxos: React.FC = () => {
  const [filtros, setFiltros]             = useState<FiltrosFluxo>(FILTROS_VAZIOS);
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltrosFluxo>(FILTROS_VAZIOS);
  const [expandido, setExpandido]         = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const temFiltro = Object.values(filtrosAtivos).some(v => v !== '');
  const { data, isLoading, error } = useFluxosGrafo(filtrosAtivos, temFiltro);
  const { data: rotinasData }      = useRotinasFluxos();

  const set = (campo: keyof FiltrosFluxo) => (v: string) =>
    setFiltros(prev => {
      const next = { ...prev, [campo]: v };
      if (campo === 'carga' && v !== 'SIM') next.horario_carga = '';
      return next;
    });

  const aplicar = () => setFiltrosAtivos(filtros);
  const limpar  = () => { setFiltros(FILTROS_VAZIOS); setFiltrosAtivos(FILTROS_VAZIOS); };

  // ── Dagre layout (só matemática, sem DOM) ──────────────────────
  const layout = useMemo<Layout | null>(() => {
    if (!data?.nodes.length) return null;

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 70, marginx: 30, marginy: 30 });
    g.setDefaultEdgeLabel(() => ({}));

    data.nodes.forEach(n => g.setNode(n.id, { width: NW, height: NH }));
    data.edges.forEach(e => { try { g.setEdge(e.source, e.target); } catch (_) {} });

    dagre.layout(g);

    const nodes: LayoutNode[] = data.nodes
      .map(n => {
        const pos = g.node(n.id) as { x: number; y: number } | undefined;
        return pos ? { ...n, x: pos.x, y: pos.y } : null;
      })
      .filter((n): n is LayoutNode => n !== null);

    const edges: LayoutEdge[] = data.edges.map(e => {
      try {
        const pts = (g.edge(e.source, e.target)?.points ?? []) as { x: number; y: number }[];
        return { ...e, points: pts };
      } catch (_) { return { ...e, points: [] }; }
    }).filter(e => e.points.length >= 2);

    return {
      nodes,
      edges,
      w: (g.graph().width  ?? 800) + 60,
      h: (g.graph().height ?? 600) + 60,
    };
  }, [data]);

  // ── Zoom / Pan via d3.zoom (só behavior, sem renderização) ─────
  useEffect(() => {
    if (!svgRef.current || !layout) return;
    const svg  = d3.select(svgRef.current);
    const grp  = svg.select<SVGGElement>('g.zg');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 4])
      .on('zoom', ev => grp.attr('transform', ev.transform.toString()));
    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity);
    return () => { svg.on('.zoom', null); };
  }, [layout]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>Fluxo de Processamento</Typography>

      {/* Filtros */}
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
             onClick={() => setExpandido(v => !v)}>
          <FilterListIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight={600}>Filtros</Typography>
          {temFiltro && <Chip label="Filtro ativo" size="small" color="primary" sx={{ ml: 1 }} />}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {expandido ? 'Recolher ▲' : 'Expandir ▼'}
          </Typography>
        </Box>
        <Collapse in={expandido}>
          <Divider />
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField label="Tabela" value={filtros.tabela} size="small" sx={{ minWidth: 150 }}
                         onChange={e => set('tabela')(e.target.value)} />
              <TextField label="Job" value={filtros.job} size="small" sx={{ minWidth: 150 }}
                         onChange={e => set('job')(e.target.value)} />
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Grupo</InputLabel>
                <Select value={filtros.grupo} label="Grupo"
                        onChange={e => set('grupo')(e.target.value as string)}>
                  <MenuItem value=""><em>Todos</em></MenuItem>
                  {GRUPOS.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Rotina</InputLabel>
                <Select value={filtros.rotina} label="Rotina"
                        onChange={e => set('rotina')(e.target.value as string)}>
                  <MenuItem value=""><em>Todas</em></MenuItem>
                  {(rotinasData?.rotinas ?? []).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 165 }}>
                <InputLabel>Posição no Fluxo</InputLabel>
                <Select value={filtros.posicao} label="Posição no Fluxo"
                        onChange={e => set('posicao')(e.target.value as string)}>
                  <MenuItem value=""><em>Todas</em></MenuItem>
                  {Object.entries(COR).map(([pos, cor]) => (
                    <MenuItem key={pos} value={pos}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cor }} />
                        {LABEL[pos]}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 155 }}>
                <InputLabel>Carga Automática</InputLabel>
                <Select value={filtros.carga} label="Carga Automática"
                        onChange={e => set('carga')(e.target.value as string)}>
                  <MenuItem value=""><em>Todas</em></MenuItem>
                  <MenuItem value="SIM">SIM</MenuItem>
                  <MenuItem value="NAO">NAO</MenuItem>
                </Select>
              </FormControl>
              {filtros.carga === 'SIM' && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Horário de Carga</InputLabel>
                  <Select value={filtros.horario_carga} label="Horário de Carga"
                          onChange={e => set('horario_carga')(e.target.value as string)}>
                    <MenuItem value=""><em>Todos</em></MenuItem>
                    {HORARIOS.map(h => (
                      <MenuItem key={h} value={h}>{h}h</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" size="small" onClick={aplicar}>Aplicar Filtros</Button>
              <Button variant="outlined"  size="small" startIcon={<ClearIcon />} onClick={limpar}>Limpar</Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* Contador + legenda */}
      {data && !isLoading && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {data.nodes.length} nó{data.nodes.length !== 1 ? 's' : ''} · {data.edges.length} aresta{data.edges.length !== 1 ? 's' : ''} — scroll + pinch para zoom · arrastar para mover
          </Typography>
          <Legenda />
        </Box>
      )}

      {isLoading && <CircularProgress />}
      {error    && <Alert severity="error">Erro ao carregar fluxos.</Alert>}

      {!temFiltro && !isLoading && (
        <Paper variant="outlined" sx={{
          p: 6, textAlign: 'center', bgcolor: '#f9fafb', borderStyle: 'dashed',
        }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Selecione ao menos um filtro para visualizar o fluxo
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Use Tabela, Job, Grupo, Rotina, Posição ou Carga para carregar o grafo.
          </Typography>
        </Paper>
      )}

      {temFiltro && data && !isLoading && (
        data.nodes.length === 0 ? (
          <Alert severity="info">Nenhum processo encontrado com os filtros aplicados.</Alert>
        ) : (
          <>
            {data.nodes.length > 80 && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                {data.nodes.length} nós — use os filtros (Rotina, Grupo ou Tabela) para uma visualização mais clara.
              </Alert>
            )}
            <Paper variant="outlined" sx={{ bgcolor: '#f0f4f8', overflow: 'hidden', borderRadius: 2 }}>
              <svg ref={svgRef} style={{ width: '100%', height: '680px', display: 'block', cursor: 'grab' }}>
                <defs>
                  <marker id="fl-arrow" viewBox="0 -5 10 10" refX={9} refY={0}
                          orient="auto" markerWidth={7} markerHeight={7}>
                    <path d="M 0,-5 L 10,0 L 0,5" fill="#90a4ae" />
                  </marker>
                </defs>
                <g className="zg">
                  {layout?.edges.map((e, i) => (
                    <path key={i} d={edgePath(e.points)}
                          fill="none" stroke="#90a4ae" strokeWidth={1.5}
                          markerEnd="url(#fl-arrow)" />
                  ))}
                  {layout?.nodes.map(n => <NodeCard key={n.id} node={n} />)}
                </g>
              </svg>
            </Paper>
          </>
        )
      )}
    </Box>
  );
};
