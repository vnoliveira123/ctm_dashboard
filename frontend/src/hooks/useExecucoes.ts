import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface FiltrosExecucao {
  tabela?: string;
  job?: string;
  grupo?: string;
  rotina?: string;
  data_inicio?: string;
  data_fim?: string;
  status?: string;
}

export interface ExecucaoItem {
  tabela: string;
  job: string;
  grupo: string;
  data_execucao: string;
  status: string;
  duracao_minutos: number | null;
}

export interface ResumoExecucoes {
  total: number;
  ok: number;
  nok: number;
  duracao_media: number;
  job_maior_duracao: string;
  maior_duracao: number;
}

export interface VolumeData     { data: string; total: number; ok: number; nok: number; }
export interface TopDurData     { job: string; avg_dur: number; max_dur: number; }
export interface HoraData       { hora: number; total: number; ok: number; nok: number; }
export interface IsdData        { job: string; total: number; }
export interface TimeseriesItem { data: string; duracao: number; status: string; }

export interface GraficosData {
  resumo: ResumoExecucoes;
  volume_por_data: VolumeData[];
  top_duracao: TopDurData[];
  por_hora: HoraData[];
  isd_execucoes: IsdData[];
  timeseries: TimeseriesItem[];
}

export interface SlaItem {
  tabela: string;
  job: string;
  avg_dur: number;
  max_dur: number;
  total_exec: number;
}

function buildParams(filtros: FiltrosExecucao, extra?: Record<string, string>) {
  const p = new URLSearchParams();
  if (filtros.tabela)      p.append('tabela',      filtros.tabela);
  if (filtros.job)         p.append('job',         filtros.job);
  if (filtros.grupo)       p.append('grupo',       filtros.grupo);
  if (filtros.rotina)      p.append('rotina',      filtros.rotina);
  if (filtros.data_inicio) p.append('data_inicio', filtros.data_inicio);
  if (filtros.data_fim)    p.append('data_fim',    filtros.data_fim);
  if (filtros.status)      p.append('status',      filtros.status);
  if (extra) Object.entries(extra).forEach(([k, v]) => p.append(k, v));
  return p;
}

export const useExecucoes = (filtros: FiltrosExecucao = {}, page = 1) =>
  useQuery<{ execucoes: ExecucaoItem[]; total: number }>({
    queryKey: ['execucoes', filtros, page],
    queryFn: async () => {
      const p = buildParams(filtros, { page: String(page), limit: '20' });
      const { data } = await axios.get(`${API_URL}/api/execucoes?${p}`);
      return data;
    },
  });

export const useGraficosExecucoes = (filtros: FiltrosExecucao) =>
  useQuery<GraficosData>({
    queryKey: ['execucoes-graficos', filtros],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const p = buildParams(filtros);
      const { data } = await axios.get(`${API_URL}/api/execucoes/graficos?${p}`);
      return data;
    },
  });

export const useRotinasDisponiveis = () =>
  useQuery<{ rotinas: string[] }>({
    queryKey: ['execucoes-rotinas'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/execucoes/rotinas`);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const useSlaJobs = (slaMinutos: number) =>
  useQuery<{ jobs: SlaItem[]; sla_minutos: number }>({
    queryKey: ['execucoes-sla', slaMinutos],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_URL}/api/execucoes/sla?sla_minutos=${slaMinutos}`,
      );
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
