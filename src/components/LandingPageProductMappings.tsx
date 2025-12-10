import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Link, Package, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Mapping {
  id: string;
  url_pattern: string;
  product_name: string;
  created_at: string;
}

interface Product {
  _id: string;
  name: string;
}

export function LandingPageProductMappings() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [urlPattern, setUrlPattern] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [customProduct, setCustomProduct] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMappings();
    fetchProducts();
  }, []);

  const fetchMappings = async () => {
    try {
      const { data, error } = await supabase
        .from('landing_page_product_mappings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMappings(data || []);
    } catch (error) {
      console.error('Error fetching mappings:', error);
      toast.error('Erro ao carregar mapeamentos');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase.functions.invoke('rd-station-products');
      if (error) throw error;
      if (data?.products) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleCreate = async () => {
    const productName = selectedProduct === 'custom' ? customProduct : selectedProduct;
    
    if (!urlPattern.trim() || !productName.trim()) {
      toast.error('Preencha o padrão de URL e o produto');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('landing_page_product_mappings')
        .insert({
          url_pattern: urlPattern.trim().toLowerCase(),
          product_name: productName.trim(),
          created_by: user.id,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Já existe um mapeamento para esta URL');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Mapeamento criado com sucesso');
      setDialogOpen(false);
      setUrlPattern('');
      setSelectedProduct('');
      setCustomProduct('');
      fetchMappings();
    } catch (error) {
      console.error('Error creating mapping:', error);
      toast.error('Erro ao criar mapeamento');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover este mapeamento?')) return;

    try {
      const { error } = await supabase
        .from('landing_page_product_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Mapeamento removido');
      fetchMappings();
    } catch (error) {
      console.error('Error deleting mapping:', error);
      toast.error('Erro ao remover mapeamento');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Mapeamento URL → Produto
            </CardTitle>
            <CardDescription>
              Configure quais URLs de landing pages correspondem a cada produto
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Mapeamento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Mapeamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Padrão de URL</Label>
                  <Input
                    placeholder="Ex: multipropriedade, atraso-obra, /imoveis/"
                    value={urlPattern}
                    onChange={(e) => setUrlPattern(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Digite parte da URL que identifica a página. O sistema buscará leads cujo landing_page contenha este padrão.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingProducts ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        <>
                          {products.map((product) => (
                            <SelectItem key={product._id} value={product.name}>
                              {product.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom">Outro (digitar)</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProduct === 'custom' && (
                  <div className="space-y-2">
                    <Label>Nome do Produto</Label>
                    <Input
                      placeholder="Digite o nome do produto"
                      value={customProduct}
                      onChange={(e) => setCustomProduct(e.target.value)}
                    />
                  </div>
                )}

                <Button 
                  onClick={handleCreate} 
                  disabled={saving} 
                  className="w-full"
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Mapeamento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : mappings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum mapeamento configurado</p>
            <p className="text-sm">Crie mapeamentos para vincular automaticamente leads a produtos</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Padrão de URL</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell className="font-mono text-sm">
                    {mapping.url_pattern}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      {mapping.product_name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(mapping.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Como funciona?</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Quando um lead preenche o formulário, o sistema captura a URL da página (landing_page)</li>
            <li>• O sistema verifica se a URL contém algum dos padrões configurados</li>
            <li>• Se encontrar, vincula automaticamente o lead ao produto correspondente</li>
            <li>• O produto aparece no dashboard de leads e é enviado ao RD Station</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
