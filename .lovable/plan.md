

## Adicionar ProjefWeb (Sistema de Cálculos do TRF4)

### Alterações

#### 1. Inserir link na tabela `tribunal_links`
**Migration SQL:**
```sql
INSERT INTO public.tribunal_links (nome, url, tribunal, sistema, categoria, ordem)
VALUES ('ProjefWeb - Sistema de Cálculos', 'https://www.jfrs.jus.br/projefweb/', 'TRF4', 'ProjefWeb', 'federal', 50);
```
Isso fará o card aparecer automaticamente na página Portais de Tribunais.

#### 2. Adicionar card nos Links Úteis do Dashboard
**Arquivo:** `src/pages/Dashboard.tsx`

Adicionar ao array `toolLinks` (linha ~284):
```typescript
{ icon: Calculator, url: 'https://www.jfrs.jus.br/projefweb/', label: 'ProjefWeb', description: 'Sistema de Cálculos TRF4' },
```
Importar `Calculator` do lucide-react.

### Resultado
- Card do ProjefWeb aparece nos Links Úteis do dashboard
- Card do ProjefWeb aparece na página de Portais de Tribunais (categoria Federal)

