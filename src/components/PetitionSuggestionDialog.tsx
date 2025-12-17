import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Sparkles, FileText, Copy, Check } from 'lucide-react';

interface PetitionSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processType: string;
  processGroup: string;
  processNumber?: string;
  clientName?: string;
}

export function PetitionSuggestionDialog({
  open,
  onOpenChange,
  processType,
  processGroup,
  processNumber,
  clientName,
}: PetitionSuggestionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerateSuggestion = async () => {
    setLoading(true);
    setSuggestion(null);

    try {
      const { data, error } = await supabase.functions.invoke('suggest-petition', {
        body: {
          processType,
          processGroup,
          processNumber,
          clientName,
          description: additionalContext || undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setSuggestion(data.suggestion);
    } catch (error: any) {
      console.error('Error generating suggestion:', error);
      toast.error(error.message || 'Erro ao gerar sugestão de petição');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (suggestion) {
      navigator.clipboard.writeText(suggestion);
      setCopied(true);
      toast.success('Sugestão copiada!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setSuggestion(null);
    setAdditionalContext('');
    onOpenChange(false);
  };

  // Format markdown-like text to JSX
  const formatSuggestion = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      // Headers
      if (line.startsWith('### ')) {
        return <h4 key={index} className="font-semibold text-base mt-4 mb-2">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={index} className="font-bold text-lg mt-5 mb-2">{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={index} className="font-bold text-xl mt-6 mb-3">{line.replace('# ', '')}</h2>;
      }
      // Bold text
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={index} className="font-semibold my-2">{line.replace(/\*\*/g, '')}</p>;
      }
      // List items
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={index} className="ml-4 my-1">{line.replace(/^[-*]\s/, '')}</li>;
      }
      // Numbered items
      if (/^\d+\.\s/.test(line)) {
        return <li key={index} className="ml-4 my-1">{line}</li>;
      }
      // Empty lines
      if (line.trim() === '') {
        return <br key={index} />;
      }
      // Regular text
      return <p key={index} className="my-1">{line}</p>;
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Sugestão de Petição por IA
          </DialogTitle>
          <DialogDescription>
            A IA irá sugerir tipos de petições adequados para este processo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Process Info */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <Badge variant="outline" className="ml-2">{processType}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Área:</span>
                  <Badge variant="secondary" className="ml-2">{processGroup}</Badge>
                </div>
                {processNumber && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Processo:</span>
                    <span className="ml-2 font-mono text-xs">{processNumber}</span>
                  </div>
                )}
                {clientName && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Cliente:</span>
                    <span className="ml-2">{clientName}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Additional Context */}
          {!suggestion && (
            <div className="space-y-2">
              <Label>Contexto adicional (opcional)</Label>
              <Textarea
                placeholder="Descreva detalhes adicionais do caso que possam ajudar na sugestão..."
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Suggestion Result */}
          {suggestion && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Sugestões de Petição</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8"
                >
                  {copied ? (
                    <Check className="h-4 w-4 mr-1 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  {copied ? 'Copiado!' : 'Copiar'}
                </Button>
              </div>
              <ScrollArea className="h-[400px] border rounded-lg p-4 bg-muted/30">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {formatSuggestion(suggestion)}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
          {!suggestion ? (
            <Button onClick={handleGenerateSuggestion} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando sugestão...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Sugestão
                </>
              )}
            </Button>
          ) : (
            <Button onClick={() => setSuggestion(null)} variant="secondary">
              <FileText className="h-4 w-4 mr-2" />
              Nova Consulta
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
