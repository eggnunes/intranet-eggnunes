// Máscaras para formatação de campos

/**
 * Aplica máscara de telefone brasileiro
 * Formato: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 */
export function maskPhone(value: string): string {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 2) {
    return numbers.length ? `(${numbers}` : '';
  }
  
  if (numbers.length <= 6) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  }
  
  if (numbers.length <= 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  
  // Celular com 9 dígitos
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
}

/**
 * Aplica máscara de CPF
 * Formato: XXX.XXX.XXX-XX
 */
export function maskCPF(value: string): string {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 3) {
    return numbers;
  }
  
  if (numbers.length <= 6) {
    return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  }
  
  if (numbers.length <= 9) {
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  }
  
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
}

/**
 * Aplica máscara de CEP
 * Formato: XXXXX-XXX
 */
export function maskCEP(value: string): string {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 5) {
    return numbers;
  }
  
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
}

/**
 * Remove máscara e retorna apenas números
 */
export function unmask(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formata número para moeda brasileira (R$ 1.234,56)
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Aplica máscara de valor monetário brasileiro
 * Aceita entrada com vírgula como separador decimal
 * Retorna string formatada: 1.234,56
 */
export function maskCurrency(value: string): string {
  // Remove tudo exceto números, vírgula e ponto
  let cleaned = value.replace(/[^\d,.-]/g, '');
  
  // Se começar com vírgula ou ponto, adiciona 0 na frente
  if (cleaned.startsWith(',') || cleaned.startsWith('.')) {
    cleaned = '0' + cleaned;
  }
  
  // Substitui ponto por vírgula para padronizar entrada
  // Mas mantém apenas a última vírgula/ponto como decimal
  const parts = cleaned.split(/[,.]/).filter(p => p !== '');
  
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  
  // Última parte são os decimais, resto é a parte inteira
  const decimals = parts.pop() || '';
  const integers = parts.join('');
  
  // Formata a parte inteira com separador de milhares (ponto)
  const formattedIntegers = integers.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Limita decimais a 2 dígitos
  const formattedDecimals = decimals.slice(0, 2);
  
  return formattedDecimals ? `${formattedIntegers},${formattedDecimals}` : formattedIntegers;
}

/**
 * Converte string em formato brasileiro (1.234,56) para número
 */
export function parseCurrency(value: string): number {
  if (!value || value === '') return 0;
  
  // Remove pontos de milhar e substitui vírgula decimal por ponto
  const cleaned = value
    .replace(/\./g, '') // Remove pontos (separador de milhar)
    .replace(',', '.'); // Substitui vírgula por ponto (decimal)
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Valida CPF (algoritmo oficial)
 */
export function validateCPF(cpf: string): boolean {
  const numbers = cpf.replace(/\D/g, '');
  
  if (numbers.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(numbers)) return false;
  
  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers[9])) return false;
  
  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers[10])) return false;
  
  return true;
}

/**
 * Busca endereço por CEP usando ViaCEP
 */
export interface ViaCEPResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export async function fetchAddressByCEP(cep: string): Promise<ViaCEPResponse | null> {
  const cleanCep = cep.replace(/\D/g, '');
  
  if (cleanCep.length !== 8) {
    return null;
  }
  
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const data: ViaCEPResponse = await response.json();
    
    if (data.erro) {
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Erro ao buscar CEP:', error);
    return null;
  }
}
