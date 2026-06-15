import React, { useEffect, useRef, useState } from 'react';
import {
  Box, TextField, Button, CircularProgress, Alert, Typography, Paper,
  FormControl, InputLabel, Select, MenuItem, Divider, Collapse, Chip,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import { useFluxosGrafo, useRotinasFluxos, FiltrosFluxo, GrafoNode } from '../hooks/useFluxos';
import * as d3 from 'd3';

interface SimNode extends GrafoNode, d3.SimulationNodeDatum {}
interface SimEdge extends d3.SimulationLinkDatum<SimNode> { condicao: string }

const GRUPOS   = ['PR12', 'PR21', 'PR31', 'PR41'];
const FILTROS_VAZIOS: FiltrosFluxo = { grupo: '', tabela: '', job: '', rotina: '', posicao: '', carga: '' };

const COR_POSICAO: Record<string, string> = {
  inicio: '#2e7d32',
  meio:   '#1565c0',
  fim:    '#c62828',
};

const LABEL_POSICAO: Record<string, string> = {
  inicio: 'Início',
  meio:   'Meio',
  fim:    'Fim',
};

// ── Legenda ───────────────────────────────────────────────────────────────────
const Legenda: React.FC = () => (
  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
    {Object.entries(COR_POSICAO).map(([pos, cor]) => (
      <Box key={pos} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: cor }} />
        <Typography variant="caption" fontWeight={600}>{LABEL_POSICAO[pos]}</Typography>
      </Box>
    ))}
    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
      — Arraste os nós para reorganizar
    </Typography>
  </Box>
);

// ── Componente principal ──────────────────────────────────────────────────────
export const Tela3Fluxos: React.FC = () => {
  const [filtros, setFiltros]           = useState<FiltrosFluxo>(FILTROS_VAZIOS);
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltrosFluxo>(FILTROS_VAZIOS);
  const [expandido, setExpandido]       = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const { data, isLoading, error } = useFluxosGrafo(filtrosAtivos);
  const { data: rotinasData }      = useRotinasFluxos();

  const set = (campo: keyof FiltrosFluxo) => (v: string) =>
    setFiltros(prev => ({ ...prev, [campo]: v }));

  const aplicar = () => setFiltrosAtivos(filtros);
  const limpar  = () => { setFiltros(FILTROS_VAZIOS); setFiltrosAtivos(FILTROS_VAZIOS); };

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const width  = 960;
    const height = 600;

    d3.select(svgRef.current).selectAll('*').remove();

    if (data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current).attr('viewBox', `0 0 ${width} ${height}`);

    const nodes: SimNode[] = data.nodes.map(n => ({ ...n }));
    const edges: SimEdge[] = data.edges.map(e => ({
      source:   e.source,
      target:   e.target,
      condicao: e.condicao,
    }));

    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force('link',      d3.forceLink<SimNode, SimEdge>(edges).id(d => d.id).distance(110))
      .force('charge',    d3.forceManyBody().strength(-320))
      .force('center',    d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(36));

    // Marcador de seta
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#90a4ae');

    const link = svg.append('g')
      .selectAll<SVGLineElement, SimEdge>('line')
      .data(edges).enter().append('line')
      .attr('stroke', '#90a4ae')
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrowhead)');

    const nodeGroup = svg.append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes).enter().append('g')
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end',  (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    // Círculo colorido por posição
    nodeGroup.append('circle')
      .attr('r', 18)
      .attr('fill', d => COR_POSICAO[d.posicao] ?? '#1565c0')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Ícone de carga (pequeno anel)
    nodeGroup.filter(d => d.carga === 'SIM')
      .append('circle')
      .attr('r', 5)
      .attr('cx', 13)
      .attr('cy', -13)
      .attr('fill', '#ff8f00')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

    // Rótulo do job
    nodeGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', 'white')
      .attr('font-size', '8px')
      .attr('font-weight', 'bold')
      .text(d => d.label.length > 11 ? d.label.substring(0, 11) + '…' : d.label);

    // Tooltip
    nodeGroup.append('title')
      .text(d => `${d.tabela} / ${d.label}\nGrupo: ${d.grupo}\nPosição: ${LABEL_POSICAO[d.posicao]}${d.carga === 'SIM' ? '\n⚡ Carga automática' : ''}`);

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as SimNode).x ?? 0)
        .attr('y1', d => (d.source as SimNode).y ?? 0)
        .attr('x2', d => (d.target as SimNode).x ?? 0)
        .attr('y2', d => (d.target as SimNode).y ?? 0);
      nodeGroup.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => { simulation.stop(); };
  }, [data]);

  const temFiltroAtivo = Object.values(filtrosAtivos).some(v => v !== '');

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>Fluxo de Processamento</Typography>

      {/* Filtros */}
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
             onClick={() => setExpandido(v => !v)}>
          <FilterListIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight={600}>Filtros</Typography>
          {temFiltroAtivo && (
            <Chip label="Filtro ativo" size="small" color="primary" sx={{ ml: 1 }} />
          )}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {expandido ? 'Recolher ▲' : 'Expandir ▼'}
          </Typography>
        </Box>
        <Collapse in={expandido}>
          <Divider />
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Linha 1: texto livre */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField label="Tabela" value={filtros.tabela} size="small" sx={{ minWidth: 150 }}
                         onChange={e => set('tabela')(e.target.value)} />
              <TextField label="Job"    value={filtros.job}    size="small" sx={{ minWidth: 150 }}
                         onChange={e => set('job')(e.target.value)} />
            </Box>

            {/* Linha 2: selects */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Grupo</InputLabel>
                <Select value={filtros.grupo} label="Grupo" onChange={e => set('grupo')(e.target.value as string)}>
                  <MenuItem value=""><em>Todos</em></MenuItem>
                  {GRUPOS.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Rotina</InputLabel>
                <Select value={filtros.rotina} label="Rotina" onChange={e => set('rotina')(e.target.value as string)}>
                  <MenuItem value=""><em>Todas</em></MenuItem>
                  {(rotinasData?.rotinas ?? []).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Posição no Fluxo</InputLabel>
                <Select value={filtros.posicao} label="Posição no Fluxo"
                        onChange={e => set('posicao')(e.target.value as string)}>
                  <MenuItem value=""><em>Todas</em></MenuItem>
                  <MenuItem value="inicio">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COR_POSICAO.inicio }} />
                      Início (sem IN_COUNDS)
                    </Box>
                  </MenuItem>
                  <MenuItem value="meio">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COR_POSICAO.meio }} />
                      Meio (IN e OUT+)
                    </Box>
                  </MenuItem>
                  <MenuItem value="fim">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COR_POSICAO.fim }} />
                      Fim (sem OUT+)
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Carga Automática</InputLabel>
                <Select value={filtros.carga} label="Carga Automática"
                        onChange={e => set('carga')(e.target.value as string)}>
                  <MenuItem value=""><em>Todas</em></MenuItem>
                  <MenuItem value="SIM">SIM</MenuItem>
                  <MenuItem value="NAO">NAO</MenuItem>
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

      {/* Info + Legenda */}
      {data && !isLoading && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {data.nodes.length} nó{data.nodes.length !== 1 ? 's' : ''} · {data.edges.length} aresta{data.edges.length !== 1 ? 's' : ''}
          </Typography>
          <Legenda />
        </Box>
      )}

      {isLoading && <CircularProgress />}
      {error   && <Alert severity="error">Erro ao carregar fluxos.</Alert>}

      {data && !isLoading && (
        data.nodes.length === 0 ? (
          <Alert severity="info">
            Nenhum processo encontrado com os filtros aplicados.
            {!temFiltroAtivo && ' Execute o ETL para gerar as dependências.'}
          </Alert>
        ) : (
          <Paper variant="outlined" sx={{ bgcolor: '#fafafa', overflow: 'hidden' }}>
            <svg ref={svgRef} style={{ width: '100%', height: '600px', display: 'block' }} />
          </Paper>
        )
      )}
    </Box>
  );
};
