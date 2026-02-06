

# Correção de 3 Bugs no RotaDoc

## Problema 1: Bug no `ImageCropEditor.tsx` (linha 65)

O `useState` esta sendo usado incorretamente como se fosse um `useEffect`. O codigo atual:

```text
useState(() => {
  if (file) {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }
});
```

Isso so executa uma vez (na montagem) e a funcao de cleanup retornada nunca e chamada, causando:
- A imagem pode nao carregar se o `file` mudar
- Memory leak pois o Object URL nunca e revogado

**Correcao**: Substituir por `useEffect` com dependencia em `file`, que faz `revokeObjectURL` no cleanup.

Alem disso, na linha 343 existe um fallback `imageUrl || URL.createObjectURL(file)` que cria um novo Object URL a cada re-render. Sera removido para usar apenas `imageUrl` gerenciado pelo `useEffect`.

---

## Problema 2: Memory leaks no `FilePreview.tsx`

Tres funcoes criam `URL.createObjectURL` sem nunca chamar `revokeObjectURL`:

- `resizeImageForAnalysis` (linha 184)
- `getImageDimensions` (linha 194)
- `applyCrop` (linha 271)

Alem disso, na linha 299, `URL.createObjectURL(file)` e chamado diretamente no JSX, criando um novo Object URL a cada re-render.

**Correcao**:
- Nas 3 funcoes, adicionar `URL.revokeObjectURL(url)` apos o `img.onload` e `img.onerror`
- Para o preview no JSX, usar `useMemo` para criar e gerenciar os Object URLs das thumbnails, revogando-os quando os arquivos mudam

---

## Problema 3: Memory leak no `FileUpload.tsx`

Na linha 80, `URL.createObjectURL(file)` e chamado diretamente no JSX dentro de um `map`, criando novos Object URLs a cada re-render.

**Correcao**: Usar `useMemo` para criar os Object URLs uma vez e `useEffect` para revoga-los no cleanup.

---

## Problema 4 (bonus): Memory leak no `RotaDoc.tsx`

Na funcao `resizeImage` (linha 108), `URL.createObjectURL(file)` e chamado sem revogacao.

**Correcao**: Adicionar `URL.revokeObjectURL` apos uso.

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/ImageCropEditor.tsx` | Trocar `useState` por `useEffect` para carregar imagem; remover fallback no JSX |
| `src/components/FilePreview.tsx` | Adicionar `revokeObjectURL` nas 3 funcoes; usar `useMemo` para thumbnails no JSX |
| `src/components/FileUpload.tsx` | Usar `useMemo`/`useEffect` para gerenciar Object URLs das previews |
| `src/pages/RotaDoc.tsx` | Adicionar `revokeObjectURL` na funcao `resizeImage` |

