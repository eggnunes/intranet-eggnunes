import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Armazenar posições de scroll por rota
const scrollPositions = new Map<string, number>();

export const useScrollRestoration = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef<string | null>(null);
  const isFirstRender = useRef(true);

  // Salvar posição antes de navegar
  useEffect(() => {
    // Salvar posição atual ao sair da página
    return () => {
      scrollPositions.set(location.pathname + location.search, window.scrollY);
    };
  }, [location]);

  // Gerenciar scroll baseado no tipo de navegação
  useEffect(() => {
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
        // Usar requestAnimationFrame para garantir que o DOM esteja pronto
        requestAnimationFrame(() => {
          window.scrollTo({
            top: savedPosition,
            behavior: 'instant'
          });
        });
      }
    } else {
      // Para navegação "PUSH" ou "REPLACE", ir para o topo
      requestAnimationFrame(() => {
        window.scrollTo({
          top: 0,
          behavior: 'instant'
        });
      });
    }

    previousPath.current = currentPath;
  }, [location.pathname, location.search, navigationType]);
};

// Componente wrapper para usar o hook
export const ScrollRestoration = () => {
  useScrollRestoration();
  return null;
};
