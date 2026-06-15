import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Execucao {
  tabela: string;
  job: string;
  grupo: string;
  data_execucao: string;
  status: string;
  duracao_minutos: number;
}

export const useExecucoes = (job?: string, dataInicio?: string, dataFim?: string, page: number = 1) => {
  return useQuery({
    queryKey: ['execucoes', job, dataInicio, dataFim, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (job) params.append('job', job);
      if (dataInicio) params.append('data_inicio', dataInicio);
      if (dataFim) params.append('data_fim', dataFim);
      params.append('page', page.toString());
      params.append('limit', '20');
      const { data } = await axios.get(`${API_URL}/api/execucoes?${params}`);
      return data;
    },
  });
};
