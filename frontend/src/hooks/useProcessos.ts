import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Processo {
  tabela: string;
  job: string;
  grupo: string;
  periodicidade?: string;
  status?: string;
}

export const useProcessos = (grupo?: string, page: number = 1) => {
  return useQuery({
    queryKey: ['processos', grupo, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (grupo) params.append('grupo', grupo);
      params.append('page', page.toString());
      params.append('limit', '20');
      const { data } = await axios.get(`${API_URL}/api/processos?${params}`);
      return data;
    },
  });
};

export const useProcessoStats = (tabela: string, job: string, grupo: string) => {
  return useQuery({
    queryKey: ['processo-stats', tabela, job, grupo],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/processos/${tabela}/${job}/${grupo}/stats`);
      return data;
    },
  });
};
