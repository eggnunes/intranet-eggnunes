export type TipoErro = 
  | 'ortografia' 
  | 'concordancia' 
  | 'regencia' 
  | 'pontuacao' 
  | 'crase' 
  | 'acentuacao' 
  | 'coesao' 
  | 'outro';

export interface ErroPortugues {
  trecho: string;
  erro: string;
  tipo: TipoErro;
  sugestao: string;
  localizacao: string;
}

export interface AnaliseResult {
  erros: ErroPortugues[];
  resumo: Record<TipoErro, number>;
  total: number;
}

export const TIPO_ERRO_CONFIG: Record<TipoErro, { label: string; color: string }> = {
  ortografia: { label: 'Ortografia', color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
  concordancia: { label: 'Concordância', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30' },
  regencia: { label: 'Regência', color: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' },
  pontuacao: { label: 'Pontuação', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  crase: { label: 'Crase', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' },
  acentuacao: { label: 'Acentuação', color: 'bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/30' },
  coesao: { label: 'Coesão', color: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30' },
  outro: { label: 'Outro', color: 'bg-muted text-muted-foreground border-border' },
};
