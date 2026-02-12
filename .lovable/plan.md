

## Plano: Corrigir Registro de Promocoes Antigas e Adicionar Edicao

### Problemas Identificados

**1. Cargo anterior auto-preenchido com o cargo ATUAL**

Quando voce seleciona um colaborador, o sistema preenche automaticamente o "Cargo Anterior" com o cargo atual dele (linha 88-89 do `PromocaoDialog.tsx`). Para a Jordania, o cargo atual e Pleno I, entao ao registrar uma promocao antiga de Junior I para Junior II, o sistema mostra "Pleno I" como anterior -- o que esta errado.

**Correcao**: Ao selecionar o colaborador, NAO auto-preencher o cargo anterior. Deixar o campo livre para o usuario escolher. Tambem desmarcar automaticamente o switch "Atualizar cargo atual" quando a data da promocao for anterior a hoje, pois promocoes historicas nao devem alterar o cargo vigente.

**2. Falta opcao de editar promocao**

O dropdown de acoes so tem "Ver Perfil" e "Excluir". Precisa adicionar "Editar".

**Correcao**: Adicionar opcao "Editar" no dropdown e adaptar o `PromocaoDialog` para funcionar em modo edicao, recebendo uma promocao existente e fazendo UPDATE ao inves de INSERT.

---

### Alteracoes Tecnicas

**Arquivo 1: `src/components/rh/PromocaoDialog.tsx`**

1. Adicionar prop opcional `promocaoParaEditar` com os dados da promocao existente (id, colaborador_id, cargo_anterior_id, cargo_novo_id, data_promocao, observacoes)
2. Remover o auto-preenchimento do cargo anterior no `handleColaboradorChange` -- o campo fica livre
3. No `useEffect`, se `promocaoParaEditar` existir, preencher todos os campos com os dados da promocao
4. No `handleSubmit`:
   - Se `promocaoParaEditar` existir, fazer UPDATE ao inves de INSERT
   - Manter a logica do switch "Atualizar cargo atual" (usuario decide)
5. Quando a data da promocao for anterior a hoje, desmarcar automaticamente o switch "Atualizar cargo atual" (com dica visual de que e uma promocao historica)
6. Atualizar o titulo do dialog para "Editar Promocao" quando em modo edicao

**Arquivo 2: `src/components/rh/RHPromocoes.tsx`**

1. Adicionar estado `promocaoParaEditar` 
2. Adicionar opcao "Editar" no DropdownMenu (entre "Ver Perfil" e "Excluir"), com icone de lapis (`Pencil`)
3. Ao clicar em Editar, setar `promocaoParaEditar` e abrir o dialog
4. Passar `promocaoParaEditar` como prop para o `PromocaoDialog`
5. Buscar tambem `cargo_anterior_id` e `cargo_novo_id` na query de promocoes (necessarios para preencher o formulario de edicao)

---

### Resultado Esperado

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Cargo anterior ao criar | Auto-preenchido com cargo atual | Campo livre para escolher |
| Promocao historica | Atualiza cargo atual erroneamente | Switch desmarcado automaticamente para datas passadas |
| Editar promocao | Nao existe | Opcao no dropdown com formulario pre-preenchido |
| Registro da Jordania | Junior I para Junior II mostra "Pleno I -> Junior II" | Mostra corretamente "Junior I -> Junior II" |

