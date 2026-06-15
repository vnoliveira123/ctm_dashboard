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
  Typography,
  Chip,
} from '@mui/material';
import { useExecucoes } from '../hooks/useExecucoes';

export const Tela2Execucoes: React.FC = () => {
  const [job, setJob] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useExecucoes(
    job || undefined,
    dataInicio || undefined,
    dataFim || undefined,
    page
  );

  const formatarData = (val: string) => {
    if (!val) return '-';
    return new Date(val).toLocaleString('pt-BR');
  };

  const limpar = () => {
    setJob('');
    setDataInicio('');
    setDataFim('');
    setPage(1);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
        📈 Detalhes de Processamento
      </Typography>

      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="Job"
          value={job}
          onChange={(e) => { setJob(e.target.value); setPage(1); }}
          size="small"
        />
        <TextField
          label="Data Início"
          type="date"
          value={dataInicio}
          onChange={(e) => { setDataInicio(e.target.value); setPage(1); }}
          size="small"
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Data Fim"
          type="date"
          value={dataFim}
          onChange={(e) => { setDataFim(e.target.value); setPage(1); }}
          size="small"
          InputLabelProps={{ shrink: true }}
        />
        <Button variant="outlined" onClick={limpar}>Limpar</Button>
      </Box>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Erro ao carregar execuções. Verifique se a API está respondendo.</Alert>}

      {data && !isLoading && (
        <>
          {data.execucoes?.length === 0 ? (
            <Alert severity="info">Nenhuma execução encontrada. Execute o ETL para importar dados.</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#1976d2' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Tabela</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Job</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Grupo</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Data Execução</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Duração (min)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.execucoes?.map((exec: any, idx: number) => (
                    <TableRow key={idx} hover>
                      <TableCell>{exec.tabela}</TableCell>
                      <TableCell>{exec.job}</TableCell>
                      <TableCell>{exec.grupo}</TableCell>
                      <TableCell>{formatarData(exec.data_execucao)}</TableCell>
                      <TableCell>
                        <Chip
                          label={exec.status}
                          size="small"
                          color={exec.status === 'SUCCESS' ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell>{exec.duracao_minutos ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              count={Math.ceil((data.total || 0) / 20)}
              page={page}
              onChange={(_, v) => setPage(v)}
              color="primary"
            />
          </Box>
        </>
      )}
    </Box>
  );
};
