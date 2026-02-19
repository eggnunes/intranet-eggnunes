

## Plano: Publicacoes DJE - Consulta via API do CNJ

### Contexto

A API de Comunicacoes Processuais do CNJ (comunicaapi.pje.jus.br/api/v1) permite consultar publicacoes do Diario da Justica Eletronica. Para acessar, e necessario:

1. Solicitar credenciais junto ao CNJ (usuario e senha do SSO)
2. A documentacao oficial esta em: https://app.swaggerhub.com/apis-docs/cnj/pcp/1.0.0
3. Dois ambientes disponiveis:
   - Homologacao: https://hcomunicaapi.cnj.jus.br/api/v1
   - Producao: https://comunicaapi.pje.jus.br/api/v1

### Como obter as credenciais

Voce precisa solicitar acesso ao sistema de Comunicacoes Processuais do CNJ. O processo e:
1. Acessar o portal https://comunica.pje.jus.br
2. Entrar com certificado digital ou credenciais do PJe
3. Solicitar acesso a API para seu escritorio (CNPJ)
4. O CNJ fornecera usuario e senha para autenticacao via SSO

Os endpoints principais disponiveis sao:
- GET /api/v1/comunicacoes - listar comunicacoes/publicacoes
- GET /api/v1/tribunais/{jtr}/comunicacoes - publicacoes por tribunal
- Filtros por numero de processo, data, tribunal, tipo de comunicacao

---

### O que sera implementado

#### 1. Novo item no menu lateral: "Publicacoes DJE"

Localizado dentro do grupo "Gestao Processual" (ao lado de Decisoes Favoraveis, Codigos TOTP e Portais de Tribunais), com o label "Publicacoes DJE".

#### 2. Nova pagina: PublicacoesDJE

Interface dedicada com:
- **Filtros de busca**: por numero de processo (formato CNJ), periodo (data inicio/fim), tribunal (dropdown com tribunais brasileiros), tipo de comunicacao (citacao, intimacao, notificacao)
- **Tabela de resultados**: data da publicacao, numero do processo, tribunal, tipo de comunicacao, destinatario, conteudo resumido, status (lida/nao lida)
- **Detalhes expandiveis**: ao clicar em uma publicacao, exibir o conteudo completo em um dialog
- **Exportacao**: botoes para exportar resultados em CSV e PDF
- **Status de conexao**: indicador visual mostrando se as credenciais da API estao configuradas

#### 3. Edge Function: pje-publicacoes

Backend function que:
- Recebe os filtros do frontend (processo, periodo, tribunal)
- Autentica na API do CNJ via SSO (usando secrets PJE_CNJ_USERNAME e PJE_CNJ_PASSWORD)
- Consulta o endpoint de comunicacoes
- Retorna os dados formatados para o frontend
- Implementa cache local para evitar chamadas repetidas

#### 4. Tabela no banco: publicacoes_dje

Para armazenar publicacoes consultadas e manter historico:
- id, numero_processo, tribunal, tipo_comunicacao, data_publicacao, conteudo, destinatario
- Campos de controle: lida (boolean), lida_por, lida_em
- Indices para busca rapida por processo e data

#### 5. Seguranca

- Credenciais armazenadas como secrets (PJE_CNJ_USERNAME, PJE_CNJ_PASSWORD)
- RLS habilitado na tabela de publicacoes (usuarios aprovados podem ler)
- Somente admins podem configurar credenciais da API

---

### Alteracoes tecnicas

**Arquivos novos:**
- `src/pages/PublicacoesDJE.tsx` - pagina principal com filtros, tabela e detalhes
- `supabase/functions/pje-publicacoes/index.ts` - edge function para comunicacao com API do CNJ

**Arquivos modificados:**
- `src/components/AppSidebar.tsx` - adicionar item "Publicacoes DJE" no grupo "Gestao Processual" (linha 236)
- `src/App.tsx` - adicionar rota /publicacoes-dje

**Migracao SQL:**
- Criar tabela `publicacoes_dje` com campos para armazenar publicacoes
- Criar tabela `publicacoes_dje_reads` para marcar leituras por usuario
- Habilitar RLS com politica para usuarios aprovados

**Secrets necessarias (a configurar quando obtiver credenciais):**
- PJE_CNJ_USERNAME
- PJE_CNJ_PASSWORD

---

### Fluxo de uso

1. Usuario acessa "Publicacoes DJE" no menu Gestao Processual
2. Se credenciais nao configuradas: exibe mensagem orientando o admin a configurar
3. Se configuradas: usuario aplica filtros (processo, periodo, tribunal) e clica "Buscar"
4. Edge function consulta API do CNJ e retorna resultados
5. Resultados exibidos em tabela com opcao de expandir detalhes
6. Usuario pode marcar como lida, exportar CSV/PDF
7. Publicacoes ficam salvas no banco para consulta futura sem precisar chamar API novamente

---

### Resultado esperado

| Aspecto | Detalhe |
|---------|---------|
| Menu | Novo item "Publicacoes DJE" em Gestao Processual |
| Busca | Filtros por processo, periodo, tribunal, tipo |
| Visualizacao | Tabela com resumo + dialog com conteudo completo |
| Exportacao | CSV e PDF |
| Cache | Publicacoes salvas no banco apos primeira consulta |
| Seguranca | Credenciais em secrets, RLS habilitado |

