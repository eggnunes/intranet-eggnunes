import { useEffect, useCallback } from 'react';

interface ShortcutAction {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

interface FinanceiroKeyboardShortcutsProps {
  onNovoLancamento: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onSearch?: () => void;
}

export function useFinanceiroKeyboardShortcuts({
  onNovoLancamento,
  onRefresh,
  onExport,
  onSearch
}: FinanceiroKeyboardShortcutsProps) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignorar se estiver em um input ou textarea
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }

    const shortcuts: ShortcutAction[] = [
      {
        key: 'n',
        ctrlKey: true,
        action: onNovoLancamento,
        description: 'Novo Lançamento'
      },
      {
        key: 'r',
        ctrlKey: true,
        shiftKey: true,
        action: () => onRefresh?.(),
        description: 'Atualizar'
      },
      {
        key: 'e',
        ctrlKey: true,
        action: () => onExport?.(),
        description: 'Exportar'
      },
      {
        key: 'f',
        ctrlKey: true,
        action: () => onSearch?.(),
        description: 'Buscar'
      }
    ];

    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrlKey ? (event.ctrlKey || event.metaKey) : true;
      const altMatch = shortcut.altKey ? event.altKey : !event.altKey;
      const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
      
      if (
        event.key.toLowerCase() === shortcut.key.toLowerCase() &&
        ctrlMatch &&
        altMatch &&
        shiftMatch
      ) {
        event.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [onNovoLancamento, onRefresh, onExport, onSearch]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export function KeyboardShortcutsLegend() {
  const shortcuts = [
    { keys: ['Ctrl', 'N'], description: 'Novo Lançamento' },
    { keys: ['Ctrl', 'Shift', 'R'], description: 'Atualizar' },
    { keys: ['Ctrl', 'E'], description: 'Exportar' },
    { keys: ['Ctrl', 'F'], description: 'Buscar' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-muted/95 backdrop-blur border-t py-2 px-4 z-40">
      <div className="container mx-auto flex items-center justify-center gap-6 text-sm">
        <span className="text-muted-foreground font-medium">Atalhos:</span>
        {shortcuts.map((shortcut, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              {shortcut.keys.map((key, keyIndex) => (
                <span key={keyIndex}>
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-background border rounded shadow-sm">
                    {key}
                  </kbd>
                  {keyIndex < shortcut.keys.length - 1 && <span className="mx-0.5 text-muted-foreground">+</span>}
                </span>
              ))}
            </div>
            <span className="text-muted-foreground">{shortcut.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
