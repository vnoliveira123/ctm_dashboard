import React, { useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Pagination,
  Card,
  CardContent,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Divider,
  Collapse,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import WorkIcon from '@mui/icons-material/Work';
import TableChartIcon from '@mui/icons-material/TableChart';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { useProcessos, useFiltrosDisponiveis, FiltrosProcesso } from '../hooks/useProcessos';

const GRUPOS = ['PR12', 'PR21', 'PR31', 'PR41'];
const HORARIOS = ['00', '01', '03', '07', '10', '13', '16', '19', '23'];
const MEMLIBS = [
  'MX.JCLFILE',
  'MX.CTMR.PR12.SCHEFILE',
  'MX.CTMR.PR21.SCHEFILE',
  'MX.CTMR.PR31.SCHEFILE',
  'MX.CTMR.PR41.SCHEFILE',
  'DUMMY',
];
const EVENTOS_ISD = ['FORCE TABELA', 'FORCE JOB', 'ADICIONA CONDIÇÃO'];
const TIPOS_ALERTA = ['OPER', 'TSO-P', 'U-ECS'];

const FILTROS_VAZIOS: FiltrosProcesso = {
  tabela: '',
  job: '',
  grupo: '',
  periodicidade: '',
  confirm: '',
  memlib: '',
  carga: '',
  horarios_carga: [],
  isd: '',
  evento_isd: '',
  tem_alerta: '',
  padrao: '',
  tipo_alerta: '',
};

const SelectFiltro: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  opcoes: { value: string; label: string }[];
  minWidth?: number;
}> = ({ label, value, onChange, opcoes, minWidth = 160 }) => (
  <FormControl size="small" sx={{ minWidth }}>
    <InputLabel>{label}</InputLabel>
    <Select value={value} label={label} onChange={(e) => onChange(e.target.value as string)}>
      <MenuItem value=""><em>Todos</em></MenuItem>
      {opcoes.map((o) => (
        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
      ))}
    </Select>
  </FormControl>
);

const ResumoCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}> = ({ icon, label, value, color }) => (
  <Card sx={{ flex: '1 1 160px', minWidth: 140, borderTop: `3px solid ${color}` }}>
    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, color }}>
        {icon}
        <Typography variant="caption" color="text.secondary" fontWeight={500}>{label}</Typography>
      </Box>
      <Typography variant="h5" fontWeight="bold">{value.toLocaleString('pt-BR')}</Typography>
    </CardContent>
  </Card>
);

export const Tela1Processos: React.FC = () => {
  const [filtros, setFiltros] = useState<FiltrosProcesso>(FILTROS_VAZIOS);
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltrosProcesso>(FILTROS_VAZIOS);
  const [page, setPage] = useState(1);
  const [expandido, setExpandido] = useState(true);

  const { data, isLoading, error } = useProcessos(filtrosAtivos, page);
  const { data: opcoes } = useFiltrosDisponiveis();

  const set = (campo: keyof FiltrosProcesso) => (valor: any) => {
    setFiltros((prev) => {
      const novo = { ...prev, [campo]: valor };
      // Limpar sub-filtros dependentes
      if (campo === 'carga' && valor !== 'SIM') novo.horarios_carga = [];
      if (campo === 'isd' && valor !== 'SIM') novo.evento_isd = '';
      if (campo === 'tem_alerta') { novo.padrao = ''; novo.tipo_alerta = ''; }
      return novo;
    });
  };

  const aplicar = () => { setFiltrosAtivos(filtros); setPage(1); };
  const limpar = () => { setFiltros(FILTROS_VAZIOS); setFiltrosAtivos(FILTROS_VAZIOS); setPage(1); };

  const resumo = data?.resumo;
  const totalPaginas = Math.ceil((data?.total || 0) / 20);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
        Processos Cadastrados
      </Typography>

      {/* Painel de Filtros */}
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Box
          sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
          onClick={() => setExpandido((v) => !v)}
        >
          <FilterListIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight={600}>Filtros</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {expandido ? 'Recolher ▲' : 'Expandir ▼'}
          </Typography>
        </Box>

        <Collapse in={expandido}>
          <Divider />
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Linha 1: Identificação */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Tabela"
                value={filtros.tabela}
                onChange={(e) => set('tabela')(e.target.value)}
                size="small"
                sx={{ minWidth: 160 }}
              />
              <TextField
                label="Job"
                value={filtros.job}
                onChange={(e) => set('job')(e.target.value)}
                size="small"
                sx={{ minWidth: 160 }}
              />
              <SelectFiltro
                label="Grupo"
                value={filtros.grupo || ''}
                onChange={set('grupo')}
                opcoes={GRUPOS.map((g) => ({ value: g, label: g }))}
              />
              <SelectFiltro
                label="Periodicidade"
                value={filtros.periodicidade || ''}
                onChange={set('periodicidade')}
                opcoes={(opcoes?.periodicidades || []).map((p) => ({ value: p, label: p }))}
                minWidth={180}
              />
            </Box>

            {/* Linha 2: Confirm + Memlib */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <SelectFiltro
                label="Confirm"
                value={filtros.confirm || ''}
                onChange={set('confirm')}
                opcoes={[{ value: 'SIM', label: 'Sim' }, { value: 'NAO', label: 'Não' }]}
              />
              <SelectFiltro
                label="Memlib"
                value={filtros.memlib || ''}
                onChange={set('memlib')}
                opcoes={MEMLIBS.map((m) => ({ value: m, label: m }))}
                minWidth={230}
              />
            </Box>

            {/* Linha 3: Carga */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <SelectFiltro
                label="Carga Automática"
                value={filtros.carga || ''}
                onChange={set('carga')}
                opcoes={[{ value: 'SIM', label: 'Sim' }, { value: 'NAO', label: 'Não' }]}
                minWidth={180}
              />
              {filtros.carga === 'SIM' && (
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Horário de Carga</InputLabel>
                  <Select
                    multiple
                    value={filtros.horarios_carga || []}
                    onChange={(e) => set('horarios_carga')(e.target.value as string[])}
                    input={<OutlinedInput label="Horário de Carga" />}
                    renderValue={(sel) => (sel as string[]).join(', ') || 'Todos'}
                  >
                    {HORARIOS.map((h) => (
                      <MenuItem key={h} value={h}>
                        <Checkbox checked={(filtros.horarios_carga || []).includes(h)} size="small" />
                        <ListItemText primary={`${h}h`} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>

            {/* Linha 4: ISD */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <SelectFiltro
                label="ISD"
                value={filtros.isd || ''}
                onChange={set('isd')}
                opcoes={[{ value: 'SIM', label: 'Sim' }, { value: 'NAO', label: 'Não' }]}
              />
              {filtros.isd === 'SIM' && (
                <SelectFiltro
                  label="Tipo de Evento ISD"
                  value={filtros.evento_isd || ''}
                  onChange={set('evento_isd')}
                  opcoes={EVENTOS_ISD.map((e) => ({ value: e, label: e }))}
                  minWidth={220}
                />
              )}
            </Box>

            {/* Linha 5: Alerta */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <SelectFiltro
                label="Alerta"
                value={filtros.tem_alerta || ''}
                onChange={set('tem_alerta')}
                opcoes={[{ value: 'SIM', label: 'Sim' }, { value: 'NAO', label: 'Não' }]}
              />
              {filtros.tem_alerta === 'SIM' && (
                <SelectFiltro
                  label="Padrão de Alerta"
                  value={filtros.padrao || ''}
                  onChange={set('padrao')}
                  opcoes={[{ value: 'SIM', label: 'Sim (Padrão)' }, { value: 'NAO', label: 'Não (Customizado)' }]}
                  minWidth={200}
                />
              )}
              {filtros.tem_alerta === 'NAO' && (
                <SelectFiltro
                  label="Tipo de Alerta"
                  value={filtros.tipo_alerta || ''}
                  onChange={set('tipo_alerta')}
                  opcoes={TIPOS_ALERTA.map((t) => ({ value: t, label: t }))}
                />
              )}
            </Box>

            {/* Ações */}
            <Box sx={{ display: 'flex', gap: 1, pt: 0.5 }}>
              <Button variant="contained" size="small" onClick={aplicar}>
                Aplicar Filtros
              </Button>
              <Button variant="outlined" size="small" startIcon={<ClearIcon />} onClick={limpar}>
                Limpar
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* Cards de Resumo */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <ResumoCard
          icon={<WorkIcon fontSize="small" />}
          label="Total de JOBs"
          value={resumo?.total_jobs ?? 0}
          color="#1976d2"
        />
        <ResumoCard
          icon={<TableChartIcon fontSize="small" />}
          label="Tabelas"
          value={resumo?.total_tabelas ?? 0}
          color="#7b1fa2"
        />
        <ResumoCard
          icon={<AutorenewIcon fontSize="small" />}
          label="Tabelas em Carga"
          value={resumo?.tabelas_carga ?? 0}
          color="#2e7d32"
        />
        <ResumoCard
          icon={<AccountTreeIcon fontSize="small" />}
          label="Tabelas com ISD"
          value={resumo?.tabelas_isd ?? 0}
          color="#e65100"
        />
        <ResumoCard
          icon={<NotificationsActiveIcon fontSize="small" />}
          label="Tabelas com Alertas"
          value={resumo?.tabelas_alerta ?? 0}
          color="#c62828"
        />
      </Box>

      {/* Conteúdo */}
      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">Erro ao carregar processos. Verifique se a API está respondendo.</Alert>}

      {data && !isLoading && (
        <>
          {data.processos.length === 0 ? (
            <Alert severity="info">Nenhum processo encontrado para os filtros selecionados.</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    {['Tabela', 'Job', 'Grupo', 'Tipo', 'Periodicidade', 'Carga', 'Horário', 'ISD', 'Confirm', 'Alerta'].map((col) => (
                      <TableCell key={col} sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {col}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.processos.map((p, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.tabela}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.job}</TableCell>
                      <TableCell>
                        <Chip
                          label={p.grupo?.split('-')[0] ?? p.grupo}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={p.tasktype ?? '-'}
                          size="small"
                          color={p.tasktype === 'JOB' ? 'default' : 'secondary'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{p.periodicidade ?? '-'}</TableCell>
                      <TableCell>
                        {p.carga === 'SIM'
                          ? <Chip label={`Sim • ${p.horario_carga}h`} size="small" color="success" />
                          : <Chip label="Não" size="small" variant="outlined" />}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {p.fromtime && p.untiltime ? `${p.fromtime} – ${p.untiltime}` : '-'}
                      </TableCell>
                      <TableCell>
                        {p.isd === 'SIM'
                          ? <Chip label="Sim" size="small" color="warning" />
                          : <Chip label="Não" size="small" variant="outlined" />}
                      </TableCell>
                      <TableCell>
                        {p.confirm === 'Y'
                          ? <Chip label="Sim" size="small" color="info" />
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {p.tem_alerta
                          ? <Chip label={p.tipo_alerta ?? 'Alerta'} size="small" color="error" />
                          : <Chip label="Não" size="small" variant="outlined" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {data.total} registro{data.total !== 1 ? 's' : ''} encontrado{data.total !== 1 ? 's' : ''}
            </Typography>
            <Pagination
              count={totalPaginas}
              page={page}
              onChange={(_, v) => setPage(v)}
              color="primary"
              size="small"
            />
          </Box>
        </>
      )}
    </Box>
  );
};
