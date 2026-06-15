import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface FiltrosFluxo {
  grupo?:         string;
  tabela?:        string;
  job?:           string;
  rotina?:        string;
  posicao?:       string;
  carga?:         string;
  horario_carga?: string;
}

export interface GrafoNode {
  id:      string;
  label:   string;
  grupo:   string;
  tabela:  string;
  posicao: 'inicio' | 'meio' | 'fim';
  carga:   string;
}

export interface GrafoEdge {
  source:   string;
  target:   string;
  condicao: string;
}

export interface Grafo {
  nodes: GrafoNode[];
  edges: GrafoEdge[];
}

export const useFluxosGrafo = (filtros: FiltrosFluxo = {}) => {
  return useQuery({
    queryKey: ['fluxos-grafo', filtros],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (filtros.grupo)         p.append('grupo',         filtros.grupo);
      if (filtros.tabela)        p.append('tabela',        filtros.tabela);
      if (filtros.job)           p.append('job',           filtros.job);
      if (filtros.rotina)        p.append('rotina',        filtros.rotina);
      if (filtros.posicao)       p.append('posicao',       filtros.posicao);
      if (filtros.carga)         p.append('carga',         filtros.carga);
      if (filtros.horario_carga) p.append('horario_carga', filtros.horario_carga);
      const { data } = await axios.get<Grafo>(`${API_URL}/api/fluxos/grafo?${p}`);
      return data;
    },
  });
};

export const useRotinasFluxos = () =>
  useQuery<{ rotinas: string[] }>({
    queryKey: ['fluxos-rotinas'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/fluxos/rotinas`);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
