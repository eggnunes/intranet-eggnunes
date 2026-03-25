

## Adicionar cadastro manual de lead na aba Contatos do CRM

### O que será feito
Adicionar um botão "Novo Lead" na barra de ações da aba Contatos, abrindo um dialog para cadastrar um contato manualmente. O contato será salvo no banco local e sincronizado com o RD Station via API.

### Implementação

**1. Nova ação `create_contact` na edge function `crm-sync/index.ts`**

Adicionar handler que:
- Recebe dados do contato (nome, email, telefone, empresa, cargo, etc.)
- Cria o contato na API do RD Station (`POST /contacts`) com os campos mapeados
- Faz upsert na tabela `crm_contacts` com o `rd_station_id` retornado
- Retorna o contato criado

Campos enviados ao RD Station:
```text
name, emails[{email}], phones[{phone}], 
organization (empresa), title (cargo),
facebook, linkedin, twitter, website
```

**2. Componente `CRMContactsList.tsx` — Botão + Dialog de criação**

- Novo botão "Novo Lead" (ícone UserPlus) ao lado do botão "Importar CSV"
- Dialog com formulário contendo: Nome (obrigatório), Email, Telefone, Empresa, Cargo, Cidade, Estado, Website, LinkedIn, Observações
- Ao submeter:
  - Se sync habilitado: chama `crm-sync` com `action: 'create_contact'`
  - Se sync desabilitado: insere direto na tabela `crm_contacts`
  - Atualiza a lista de contatos
  - Toast de sucesso/erro

**3. Arquivos modificados**
- `supabase/functions/crm-sync/index.ts` — nova ação `create_contact`
- `src/components/crm/CRMContactsList.tsx` — botão + dialog de cadastro

