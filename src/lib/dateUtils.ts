import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Converte uma string de data YYYY-MM-DD para um objeto Date local
 * sem sofrer shift de timezone.
 * 
 * O JavaScript interpreta strings YYYY-MM-DD como UTC, causando
 * problemas em fusos horários negativos (como Brasil UTC-3).
 * 
 * Exemplo do bug:
 * new Date('2026-01-01') em Brasília = 31/12/2025 21:00
 * 
 * Esta função corrige isso criando a data com o construtor de componentes,
 * que é interpretado como horário local.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  const parts = dateStr.split('-').map(Number);
  const year = parts[0];
  const month = parts[1] - 1; // JavaScript months are 0-indexed
  const day = parts[2] || 1;
  
  // Fixar hora ao meio-dia para evitar problemas com DST
  return new Date(year, month, day, 12, 0, 0);
}

/**
 * Formata uma string de mes_referencia (YYYY-MM-DD ou YYYY-MM) 
 * sem sofrer shift de timezone.
 * 
 * @param dateStr - String de data no formato YYYY-MM-DD ou YYYY-MM
 * @param formatStr - Formato de saída (padrão: 'MMM/yyyy')
 * @returns String formatada (ex: 'jan/2026')
 */
export function formatMesReferencia(dateStr: string, formatStr = 'MMM/yyyy'): string {
  if (!dateStr) return '-';
  
  const date = parseLocalDate(dateStr);
  return format(date, formatStr, { locale: ptBR });
}

/**
 * Formata uma data completa (YYYY-MM-DD) para exibição
 * sem sofrer shift de timezone.
 * 
 * @param dateStr - String de data no formato YYYY-MM-DD
 * @param formatStr - Formato de saída (padrão: 'dd/MM/yyyy')
 * @returns String formatada (ex: '01/01/2026')
 */
export function formatLocalDate(dateStr: string, formatStr = 'dd/MM/yyyy'): string {
  if (!dateStr) return '-';
  
  const date = parseLocalDate(dateStr);
  return format(date, formatStr, { locale: ptBR });
}

/**
 * Formata uma data para exibição com dia da semana
 * sem sofrer shift de timezone.
 * 
 * @param dateStr - String de data no formato YYYY-MM-DD
 * @returns String formatada (ex: '01/01/2026 (qua)')
 */
export function formatLocalDateWithWeekday(dateStr: string): string {
  if (!dateStr) return '-';
  
  const date = parseLocalDate(dateStr);
  return format(date, 'dd/MM/yyyy (EEE)', { locale: ptBR });
}
