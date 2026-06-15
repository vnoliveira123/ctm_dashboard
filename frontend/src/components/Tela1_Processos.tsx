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
} from '@mui/material';
import { useProcessos } from '../hooks/useProcessos';

export const Tela1Processos: React.FC = () => {
  const [grupo, setGrupo] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useProcessos(grupo || undefined, page);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
        📋 Processos Cadastrados
      </Typography>

      {/* Filtros */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Filtrar por Grupo"
          value={grupo}
          onChange={(e) => { setGrupo(e.target.value); setPage(1); }}
          size="small"
        />
        <Button variant="outlined" onClick={() => { setGrupo(''); setPage(1); }}>
          Limpar
        </Button>
      </Box>

      {/* Cards de resumo */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Card sx={{ minWidth: 160 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Total de Processos</Typography>
            <Typography variant="h5" fontWeight="bold">{data?.total ?? 0}</Typography>
          </CardContent>
        </Card>
      </Box>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">Erro ao carregar processos. Verifique se a API está respondendo.</Alert>}

      {data && !isLoading && (
        <>
          {data.processos?.length === 0 ? (
            <Alert severity="info">Nenhum processo encontrado. Execute o ETL para importar dados.</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#1976d2' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Tabela</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Job</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Grupo</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Periodicidade</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.processos?.map((p: any, idx: number) => (
                    <TableRow key={idx} hover>
                      <TableCell>{p.tabela}</TableCell>
                      <TableCell>{p.job}</TableCell>
                      <TableCell>{p.grupo}</TableCell>
                      <TableCell>{p.periodicidade || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={p.status}
                          size="small"
                          color={p.status === 'OK' ? 'success' : 'error'}
                        />
                      </TableCell>
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
