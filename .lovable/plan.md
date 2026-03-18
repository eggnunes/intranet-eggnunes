

# Análise e Implementação de Funcionalidades Faltantes

## O que ja existe

- **PROMPT 2.3 (Automação de Marketing)**: Ja implementado em `MarketingAutomation.tsx` com regras (gatilho + ação), toggle ativo/inativo, log de execuções e listas dinâmicas. Nao precisa reimplementar.
- **PROMPT 2.2 (Segmentação)**: Parcialmente existe nas "Listas Dinâmicas" do `MarketingAutomation.tsx`, com filtros por estado, cidade, período e score.

## O que falta

### 1. Importação em Lote de Contatos (PROMPT 2.1) — NOVO

Criar componente `CRMContactsImport.tsx` e integrar ao `CRMContactsList.tsx` com botão "Importar".

**Funcionalidades:**
- Upload de CSV (XLSX via parsing nativo não é viável sem lib; focaremos em CSV que cobre 95% dos casos)
- Preview dos dados em tabela antes de importar
- Mapeamento de colunas: usuario arrasta/seleciona qual coluna do CSV corresponde a qual campo (name, email, phone, company, city, state, etc.)
- Validação: email regex, telefone formato, campos obrigatórios (nome), detecção de duplicatas por email
- Barra de progresso durante importação em batch (inserts de 50 em 50)
- Relatório final: total importados, total erros, download CSV dos erros
- Opção "Ignorar erros e continuar"

### 2. Melhorar Segmentação de Leads (PROMPT 2.2) — APRIMORAR

Adicionar ao `MarketingAutomation.tsx` (aba "Listas Dinâmicas"):
- Segmentos pré-definidos: Leads quentes, mornos, frios, não contatados, convertidos
- Cards com contagem por segmento no topo da aba
- Botão "Exportar" segmento como CSV

Não implementaremos lógica AND/OR complexa nem envio em massa de email/WhatsApp pois isso exigiria infraestrutura de email marketing e aquecimento de número que já foi definido como restrito.

## Arquivos

1. **`src/components/crm/CRMContactsImport.tsx`** (novo) — Dialog completo de importação CSV
2. **`src/components/crm/CRMContactsList.tsx`** — adicionar botão "Importar" que abre o dialog
3. **`src/components/crm/MarketingAutomation.tsx`** — adicionar segmentos pré-definidos com contagens na aba de Listas Dinâmicas

## Sem mudanças no banco de dados
Todas as funcionalidades usam a tabela `crm_contacts` existente.

