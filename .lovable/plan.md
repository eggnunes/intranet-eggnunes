
# Plano: Implementação das Rubricas para Assistente Comercial

## Resumo

Vou adicionar as rubricas específicas que aparecem no contracheque do Assistente Comercial e ajustar a lógica do sistema de pagamentos para exibir corretamente essas rubricas apenas para este cargo.

---

## Análise Comparativa

### Rubricas do Contracheque (imagem):

| Código | Descrição | Tipo | Status |
|--------|-----------|------|--------|
| 001 | Salário Base | Vantagem | ✅ Existe (Honorários Mensais) |
| 400 | Comissão | Vantagem | ✅ Existe |
| 423 | Repouso Remunerado | Vantagem | ❌ Criar |
| 144 | Prêmio Comissão | Vantagem | ❌ Criar |
| 439 | DSR s/prêmio | Vantagem | ❌ Criar |
| 604 | Vale Transporte | Desconto | ✅ Existe |
| 903 | INSS Folha | Desconto | ✅ Existe |

### Ação Necessária

Criar **3 novas rubricas** no banco de dados para completar o contracheque do Assistente Comercial.

---

## Etapas de Implementação

### Etapa 1: Criar Novas Rubricas no Banco de Dados

Adicionar via migration SQL as seguintes rubricas específicas para o comercial:

```text
1. Repouso Remunerado (vantagem, ordem 16)
   - Descrição: DSR sobre comissões para assistentes comerciais

2. Prêmio Comissão (vantagem, ordem 17)
   - Descrição: Premiação adicional sobre comissões

3. DSR s/prêmio (vantagem, ordem 18)
   - Descrição: Descanso semanal remunerado sobre prêmio
```

### Etapa 2: Atualizar Lógica de Exibição de Rubricas

Modificar o componente `RHPagamentos.tsx` para:

1. **Identificar o cargo "Assistente Comercial"** pelo ID ou nome
2. **Filtrar rubricas específicas** quando o colaborador selecionado for do cargo comercial:
   - Mostrar apenas as rubricas relevantes para o contracheque comercial
   - Manter compatibilidade com outros cargos CLT

### Etapa 3: Adicionar Constantes de IDs

Adicionar no `RHPagamentos.tsx`:
- IDs das novas rubricas
- Lista de rubricas permitidas para Assistente Comercial

---

## Detalhes Técnicos

### Migration SQL

```sql
INSERT INTO rh_rubricas (nome, tipo, ordem, descricao, is_active)
VALUES 
  ('Repouso Remunerado', 'vantagem', 16, 'DSR sobre comissões para assistentes comerciais', true),
  ('Prêmio Comissão', 'vantagem', 17, 'Premiação adicional sobre comissões', true),
  ('DSR s/prêmio', 'vantagem', 18, 'Descanso semanal remunerado sobre prêmio', true);
```

### Lógica de Filtro (pseudocódigo)

```text
SE cargo.nome = "Assistente Comercial" ENTÃO
  vantagens = [
    Honorários Mensais (como "Salário Base"),
    Comissão,
    Repouso Remunerado,
    Prêmio Comissão,
    DSR s/prêmio
  ]
  descontos = [
    Vale Transporte,
    INSS,
    Adiantamento,
    IRPF
  ]
SENÃO SE cargo.tipo = "clt" ENTÃO
  // Lógica atual para CLT
SENÃO
  // Lógica atual para advogados/sócios
```

---

## Arquivos a Modificar

1. **Nova Migration SQL**: Inserir as 3 novas rubricas
2. **src/components/rh/RHPagamentos.tsx**: 
   - Adicionar constantes com IDs das novas rubricas
   - Criar lista `COMERCIAL_VANTAGENS` com IDs específicos
   - Modificar `getVantagensFiltradas()` para filtrar por cargo comercial
   - Ajustar `getRubricaLabel()` para renomear "Honorários Mensais" → "Salário Base" para comercial

---

## Resultado Esperado

Ao registrar pagamento para um Assistente Comercial, o formulário exibirá exatamente as mesmas rubricas do contracheque:

**Vantagens:**
- Salário Base (R$ 1.971,36)
- Comissão
- Repouso Remunerado
- Prêmio Comissão
- DSR s/prêmio

**Descontos:**
- Vale Transporte
- INSS Folha
- Adiantamento (se houver)
- IRPF (se aplicável)
