
# Plano: Cadastro ADVBox Após Assinatura do Contrato

## Resumo das Alterações

O sistema atual cadastra o cliente e processo no ADVBox imediatamente após a **geração** do contrato. A nova lógica irá:

1. **Adiar o cadastro no ADVBox** para quando o contrato for assinado via ZapSign (webhook)
2. **Permitir cadastro manual** quando o contrato for assinado presencialmente (sem ZapSign)
3. **Exibir status de assinatura** nas abas de Contratos e Comercial
4. **Criar tarefa automática para Mariana** após o cadastro no ADVBox

---

## Fase 1: Alterações na Estrutura de Dados

### Tabela `zapsign_documents`
Adicionar campos para vincular ao contrato local e rastrear sincronização:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| fin_contrato_id | uuid | FK para fin_contratos |
| advbox_sync_triggered | boolean | Se já tentou sincronizar |
| advbox_sync_at | timestamp | Data da sincronização |

### Tabela `fin_contratos`
Adicionar campo para status de assinatura:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| zapsign_document_id | uuid | FK para zapsign_documents |
| assinatura_status | text | pending_signature, signed, manual_signature, not_sent |
| assinado_em | timestamp | Data da assinatura |

---

## Fase 2: Modificar Edge Function `contract-automation`

### O Que Muda
- **Antes**: Criava cliente + processo no ADVBox automaticamente
- **Depois**: Apenas registra o contrato no banco com status `pending_signature` (não sincroniza com ADVBox)

A sincronização com ADVBox será disparada apenas:
1. Pelo webhook quando o cliente assinar
2. Manualmente pelo botão de cadastro manual

---

## Fase 3: Modificar Edge Function `zapsign-webhook`

### Novo Fluxo Quando Cliente Assina

Ao receber notificação de assinatura do cliente:

```text
1. Atualizar status do documento → 'signed'
2. Atualizar fin_contratos.assinatura_status → 'signed'
3. Buscar dados do contrato (client, productName, etc)
4. Chamar lógica de sincronização ADVBox:
   - Criar/buscar cliente no ADVBox
   - Criar processo no ADVBox
5. Criar tarefa para Mariana no ADVBox:
   - Título: "Analisar novo caso - [Nome do Cliente]"
   - Descrição: "Cliente assinou contrato. Analisar caso e designar advogado responsável."
   - Prazo: 2 dias úteis
6. Atualizar fin_contratos com IDs do ADVBox
```

---

## Fase 4: Nova Função para Cadastro Manual

### Nova Edge Function: `advbox-manual-registration`

Será invocada quando o usuário clicar no botão de "Cadastrar no ADVBox" para contratos assinados manualmente.

```text
Parâmetros de entrada:
- contrato_id: ID do contrato em fin_contratos

Ações:
1. Buscar dados do contrato
2. Criar cliente no ADVBox (se não existir)
3. Criar processo no ADVBox
4. Criar tarefa para Mariana
5. Atualizar fin_contratos com:
   - advbox_customer_id
   - advbox_lawsuit_id
   - advbox_sync_status = 'synced'
   - assinatura_status = 'manual_signature'
```

---

## Fase 5: Alterações no Frontend

### ContractGenerator.tsx

**Alteração no diálogo de confirmação após gerar contrato:**

Quando o usuário **não enviar para ZapSign** (clica em "Não" ou "Fechar"):
- Mostrar novo diálogo perguntando:

```text
┌─────────────────────────────────────────────────┐
│  Deseja cadastrar o cliente no ADVBox?          │
│                                                 │
│  Como o contrato não foi enviado para           │
│  assinatura digital, você pode cadastrar        │
│  manualmente o cliente e processo no ADVBox.    │
│                                                 │
│  [Cadastrar no ADVBox]    [Mais tarde]          │
└─────────────────────────────────────────────────┘
```

### ZapSignDialog.tsx

Após envio bem-sucedido:
- Atualizar `fin_contratos` com o `zapsign_document_id`
- Mostrar que o cadastro no ADVBox será feito automaticamente após assinatura

### SetorComercial.tsx (Aba Comercial)

Na tabela de clientes, adicionar coluna visual com badges:

| Badge | Significado |
|-------|-------------|
| "Aguardando Assinatura" | Contrato enviado via ZapSign, aguardando |
| "Assinado" (verde) | Contrato assinado digitalmente |
| "Assinatura Manual" | Contrato assinado presencialmente |
| "Sem Contrato" | Nenhum contrato gerado ainda |

Também mostrar se está sincronizado com ADVBox:
| Badge | Significado |
|-------|-------------|
| "ADVBox ✓" (verde) | Cliente e processo cadastrados |
| "ADVBox Pendente" | Aguardando cadastro |

### FinanceiroContratos.tsx (Aba Contratos)

Adicionar colunas:
- **Status Assinatura**: Com os badges acima
- **ADVBox**: Status de sincronização
- **Ação**: Botão "Cadastrar no ADVBox" (visível apenas quando assinatura_status = 'manual_signature' e advbox_sync_status != 'synced')

---

## Fase 6: Criar Tarefa no ADVBox

### Lógica de Criação de Tarefa

Após cadastrar cliente e processo no ADVBox:

```text
POST /posts (endpoint de tarefas do ADVBox)
{
  "title": "Analisar novo caso - {Nome do Cliente}",
  "description": "Cliente {Nome} assinou contrato para {Produto}. 
                  Analisar documentação e designar advogado responsável.",
  "lawsuit_id": {ID do processo criado},
  "assigned_to": {ID da Mariana},
  "due_date": {Data atual + 2 dias úteis},
  "priority": "normal"
}
```

---

## Fluxo Completo

```text
CENÁRIO 1: Assinatura via ZapSign
────────────────────────────────
1. Usuário gera contrato → Salvo em fin_contratos (assinatura_status = 'pending_signature')
2. Usuário envia para ZapSign → Escritório assina automaticamente
3. Cliente recebe link e assina
4. Webhook recebe notificação:
   ├─ Atualiza zapsign_documents.status = 'signed'
   ├─ Atualiza fin_contratos.assinatura_status = 'signed'
   ├─ Cria cliente no ADVBox
   ├─ Cria processo no ADVBox
   ├─ Cria tarefa para Mariana
   └─ Atualiza fin_contratos com IDs do ADVBox

CENÁRIO 2: Assinatura Presencial (Manual)
─────────────────────────────────────────
1. Usuário gera contrato → Salvo em fin_contratos (assinatura_status = 'not_sent')
2. Usuário NÃO envia para ZapSign
3. Sistema pergunta: "Deseja cadastrar no ADVBox?"
   ├─ Se SIM:
   │   ├─ Cria cliente no ADVBox
   │   ├─ Cria processo no ADVBox
   │   ├─ Cria tarefa para Mariana
   │   └─ Atualiza fin_contratos (assinatura_status = 'manual_signature')
   │
   └─ Se NÃO:
       └─ Contrato fica com assinatura_status = 'not_sent'
           (pode cadastrar depois pela aba de Contratos)
```

---

## Arquivos a Serem Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/...` | Adicionar colunas em zapsign_documents e fin_contratos |
| `supabase/functions/contract-automation/index.ts` | Remover sincronização ADVBox automática |
| `supabase/functions/zapsign-webhook/index.ts` | Adicionar lógica de criação ADVBox + tarefa |
| `supabase/functions/advbox-manual-registration/index.ts` | **NOVA** - Cadastro manual |
| `src/components/ContractGenerator.tsx` | Diálogo de cadastro manual + vincular ZapSign |
| `src/components/ZapSignDialog.tsx` | Vincular com fin_contratos |
| `src/pages/SetorComercial.tsx` | Mostrar badges de status |
| `src/components/financeiro/FinanceiroContratos.tsx` | Colunas de status + botão de cadastro manual |

---

## Resultado Esperado

- Contratos enviados via ZapSign: cadastro automático no ADVBox após assinatura
- Contratos assinados presencialmente: opção de cadastrar manualmente
- Visibilidade clara do status de assinatura e sincronização ADVBox
- Tarefa automática para Mariana analisar cada novo caso

