import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface FiltrosProcesso {
  tabela?: string;
  job?: string;
  grupo?: string;
  periodicidade?: string;
  confirm?: string;
  memlib?: string;
  carga?: string;
  horarios_carga?: string[];
  isd?: string;
  evento_isd?: string;
  tem_alerta?: string;
  padrao?: string;
  tipo_alerta?: string;
}

export interface ProcessoItem {
  tabela: string;
  job: string;
  grupo: string;
  tasktype?: string;
  periodicidade?: string;
  carga?: string;
  horario_carga?: string;
  isd?: string;
  evento_isd?: string;
  tem_alerta?: boolean;
  alerta_config?: string;
  tipo_alerta?: string;
  padrao?: string;
  confirm?: string;
  memlib?: string;
  resource?: string;
  fromtime?: string;
  untiltime?: string;
}

export interface ResumoProcessos {
  total_jobs: number;
  total_tabelas: number;
  tabelas_carga: number;
  tabelas_isd: number;
  tabelas_alerta: number;
}

export interface RespostaProcessos {
  processos: ProcessoItem[];
  total: number;
  resumo: ResumoProcessos;
  page: number;
  limit: number;
}

export const useProcessos = (filtros: FiltrosProcesso = {}, page: number = 1) => {
  return useQuery<RespostaProcessos>({
    queryKey: ['processos', filtros, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtros.tabela) params.append('tabela', filtros.tabela);
      if (filtros.job) params.append('job', filtros.job);
      if (filtros.grupo) params.append('grupo', filtros.grupo);
      if (filtros.periodicidade) params.append('periodicidade', filtros.periodicidade);
      if (filtros.confirm) params.append('confirm', filtros.confirm);
      if (filtros.memlib) params.append('memlib', filtros.memlib);
      if (filtros.carga) params.append('carga', filtros.carga);
      if (filtros.horarios_carga?.length) params.append('horarios_carga', filtros.horarios_carga.join(','));
      if (filtros.isd) params.append('isd', filtros.isd);
      if (filtros.evento_isd) params.append('evento_isd', filtros.evento_isd);
      if (filtros.tem_alerta) params.append('tem_alerta', filtros.tem_alerta);
      if (filtros.padrao) params.append('padrao', filtros.padrao);
      if (filtros.tipo_alerta) params.append('tipo_alerta', filtros.tipo_alerta);
      params.append('page', page.toString());
      params.append('limit', '20');
      const { data } = await axios.get(`${API_URL}/api/processos?${params}`);
      return data;
    },
  });
};

export const useFiltrosDisponiveis = () => {
  return useQuery<{ periodicidades: string[] }>({
    queryKey: ['processos-filtros'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/processos/filtros`);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
};
