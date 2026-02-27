

## Melhorar sistema de templates de poderes especiais

### Problema
1. Apenas admins podem salvar templates de poderes especiais
2. Não existe busca/filtro nos templates disponíveis

### Solução

**Arquivo:** `src/components/ProcuracaoGenerator.tsx`

1. **Permitir que qualquer usuário salve templates:**
   - Remover a restrição `isAdmin` do formulário de criação (linha 903)
   - Quando não-admin salva, `is_default` fica `false`; quando admin salva, `is_default` fica `true`
   - Mostrar botão "Salvar como Template" para todos os usuários (já existe na linha 856-864)

2. **Adicionar campo de busca nos templates:**
   - Novo estado `templateSearch` para filtrar templates por nome
   - Adicionar `<Input>` de busca acima da lista de badges quando há mais de 3 templates
   - Filtrar a lista `templates` pelo texto digitado (case-insensitive)

3. **Ajustes na UI:**
   - Mudar texto do botão de "Salvar como Template Geral" para "Salvar como Template" para não-admins
   - Admins veem opção de marcar como "padrão" (visível para todos)
   - Mostrar botão "+ Novo Template Padrão" para admins e "+ Salvar Template" para não-admins

### Alterações
- Apenas `src/components/ProcuracaoGenerator.tsx` (sem migração necessária, tabela já existe)

