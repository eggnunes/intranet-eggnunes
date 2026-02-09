import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { SpellCheck } from 'lucide-react';
import { CorretorUpload } from '@/components/corretor/CorretorUpload';
import { CorretorReport } from '@/components/corretor/CorretorReport';
import { type AnaliseResult, type TipoErro, TIPO_ERRO_CONFIG } from '@/components/corretor/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function CorretorPortugues() {
  const [result, setResult] = useState<AnaliseResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleAnalyze = async (fileBase64: string, fileName: string) => {
    setIsAnalyzing(true);
    setProgress(10);
    setResult(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 85) { clearInterval(progressInterval); return prev; }
          return prev + Math.random() * 8;
        });
      }, 1500);

      const { data, error } = await supabase.functions.invoke('check-portuguese', {
        body: { file_base64: fileBase64, file_name: fileName },
      });

      clearInterval(progressInterval);

      if (error) {
        if (error.message?.includes('429')) {
          toast.error('Limite de requisições atingido. Tente novamente em alguns minutos.');
        } else if (error.message?.includes('402')) {
          toast.error('Créditos insuficientes. Entre em contato com o administrador.');
        } else {
          toast.error('Erro ao analisar o documento. Tente novamente.');
        }
        console.error('Check portuguese error:', error);
        return;
      }

      // Handle edge function error responses
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const erros = data?.erros || [];
      const resumo: Record<TipoErro, number> = {} as Record<TipoErro, number>;
      for (const tipo of Object.keys(TIPO_ERRO_CONFIG) as TipoErro[]) {
        resumo[tipo] = erros.filter((e: any) => e.tipo === tipo).length;
      }

      setResult({ erros, resumo, total: erros.length });
      setProgress(100);

      if (erros.length === 0) {
        toast.success('Nenhum erro de português encontrado!');
      } else {
        toast.info(`${erros.length} erro(s) encontrado(s).`);
      }
    } catch (err) {
      console.error('Analyze error:', err);
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <SpellCheck className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">Corretor de Português</h1>
          </div>
          <p className="text-muted-foreground">
            Faça upload de um documento PDF ou DOCX para análise gramatical. O sistema identifica erros de ortografia, concordância, regência, pontuação, crase, acentuação e coesão textual.
          </p>
        </div>

        <CorretorUpload
          onAnalyze={handleAnalyze}
          isAnalyzing={isAnalyzing}
          progress={progress}
        />

        {result && <CorretorReport result={result} />}
      </div>
    </Layout>
  );
}
