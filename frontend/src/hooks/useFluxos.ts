import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface GrafoNode {
  id: string;
  label: string;
  grupo: string;
}

export interface GrafoEdge {
  source: string;
  target: string;
  condicao: string;
}

export interface Grafo {
  nodes: GrafoNode[];
  edges: GrafoEdge[];
}

export const useFluxosGrafo = (grupo?: string) => {
  return useQuery({
    queryKey: ['fluxos-grafo', grupo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (grupo) params.append('grupo', grupo);
      const { data } = await axios.get<Grafo>(`${API_URL}/api/fluxos/grafo?${params}`);
      return data;
    },
  });
};
