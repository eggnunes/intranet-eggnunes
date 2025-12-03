import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Upload, Search, Users, UserPlus, FileText, Calendar, 
  CheckCircle, XCircle, Clock, AlertTriangle, History,
  MessageSquare, Trash2, Eye, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';

type RecruitmentStage = 
  | 'curriculo_recebido'
  | 'entrevista_agendada'
  | 'entrevista_realizada'
  | 'aguardando_prova'
  | 'prova_realizada'
  | 'entrevista_presencial_agendada'
  | 'entrevista_presencial_realizada'
  | 'contratado'
  | 'eliminado';

type EliminationReason = 
  | 'sem_interesse_candidato'
  | 'sem_interesse_escritorio'
  | 'reprovado_entrevista'
  | 'reprovado_prova'
  | 'reprovado_entrevista_presencial'
  | 'outro';

interface Candidate {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  position_applied: string | null;
  resume_url: string | null;
  resume_file_name: string | null;
  current_stage: RecruitmentStage;
  is_active: boolean;
  elimination_reason: EliminationReason | null;
  elimination_notes: string | null;
  interview_date: string | null;
  test_date: string | null;
  test_score: number | null;
  in_person_interview_date: string | null;
  hired_date: string | null;
  extracted_data: any;
  created_at: string;
  updated_at: string;
}

interface StageHistory {
  id: string;
  from_stage: RecruitmentStage | null;
  to_stage: RecruitmentStage;
  notes: string | null;
  created_at: string;
  changed_by: string;
}

interface CandidateNote {
  id: string;
  content: string;
  created_at: string;
  created_by: string;
}

const STAGE_LABELS: Record<RecruitmentStage, string> = {
  curriculo_recebido: 'Currículo Recebido',
  entrevista_agendada: 'Entrevista Agendada',
  entrevista_realizada: 'Entrevista Realizada',
  aguardando_prova: 'Aguardando Prova',
  prova_realizada: 'Prova Realizada',
  entrevista_presencial_agendada: 'Entrevista Presencial Agendada',
  entrevista_presencial_realizada: 'Entrevista Presencial Realizada',
  contratado: 'Contratado',
  eliminado: 'Eliminado'
};

const STAGE_COLORS: Record<RecruitmentStage, string> = {
  curriculo_recebido: 'bg-blue-500',
  entrevista_agendada: 'bg-yellow-500',
  entrevista_realizada: 'bg-orange-500',
  aguardando_prova: 'bg-purple-500',
  prova_realizada: 'bg-indigo-500',
  entrevista_presencial_agendada: 'bg-cyan-500',
  entrevista_presencial_realizada: 'bg-teal-500',
  contratado: 'bg-green-500',
  eliminado: 'bg-red-500'
};

const ELIMINATION_LABELS: Record<EliminationReason, string> = {
  sem_interesse_candidato: 'Sem interesse do candidato',
  sem_interesse_escritorio: 'Sem interesse do escritório',
  reprovado_entrevista: 'Reprovado na entrevista',
  reprovado_prova: 'Reprovado na prova',
  reprovado_entrevista_presencial: 'Reprovado na entrevista presencial',
  outro: 'Outro motivo'
};

export default function Contratacao() {
  const { role, loading: roleLoading } = useUserRole();
  const { hasPermission, loading: permLoading } = useAdminPermissions();
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [uploading, setUploading] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidateHistory, setCandidateHistory] = useState<StageHistory[]>([]);
  const [candidateNotes, setCandidateNotes] = useState<CandidateNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualCandidate, setManualCandidate] = useState({
    full_name: '',
    email: '',
    phone: '',
    position_applied: ''
  });

  const isAdmin = role === 'admin';
  const canView = isAdmin && hasPermission('recruitment', 'view');
  const canEdit = isAdmin && hasPermission('recruitment', 'edit');

  useEffect(() => {
    if (canView) {
      fetchCandidates();
    }
  }, [canView]);

  const fetchCandidates = async () => {
    try {
      const { data, error } = await supabase
        .from('recruitment_candidates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCandidates(data || []);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast.error('Erro ao carregar candidatos');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const file of Array.from(files)) {
      if (file.type !== 'application/pdf') {
        toast.error(`${file.name} não é um arquivo PDF`);
        errorCount++;
        continue;
      }

      try {
        // Convert to base64
        const base64 = await fileToBase64(file);

        // Parse resume with AI
        const { data: extractedData, error: parseError } = await supabase.functions.invoke('parse-resume', {
          body: { fileBase64: base64, fileName: file.name }
        });

        if (parseError) {
          console.error('Parse error:', parseError);
          toast.error(`Erro ao processar ${file.name}`);
          errorCount++;
          continue;
        }

        // Check for duplicates
        const { data: existing } = await supabase
          .from('recruitment_candidates')
          .select('id, full_name, current_stage, created_at')
          .or(`email.eq.${extractedData.email},full_name.ilike.%${extractedData.full_name}%`)
          .limit(1);

        if (existing && existing.length > 0) {
          const existingCandidate = existing[0];
          toast.warning(
            `${extractedData.full_name} já existe no banco de dados (${STAGE_LABELS[existingCandidate.current_stage as RecruitmentStage]})`,
            { duration: 5000 }
          );
        }

        // Upload file to storage
        const filePath = `${crypto.randomUUID()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
        }

        // Create candidate record
        const { error: insertError } = await supabase
          .from('recruitment_candidates')
          .insert({
            full_name: extractedData.full_name || 'Nome não identificado',
            email: extractedData.email || null,
            phone: extractedData.phone || null,
            position_applied: extractedData.position_applied || null,
            resume_url: filePath,
            resume_file_name: file.name,
            extracted_data: extractedData,
            created_by: user.id
          });

        if (insertError) throw insertError;

        successCount++;
      } catch (error) {
        console.error('Error processing file:', error);
        toast.error(`Erro ao processar ${file.name}`);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} currículo(s) processado(s) com sucesso`);
      fetchCandidates();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} arquivo(s) com erro`);
    }

    setUploading(false);
    e.target.value = '';
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleAddManualCandidate = async () => {
    if (!user || !manualCandidate.full_name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      // Check for duplicates
      const { data: existing } = await supabase
        .from('recruitment_candidates')
        .select('id, full_name, current_stage')
        .or(`email.eq.${manualCandidate.email},full_name.ilike.%${manualCandidate.full_name}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        toast.warning(
          `${manualCandidate.full_name} já pode existir no banco de dados`,
          { duration: 5000 }
        );
      }

      const { error } = await supabase
        .from('recruitment_candidates')
        .insert({
          full_name: manualCandidate.full_name,
          email: manualCandidate.email || null,
          phone: manualCandidate.phone || null,
          position_applied: manualCandidate.position_applied || null,
          created_by: user.id
        });

      if (error) throw error;

      toast.success('Candidato adicionado com sucesso');
      setShowAddManual(false);
      setManualCandidate({ full_name: '', email: '', phone: '', position_applied: '' });
      fetchCandidates();
    } catch (error) {
      console.error('Error adding candidate:', error);
      toast.error('Erro ao adicionar candidato');
    }
  };

  const handleStageChange = async (candidateId: string, newStage: RecruitmentStage, notes?: string) => {
    if (!user) return;

    try {
      const candidate = candidates.find(c => c.id === candidateId);
      if (!candidate) return;

      // Insert history record
      await supabase.from('recruitment_stage_history').insert({
        candidate_id: candidateId,
        from_stage: candidate.current_stage,
        to_stage: newStage,
        changed_by: user.id,
        notes: notes || null
      });

      // Update candidate
      const updateData: any = { current_stage: newStage };
      
      if (newStage === 'eliminado') {
        updateData.is_active = false;
      }
      if (newStage === 'contratado') {
        updateData.hired_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('recruitment_candidates')
        .update(updateData)
        .eq('id', candidateId);

      if (error) throw error;

      toast.success('Estágio atualizado');
      fetchCandidates();
      
      if (selectedCandidate?.id === candidateId) {
        fetchCandidateDetails(candidateId);
      }
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error('Erro ao atualizar estágio');
    }
  };

  const handleEliminate = async (candidateId: string, reason: EliminationReason, notes: string) => {
    if (!user) return;

    try {
      const candidate = candidates.find(c => c.id === candidateId);
      if (!candidate) return;

      await supabase.from('recruitment_stage_history').insert({
        candidate_id: candidateId,
        from_stage: candidate.current_stage,
        to_stage: 'eliminado',
        changed_by: user.id,
        notes: `${ELIMINATION_LABELS[reason]}${notes ? `: ${notes}` : ''}`
      });

      const { error } = await supabase
        .from('recruitment_candidates')
        .update({
          current_stage: 'eliminado',
          is_active: false,
          elimination_reason: reason,
          elimination_notes: notes || null
        })
        .eq('id', candidateId);

      if (error) throw error;

      toast.success('Candidato eliminado do processo');
      fetchCandidates();
    } catch (error) {
      console.error('Error eliminating candidate:', error);
      toast.error('Erro ao eliminar candidato');
    }
  };

  const fetchCandidateDetails = async (candidateId: string) => {
    try {
      const [historyRes, notesRes] = await Promise.all([
        supabase
          .from('recruitment_stage_history')
          .select('*')
          .eq('candidate_id', candidateId)
          .order('created_at', { ascending: false }),
        supabase
          .from('recruitment_notes')
          .select('*')
          .eq('candidate_id', candidateId)
          .order('created_at', { ascending: false })
      ]);

      setCandidateHistory(historyRes.data || []);
      setCandidateNotes(notesRes.data || []);
    } catch (error) {
      console.error('Error fetching details:', error);
    }
  };

  const handleAddNote = async () => {
    if (!user || !selectedCandidate || !newNote.trim()) return;

    try {
      const { error } = await supabase
        .from('recruitment_notes')
        .insert({
          candidate_id: selectedCandidate.id,
          content: newNote,
          created_by: user.id
        });

      if (error) throw error;

      toast.success('Observação adicionada');
      setNewNote('');
      fetchCandidateDetails(selectedCandidate.id);
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Erro ao adicionar observação');
    }
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    if (!confirm('Tem certeza que deseja excluir este candidato?')) return;

    try {
      const candidate = candidates.find(c => c.id === candidateId);
      
      // Delete resume from storage if exists
      if (candidate?.resume_url) {
        await supabase.storage.from('resumes').remove([candidate.resume_url]);
      }

      const { error } = await supabase
        .from('recruitment_candidates')
        .delete()
        .eq('id', candidateId);

      if (error) throw error;

      toast.success('Candidato excluído');
      setSelectedCandidate(null);
      fetchCandidates();
    } catch (error) {
      console.error('Error deleting candidate:', error);
      toast.error('Erro ao excluir candidato');
    }
  };

  const downloadResume = async (resumeUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('resumes')
        .download(resumeUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading resume:', error);
      toast.error('Erro ao baixar currículo');
    }
  };

  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = 
      c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.position_applied?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStage = stageFilter === 'all' || c.current_stage === stageFilter;
    
    return matchesSearch && matchesStage;
  });

  const stats = {
    total: candidates.length,
    active: candidates.filter(c => c.is_active).length,
    hired: candidates.filter(c => c.current_stage === 'contratado').length,
    eliminated: candidates.filter(c => c.current_stage === 'eliminado').length
  };

  if (roleLoading || permLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!canView) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gestão de Contratação</h1>
            <p className="text-muted-foreground">Banco de currículos e processo seletivo</p>
          </div>
          
          {canEdit && (
            <div className="flex gap-2">
              <Button onClick={() => setShowAddManual(true)} variant="outline">
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar Manual
              </Button>
              <Button asChild className="relative">
                <label>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Processando...' : 'Upload Currículos'}
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>
              </Button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-sm text-muted-foreground">Em Processo</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.hired}</p>
                  <p className="text-sm text-muted-foreground">Contratados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.eliminated}</p>
                  <p className="text-sm text-muted-foreground">Eliminados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar por estágio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estágios</SelectItem>
              {Object.entries(STAGE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Candidates List */}
        <div className="grid gap-4">
          {filteredCandidates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum candidato encontrado</p>
              </CardContent>
            </Card>
          ) : (
            filteredCandidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                canEdit={canEdit}
                onSelect={(c) => {
                  setSelectedCandidate(c);
                  fetchCandidateDetails(c.id);
                }}
                onStageChange={handleStageChange}
                onEliminate={handleEliminate}
                onDownloadResume={downloadResume}
              />
            ))
          )}
        </div>

        {/* Manual Add Dialog */}
        <Dialog open={showAddManual} onOpenChange={setShowAddManual}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Candidato Manualmente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome Completo *</Label>
                <Input
                  value={manualCandidate.full_name}
                  onChange={(e) => setManualCandidate({ ...manualCandidate, full_name: e.target.value })}
                  placeholder="Nome do candidato"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={manualCandidate.email}
                  onChange={(e) => setManualCandidate({ ...manualCandidate, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={manualCandidate.phone}
                  onChange={(e) => setManualCandidate({ ...manualCandidate, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label>Cargo Pretendido</Label>
                <Input
                  value={manualCandidate.position_applied}
                  onChange={(e) => setManualCandidate({ ...manualCandidate, position_applied: e.target.value })}
                  placeholder="Ex: Advogado, Estagiário..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddManual(false)}>Cancelar</Button>
                <Button onClick={handleAddManualCandidate}>Adicionar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Candidate Details Dialog */}
        <Dialog open={!!selectedCandidate} onOpenChange={(open) => !open && setSelectedCandidate(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {selectedCandidate && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {selectedCandidate.full_name}
                    <Badge className={STAGE_COLORS[selectedCandidate.current_stage]}>
                      {STAGE_LABELS[selectedCandidate.current_stage]}
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="info">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="info">Informações</TabsTrigger>
                    <TabsTrigger value="history">Histórico</TabsTrigger>
                    <TabsTrigger value="notes">Observações</TabsTrigger>
                  </TabsList>

                  <TabsContent value="info" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Email</Label>
                        <p>{selectedCandidate.email || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Telefone</Label>
                        <p>{selectedCandidate.phone || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Cargo Pretendido</Label>
                        <p>{selectedCandidate.position_applied || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Cadastrado em</Label>
                        <p>{format(new Date(selectedCandidate.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                      </div>
                    </div>

                    {selectedCandidate.resume_url && (
                      <Button 
                        variant="outline" 
                        onClick={() => downloadResume(selectedCandidate.resume_url!, selectedCandidate.resume_file_name || 'curriculo.pdf')}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Baixar Currículo
                      </Button>
                    )}

                    {selectedCandidate.extracted_data?.summary && (
                      <div>
                        <Label className="text-muted-foreground">Resumo Extraído</Label>
                        <p className="text-sm bg-muted p-3 rounded-md">{selectedCandidate.extracted_data.summary}</p>
                      </div>
                    )}

                    {selectedCandidate.elimination_reason && (
                      <div className="bg-destructive/10 p-4 rounded-md">
                        <Label className="text-destructive">Motivo da Eliminação</Label>
                        <p>{ELIMINATION_LABELS[selectedCandidate.elimination_reason]}</p>
                        {selectedCandidate.elimination_notes && (
                          <p className="text-sm text-muted-foreground mt-1">{selectedCandidate.elimination_notes}</p>
                        )}
                      </div>
                    )}

                    {canEdit && (
                      <Button 
                        variant="destructive" 
                        onClick={() => handleDeleteCandidate(selectedCandidate.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir Candidato
                      </Button>
                    )}
                  </TabsContent>

                  <TabsContent value="history" className="space-y-4">
                    {candidateHistory.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Nenhum histórico registrado</p>
                    ) : (
                      <div className="space-y-3">
                        {candidateHistory.map((h) => (
                          <div key={h.id} className="flex items-start gap-3 p-3 bg-muted rounded-md">
                            <History className="h-4 w-4 mt-1 text-muted-foreground" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {h.from_stage && (
                                  <>
                                    <Badge variant="outline">{STAGE_LABELS[h.from_stage]}</Badge>
                                    <span>→</span>
                                  </>
                                )}
                                <Badge className={STAGE_COLORS[h.to_stage]}>{STAGE_LABELS[h.to_stage]}</Badge>
                              </div>
                              {h.notes && <p className="text-sm text-muted-foreground mt-1">{h.notes}</p>}
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="notes" className="space-y-4">
                    {canEdit && (
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Adicionar observação..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          className="flex-1"
                        />
                        <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {candidateNotes.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Nenhuma observação</p>
                    ) : (
                      <div className="space-y-3">
                        {candidateNotes.map((note) => (
                          <div key={note.id} className="p-3 bg-muted rounded-md">
                            <p>{note.content}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

// Candidate Card Component
function CandidateCard({ 
  candidate, 
  canEdit, 
  onSelect, 
  onStageChange, 
  onEliminate,
  onDownloadResume 
}: { 
  candidate: Candidate;
  canEdit: boolean;
  onSelect: (c: Candidate) => void;
  onStageChange: (id: string, stage: RecruitmentStage, notes?: string) => void;
  onEliminate: (id: string, reason: EliminationReason, notes: string) => void;
  onDownloadResume: (url: string, name: string) => void;
}) {
  const [showEliminate, setShowEliminate] = useState(false);
  const [eliminationReason, setEliminationReason] = useState<EliminationReason>('outro');
  const [eliminationNotes, setEliminationNotes] = useState('');

  const getNextStages = (currentStage: RecruitmentStage): RecruitmentStage[] => {
    const stageFlow: Record<RecruitmentStage, RecruitmentStage[]> = {
      curriculo_recebido: ['entrevista_agendada'],
      entrevista_agendada: ['entrevista_realizada'],
      entrevista_realizada: ['aguardando_prova'],
      aguardando_prova: ['prova_realizada'],
      prova_realizada: ['entrevista_presencial_agendada'],
      entrevista_presencial_agendada: ['entrevista_presencial_realizada'],
      entrevista_presencial_realizada: ['contratado'],
      contratado: [],
      eliminado: []
    };
    return stageFlow[currentStage] || [];
  };

  const nextStages = getNextStages(candidate.current_stage);

  return (
    <Card className={!candidate.is_active ? 'opacity-60' : ''}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{candidate.full_name}</h3>
              <Badge className={STAGE_COLORS[candidate.current_stage]}>
                {STAGE_LABELS[candidate.current_stage]}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground mt-1 space-y-1">
              {candidate.email && <p>{candidate.email}</p>}
              {candidate.phone && <p>{candidate.phone}</p>}
              {candidate.position_applied && <p>Cargo: {candidate.position_applied}</p>}
              <p className="text-xs">
                Cadastrado em {format(new Date(candidate.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-start">
            {candidate.resume_url && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onDownloadResume(candidate.resume_url!, candidate.resume_file_name || 'curriculo.pdf')}
              >
                <FileText className="h-4 w-4" />
              </Button>
            )}
            
            <Button size="sm" variant="outline" onClick={() => onSelect(candidate)}>
              <Eye className="h-4 w-4 mr-1" />
              Ver Detalhes
            </Button>

            {canEdit && candidate.is_active && (
              <>
                {nextStages.map((stage) => (
                  <Button 
                    key={stage}
                    size="sm" 
                    onClick={() => onStageChange(candidate.id, stage)}
                  >
                    {STAGE_LABELS[stage]}
                  </Button>
                ))}

                <Dialog open={showEliminate} onOpenChange={setShowEliminate}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="destructive">
                      <XCircle className="h-4 w-4 mr-1" />
                      Eliminar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Eliminar Candidato</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Motivo da Eliminação</Label>
                        <Select value={eliminationReason} onValueChange={(v) => setEliminationReason(v as EliminationReason)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ELIMINATION_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Observações</Label>
                        <Textarea
                          value={eliminationNotes}
                          onChange={(e) => setEliminationNotes(e.target.value)}
                          placeholder="Detalhes adicionais..."
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowEliminate(false)}>Cancelar</Button>
                        <Button 
                          variant="destructive" 
                          onClick={() => {
                            onEliminate(candidate.id, eliminationReason, eliminationNotes);
                            setShowEliminate(false);
                          }}
                        >
                          Confirmar Eliminação
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
