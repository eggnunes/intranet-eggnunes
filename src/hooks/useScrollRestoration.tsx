import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Armazenar posições de scroll por rota
const scrollPositions = new Map<string, number>();

export const useScrollRestoration = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef<string | null>(null);

  // Salvar posição antes de navegar
  useEffect(() => {
    const handleBeforeNavigate = () => {
      if (previousPath.current) {
        scrollPositions.set(previousPath.current, window.scrollY);
      }
    };

    // Salvar posição atual ao sair da página
    return () => {
      scrollPositions.set(location.pathname + location.search, window.scrollY);
    };
  }, [location]);

  // Gerenciar scroll baseado no tipo de navegação
  useLayoutEffect(() => {
    const currentPath = location.pathname + location.search;
    
    // Se for navegação "POP" (voltar/avançar), restaurar posição
    if (navigationType === 'POP') {
      const savedPosition = scrollPositions.get(currentPath);
      if (savedPosition !== undefined) {
        // Usar setTimeout para garantir que o DOM esteja renderizado
        setTimeout(() => {
          window.scrollTo({
            top: savedPosition,
            behavior: 'instant'
          });
        }, 0);
      }
    } else {
      // Para navegação "PUSH" ou "REPLACE", ir para o topo
      window.scrollTo({
        top: 0,
        behavior: 'instant'
      });
    }

    previousPath.current = currentPath;
  }, [location, navigationType]);
};

// Componente wrapper para usar o hook
export const ScrollRestoration = () => {
  useScrollRestoration();
  return null;
};
