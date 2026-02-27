

## Plano: Permitir edição da qualificação dentro da Procuração

### Problema
A qualificação do cliente dentro do dialog de Procuração é exibida como texto estático (linha 722-724 de `ProcuracaoGenerator.tsx`). Quando o colaborador altera dados do cliente na tela principal, essa alteração não se reflete na procuração porque:
1. A qualificação é passada como prop e exibida em um `<p>` não editável
2. O `gerarPDF()` usa a prop `qualification` original diretamente
3. O preview permite editar o texto completo, mas o `gerarPDF()` ignora essas edições e reconstrói tudo do zero a partir das props originais

### Solução

**Arquivo:** `src/components/ProcuracaoGenerator.tsx`

1. **Adicionar estado local para qualificação editável:**
   - Criar `const [localQualification, setLocalQualification] = useState(qualification)`
   - Sincronizar com prop via `useEffect` quando `qualification` mudar

2. **Tornar a qualificação editável no formulário:**
   - Substituir o `<p>` estático (linhas 722-724) por um `<Textarea>` editável com `localQualification`

3. **Usar qualificação local no PDF:**
   - Em `gerarTextoProcuracao()` (linha 347) e `gerarPDF()` (linha 388): substituir referências a `qualification` por `localQualification`

4. **Usar qualificação local no preview:**
   - Garantir que `gerarTextoProcuracao()` use `localQualification` para que o preview também reflita edições

Isso permite que o colaborador edite a qualificação diretamente no dialog da procuração antes de gerar o PDF.

