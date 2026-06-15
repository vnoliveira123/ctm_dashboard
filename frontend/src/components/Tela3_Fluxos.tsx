import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Typography,
  Paper,
} from '@mui/material';
import { useFluxosGrafo, GrafoNode, GrafoEdge } from '../hooks/useFluxos';
import * as d3 from 'd3';

interface SimNode extends GrafoNode, d3.SimulationNodeDatum {}
interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  condicao: string;
}

export const Tela3Fluxos: React.FC = () => {
  const [grupo, setGrupo] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const { data, isLoading, error } = useFluxosGrafo(grupo || undefined);

  useEffect(() => {
    if (!data || !svgRef.current || data.nodes.length === 0) return;

    const width = 900;
    const height = 580;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const edges: SimEdge[] = data.edges.map((e) => ({
      source: e.source,
      target: e.target,
      condicao: e.condicao,
    }));

    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimEdge>(edges).id((d) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-350))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(40));

    // Seta para as arestas
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#999');

    const link = svg.append('g')
      .selectAll<SVGLineElement, SimEdge>('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrowhead)');

    const nodeGroup = svg.append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .enter()
      .append('g')
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    nodeGroup.append('circle')
      .attr('r', 18)
      .attr('fill', '#1976d2')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    nodeGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', 'white')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .text((d) => d.label.length > 10 ? d.label.substring(0, 10) + '…' : d.label);

    nodeGroup.append('title').text((d) => `${d.label}\nGrupo: ${d.grupo}`);

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);

      nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => { simulation.stop(); };
  }, [data]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
        🔗 Fluxo de Processamento
      </Typography>

      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <TextField
          label="Filtrar por Grupo"
          value={grupo}
          onChange={(e) => setGrupo(e.target.value)}
          size="small"
        />
        <Button variant="outlined" onClick={() => setGrupo('')}>Limpar</Button>
      </Box>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Erro ao carregar fluxos.</Alert>}

      {data && !isLoading && (
        data.nodes.length === 0 ? (
          <Alert severity="info">Nenhum fluxo encontrado. Execute o ETL para gerar as dependências.</Alert>
        ) : (
          <Paper variant="outlined" sx={{ bgcolor: '#fafafa', overflow: 'hidden' }}>
            <svg ref={svgRef} style={{ width: '100%', height: '580px', display: 'block' }} />
          </Paper>
        )
      )}
    </Box>
  );
};
