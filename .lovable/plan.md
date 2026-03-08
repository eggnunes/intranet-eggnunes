

# Diagnóstico: Tarefas Irrelevantes no Controle de Prazos

## Problema

O filtro atual usa `.includes()` genérico (ex: "ATENDIMENTO" exclui qualquer tipo com essa palavra), mas NÃO exclui tipos administrativos/operacionais que não são prazos processuais. Resultado: **~2.600 tarefas** aparecem quando deveriam ser muito menos.

### Tipos que estão aparecendo mas NÃO são prazos processuais:

| Tipo | Qtd | Por que não é prazo |
|------|-----|---------------------|
| AGUARDANDO DOCUMENTOS CLIENTE | 283 | Espera passiva |
| ATRIBUIR E-MAIL / NOTA DE EXPEDIENTE / TAREFA | 554* | Tarefa administrativa |
| COMENTÁRIO | 493* | Nota interna |
| ALERTA DE TAREFA EXCLUÍDA | 115* | Notificação do sistema |
| ACOMPANHAR TRÂNSITO EM JULGADO | 97 | Acompanhamento |
| ACOMPANHAR PAGAMENTO | 42 | Financeiro |
| MANDAR/RESPONDER E-MAIL | 99 | Comunicação |
| TENTATIVA DE CONTATO COM O CLIENTE | 50 | Comunicação |
| REUNIÃO SOBRE O CASO DO CLIENTE | ~100 | Reunião |
| ANÁLISE DA PASTA DO CLIENTE | 70 | Análise |
| RECADO PARA PARCEIRO | 9 | Comunicação |
| ENCAMINHAR INTIMAÇÕES DIÁRIAS | 49 | Tarefa da própria Mariana |
| GERAR RELATÓRIOS MENSAIS | 25 | Administrativo |
| RELATÓRIO DIÁRIO DA CONTROLADORIA | 31 | Administrativo |
| CONFERÊNCIA DAS PETIÇÕES | 31 | Administrativo |
| RELATÓRIO PROCESSUAL | 19 | Administrativo |
| ENVIO DE LINK DE AVALIAÇÃO | 6 | Administrativo |
| COBRAR HONORÁRIOS | 5 | Financeiro |
| EMISSÃO DE BOLETO | 6 | Financeiro |
| ENCERRAR PASTA DE CLIENTE | 9 | Administrativo |
| ELABORAÇÃO DE PROCURAÇÃO/SUBSTABELECIMENTO | 9 | Documento interno |

Os tipos que SÃO prazos processuais reais (petições, protocolos, embargos, audiências, cumprimento de sentença, etc.) somam algo em torno de **~1.300 tarefas** — um número muito mais realista.

## Solução

Inverter a lógica: em vez de excluir tipos específicos, **incluir apenas os tipos que são prazos processuais**. Isso é mais seguro porque novos tipos administrativos criados no ADVBox não vão poluir a lista.

### Tipos a INCLUIR (prazos processuais):

- Todas as PETIÇÕES (inicial, intermediária, ciência, esboço, etc.)
- PROTOCOLO ELETRÔNICO DE PETIÇÃO
- EMBARGOS DE DECLARAÇÃO
- IMPUGNAÇÃO À CONTESTAÇÃO
- CONTRARRAZÕES DE RECURSO
- APELAÇÃO/RECURSO INOMINADO
- AGRAVO EM RESP/REXT
- RECURSO EXTRAORDINÁRIO
- CUMPRIMENTO DE SENTENÇA
- MANIFESTAÇÃO SOBRE IMPUGNAÇÃO
- ALEGAÇÕES FINAIS
- CONTRAMINUTA DE AGRAVO
- AUDIÊNCIAS (conciliação, instrução/julgamento)
- DISTRIBUIÇÃO DE PROCESSO ELETRÔNICO
- EMENDA À INICIAL
- COMPLEMENTAÇÃO DA PETIÇÃO
- ANÁLISE DE DECISÃO PARA FINS DE RECURSO
- ELABORAÇÃO DE CÁLCULO
- AVALIAR DOCUMENTAÇÃO COMPROBATÓRIA
- REQUERIMENTO ADMINISTRATIVO (judicial)
- SUSTENTAÇÃO ORAL
- PREPARAR SUSTENTAÇÃO ORAL
- INSTRUIR DOCUMENTOS PRECATÓRIO
- CORREÇÃO PEQUENA DE PETIÇÃO/CÁLCULO
- REVISÃO DE PETIÇÃO
- PESQUISA DE JURISPRUDÊNCIA
- ANÁLISE DE CASO JURÍDICO
- EMISSÃO DE GUIA DE CUSTAS/DEPÓSITO JUDICIAL
- PREPARAR TESTEMUNHAS PARA AUDIÊNCIA
- ELABORAR CARTA DE INTIMAÇÃO DE TESTEMUNHA

### Alterações no `src/pages/ControlePrazos.tsx`

1. **Substituir `EXCLUDED_TASK_TYPES`** por `INCLUDED_TASK_KEYWORDS` — lista de palavras-chave que identificam prazos processuais (PETIÇÃO, PROTOCOLO, EMBARGOS, IMPUGNAÇÃO, RECURSO, CUMPRIMENTO, AUDIÊNCIA, etc.)
2. **Filtro por inclusão**: tarefa aparece apenas se o `task_type` contém uma das keywords
3. **Manter exclusão Mariana-only** e adicionar exclusão explícita dos 7 tipos do documento
4. **Adicionar filtro por tipo de tarefa** no painel de filtros (dropdown)
5. **Resultado esperado**: ~1.300 tarefas em vez de 4.000+

