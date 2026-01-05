import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { User, Lock, Calendar, Upload, IdCard, History, Building, Bookmark, Download, Trash2, Search, Phone, MapPin, AlertTriangle, ArrowLeft, TrendingUp, DollarSign, Briefcase, FileText, FileSignature } from 'lucide-react';
import { FeedbackBox } from '@/components/FeedbackBox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmailNotificationSettings } from '@/components/EmailNotificationSettings';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

interface UsageHistoryItem {
  id: string;
  tool_name: string;
  action: string;
  created_at: string;
  metadata: any;
}

interface SavedJurisprudence {
  id: string;
  title: string;
  content: string;
  source: string | null;
  notes: string | null;
  created_at: string;
}

interface Promocao {
  id: string;
  cargo_anterior_nome: string;
  cargo_novo_nome: string;
  data_promocao: string;
  observacoes: string | null;
}

interface HistoricoSalario {
  id: string;
  salario_anterior: number;
  salario_novo: number;
  data_alteracao: string;
  observacao: string | null;
}

interface Pagamento {
  id: string;
  mes_referencia: string;
  total_liquido: number;
  data_pagamento: string | null;
  status: string;
}

interface Cargo {
  id: string;
  nome: string;
  valor_base: number;
}

interface ContratoColaborador {
  id: string;
  client_name: string;
  product_name: string;
  valor_total: number | null;
  status: string | null;
  created_at: string;
}

export default function Profile() {
  const { user } = useAuth();
  const { profile, loading, isAdmin } = useUserRole();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewingUserId = searchParams.get('userId');
  const [viewingProfile, setViewingProfile] = useState<any>(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const isViewingOther = viewingUserId && viewingUserId !== user?.id;
  const isSocio = profile?.position === 'socio';
  const canViewOther = isSocio || isAdmin;
  
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Campos do perfil
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [joinDate, setJoinDate] = useState<Date | undefined>(undefined);
  const [oabNumber, setOabNumber] = useState('');
  const [oabState, setOabState] = useState('');
  const [position, setPosition] = useState('');
  
  // Novos campos de contato
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [enderecoCep, setEnderecoCep] = useState('');
  const [enderecoLogradouro, setEnderecoLogradouro] = useState('');
  const [enderecoNumero, setEnderecoNumero] = useState('');
  const [enderecoComplemento, setEnderecoComplemento] = useState('');
  const [enderecoBairro, setEnderecoBairro] = useState('');
  const [enderecoCidade, setEnderecoCidade] = useState('');
  const [enderecoEstado, setEnderecoEstado] = useState('');
  
  // Campos de senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [usageHistory, setUsageHistory] = useState<UsageHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [savedJurisprudence, setSavedJurisprudence] = useState<SavedJurisprudence[]>([]);
  const [jurisprudenceLoading, setJurisprudenceLoading] = useState(true);
  const [showProfileAlert, setShowProfileAlert] = useState(false);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [viewingPromocoes, setViewingPromocoes] = useState<Promocao[]>([]);
  const [historicoSalario, setHistoricoSalario] = useState<HistoricoSalario[]>([]);
  const [viewingHistoricoSalario, setViewingHistoricoSalario] = useState<HistoricoSalario[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [viewingPagamentos, setViewingPagamentos] = useState<Pagamento[]>([]);
  const [cargoAtual, setCargoAtual] = useState<Cargo | null>(null);
  const [viewingCargoAtual, setViewingCargoAtual] = useState<Cargo | null>(null);
  const [contratos, setContratos] = useState<ContratoColaborador[]>([]);
  const [viewingContratos, setViewingContratos] = useState<ContratoColaborador[]>([]);

  // Fetch viewing profile if viewing another user
  useEffect(() => {
    const fetchViewingProfile = async () => {
      if (isViewingOther && canViewOther && viewingUserId) {
        setViewingLoading(true);
        const [profileRes, promocoesRes, historicoRes, pagamentosRes, contratosRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', viewingUserId)
            .single(),
          supabase
            .from('rh_promocoes')
            .select('id, cargo_anterior_nome, cargo_novo_nome, data_promocao, observacoes')
            .eq('colaborador_id', viewingUserId)
            .order('data_promocao', { ascending: false }),
          supabase
            .from('rh_historico_salario')
            .select('id, salario_anterior, salario_novo, data_alteracao, observacao')
            .eq('colaborador_id', viewingUserId)
            .order('data_alteracao', { ascending: false }),
          supabase
            .from('rh_pagamentos')
            .select('id, mes_referencia, total_liquido, data_pagamento, status')
            .eq('colaborador_id', viewingUserId)
            .order('mes_referencia', { ascending: false })
            .limit(12),
          supabase
            .from('fin_contratos')
            .select('id, client_name, product_name, valor_total, status, created_at')
            .eq('created_by', viewingUserId)
            .order('created_at', { ascending: false })
            .limit(10)
        ]);
        
        if (!profileRes.error && profileRes.data) {
          setViewingProfile(profileRes.data);
          
          // Buscar cargo atual se existir cargo_id
          if (profileRes.data.cargo_id) {
            const { data: cargoData } = await supabase
              .from('rh_cargos')
              .select('id, nome, valor_base')
              .eq('id', profileRes.data.cargo_id)
              .single();
            if (cargoData) {
              setViewingCargoAtual(cargoData as Cargo);
            }
          }
        } else {
          toast({
            title: 'Erro',
            description: 'Não foi possível carregar o perfil',
            variant: 'destructive',
          });
          navigate('/equipe');
        }
        
        if (!promocoesRes.error && promocoesRes.data) {
          setViewingPromocoes(promocoesRes.data as Promocao[]);
        }
        
        if (!historicoRes.error && historicoRes.data) {
          setViewingHistoricoSalario(historicoRes.data as HistoricoSalario[]);
        }
        
        if (!pagamentosRes.error && pagamentosRes.data) {
          setViewingPagamentos(pagamentosRes.data as Pagamento[]);
        }
        
        if (!contratosRes.error && contratosRes.data) {
          setViewingContratos(contratosRes.data as ContratoColaborador[]);
        }
        
        setViewingLoading(false);
      }
    };
    
    fetchViewingProfile();
  }, [viewingUserId, isViewingOther, canViewOther, navigate]);

  // Use current profile data for own profile
  const currentProfile = isViewingOther ? viewingProfile : profile;

  useEffect(() => {
    if (currentProfile && !isViewingOther) {
      setFullName(currentProfile.full_name || '');
      setPosition(currentProfile.position || '');
      setOabNumber((currentProfile as any).oab_number || '');
      setOabState((currentProfile as any).oab_state || '');
      // Novos campos de contato
      setTelefone((currentProfile as any).telefone || '');
      setCpf((currentProfile as any).cpf || '');
      setEnderecoCep((currentProfile as any).endereco_cep || '');
      setEnderecoLogradouro((currentProfile as any).endereco_logradouro || '');
      setEnderecoNumero((currentProfile as any).endereco_numero || '');
      setEnderecoComplemento((currentProfile as any).endereco_complemento || '');
      setEnderecoBairro((currentProfile as any).endereco_bairro || '');
      setEnderecoCidade((currentProfile as any).endereco_cidade || '');
      setEnderecoEstado((currentProfile as any).endereco_estado || '');
      
      // Verificar se perfil está incompleto
      const isIncomplete = !(currentProfile as any).telefone || !(currentProfile as any).cpf;
      setShowProfileAlert(isIncomplete);
      
      if (currentProfile.birth_date) {
        setBirthDate(parse(currentProfile.birth_date, 'yyyy-MM-dd', new Date()));
      }
      if ((currentProfile as any).join_date) {
        setJoinDate(parse((currentProfile as any).join_date, 'yyyy-MM-dd', new Date()));
      }
      fetchUsageHistory();
      fetchSavedJurisprudence();
      fetchPromocoes();
      fetchHistoricoSalario();
      fetchPagamentos();
      fetchCargoAtual();
      fetchContratos();
    }
  }, [currentProfile, isViewingOther]);

  const fetchPromocoes = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('rh_promocoes')
      .select('id, cargo_anterior_nome, cargo_novo_nome, data_promocao, observacoes')
      .eq('colaborador_id', user.id)
      .order('data_promocao', { ascending: false });

    if (!error && data) {
      setPromocoes(data as Promocao[]);
    }
  };

  const fetchHistoricoSalario = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('rh_historico_salario')
      .select('id, salario_anterior, salario_novo, data_alteracao, observacao')
      .eq('colaborador_id', user.id)
      .order('data_alteracao', { ascending: false });

    if (!error && data) {
      setHistoricoSalario(data as HistoricoSalario[]);
    }
  };

  const fetchPagamentos = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('rh_pagamentos')
      .select('id, mes_referencia, total_liquido, data_pagamento, status')
      .eq('colaborador_id', user.id)
      .order('mes_referencia', { ascending: false })
      .limit(12);

    if (!error && data) {
      setPagamentos(data as Pagamento[]);
    }
  };

  const fetchCargoAtual = async () => {
    if (!user || !(profile as any)?.cargo_id) return;
    
    const { data, error } = await supabase
      .from('rh_cargos')
      .select('id, nome, valor_base')
      .eq('id', (profile as any).cargo_id)
      .single();

    if (!error && data) {
      setCargoAtual(data as Cargo);
    }
  };

  const fetchContratos = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('fin_contratos')
      .select('id, client_name, product_name, valor_total, status, created_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setContratos(data as ContratoColaborador[]);
    }
  };

  const fetchUsageHistory = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('usage_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setUsageHistory(data);
    }
    setHistoryLoading(false);
  };

  const fetchSavedJurisprudence = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('saved_jurisprudence')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setSavedJurisprudence(data as SavedJurisprudence[]);
    }
    setJurisprudenceLoading(false);
  };

  const downloadJurisprudence = (item: SavedJurisprudence) => {
    const content = `JURISPRUDÊNCIA SALVA
==================

Título: ${item.title}
Data de salvamento: ${format(new Date(item.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
Fonte: ${item.source || 'Não informada'}

---

${item.content}

${item.notes ? `\n---\nNotas:\n${item.notes}` : ''}
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jurisprudencia-${item.title.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteJurisprudence = async (id: string) => {
    const { error } = await supabase
      .from('saved_jurisprudence')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao remover jurisprudência',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Jurisprudência removida',
      });
      fetchSavedJurisprudence();
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Erro',
          description: 'A imagem deve ter no máximo 5MB',
          variant: 'destructive',
        });
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile || !user) return null;

    setUploadingAvatar(true);
    try {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      toast({
        title: 'Erro ao fazer upload da foto',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      let avatarUrl = profile?.avatar_url;

      if (avatarFile) {
        const newAvatarUrl = await uploadAvatar();
        if (newAvatarUrl) {
          avatarUrl = newAvatarUrl;
        }
      }

      const updateData: any = {
        full_name: fullName,
        position,
        birth_date: birthDate ? format(birthDate, 'yyyy-MM-dd') : null,
        oab_number: oabNumber || null,
        oab_state: oabState || null,
        // Novos campos de contato
        telefone: telefone || null,
        cpf: cpf || null,
        endereco_cep: enderecoCep || null,
        endereco_logradouro: enderecoLogradouro || null,
        endereco_numero: enderecoNumero || null,
        endereco_complemento: enderecoComplemento || null,
        endereco_bairro: enderecoBairro || null,
        endereco_cidade: enderecoCidade || null,
        endereco_estado: enderecoEstado || null,
        perfil_completo: !!(telefone && cpf),
        updated_at: new Date().toISOString(),
      };

      // Só admins podem editar a data de ingresso
      if (isAdmin) {
        updateData.join_date = joinDate ? format(joinDate, 'yyyy-MM-dd') : null;
      }

      console.log('Salvando perfil com dados:', updateData);

      if (avatarUrl) {
        updateData.avatar_url = avatarUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .or(`id.eq.${user.id},email.eq.${user.email}`);

      if (error) {
        console.error('Erro ao atualizar perfil:', error);
        throw error;
      }

      // Recarregar os dados do perfil após salvar
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (updatedProfile && updatedProfile.birth_date) {
        setBirthDate(parse(updatedProfile.birth_date, 'yyyy-MM-dd', new Date()));
      }

      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações foram salvas com sucesso!',
      });

      setAvatarFile(null);
      setAvatarPreview(null);
      
      // Forçar reload da página para atualizar o hook useUserRole
      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar perfil',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos de senha',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Erro',
        description: 'As senhas não coincidem',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter no mínimo 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: 'Senha alterada',
        description: 'Sua senha foi atualizada com sucesso!',
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'Erro ao alterar senha',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const showOabFields = position === 'advogado' || position === 'estagiario';

  if (loading || viewingLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  // If viewing another user's profile (for sócios/admins)
  if (isViewingOther && canViewOther && viewingProfile) {
    const vp = viewingProfile;
    const positionLabels: Record<string, string> = {
      socio: 'Sócio',
      advogado: 'Advogado',
      estagiario: 'Estagiário',
      comercial: 'Comercial',
      administrativo: 'Administrativo',
    };
    
    return (
      <Layout>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Botão Voltar */}
          <Button variant="ghost" onClick={() => navigate('/equipe')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Equipe
          </Button>
          
          <div className="flex items-center gap-3 mb-8">
            <Avatar className="h-20 w-20 border-4 border-primary/30">
              <AvatarImage src={vp.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-2xl">
                {vp.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold">{vp.full_name}</h1>
              <p className="text-muted-foreground">{positionLabels[vp.position] || vp.position}</p>
            </div>
          </div>

          {/* Informações do Perfil - Apenas Visualização */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Informações Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-sm">Email</Label>
                  <p className="font-medium">{vp.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Telefone</Label>
                  <p className="font-medium">{vp.telefone || 'Não informado'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-sm">CPF</Label>
                  <p className="font-medium">{vp.cpf || 'Não informado'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Data de Nascimento</Label>
                  <p className="font-medium">
                    {vp.birth_date 
                      ? format(parse(vp.birth_date, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : 'Não informado'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-sm">Data de Ingresso</Label>
                  <p className="font-medium">
                    {vp.join_date 
                      ? format(parse(vp.join_date, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : 'Não informado'}
                  </p>
                </div>
                {(vp.position === 'advogado' || vp.position === 'socio' || vp.position === 'estagiario') && (
                  <div>
                    <Label className="text-muted-foreground text-sm">OAB</Label>
                    <p className="font-medium">
                      {vp.oab_number ? `${vp.oab_state || ''}/${vp.oab_number}` : 'Não informado'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Endereço */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Endereço
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {vp.endereco_logradouro ? (
                <>
                  <p className="font-medium">
                    {vp.endereco_logradouro}, {vp.endereco_numero}
                    {vp.endereco_complemento && ` - ${vp.endereco_complemento}`}
                  </p>
                  <p className="text-muted-foreground">
                    {vp.endereco_bairro && `${vp.endereco_bairro}, `}
                    {vp.endereco_cidade && `${vp.endereco_cidade} - `}
                    {vp.endereco_estado}
                    {vp.endereco_cep && ` | CEP: ${vp.endereco_cep}`}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Endereço não informado</p>
              )}
            </CardContent>
          </Card>

          {/* Cargo e Salário Atual */}
          {(viewingCargoAtual || vp.salario) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Cargo e Remuneração
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {viewingCargoAtual && (
                    <div>
                      <Label className="text-muted-foreground text-sm">Cargo Atual</Label>
                      <p className="font-medium">{viewingCargoAtual.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        Base: {viewingCargoAtual.valor_base?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  )}
                  {vp.salario && (
                    <div>
                      <Label className="text-muted-foreground text-sm">
                        {vp.position === 'advogado' || vp.position === 'socio' ? 'Pagamento' : 'Salário'}
                      </Label>
                      <p className="font-medium text-lg">
                        {Number(vp.salario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Histórico de Promoções */}
          {viewingPromocoes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Histórico de Promoções
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {viewingPromocoes.map((promo) => (
                    <div key={promo.id} className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{promo.cargo_anterior_nome}</Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            {promo.cargo_novo_nome}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(parse(promo.data_promocao, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                        {promo.observacoes && (
                          <p className="text-sm mt-1">{promo.observacoes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Histórico de Salário */}
          {viewingHistoricoSalario.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Histórico de Alterações Salariais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {viewingHistoricoSalario.map((item) => (
                    <div key={item.id} className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">
                            {Number(item.salario_anterior).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {Number(item.salario_novo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(item.data_alteracao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                        {item.observacao && (
                          <p className="text-sm mt-1">{item.observacao}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Histórico de Pagamentos */}
          {viewingPagamentos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Histórico de Pagamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês Referência</TableHead>
                      <TableHead>Valor Líquido</TableHead>
                      <TableHead>Data Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingPagamentos.map((pag) => (
                      <TableRow key={pag.id}>
                        <TableCell>
                          {format(new Date(pag.mes_referencia), "MMMM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {Number(pag.total_liquido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                        <TableCell>
                          {pag.data_pagamento 
                            ? format(new Date(pag.data_pagamento), "dd/MM/yyyy") 
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={pag.status === 'processado' ? 'default' : 'outline'}>
                            {pag.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Contratos Registrados */}
          {viewingContratos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSignature className="w-5 h-5" />
                  Contratos Registrados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingContratos.map((contrato) => (
                      <TableRow key={contrato.id}>
                        <TableCell>{contrato.client_name}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{contrato.product_name}</TableCell>
                        <TableCell className="font-medium">
                          {contrato.valor_total 
                            ? Number(contrato.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={contrato.status === 'ativo' ? 'default' : 'outline'}>
                            {contrato.status || 'Pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(contrato.created_at), "dd/MM/yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Alerta de perfil incompleto */}
        {showProfileAlert && !isViewingOther && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-800 dark:text-orange-200">Perfil incompleto</p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Por favor, preencha seus dados de contato (telefone e CPF) para completar seu perfil.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Meu Perfil</h1>
            <p className="text-muted-foreground">Gerencie suas informações pessoais</p>
          </div>
        </div>

        {/* Avatar Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Foto de Perfil
            </CardTitle>
            <CardDescription>
              Escolha uma foto para seu perfil (máximo 5MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24 border-4 border-primary/30">
                <AvatarImage src={avatarPreview || profile?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-2xl">
                  <User className="h-12 w-12" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Formatos aceitos: JPG, PNG, GIF. Tamanho máximo: 5MB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                O e-mail não pode ser alterado
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Cargo</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione seu cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="socio">Sócio</SelectItem>
                  <SelectItem value="advogado">Advogado</SelectItem>
                  <SelectItem value="estagiario">Estagiário</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="administrativo">Administrativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {birthDate ? format(birthDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={birthDate}
                    onSelect={setBirthDate}
                    initialFocus
                    disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building className="w-4 h-4" />
                Data de Ingresso no Escritório
              </Label>
              {isAdmin ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {joinDate ? format(joinDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={joinDate}
                      onSelect={setJoinDate}
                      initialFocus
                      disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <Input
                  value={joinDate ? format(joinDate, 'PPP', { locale: ptBR }) : 'Não informado'}
                  disabled
                  className="bg-muted"
                />
              )}
              {!isAdmin && (
                <p className="text-xs text-muted-foreground">
                  Este campo só pode ser editado por administradores
                </p>
              )}
            </div>

            {showOabFields && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="oabNumber" className="flex items-center gap-2">
                    <IdCard className="w-4 h-4" />
                    Número da OAB
                  </Label>
                  <Input
                    id="oabNumber"
                    value={oabNumber}
                    onChange={(e) => setOabNumber(e.target.value)}
                    placeholder="Ex: 123456"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="oabState">Estado da OAB</Label>
                  <Select value={oabState} onValueChange={setOabState}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRAZILIAN_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Dados de Contato */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Dados de Contato
              {!telefone && !cpf && (
                <span className="text-xs text-orange-600 ml-2">(Obrigatório)</span>
              )}
            </CardTitle>
            <CardDescription>
              Mantenha seus dados de contato atualizados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(31) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>

            <Separator />
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Endereço
              </Label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  value={enderecoCep}
                  onChange={(e) => setEnderecoCep(e.target.value)}
                  placeholder="30000-000"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="logradouro">Logradouro</Label>
                <Input
                  id="logradouro"
                  value={enderecoLogradouro}
                  onChange={(e) => setEnderecoLogradouro(e.target.value)}
                  placeholder="Rua, Avenida, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numero">Número</Label>
                <Input
                  id="numero"
                  value={enderecoNumero}
                  onChange={(e) => setEnderecoNumero(e.target.value)}
                  placeholder="123"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  value={enderecoComplemento}
                  onChange={(e) => setEnderecoComplemento(e.target.value)}
                  placeholder="Apto, Sala, etc."
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={enderecoBairro}
                  onChange={(e) => setEnderecoBairro(e.target.value)}
                  placeholder="Bairro"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={enderecoCidade}
                  onChange={(e) => setEnderecoCidade(e.target.value)}
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Select value={enderecoEstado} onValueChange={setEnderecoEstado}>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={saving || uploadingAvatar}
              className="w-full"
            >
              {saving || uploadingAvatar ? 'Salvando...' : 'Salvar Dados de Contato'}
            </Button>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Alterar Senha
            </CardTitle>
            <CardDescription>
              Escolha uma senha forte com no mínimo 6 caracteres
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nova senha"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme a nova senha"
              />
            </div>

            <Button
              onClick={handleChangePassword}
              disabled={changingPassword}
              variant="secondary"
              className="w-full"
            >
              {changingPassword ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </CardContent>
        </Card>

        {/* Email Notification Settings */}
        <EmailNotificationSettings />

        {/* Jurisprudências Salvas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bookmark className="w-5 h-5" />
                  Jurisprudências Salvas
                </CardTitle>
                <CardDescription>
                  Decisões judiciais salvas para consulta
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/pesquisa-jurisprudencia')}>
                <Search className="w-4 h-4 mr-2" />
                Pesquisar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {jurisprudenceLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando jurisprudências...
              </div>
            ) : savedJurisprudence.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma jurisprudência salva ainda</p>
                <Button 
                  variant="link" 
                  className="mt-2"
                  onClick={() => navigate('/pesquisa-jurisprudencia')}
                >
                  Pesquisar jurisprudência
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {savedJurisprudence.map((item) => (
                  <div 
                    key={item.id} 
                    className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.source && `${item.source} • `}
                          {format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => downloadJurisprudence(item)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDeleteJurisprudence(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {savedJurisprudence.length === 10 && (
                  <Button 
                    variant="link" 
                    className="w-full"
                    onClick={() => navigate('/pesquisa-jurisprudencia')}
                  >
                    Ver todas as jurisprudências salvas
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cargo e Salário Atual */}
        {(cargoAtual || (profile as any)?.salario) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Cargo e Remuneração
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {cargoAtual && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Cargo Atual</Label>
                    <p className="font-medium">{cargoAtual.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      Base: {cargoAtual.valor_base?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                )}
                {(profile as any)?.salario && (
                  <div>
                    <Label className="text-muted-foreground text-sm">
                      {profile?.position === 'advogado' || profile?.position === 'socio' ? 'Pagamento' : 'Salário'}
                    </Label>
                    <p className="font-medium text-lg">
                      {Number((profile as any).salario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Histórico de Promoções do próprio usuário */}
        {promocoes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Histórico de Promoções
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {promocoes.map((promo) => (
                  <div key={promo.id} className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{promo.cargo_anterior_nome}</Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {promo.cargo_novo_nome}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(parse(promo.data_promocao, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                      {promo.observacoes && (
                        <p className="text-sm mt-1">{promo.observacoes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Histórico de Salário */}
        {historicoSalario.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Histórico de Alterações Salariais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {historicoSalario.map((item) => (
                  <div key={item.id} className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">
                          {Number(item.salario_anterior).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {Number(item.salario_novo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(new Date(item.data_alteracao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                      {item.observacao && (
                        <p className="text-sm mt-1">{item.observacao}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Histórico de Pagamentos */}
        {pagamentos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Histórico de Pagamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês Referência</TableHead>
                    <TableHead>Valor Líquido</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagamentos.map((pag) => (
                    <TableRow key={pag.id}>
                      <TableCell>
                        {format(new Date(pag.mes_referencia), "MMMM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {Number(pag.total_liquido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      <TableCell>
                        {pag.data_pagamento 
                          ? format(new Date(pag.data_pagamento), "dd/MM/yyyy") 
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={pag.status === 'processado' ? 'default' : 'outline'}>
                          {pag.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Contratos Registrados */}
        {contratos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="w-5 h-5" />
                Meus Contratos Registrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contratos.map((contrato) => (
                    <TableRow key={contrato.id}>
                      <TableCell>{contrato.client_name}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{contrato.product_name}</TableCell>
                      <TableCell className="font-medium">
                        {contrato.valor_total 
                          ? Number(contrato.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={contrato.status === 'ativo' ? 'default' : 'outline'}>
                          {contrato.status || 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(contrato.created_at), "dd/MM/yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Usage History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Histórico de Uso
            </CardTitle>
            <CardDescription>
              Últimas 50 ações realizadas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando histórico...
              </div>
            ) : usageHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma ação registrada ainda
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {usageHistory.map((item) => (
                  <div key={item.id}>
                    <div className="border-l-2 border-primary/30 pl-4 py-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium">{item.tool_name}</p>
                          <p className="text-sm text-muted-foreground">{item.action}</p>
                          {item.metadata && Object.keys(item.metadata).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {JSON.stringify(item.metadata).substring(0, 100)}
                              {JSON.stringify(item.metadata).length > 100 ? '...' : ''}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <Separator className="my-2" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Caixinha de Desabafo */}
        <FeedbackBox />
      </div>
    </Layout>
  );
}
