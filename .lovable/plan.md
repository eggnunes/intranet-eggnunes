

## Tradução de Andamentos Processuais do ADVBox

### O que será feito
Nova página "Tradução de Andamentos" no menu de Produção Jurídica. Busca todos os andamentos do ADVBox, exibe apenas os títulos únicos (sem duplicatas), permite digitar ou editar uma tradução humanizada para cada um, e oferece botões para sugerir tradução com IA (Anthropic Claude) — individual ou em lote.

### Alterações

#### 1. Migration SQL — tabela `movement_translations`
```sql
CREATE TABLE public.movement_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_title TEXT NOT NULL UNIQUE,
  translated_text TEXT,
  suggested_by_ai BOOLEAN DEFAULT false,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE movement_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view" ON movement_translations
  FOR SELECT TO authenticated USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can insert" ON movement_translations
  FOR INSERT TO authenticated WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update" ON movement_translations
  FOR UPDATE TO authenticated USING (is_approved(auth.uid()));
```

#### 2. Edge function `translate-movement/index.ts`
- Recebe `{ title: string }` ou `{ titles: string[] }` (lote)
- Usa Anthropic Claude (ANTHROPIC_API_KEY já configurado)
- Prompt: "Traduza este andamento processual jurídico para linguagem simples e humanizada, sem termos técnicos, para que um cliente leigo entenda o que aconteceu no processo"
- Retorna `{ translations: { original: string, translated: string }[] }`

#### 3. Nova página `src/pages/TraducaoAndamentos.tsx`
- Busca movimentações do cache local (mesmo padrão do `MovimentacoesAdvbox`)
- Extrai títulos únicos com `new Set(movements.map(m => m.title))`
- Busca traduções existentes da tabela `movement_translations`
- Exibe tabela com: Andamento Original | Tradução | Ações
- Campo de texto editável na coluna "Tradução"
- Botão "Sugerir com IA" por linha (chama edge function para 1 título)
- Botão global "Sugerir todas com IA" (envia apenas os sem tradução)
- Salva/atualiza no banco ao editar (upsert por `original_title`)
- Busca com filtro por texto
- Indicador visual de quais já têm tradução vs pendentes

#### 4. Rota no `App.tsx`
- Adicionar rota `/traducao-andamentos` com `TraducaoAndamentos`

#### 5. Menu lateral (`src/lib/menuData.ts`)
- Adicionar no grupo `producao-juridica` após "Movimentações Advbox":
```typescript
{ icon: Languages, path: '/traducao-andamentos', label: 'Tradução de Andamentos', searchDescription: 'Traduzir andamentos para linguagem simples' }
```

### Arquivos modificados/criados
- Migration SQL — nova tabela `movement_translations`
- `supabase/functions/translate-movement/index.ts` — edge function com Anthropic
- `src/pages/TraducaoAndamentos.tsx` — nova página
- `src/App.tsx` — rota
- `src/lib/menuData.ts` — item de menu

### Resultado
- Página lista todos os andamentos únicos do ADVBox
- Cada um pode receber tradução manual ou sugerida por IA (Anthropic Claude)
- Traduções ficam salvas no banco para uso futuro na comunicação com clientes

