import { useState } from 'react';
import { Download, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type AnaliseResult, type TipoErro, TIPO_ERRO_CONFIG } from './types';

interface CorretorReportProps {
  result: AnaliseResult;
}

export function CorretorReport({ result }: CorretorReportProps) {
  const [filtro, setFiltro] = useState<TipoErro | 'todos'>('todos');

  const errosFiltrados = filtro === 'todos'
    ? result.erros
    : result.erros.filter(e => e.tipo === filtro);

  const exportarCSV = () => {
    const header = 'Trecho;Erro;Tipo;Sugestão;Localização';
    const rows = result.erros.map(e =>
      `"${e.trecho.replace(/"/g, '""')}";"${e.erro.replace(/"/g, '""')}";"${TIPO_ERRO_CONFIG[e.tipo]?.label || e.tipo}";"${e.sugestao.replace(/"/g, '""')}";"${e.localizacao}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'relatorio-corretor.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const tiposComErros = Object.entries(result.resumo)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {result.total === 0 ? 'Nenhum erro encontrado! 🎉' : `${result.total} erro${result.total > 1 ? 's' : ''} encontrado${result.total > 1 ? 's' : ''}`}
            </CardTitle>
            {result.total > 0 && (
              <Button variant="outline" size="sm" onClick={exportarCSV}>
                <Download className="h-4 w-4 mr-1" />
                Exportar CSV
              </Button>
            )}
          </div>
        </CardHeader>
        {tiposComErros.length > 0 && (
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {tiposComErros.map(([tipo, count]) => {
                const config = TIPO_ERRO_CONFIG[tipo as TipoErro];
                return (
                  <Badge key={tipo} variant="outline" className={`${config.color} cursor-pointer`} onClick={() => setFiltro(tipo as TipoErro)}>
                    {config.label}: {count}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Filtro e Lista */}
      {result.total > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filtro} onValueChange={(v) => setFiltro(v as TipoErro | 'todos')}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {Object.entries(TIPO_ERRO_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground ml-auto">
                {errosFiltrados.length} resultado{errosFiltrados.length !== 1 ? 's' : ''}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {errosFiltrados.map((erro, i) => {
                const config = TIPO_ERRO_CONFIG[erro.tipo] || TIPO_ERRO_CONFIG.outro;
                return (
                  <div key={i} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" className={config.color}>
                        {config.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{erro.localizacao}</span>
                    </div>
                    <div>
                      <p className="text-sm">
                        <span className="font-medium text-destructive">"{erro.trecho}"</span>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">{erro.erro}</p>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <p className="text-sm">
                        <span className="font-medium">Sugestão:</span> {erro.sugestao}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
