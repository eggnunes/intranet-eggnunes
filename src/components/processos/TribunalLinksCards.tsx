import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Search, Scale, Building2, Shield, Gavel } from 'lucide-react';

interface TribunalLink {
  id: string;
  nome: string;
  url: string;
  tribunal: string;
  sistema: string;
  categoria: string;
}

const getCategoriaIcon = (categoria: string) => {
  switch (categoria) {
    case 'federal':
      return <Building2 className="h-4 w-4" />;
    case 'estadual':
      return <Scale className="h-4 w-4" />;
    case 'militar':
      return <Shield className="h-4 w-4" />;
    default:
      return <Gavel className="h-4 w-4" />;
  }
};

const getCategoriaColor = (categoria: string) => {
  switch (categoria) {
    case 'federal':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'estadual':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'militar':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

const getSistemaColor = (sistema: string) => {
  switch (sistema) {
    case 'PJE':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
    case 'E-Proc':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case 'ESAJ':
      return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300';
    case 'RUPE':
      return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300';
    case 'Tarefas':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

export const TribunalLinksCards = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);
  const [selectedSistema, setSelectedSistema] = useState<string | null>(null);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['tribunal-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tribunal_links')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      
      if (error) throw error;
      return data as TribunalLink[];
    },
  });

  // Extrair categorias e sistemas únicos
  const categorias = [...new Set(links.map(l => l.categoria))];
  const sistemas = [...new Set(links.map(l => l.sistema))];

  // Filtrar links
  const filteredLinks = links.filter(link => {
    const matchesSearch = 
      link.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.tribunal.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.sistema.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategoria = !selectedCategoria || link.categoria === selectedCategoria;
    const matchesSistema = !selectedSistema || link.sistema === selectedSistema;
    
    return matchesSearch && matchesCategoria && matchesSistema;
  });

  const handleCardClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Carregando links...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de busca e filtros */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tribunal, sistema ou nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filtros por categoria */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground mr-2">Categoria:</span>
          <Badge
            variant={selectedCategoria === null ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSelectedCategoria(null)}
          >
            Todas
          </Badge>
          {categorias.map(cat => (
            <Badge
              key={cat}
              variant={selectedCategoria === cat ? 'default' : 'outline'}
              className={`cursor-pointer ${selectedCategoria !== cat ? getCategoriaColor(cat) : ''}`}
              onClick={() => setSelectedCategoria(selectedCategoria === cat ? null : cat)}
            >
              {cat === 'federal' ? 'Federal' : cat === 'estadual' ? 'Estadual' : cat === 'militar' ? 'Militar' : cat}
            </Badge>
          ))}
        </div>

        {/* Filtros por sistema */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground mr-2">Sistema:</span>
          <Badge
            variant={selectedSistema === null ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSelectedSistema(null)}
          >
            Todos
          </Badge>
          {sistemas.map(sis => (
            <Badge
              key={sis}
              variant={selectedSistema === sis ? 'default' : 'outline'}
              className={`cursor-pointer ${selectedSistema !== sis ? getSistemaColor(sis) : ''}`}
              onClick={() => setSelectedSistema(selectedSistema === sis ? null : sis)}
            >
              {sis}
            </Badge>
          ))}
        </div>
      </div>

      {/* Contador de resultados */}
      <div className="text-sm text-muted-foreground">
        {filteredLinks.length} {filteredLinks.length === 1 ? 'portal encontrado' : 'portais encontrados'}
      </div>

      {/* Grid de cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredLinks.map(link => (
          <Card
            key={link.id}
            className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 group"
            onClick={() => handleCardClick(link.url)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getCategoriaIcon(link.categoria)}
                  <span className="font-medium text-sm">{link.tribunal}</span>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              
              <h3 className="font-semibold text-base mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                {link.nome}
              </h3>
              
              <div className="flex gap-2">
                <Badge variant="secondary" className={getSistemaColor(link.sistema)}>
                  {link.sistema}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredLinks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum portal encontrado com os filtros selecionados.</p>
        </div>
      )}
    </div>
  );
};
