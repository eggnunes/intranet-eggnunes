

# Correção de 2 erros: Upload de documento e Carregamento de transações

## Problema 1: "Erro ao enviar documento: Invalid key"

O nome do arquivo contém caracteres especiais (ç, ã, espaços): `rescisão e comprovante de pagamento rescisão Tatiane.pdf`. O Supabase Storage rejeita chaves com esses caracteres.

**Correção**: Sanitizar o nome do arquivo antes do upload no componente `ColaboradorDocumentos.tsx`, removendo acentos e substituindo espaços por underscores, mantendo o nome original visível para o usuário no banco de dados.

## Problema 2: "Erro ao carregar transações financeiras"

A Letícia tem permissão financeira via a tabela `position_permission_defaults` (cargo "administrativo" tem `perm_financial = edit`). O frontend reconhece isso e permite acesso à página. Porém, a Edge Function `advbox-integration` valida permissão chamando a função SQL `get_admin_permission`, que **não consulta** a tabela `position_permission_defaults` — só consulta `admin_permissions`. Como a Letícia não está na `admin_permissions`, o backend retorna 403.

**Correção**: Atualizar a função SQL `get_admin_permission` para incluir o fallback para `position_permission_defaults`, alinhando o comportamento do backend com o frontend.

## Arquivos alterados

1. **`src/components/rh/ColaboradorDocumentos.tsx`** — sanitizar nome do arquivo no upload
2. **`src/components/rh/RHDocumentos.tsx`** — mesma sanitização (componente alternativo de upload)
3. **Migração SQL** — atualizar função `get_admin_permission` para consultar `position_permission_defaults`

## Detalhe técnico

### Sanitização de arquivo
```
"rescisão e comprovante.pdf" → "rescisao_e_comprovante.pdf"
```
O nome original fica salvo na coluna `nome` da tabela `rh_documentos`.

### Função SQL corrigida
Após verificar `admin_permissions` sem resultado, a função consultará `position_permission_defaults` usando o cargo do usuário antes de retornar 'none'.

