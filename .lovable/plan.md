

## Corrigir nomes "Sem contato" no Ranking e Comissões

### Causa raiz
A tabela `crm_contacts` tem **1.896 registros**, mas o Supabase retorna no máximo **1.000 linhas** por consulta padrão. Isso significa que metade dos contatos não entra no `contactMap`, e quando o `contact_id` do deal aponta para um contato que ficou de fora, o lookup retorna `undefined`.

Embora o fallback `|| d.name` esteja no código, o problema é que contatos importantes ficam fora do mapa. E para deals onde `deal.name` também possa ser inconsistente, o resultado é "Sem contato".

### Solução
Em ambos os arquivos, **buscar apenas os contatos necessários** (os que estão referenciados nos deals do período) em vez de buscar todos os 1.896. Isso elimina o limite de 1.000 e garante que todos os contatos relevantes estejam no mapa.

**Alternativa mais simples**: Não depender da tabela `crm_contacts` para o nome do cliente. Usar `deal.name` como fonte principal (que sempre contém o nome do cliente vindo do RD Station) e o contato como fallback.

### Alterações

**Arquivo 1:** `src/components/crm/CRMRanking.tsx`
- Inverter a prioridade: usar `deal.name` como nome principal do cliente
- Manter contato como fallback secundário
- Linha 165: `contactName: d.name || (d.contact_id ? contactMap.get(d.contact_id) : null) || null`

**Arquivo 2:** `src/components/crm/CRMCommissions.tsx`
- Mesma correção na linha 134
- `contactName: deal.name || (deal.contact_id ? contactMap.get(deal.contact_id) : null) || null`

### Por que inverter a prioridade
- `deal.name` está **sempre presente** (vem direto do RD Station com o nome do cliente)
- `crm_contacts` tem o limite de 1.000 linhas e muitos deals não têm `contact_id` vinculado
- O nome no deal é a mesma informação do contato na grande maioria dos casos

### Resultado
Todos os contratos expandidos mostrarão o nome do cliente corretamente, tanto no Ranking quanto nas Comissões, sem depender do limite de linhas da tabela de contatos.

