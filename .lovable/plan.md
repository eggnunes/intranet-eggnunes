
### Diagnóstico confirmado com base no código + banco + anexo

O comportamento atual está coerente com a sua reclamação:

1. A aba **“Contratos”** da Nova Cobrança (`AsaasNovaCobranca.tsx`) busca **somente** da tabela `fin_contratos`.
2. O painel “Clientes do Formulário” (onde aparece “Ruan”) vem de **Google Sheets** via `google-sheets-integration` (`src/pages/SetorComercial.tsx`) — ou seja, é uma fonte diferente.
3. Resultado: se o cliente ainda não virou registro em `fin_contratos`, ele **não aparece** na Nova Cobrança, mesmo existindo no formulário.
4. Isso explica exatamente o caso do Ruan: ele está na aba de formulários, mas não está sendo considerado na busca da cobrança.

---

### Objetivo da correção

Fazer a aba “Contratos” da Nova Cobrança reconhecer também os clientes da aba de formulários (Google Sheets), mantendo:
- listagem recente no topo;
- busca por nome/CPF/email/telefone;
- desempenho bom;
- clareza visual da origem (Contrato vs Formulário).

---

### Implementação proposta (frontend, sem migração de banco)

**Arquivo principal:** `src/components/financeiro/asaas/AsaasNovaCobranca.tsx`

#### 1) Expandir a fonte “contrato” para “contratos + formulários”
- Criar estado para clientes de formulário (ex.: `formCustomers`) e loading dedicado.
- Criar função `loadFormCustomers()` chamando `supabase.functions.invoke('google-sheets-integration')`.
- Mapear campos do retorno:
  - `nomeCompleto` -> nome
  - `cpf` -> cpfCnpj
  - `email` -> email
  - `telefone` -> phone
  - `timestamp` -> data de ordenação
- Não remover `loadContractCustomers()`; vamos **combinar** as duas origens.

#### 2) Unificar e normalizar busca no bloco `customerSource === 'contrato'`
- Em vez de filtrar só `contractCustomers`, criar um array unificado:
  - contratos (`fin_contratos`)
  - formulários (Google Sheets)
- Aplicar a mesma normalização robusta já usada (acentos + dígitos):
  - nome sem acento (`normalize`)
  - CPF/telefone apenas números (`replace(/\D/g, '')`)
  - incluir email na busca
- Cobrir casos:
  - digitar “Ruan” encontra `Ruan de Oliveira Coelho`
  - digitar CPF com/sem máscara encontra igual
  - digitar pedaço do email/telefone também encontra

#### 3) Ordenação correta por recência
- Unificar com campo de data:
  - contratos: `created_at`
  - formulários: `timestamp` convertido de `dd/MM/yyyy HH:mm:ss`
- Ordenar descendente (mais recente primeiro), antes do `slice`.

#### 4) Deduplicação para evitar cliente repetido
- Deduplicar por prioridade:
  1. CPF numérico (quando existir)
  2. fallback nome normalizado + telefone/email
- Regra de prioridade:
  - manter registro de **contrato** quando houver duplicidade com formulário (porque traz `product_name` e status já formalizado).

#### 5) UX na lista de resultados
- Exibir badge de origem:
  - `Contrato`
  - `Formulário`
- Para contrato, manter exibição de `productName`.
- Para formulário, opcionalmente exibir subtítulo curto “Lead de formulário”.

#### 6) Segurança funcional na criação de cobrança
- Fluxo atual exige CPF/CNPJ para sincronizar no Asaas; manter isso.
- Se cliente de formulário vier sem CPF, mostrar mensagem clara já no passo 1 (antes de avançar), para evitar fricção no fim do fluxo.

---

### Ajustes de performance e confiabilidade

1. **Carregamento sob demanda**
   - Buscar Google Sheets apenas quando:
     - modal abrir **e** aba “Contratos” for usada, ou
     - usuário trocar para a aba “Contratos”.
   - Evita chamadas desnecessárias para quem usa só Asaas/ADVBox.

2. **Cache em memória durante o modal aberto**
   - Não chamar Google Sheets a cada tecla.
   - Carrega uma vez e filtra localmente.

3. **Botão de atualizar nessa fonte**
   - Adicionar botão “Atualizar formulários” na aba “Contratos” (similar ao ADVBox), para forçar refresh imediato quando acabou de chegar lead novo.

---

### Critérios de aceite (o que deve funcionar após aprovação)

1. Abrindo Nova Cobrança > aba Contratos:
   - o “último formulário preenchido” aparece no topo (se dados válidos).
2. Ao digitar “Ruan”, o cliente do formulário é encontrado.
3. Busca por CPF sem máscara também encontra.
4. Quando cliente existir em contrato e formulário, não aparece duplicado.
5. Selecionando cliente de formulário com CPF válido, o fluxo segue e cria cobrança normalmente.

---

### Riscos e mitigação

- **Risco:** falha temporária da função de Google Sheets.
  - **Mitigação:** fallback para mostrar contratos normalmente + toast de erro específico para formulários.
- **Risco:** timestamps em formato inconsistente.
  - **Mitigação:** parser defensivo com fallback de data mínima; não quebrar ordenação.
- **Risco:** volume crescer.
  - **Mitigação futura:** criar endpoint de busca paginada no backend (se necessário); por agora o volume atual (~1k) é seguro para filtro local.

---

### Arquivos previstos para alteração

1. `src/components/financeiro/asaas/AsaasNovaCobranca.tsx`
   - novos estados para formulário
   - `loadFormCustomers()`
   - unificação + deduplicação + ordenação no `getFilteredCustomers()` da fonte contrato
   - ajustes de UI (badge/formulário + botão atualizar)

Sem necessidade de migração de banco nesta etapa.
