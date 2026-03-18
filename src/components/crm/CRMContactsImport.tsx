import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Download, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CRMContactsImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

const CRM_FIELDS = [
  { value: '_skip', label: '— Ignorar —' },
  { value: 'name', label: 'Nome *', required: true },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'company', label: 'Empresa' },
  { value: 'job_title', label: 'Cargo' },
  { value: 'city', label: 'Cidade' },
  { value: 'state', label: 'Estado' },
  { value: 'country', label: 'País' },
  { value: 'address', label: 'Endereço' },
  { value: 'website', label: 'Website' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'notes', label: 'Observações' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if ((ch === ',' || ch === ';') && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine).filter(r => r.some(c => c));
  return { headers, rows };
}

function autoMapColumns(headers: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  const patterns: Record<string, RegExp> = {
    name: /^(nome|name|contato|contact)$/i,
    email: /^(e-?mail|email)$/i,
    phone: /^(telefone|phone|cel|celular|whatsapp|fone)$/i,
    company: /^(empresa|company|organiza)$/i,
    job_title: /^(cargo|profiss|job|title|função)$/i,
    city: /^(cidade|city|município)$/i,
    state: /^(estado|state|uf)$/i,
    country: /^(pa[ií]s|country)$/i,
    address: /^(endere[çc]o|address|rua)$/i,
    website: /^(site|website|url|web)$/i,
    linkedin: /^(linkedin)$/i,
    notes: /^(observa|notas|notes|obs)$/i,
  };

  headers.forEach((h, i) => {
    for (const [field, regex] of Object.entries(patterns)) {
      if (regex.test(h.trim())) {
        // Don't map same field twice
        if (!Object.values(mapping).includes(field)) {
          mapping[i] = field;
        }
        break;
      }
    }
  });

  return mapping;
}

interface RowError {
  row: number;
  values: string[];
  errors: string[];
}

export const CRMContactsImport = ({ open, onOpenChange, onImportComplete }: CRMContactsImportProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  const [ignoreErrors, setIgnoreErrors] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ imported: number; errors: RowError[] }>({ imported: 0, errors: [] });

  const reset = () => {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setColumnMapping({});
    setIgnoreErrors(false);
    setProgress(0);
    setImportResult({ imported: 0, errors: [] });
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Apenas arquivos CSV são suportados');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      if (h.length === 0) {
        toast.error('Arquivo CSV vazio ou inválido');
        return;
      }
      setHeaders(h);
      setRows(r);
      const autoMap = autoMapColumns(h);
      setColumnMapping(autoMap);
      setStep('mapping');
    };
    reader.readAsText(file, 'UTF-8');
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, []);

  const nameColumnMapped = Object.values(columnMapping).includes('name');

  const validateRows = (): { valid: Record<string, any>[]; errors: RowError[] } => {
    const valid: Record<string, any>[] = [];
    const errors: RowError[] = [];
    const seenEmails = new Set<string>();

    // Also fetch existing emails for dedup (we'll do it in the import step instead for performance)

    rows.forEach((row, idx) => {
      const record: Record<string, any> = {};
      const rowErrors: string[] = [];

      Object.entries(columnMapping).forEach(([colIdx, field]) => {
        if (field === '_skip') return;
        const val = row[Number(colIdx)]?.trim() || '';
        if (val) record[field] = val;
      });

      // Required: name
      if (!record.name) {
        rowErrors.push('Nome é obrigatório');
      }

      // Validate email
      if (record.email && !EMAIL_REGEX.test(record.email)) {
        rowErrors.push('E-mail inválido');
      }

      // Dedup email within file
      if (record.email) {
        const lower = record.email.toLowerCase();
        if (seenEmails.has(lower)) {
          rowErrors.push('E-mail duplicado no arquivo');
        } else {
          seenEmails.add(lower);
        }
      }

      if (rowErrors.length > 0) {
        errors.push({ row: idx + 2, values: row, errors: rowErrors }); // +2 because header is row 1
      } else {
        valid.push(record);
      }
    });

    return { valid, errors };
  };

  const handlePreview = () => {
    if (!nameColumnMapped) {
      toast.error('Mapeie ao menos a coluna "Nome"');
      return;
    }
    setStep('preview');
  };

  const handleImport = async () => {
    const { valid, errors } = validateRows();

    if (!ignoreErrors && errors.length > 0) {
      setImportResult({ imported: 0, errors });
      toast.error(`${errors.length} linha(s) com erro. Ative "Ignorar erros" para importar as válidas.`);
      return;
    }

    if (valid.length === 0) {
      toast.error('Nenhum registro válido para importar');
      return;
    }

    setStep('importing');
    setProgress(0);

    const batchSize = 50;
    let imported = 0;
    const allErrors = [...errors];

    for (let i = 0; i < valid.length; i += batchSize) {
      const batch = valid.slice(i, i + batchSize);
      const { error } = await supabase.from('crm_contacts').insert(
        batch as any
      );

      if (error) {
        // If batch fails, try one-by-one
        for (const record of batch) {
          const { error: singleErr } = await supabase.from('crm_contacts').insert(
            record as any
          );
          if (singleErr) {
            allErrors.push({
              row: 0,
              values: [record.name || '', record.email || ''],
              errors: [singleErr.message],
            });
          } else {
            imported++;
          }
        }
      } else {
        imported += batch.length;
      }

      setProgress(Math.round(((i + batch.length) / valid.length) * 100));
    }

    setImportResult({ imported, errors: allErrors });
    setStep('done');
    if (imported > 0) onImportComplete();
  };

  const downloadErrors = () => {
    if (importResult.errors.length === 0) return;
    const csvLines = ['Linha,Valores,Erros'];
    importResult.errors.forEach(e => {
      csvLines.push(`${e.row},"${e.values.join('; ')}","${e.errors.join('; ')}"`);
    });
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'erros_importacao.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewData = rows.slice(0, 5).map(row => {
    const record: Record<string, string> = {};
    Object.entries(columnMapping).forEach(([colIdx, field]) => {
      if (field !== '_skip') {
        record[field] = row[Number(colIdx)] || '';
      }
    });
    return record;
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Contatos via CSV
          </DialogTitle>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Clique para selecionar um arquivo CSV</p>
              <p className="text-sm text-muted-foreground mt-1">Formatos: .csv (separado por vírgula ou ponto-e-vírgula)</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
          </div>
        )}

        {/* Step: Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {rows.length} linhas encontradas. Mapeie as colunas do CSV aos campos do CRM.
              </p>
              <Badge variant="secondary">{headers.length} colunas</Badge>
            </div>

            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{h}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Ex: {rows[0]?.[i] || '—'}
                      </p>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <Select
                      value={columnMapping[i] || '_skip'}
                      onValueChange={(v) => setColumnMapping({ ...columnMapping, [i]: v })}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CRM_FIELDS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {!nameColumnMapped && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-500/10 p-2 rounded-md">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Mapeie ao menos a coluna "Nome" para continuar.
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>Voltar</Button>
              <Button onClick={handlePreview} disabled={!nameColumnMapped}>Próximo: Preview</Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Preview das primeiras 5 linhas mapeadas:</p>

            <ScrollArea className="max-h-[250px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.values(columnMapping).filter(v => v !== '_skip').map(field => (
                      <TableHead key={field} className="text-xs">
                        {CRM_FIELDS.find(f => f.value === field)?.label || field}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, i) => (
                    <TableRow key={i}>
                      {Object.entries(row).map(([k, v]) => (
                        <TableCell key={k} className="text-sm">{v || '—'}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
              <Switch checked={ignoreErrors} onCheckedChange={setIgnoreErrors} id="ignore-errors" />
              <Label htmlFor="ignore-errors" className="text-sm">
                Ignorar linhas com erro e importar apenas as válidas
              </Label>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total: <strong>{rows.length}</strong> linhas</span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('mapping')}>Voltar</Button>
              <Button onClick={handleImport}>
                <Upload className="h-4 w-4 mr-2" />
                Importar {rows.length} contatos
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-medium">Importando contatos...</p>
              <div className="w-full max-w-sm">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground text-center mt-2">{progress}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <p className="text-lg font-semibold">Importação concluída!</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-md bg-green-500/10">
                <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                <p className="text-sm text-muted-foreground">Importados</p>
              </div>
              <div className="text-center p-4 rounded-md bg-red-500/10">
                <p className="text-2xl font-bold text-red-600">{importResult.errors.length}</p>
                <p className="text-sm text-muted-foreground">Erros</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <Button variant="outline" className="w-full" onClick={downloadErrors}>
                <Download className="h-4 w-4 mr-2" />
                Baixar CSV de erros
              </Button>
            )}

            <DialogFooter>
              <Button onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
