import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { maskPhone } from '@/lib/masks';
import {
  Plus, Search, Phone, Copy, Pencil, Trash2, Eye, EyeOff, KeyRound, Building2, Globe, Mail
} from 'lucide-react';

// ─── Types ───
interface Fornecedor {
  id: string;
  nome: string;
  telefone: string | null;
  categoria: string | null;
  email: string | null;
  endereco: string | null;
  observacoes: string | null;
}

interface SenhaUtil {
  id: string;
  titulo: string;
  usuario: string | null;
  senha: string | null;
  url: string | null;
  categoria: string | null;
  observacoes: string | null;
}

// ─── Fornecedor Form Dialog ───
function FornecedorDialog({
  open, onOpenChange, fornecedor, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fornecedor: Fornecedor | null;
  onSave: () => void;
}) {
  const { user } = useAuth();
  const { retryWithRefresh } = useSessionRefresh();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [categoria, setCategoria] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fornecedor) {
      setNome(fornecedor.nome);
      setTelefone(fornecedor.telefone || '');
      setCategoria(fornecedor.categoria || '');
      setEmail(fornecedor.email || '');
      setEndereco(fornecedor.endereco || '');
      setObservacoes(fornecedor.observacoes || '');
    } else {
      setNome(''); setTelefone(''); setCategoria(''); setEmail(''); setEndereco(''); setObservacoes('');
    }
  }, [fornecedor, open]);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    const payload = {
      nome: nome.trim(),
      telefone: telefone || null,
      categoria: categoria || null,
      email: email || null,
      endereco: endereco || null,
      observacoes: observacoes || null,
      created_by: user?.id,
    };

    const { error } = await retryWithRefresh(() =>
      fornecedor
        ? supabase.from('fornecedores_uteis').update(payload).eq('id', fornecedor.id)
        : supabase.from('fornecedores_uteis').insert(payload)
    );
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success(fornecedor ? 'Fornecedor atualizado!' : 'Fornecedor cadastrado!');
    onOpenChange(false);
    onSave();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{fornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do fornecedor" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={telefone} onChange={e => setTelefone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <Label>Categoria</Label>
            <Input value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex: Papelaria, TI, Limpeza..." />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Endereço" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações adicionais" />
          </div>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Senha Form Dialog ───
function SenhaDialog({
  open, onOpenChange, senha, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  senha: SenhaUtil | null;
  onSave: () => void;
}) {
  const { user } = useAuth();
  const [titulo, setTitulo] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senhaVal, setSenhaVal] = useState('');
  const [url, setUrl] = useState('');
  const [categoria, setCategoria] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (senha) {
      setTitulo(senha.titulo);
      setUsuario(senha.usuario || '');
      setSenhaVal(senha.senha || '');
      setUrl(senha.url || '');
      setCategoria(senha.categoria || '');
      setObservacoes(senha.observacoes || '');
    } else {
      setTitulo(''); setUsuario(''); setSenhaVal(''); setUrl(''); setCategoria(''); setObservacoes('');
    }
    setShowPassword(false);
  }, [senha, open]);

  const handleSave = async () => {
    if (!titulo.trim()) { toast.error('Título é obrigatório'); return; }
    setSaving(true);
    const payload = {
      titulo: titulo.trim(),
      usuario: usuario || null,
      senha: senhaVal || null,
      url: url || null,
      categoria: categoria || null,
      observacoes: observacoes || null,
      created_by: user?.id,
    };

    let error;
    if (senha) {
      ({ error } = await supabase.from('senhas_uteis').update(payload).eq('id', senha.id));
    } else {
      ({ error } = await supabase.from('senhas_uteis').insert(payload));
    }
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success(senha ? 'Senha atualizada!' : 'Senha cadastrada!');
    onOpenChange(false);
    onSave();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{senha ? 'Editar Senha' : 'Nova Senha'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: E-mail institucional, Certificado Digital..." />
          </div>
          <div>
            <Label>Usuário/Login</Label>
            <Input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="Usuário ou login" />
          </div>
          <div>
            <Label>Senha</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={senhaVal}
                onChange={e => setSenhaVal(e.target.value)}
                placeholder="Senha"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div>
            <Label>URL</Label>
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Categoria</Label>
            <Input value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex: E-mail, Certificado, Sistema..." />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações adicionais" />
          </div>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───
export default function CadastrosUteis() {
  const { user } = useAuth();
  const { isAdmin, profile } = useUserRole();
  const isAdminOrSocio = isAdmin || profile?.position === 'socio';

  // Fornecedores state
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornSearch, setFornSearch] = useState('');
  const [fornCatFilter, setFornCatFilter] = useState('all');
  const [fornDialogOpen, setFornDialogOpen] = useState(false);
  const [editingForn, setEditingForn] = useState<Fornecedor | null>(null);

  // Senhas state
  const [senhas, setSenhas] = useState<SenhaUtil[]>([]);
  const [senhaSearch, setSenhaSearch] = useState('');
  const [senhaCatFilter, setSenhaCatFilter] = useState('all');
  const [senhaDialogOpen, setSenhaDialogOpen] = useState(false);
  const [editingSenha, setEditingSenha] = useState<SenhaUtil | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const fetchFornecedores = async () => {
    const { data } = await supabase.from('fornecedores_uteis').select('*').order('nome');
    if (data) setFornecedores(data as Fornecedor[]);
  };

  const fetchSenhas = async () => {
    if (!isAdminOrSocio) return;
    const { data } = await supabase.from('senhas_uteis').select('*').order('titulo');
    if (data) setSenhas(data as SenhaUtil[]);
  };

  useEffect(() => { fetchFornecedores(); }, []);
  useEffect(() => { if (isAdminOrSocio) fetchSenhas(); }, [isAdminOrSocio]);

  // Derived
  const fornCategorias = useMemo(() => {
    const cats = new Set(fornecedores.map(f => f.categoria).filter(Boolean) as string[]);
    return Array.from(cats).sort();
  }, [fornecedores]);

  const senhaCategorias = useMemo(() => {
    const cats = new Set(senhas.map(s => s.categoria).filter(Boolean) as string[]);
    return Array.from(cats).sort();
  }, [senhas]);

  const filteredForn = useMemo(() => {
    let list = fornecedores;
    if (fornCatFilter !== 'all') list = list.filter(f => f.categoria === fornCatFilter);
    if (fornSearch) {
      const q = fornSearch.toLowerCase();
      list = list.filter(f =>
        f.nome.toLowerCase().includes(q) ||
        (f.telefone && f.telefone.includes(q)) ||
        (f.categoria && f.categoria.toLowerCase().includes(q)) ||
        (f.email && f.email.toLowerCase().includes(q))
      );
    }
    return list;
  }, [fornecedores, fornSearch, fornCatFilter]);

  const filteredSenhas = useMemo(() => {
    let list = senhas;
    if (senhaCatFilter !== 'all') list = list.filter(s => s.categoria === senhaCatFilter);
    if (senhaSearch) {
      const q = senhaSearch.toLowerCase();
      list = list.filter(s =>
        s.titulo.toLowerCase().includes(q) ||
        (s.categoria && s.categoria.toLowerCase().includes(q)) ||
        (s.usuario && s.usuario.toLowerCase().includes(q))
      );
    }
    return list;
  }, [senhas, senhaSearch, senhaCatFilter]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleDeleteForn = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este fornecedor?')) return;
    const { error } = await supabase.from('fornecedores_uteis').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Fornecedor excluído');
    fetchFornecedores();
  };

  const handleDeleteSenha = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta senha?')) return;
    const { error } = await supabase.from('senhas_uteis').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Senha excluída');
    fetchSenhas();
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cadastros Úteis</h1>
          <p className="text-muted-foreground">Diretório de fornecedores e informações administrativas</p>
        </div>

        <Tabs defaultValue="fornecedores">
          <TabsList>
            <TabsTrigger value="fornecedores" className="gap-2">
              <Phone className="h-4 w-4" /> Fornecedores
            </TabsTrigger>
            {isAdminOrSocio && (
              <TabsTrigger value="senhas" className="gap-2">
                <KeyRound className="h-4 w-4" /> Cofre de Senhas
              </TabsTrigger>
            )}
          </TabsList>

          {/* ─── Fornecedores Tab ─── */}
          <TabsContent value="fornecedores">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-lg">Telefones e Fornecedores</CardTitle>
                {isAdminOrSocio && (
                  <Button size="sm" onClick={() => { setEditingForn(null); setFornDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-1" /> Novo Fornecedor
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, telefone, categoria..."
                      value={fornSearch}
                      onChange={e => setFornSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={fornCatFilter} onValueChange={setFornCatFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {fornCategorias.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {filteredForn.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum fornecedor encontrado</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>E-mail</TableHead>
                          <TableHead className="hidden lg:table-cell">Endereço</TableHead>
                          <TableHead className="hidden lg:table-cell">Observações</TableHead>
                          {isAdminOrSocio && <TableHead className="w-24">Ações</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredForn.map(f => (
                          <TableRow key={f.id}>
                            <TableCell className="font-medium">{f.nome}</TableCell>
                            <TableCell>
                              {f.telefone ? (
                                <div className="flex items-center gap-1">
                                  <span>{f.telefone}</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(f.telefone!, 'Telefone')}>
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {f.categoria ? <Badge variant="secondary">{f.categoria}</Badge> : '-'}
                            </TableCell>
                            <TableCell>
                              {f.email ? (
                                <div className="flex items-center gap-1">
                                  <span className="truncate max-w-32">{f.email}</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(f.email!, 'E-mail')}>
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell max-w-48 truncate">{f.endereco || '-'}</TableCell>
                            <TableCell className="hidden lg:table-cell max-w-48 truncate">{f.observacoes || '-'}</TableCell>
                            {isAdminOrSocio && (
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingForn(f); setFornDialogOpen(true); }}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteForn(f.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Senhas Tab ─── */}
          {isAdminOrSocio && (
            <TabsContent value="senhas">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-lg">Cofre de Senhas</CardTitle>
                  <Button size="sm" onClick={() => { setEditingSenha(null); setSenhaDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-1" /> Nova Senha
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por título, categoria, usuário..."
                        value={senhaSearch}
                        onChange={e => setSenhaSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={senhaCatFilter} onValueChange={setSenhaCatFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as categorias</SelectItem>
                        {senhaCategorias.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {filteredSenhas.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhuma senha cadastrada</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Usuário/Login</TableHead>
                            <TableHead>Senha</TableHead>
                            <TableHead>URL</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="hidden lg:table-cell">Observações</TableHead>
                            <TableHead className="w-24">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSenhas.map(s => (
                            <TableRow key={s.id}>
                              <TableCell className="font-medium">{s.titulo}</TableCell>
                              <TableCell>
                                {s.usuario ? (
                                  <div className="flex items-center gap-1">
                                    <span className="truncate max-w-32">{s.usuario}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(s.usuario!, 'Usuário')}>
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                {s.senha ? (
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono text-sm">
                                      {visiblePasswords.has(s.id) ? s.senha : '••••••••'}
                                    </span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => togglePasswordVisibility(s.id)}>
                                      {visiblePasswords.has(s.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(s.senha!, 'Senha')}>
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                {s.url ? (
                                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 truncate max-w-40">
                                    <Globe className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{s.url.replace(/^https?:\/\//, '')}</span>
                                  </a>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                {s.categoria ? <Badge variant="secondary">{s.categoria}</Badge> : '-'}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell max-w-48 truncate">{s.observacoes || '-'}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingSenha(s); setSenhaDialogOpen(true); }}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSenha(s.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <FornecedorDialog open={fornDialogOpen} onOpenChange={setFornDialogOpen} fornecedor={editingForn} onSave={fetchFornecedores} />
      <SenhaDialog open={senhaDialogOpen} onOpenChange={setSenhaDialogOpen} senha={editingSenha} onSave={fetchSenhas} />
    </Layout>
  );
}
