import { useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Armazenar posições de scroll por rota
const scrollPositions = new Map<string, number>();

export const useScrollRestoration = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef<string | null>(null);
  const isFirstRender = useRef(true);

  // Função para garantir scroll habilitado
  const ensureScrollEnabled = useCallback(() => {
    // Reset any blocking styles on body and html
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.documentElement.style.overflow = '';
    
    // Force a reflow to ensure scroll works
    void document.body.offsetHeight;
  }, []);

  // Salvar posição antes de navegar
  useEffect(() => {
    // Salvar posição atual ao sair da página
    return () => {
      scrollPositions.set(location.pathname + location.search, window.scrollY);
    };
  }, [location]);

  // Gerenciar scroll baseado no tipo de navegação
  useEffect(() => {
    // Garantir scroll habilitado em cada navegação
    ensureScrollEnabled();

    // Skip primeiro render para evitar conflitos com carregamento inicial
    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousPath.current = location.pathname + location.search;
      return;
    }

    const currentPath = location.pathname + location.search;
    
    // Se for navegação "POP" (voltar/avançar), restaurar posição
    if (navigationType === 'POP') {
      const savedPosition = scrollPositions.get(currentPath);
      if (savedPosition !== undefined) {
        // Usar setTimeout para garantir que o DOM esteja pronto
        setTimeout(() => {
          ensureScrollEnabled();
          window.scrollTo({
            top: savedPosition,
            behavior: 'instant'
          });
        }, 50);
      }
    } else {
      // Para navegação "PUSH" ou "REPLACE", ir para o topo
      setTimeout(() => {
        ensureScrollEnabled();
        window.scrollTo({
          top: 0,
          behavior: 'instant'
        });
      }, 50);
    }

    previousPath.current = currentPath;
  }, [location.pathname, location.search, navigationType, ensureScrollEnabled]);
};

// Componente wrapper para usar o hook
export const ScrollRestoration = () => {
  useScrollRestoration();
  return null;
};
