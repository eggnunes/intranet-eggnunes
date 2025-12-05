import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Upload, Search, Users, UserPlus, FileText, Calendar, 
  CheckCircle, XCircle, Clock, AlertTriangle, History,
  MessageSquare, Trash2, Eye, Filter, Briefcase, Plus,
  TrendingUp, BarChart3, Video, MapPin, Star, Paperclip,
  CalendarDays, FolderOpen, Sparkles, Loader2, Download, 
  Database, UserCheck, Archive, GitCompare, Check, Edit, Mail, Phone,
  LayoutGrid, List
} from 'lucide-react';
import { format, differenceInDays, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { RecruitmentKanban } from '@/components/RecruitmentKanban';

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

interface JobOpening {
  id: string;
  title: string;
  position: string;
  description: string | null;
  requirements: string | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
}

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
  job_opening_id: string | null;
  previous_job_opening_id: string | null;
  is_future_hire_candidate: boolean;
  future_hire_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Interview {
  id: string;
  candidate_id: string;
  interview_type: string;
  scheduled_date: string;
  duration_minutes: number;
  location: string | null;
  meeting_link: string | null;
  interviewer_ids: string[];
  notes: string | null;
  status: string;
  feedback: string | null;
  rating: number | null;
  created_at: string;
}

interface CandidateDocument {
  id: string;
  candidate_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  document_type: string;
  created_at: string;
}

interface StageHistory {
  id: string;
  from_stage: RecruitmentStage | null;
  to_stage: RecruitmentStage;
  notes: string | null;
  created_at: string;
}

interface CandidateNote {
  id: string;
  content: string;
  created_at: string;
}

interface PositionTemplate {
  id: string;
  position: string;
  description: string | null;
  requirements: string | null;
  created_at: string;
}

interface InterviewFeedback {
  id: string;
  interview_id: string;
  evaluator_id: string;
  technical_skills: number | null;
  communication: number | null;
  cultural_fit: number | null;
  problem_solving: number | null;
  experience: number | null;
  motivation: number | null;
  overall_rating: number | null;
  recommendation: string | null;
  strengths: string | null;
  weaknesses: string | null;
  additional_notes: string | null;
  created_at: string;
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  strong_yes: 'Fortemente Recomendado',
  yes: 'Recomendado',
  maybe: 'Talvez',
  no: 'Não Recomendado',
  strong_no: 'Fortemente Não Recomendado'
};

const EVALUATION_CRITERIA = [
  { key: 'technical_skills', label: 'Conhecimentos Técnicos' },
  { key: 'communication', label: 'Comunicação' },
  { key: 'cultural_fit', label: 'Fit Cultural' },
  { key: 'problem_solving', label: 'Resolução de Problemas' },
  { key: 'experience', label: 'Experiência' },
  { key: 'motivation', label: 'Motivação' },
];

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

const DOCUMENT_TYPES = [
  { value: 'certificado', label: 'Certificado' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'comprovante_residencia', label: 'Comprovante de Residência' },
  { value: 'documento_identidade', label: 'Documento de Identidade' },
  { value: 'portfolio', label: 'Portfólio' },
  { value: 'carta_recomendacao', label: 'Carta de Recomendação' },
  { value: 'outro', label: 'Outro' },
];

export default function Contratacao() {
  const { role, loading: roleLoading } = useUserRole();
  const { hasPermission, loading: permLoading } = useAdminPermissions();
  const { user } = useAuth();
  
  // Data states
  const [jobOpenings, setJobOpenings] = useState<JobOpening[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [positionTemplates, setPositionTemplates] = useState<PositionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI states
  const [activeTab, setActiveTab] = useState('vagas');
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [jobOpeningFilter, setJobOpeningFilter] = useState<string>('all');
  const [talentPoolFilter, setTalentPoolFilter] = useState<string>('all');
  const [talentPoolSearch, setTalentPoolSearch] = useState('');
  const [talentPoolSort, setTalentPoolSort] = useState<string>('date_desc');
  const [talentPoolPositionFilter, setTalentPoolPositionFilter] = useState<string>('all');
  const [candidatesViewMode, setCandidatesViewMode] = useState<'list' | 'kanban'>('list');
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploading, setUploading] = useState(false);
  
  // Selected items
  const [selectedJobOpening, setSelectedJobOpening] = useState<JobOpening | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidateHistory, setCandidateHistory] = useState<StageHistory[]>([]);
  const [candidateNotes, setCandidateNotes] = useState<CandidateNote[]>([]);
  const [candidateDocuments, setCandidateDocuments] = useState<CandidateDocument[]>([]);
  const [candidateInterviews, setCandidateInterviews] = useState<Interview[]>([]);
  const [interviewFeedbacks, setInterviewFeedbacks] = useState<Record<string, InterviewFeedback[]>>({});
  
  // Dialog states
  const [showAddJobOpening, setShowAddJobOpening] = useState(false);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [showScheduleInterview, setShowScheduleInterview] = useState(false);
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showSendToTalentPool, setShowSendToTalentPool] = useState(false);
  const [talentPoolCandidate, setTalentPoolCandidate] = useState<Candidate | null>(null);
  const [talentPoolNotes, setTalentPoolNotes] = useState('');
  const [showEditPosition, setShowEditPosition] = useState(false);
  const [editPositionCandidate, setEditPositionCandidate] = useState<Candidate | null>(null);
  const [editPositionValue, setEditPositionValue] = useState('');
  const [showEditContact, setShowEditContact] = useState(false);
  const [editContactCandidate, setEditContactCandidate] = useState<Candidate | null>(null);
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  
  // Preview state
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewFilePath, setPreviewFilePath] = useState('');
  
  // Comparison state
  const [compareList, setCompareList] = useState<string[]>([]);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  
  // Form states
  const [newJobOpening, setNewJobOpening] = useState({ title: '', position: '', description: '', requirements: '', saveAsTemplate: false });
  const [newCandidate, setNewCandidate] = useState({ full_name: '', email: '', phone: '', position_applied: '', job_opening_id: '' });
  const [newInterview, setNewInterview] = useState({ interview_type: 'online', scheduled_date: '', duration_minutes: 60, location: '', meeting_link: '', notes: '' });
  const [newNote, setNewNote] = useState('');
  const [suggestingJobOpening, setSuggestingJobOpening] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    technical_skills: 3,
    communication: 3,
    cultural_fit: 3,
    problem_solving: 3,
    experience: 3,
    motivation: 3,
    overall_rating: 3,
    recommendation: 'maybe',
    strengths: '',
    weaknesses: '',
    additional_notes: ''
  });

  const isAdmin = role === 'admin';
  const canView = isAdmin && hasPermission('recruitment', 'view');
  const canEdit = isAdmin && hasPermission('recruitment', 'edit');

  useEffect(() => {
    if (canView) {
      fetchData();
    }
  }, [canView]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchJobOpenings(),
      fetchCandidates(),
      fetchInterviews(),
      fetchPositionTemplates()
    ]);
    setLoading(false);
  };

  const fetchJobOpenings = async () => {
    const { data, error } = await supabase
      .from('recruitment_job_openings')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setJobOpenings(data || []);
  };

  const fetchCandidates = async () => {
    const { data, error } = await supabase
      .from('recruitment_candidates')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setCandidates(data || []);
  };

  const fetchInterviews = async () => {
    const { data, error } = await supabase
      .from('recruitment_interviews')
      .select('*')
      .order('scheduled_date', { ascending: true });
    if (!error) setInterviews(data || []);
  };

  const fetchPositionTemplates = async () => {
    const { data, error } = await supabase
      .from('recruitment_position_templates')
      .select('*')
      .order('position', { ascending: true });
    if (!error) setPositionTemplates(data || []);
  };

  const handleCreateJobOpening = async () => {
    if (!user || !newJobOpening.title || !newJobOpening.position) {
      toast.error('Título e cargo são obrigatórios');
      return;
    }

    // Save template if requested
    if (newJobOpening.saveAsTemplate && (newJobOpening.description || newJobOpening.requirements)) {
      const existingTemplate = positionTemplates.find(t => t.position === newJobOpening.position);
      if (existingTemplate) {
        await supabase.from('recruitment_position_templates')
          .update({ 
            description: newJobOpening.description, 
            requirements: newJobOpening.requirements,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTemplate.id);
      } else {
        await supabase.from('recruitment_position_templates').insert({
          position: newJobOpening.position,
          description: newJobOpening.description,
          requirements: newJobOpening.requirements,
          created_by: user.id
        });
      }
      fetchPositionTemplates();
    }

    const { title, position, description, requirements } = newJobOpening;
    const { error } = await supabase.from('recruitment_job_openings').insert({
      title,
      position,
      description,
      requirements,
      created_by: user.id
    });

    if (error) {
      toast.error('Erro ao criar vaga');
      return;
    }

    toast.success('Vaga criada com sucesso');
    setShowAddJobOpening(false);
    setNewJobOpening({ title: '', position: '', description: '', requirements: '', saveAsTemplate: false });
    fetchJobOpenings();
  };

  const handleLoadTemplate = (position: string) => {
    const template = positionTemplates.find(t => t.position === position);
    if (template) {
      setNewJobOpening(prev => ({
        ...prev,
        description: template.description || '',
        requirements: template.requirements || ''
      }));
      toast.success('Template carregado');
    }
  };

  const handleSaveFeedback = async () => {
    if (!user || !selectedInterview) return;

    const { error } = await supabase.from('recruitment_interview_feedback').insert({
      interview_id: selectedInterview.id,
      evaluator_id: user.id,
      ...feedbackForm
    });

    if (error) {
      if (error.code === '23505') {
        // Update existing feedback
        const { error: updateError } = await supabase
          .from('recruitment_interview_feedback')
          .update(feedbackForm)
          .eq('interview_id', selectedInterview.id)
          .eq('evaluator_id', user.id);
        if (updateError) {
          toast.error('Erro ao atualizar avaliação');
          return;
        }
      } else {
        toast.error('Erro ao salvar avaliação');
        return;
      }
    }

    // Update interview status
    await supabase.from('recruitment_interviews')
      .update({ status: 'completed', rating: feedbackForm.overall_rating, feedback: feedbackForm.additional_notes })
      .eq('id', selectedInterview.id);

    toast.success('Avaliação salva com sucesso');
    setShowFeedbackDialog(false);
    setSelectedInterview(null);
    if (selectedCandidate) fetchCandidateDetails(selectedCandidate.id);
    fetchInterviews();
  };

  const fetchInterviewFeedbacks = async (interviewIds: string[]) => {
    if (interviewIds.length === 0) return;
    const { data } = await supabase
      .from('recruitment_interview_feedback')
      .select('*')
      .in('interview_id', interviewIds);
    if (data) {
      const grouped = data.reduce((acc, fb) => {
        if (!acc[fb.interview_id]) acc[fb.interview_id] = [];
        acc[fb.interview_id].push(fb);
        return acc;
      }, {} as Record<string, InterviewFeedback[]>);
      setInterviewFeedbacks(grouped);
    }
  };

  const handleSuggestJobOpening = async () => {
    if (!newJobOpening.title && !newJobOpening.position) {
      toast.error('Preencha o título ou cargo para gerar sugestões');
      return;
    }

    setSuggestingJobOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-job-opening', {
        body: { title: newJobOpening.title, position: newJobOpening.position }
      });

      if (error) {
        throw error;
      }

      if (data?.description || data?.requirements) {
        setNewJobOpening(prev => ({
          ...prev,
          description: data.description || prev.description,
          requirements: data.requirements || prev.requirements
        }));
        toast.success('Sugestões geradas com IA');
      }
    } catch (error) {
      console.error('Error suggesting job opening:', error);
      toast.error('Erro ao gerar sugestões');
    } finally {
      setSuggestingJobOpening(false);
    }
  };

  const handleCloseJobOpening = async (id: string) => {
    const { error } = await supabase
      .from('recruitment_job_openings')
      .update({ status: 'closed', closed_at: new Date().toISOString().split('T')[0] })
      .eq('id', id);

    if (!error) {
      toast.success('Vaga encerrada');
      fetchJobOpenings();
    }
  };

  const handleDeleteJobOpening = async (id: string) => {
    const joCandidates = candidates.filter(c => c.job_opening_id === id);
    if (joCandidates.length > 0) {
      toast.error(`Não é possível excluir. Existem ${joCandidates.length} candidato(s) vinculados a esta vaga.`);
      return;
    }

    const { error } = await supabase
      .from('recruitment_job_openings')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir vaga');
      return;
    }

    toast.success('Vaga excluída');
    fetchJobOpenings();
  };

  const handleDeleteCandidate = async (candidate: Candidate) => {
    // Delete resume from storage if exists
    if (candidate.resume_url) {
      await supabase.storage.from('resumes').remove([candidate.resume_url]);
    }

    // Delete candidate documents from storage
    const { data: docs } = await supabase
      .from('recruitment_candidate_documents')
      .select('file_url')
      .eq('candidate_id', candidate.id);
    
    if (docs && docs.length > 0) {
      await supabase.storage.from('resumes').remove(docs.map(d => d.file_url));
    }

    // Delete related records
    await Promise.all([
      supabase.from('recruitment_candidate_documents').delete().eq('candidate_id', candidate.id),
      supabase.from('recruitment_notes').delete().eq('candidate_id', candidate.id),
      supabase.from('recruitment_stage_history').delete().eq('candidate_id', candidate.id),
      supabase.from('recruitment_interviews').delete().eq('candidate_id', candidate.id)
    ]);

    // Delete candidate
    const { error } = await supabase
      .from('recruitment_candidates')
      .delete()
      .eq('id', candidate.id);

    if (error) {
      toast.error('Erro ao excluir candidato');
      return;
    }

    toast.success('Candidato excluído');
    setSelectedCandidate(null);
    fetchCandidates();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, jobOpeningId?: string) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    const fileList = Array.from(files).filter(file => {
      if (file.type !== 'application/pdf') {
        toast.error(`${file.name} não é um arquivo PDF`);
        return false;
      }
      return true;
    });

    if (fileList.length === 0) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: fileList.length });
    let successCount = 0;

    // Process files sequentially with delay to avoid overwhelming the API
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setUploadProgress({ current: i + 1, total: fileList.length });
      
      try {
        // Add delay between requests (except for the first one)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        const base64 = await fileToBase64(file);
        
        console.log(`Processing file ${i + 1}/${fileList.length}: ${file.name}`);
        
        const { data: extractedData, error: parseError } = await supabase.functions.invoke('parse-resume', {
          body: { fileBase64: base64, fileName: file.name }
        });

        if (parseError) {
          console.error(`Error parsing ${file.name}:`, parseError);
          toast.error(`Erro ao processar ${file.name}`);
          continue;
        }

        if (!extractedData) {
          console.error(`No data returned for ${file.name}`);
          toast.error(`Não foi possível extrair dados de ${file.name}`);
          continue;
        }

        // Check for duplicates in entire database
        const searchEmail = extractedData.email || '';
        const searchName = extractedData.full_name || '';
        
        if (searchEmail || searchName) {
          const orConditions = [];
          if (searchEmail) orConditions.push(`email.eq.${searchEmail}`);
          if (searchName) orConditions.push(`full_name.ilike.%${searchName}%`);
          
          const { data: existing } = await supabase
            .from('recruitment_candidates')
            .select('id, full_name, current_stage, job_opening_id, created_at')
            .or(orConditions.join(','));

          if (existing && existing.length > 0) {
            const previousProcesses = existing.map(c => {
              const jo = jobOpenings.find(j => j.id === c.job_opening_id);
              return jo ? jo.title : 'Processo anterior';
            });
            toast.warning(
              `${extractedData.full_name || file.name} já participou de processo(s) anterior(es): ${previousProcesses.join(', ')}`,
              { duration: 8000 }
            );
          }
        }

        const filePath = `${crypto.randomUUID()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('resumes').upload(filePath, file);
        
        if (uploadError) {
          console.error(`Error uploading ${file.name}:`, uploadError);
          toast.error(`Erro ao fazer upload de ${file.name}`);
          continue;
        }

        const { error: insertError } = await supabase.from('recruitment_candidates').insert({
          full_name: extractedData.full_name || 'Nome não identificado',
          email: extractedData.email || null,
          phone: extractedData.phone || null,
          position_applied: extractedData.position_applied || null,
          resume_url: filePath,
          resume_file_name: file.name,
          extracted_data: extractedData,
          job_opening_id: jobOpeningId || null,
          created_by: user.id
        });

        if (insertError) {
          console.error(`Error inserting candidate ${file.name}:`, insertError);
          toast.error(`Erro ao salvar candidato de ${file.name}`);
          continue;
        }

        successCount++;
        toast.success(`✓ ${extractedData.full_name || file.name} processado`);
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        toast.error(`Erro ao processar ${file.name}`);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} de ${fileList.length} currículo(s) processado(s) com sucesso!`);
      fetchCandidates();
    } else if (fileList.length > 0) {
      toast.error('Nenhum currículo foi processado com sucesso');
    }
    
    setUploading(false);
    setUploadProgress({ current: 0, total: 0 });
    e.target.value = '';
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
    });
  };

  const handleAddCandidate = async () => {
    if (!user || !newCandidate.full_name) {
      toast.error('Nome é obrigatório');
      return;
    }

    // Check for duplicates
    const { data: existing } = await supabase
      .from('recruitment_candidates')
      .select('id, full_name, job_opening_id')
      .or(`email.eq.${newCandidate.email},full_name.ilike.%${newCandidate.full_name}%`);

    if (existing && existing.length > 0) {
      const previousProcesses = existing.map(c => {
        const jo = jobOpenings.find(j => j.id === c.job_opening_id);
        return jo ? jo.title : 'Processo anterior';
      });
      toast.warning(`Candidato já participou de: ${previousProcesses.join(', ')}`, { duration: 5000 });
    }

    const { error } = await supabase.from('recruitment_candidates').insert({
      ...newCandidate,
      job_opening_id: newCandidate.job_opening_id || null,
      created_by: user.id
    });

    if (!error) {
      toast.success('Candidato adicionado');
      setShowAddCandidate(false);
      setNewCandidate({ full_name: '', email: '', phone: '', position_applied: '', job_opening_id: '' });
      fetchCandidates();
    }
  };

  const handleStageChange = async (candidateId: string, newStage: RecruitmentStage) => {
    if (!user) return;
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;

    await supabase.from('recruitment_stage_history').insert({
      candidate_id: candidateId,
      from_stage: candidate.current_stage,
      to_stage: newStage,
      changed_by: user.id
    });

    const updateData: any = { current_stage: newStage };
    if (newStage === 'eliminado') updateData.is_active = false;
    if (newStage === 'contratado') updateData.hired_date = new Date().toISOString().split('T')[0];

    await supabase.from('recruitment_candidates').update(updateData).eq('id', candidateId);
    toast.success('Estágio atualizado');
    fetchCandidates();
    if (selectedCandidate?.id === candidateId) fetchCandidateDetails(candidateId);
  };

  const handleEliminate = async (candidateId: string, reason: EliminationReason, notes: string) => {
    if (!user) return;
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;

    await supabase.from('recruitment_stage_history').insert({
      candidate_id: candidateId,
      from_stage: candidate.current_stage,
      to_stage: 'eliminado',
      changed_by: user.id,
      notes: `${ELIMINATION_LABELS[reason]}${notes ? `: ${notes}` : ''}`
    });

    await supabase.from('recruitment_candidates').update({
      current_stage: 'eliminado',
      is_active: false,
      elimination_reason: reason,
      elimination_notes: notes || null
    }).eq('id', candidateId);

    toast.success('Candidato eliminado');
    fetchCandidates();
  };

  const handleSendToTalentPool = async () => {
    if (!talentPoolCandidate) return;

    const { error } = await supabase
      .from('recruitment_candidates')
      .update({
        previous_job_opening_id: talentPoolCandidate.job_opening_id,
        job_opening_id: null,
        is_future_hire_candidate: true,
        future_hire_notes: talentPoolNotes || null,
        current_stage: 'curriculo_recebido',
        is_active: true
      })
      .eq('id', talentPoolCandidate.id);

    if (error) {
      toast.error('Erro ao enviar para banco de talentos');
      return;
    }

    toast.success(`${talentPoolCandidate.full_name} enviado ao banco de talentos`);
    setShowSendToTalentPool(false);
    setTalentPoolCandidate(null);
    setTalentPoolNotes('');
    fetchCandidates();
  };

  const handleUpdatePosition = async () => {
    if (!editPositionCandidate) return;

    const { error } = await supabase
      .from('recruitment_candidates')
      .update({ position_applied: editPositionValue || null })
      .eq('id', editPositionCandidate.id);

    if (error) {
      toast.error('Erro ao atualizar cargo');
      return;
    }

    toast.success('Cargo atualizado com sucesso');
    setShowEditPosition(false);
    setEditPositionCandidate(null);
    setEditPositionValue('');
    fetchCandidates();
  };

  const handleUpdateContact = async () => {
    if (!editContactCandidate) return;

    const { error } = await supabase
      .from('recruitment_candidates')
      .update({ 
        email: editContactEmail || null,
        phone: editContactPhone || null 
      })
      .eq('id', editContactCandidate.id);

    if (error) {
      toast.error('Erro ao atualizar contato');
      return;
    }

    toast.success('Contato atualizado com sucesso');
    setShowEditContact(false);
    setEditContactCandidate(null);
    setEditContactEmail('');
    setEditContactPhone('');
    fetchCandidates();
  };

  const fetchCandidateDetails = async (candidateId: string) => {
    const [historyRes, notesRes, docsRes, interviewsRes] = await Promise.all([
      supabase.from('recruitment_stage_history').select('*').eq('candidate_id', candidateId).order('created_at', { ascending: false }),
      supabase.from('recruitment_notes').select('*').eq('candidate_id', candidateId).order('created_at', { ascending: false }),
      supabase.from('recruitment_candidate_documents').select('*').eq('candidate_id', candidateId).order('created_at', { ascending: false }),
      supabase.from('recruitment_interviews').select('*').eq('candidate_id', candidateId).order('scheduled_date', { ascending: false })
    ]);

    setCandidateHistory(historyRes.data || []);
    setCandidateNotes(notesRes.data || []);
    setCandidateDocuments(docsRes.data || []);
    setCandidateInterviews(interviewsRes.data || []);
    
    // Fetch feedbacks for interviews
    if (interviewsRes.data && interviewsRes.data.length > 0) {
      fetchInterviewFeedbacks(interviewsRes.data.map(i => i.id));
    }
  };

  const handleScheduleInterview = async () => {
    if (!user || !selectedCandidate || !newInterview.scheduled_date) {
      toast.error('Data da entrevista é obrigatória');
      return;
    }

    const { error } = await supabase.from('recruitment_interviews').insert({
      candidate_id: selectedCandidate.id,
      ...newInterview,
      interviewer_ids: [user.id],
      created_by: user.id
    });

    if (!error) {
      toast.success('Entrevista agendada');
      setShowScheduleInterview(false);
      setNewInterview({ interview_type: 'online', scheduled_date: '', duration_minutes: 60, location: '', meeting_link: '', notes: '' });
      fetchCandidateDetails(selectedCandidate.id);
      fetchInterviews();
      
      // Update candidate stage if at curriculo_recebido
      if (selectedCandidate.current_stage === 'curriculo_recebido') {
        handleStageChange(selectedCandidate.id, 'entrevista_agendada');
      }
    }
  };

  const handleAddDocument = async (e: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedCandidate) return;

    const filePath = `documents/${selectedCandidate.id}/${crypto.randomUUID()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('resumes').upload(filePath, file);

    if (uploadError) {
      toast.error('Erro ao fazer upload');
      return;
    }

    const { error } = await supabase.from('recruitment_candidate_documents').insert({
      candidate_id: selectedCandidate.id,
      file_name: file.name,
      file_url: filePath,
      file_type: file.type,
      document_type: documentType,
      uploaded_by: user.id
    });

    if (!error) {
      toast.success('Documento anexado');
      fetchCandidateDetails(selectedCandidate.id);
    }
    e.target.value = '';
  };

  const handleAddNote = async () => {
    if (!user || !selectedCandidate || !newNote.trim()) return;

    const { error } = await supabase.from('recruitment_notes').insert({
      candidate_id: selectedCandidate.id,
      content: newNote,
      created_by: user.id
    });

    if (!error) {
      toast.success('Observação adicionada');
      setNewNote('');
      fetchCandidateDetails(selectedCandidate.id);
    }
  };

  const downloadFile = async (fileUrl: string, fileName: string) => {
    try {
      // Use signed URL as primary method - handles special characters better
      const { data: signedData, error: signedError } = await supabase.storage
        .from('resumes')
        .createSignedUrl(fileUrl, 300);
      
      if (signedData?.signedUrl) {
        // Fetch the file and trigger download with correct filename
        const response = await fetch(signedData.signedUrl);
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
        }
      }
      
      // If signed URL fails, try public URL
      const { data: publicUrlData } = supabase.storage
        .from('resumes')
        .getPublicUrl(fileUrl);
      
      if (publicUrlData?.publicUrl) {
        const response = await fetch(publicUrlData.publicUrl);
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
        }
      }
      
      console.error('Download error:', signedError);
      toast.error('Erro ao baixar arquivo. Verifique se o arquivo existe.');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erro ao baixar arquivo');
    }
  };

  const previewResume = async (fileUrl: string, fileName: string) => {
    try {
      const { data: signedData } = await supabase.storage
        .from('resumes')
        .createSignedUrl(fileUrl, 300);
      
      if (signedData?.signedUrl) {
        setPreviewUrl(signedData.signedUrl);
        setPreviewFileName(fileName);
        setPreviewFilePath(fileUrl);
        setShowResumePreview(true);
      } else {
        toast.error('Erro ao carregar preview do currículo');
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Erro ao carregar preview');
    }
  };

  // Metrics calculation
  const calculateMetrics = () => {
    const hired = candidates.filter(c => c.current_stage === 'contratado');
    const avgDaysToHire = hired.length > 0
      ? hired.reduce((sum, c) => sum + differenceInDays(new Date(c.hired_date!), new Date(c.created_at)), 0) / hired.length
      : 0;

    const stages: RecruitmentStage[] = ['curriculo_recebido', 'entrevista_agendada', 'entrevista_realizada', 'aguardando_prova', 'prova_realizada', 'entrevista_presencial_agendada', 'entrevista_presencial_realizada', 'contratado'];
    const stageConversion = stages.map((stage, index) => {
      if (index === 0) return { stage, count: candidates.length, rate: 100 };
      const atOrPastStage = candidates.filter(c => stages.indexOf(c.current_stage) >= index || c.current_stage === 'contratado').length;
      const rate = candidates.length > 0 ? (atOrPastStage / candidates.length) * 100 : 0;
      return { stage, count: atOrPastStage, rate };
    });

    return {
      total: candidates.length,
      active: candidates.filter(c => c.is_active).length,
      hired: hired.length,
      eliminated: candidates.filter(c => c.current_stage === 'eliminado').length,
      avgDaysToHire: Math.round(avgDaysToHire),
      conversionRate: candidates.length > 0 ? ((hired.length / candidates.length) * 100).toFixed(1) : 0,
      stageConversion
    };
  };

  const metrics = calculateMetrics();

  // Filtered candidates
  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = 
      c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.position_applied?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === 'all' || c.current_stage === stageFilter;
    const matchesJobOpening = 
      jobOpeningFilter === 'all' || 
      (jobOpeningFilter === 'banco_talentos' && !c.job_opening_id) ||
      c.job_opening_id === jobOpeningFilter;
    return matchesSearch && matchesStage && matchesJobOpening;
  });

  // Talent pool count
  const talentPoolCount = candidates.filter(c => !c.job_opening_id).length;

  // Filtered talent pool
  const talentPoolCandidates = candidates.filter(c => !c.job_opening_id);
  
  const filteredTalentPool = talentPoolCandidates
    .filter(c => {
      const matchesSearch = c.full_name.toLowerCase().includes(talentPoolSearch.toLowerCase());
      const matchesPosition = talentPoolPositionFilter === 'all' || 
        (talentPoolPositionFilter === 'unspecified' && !c.position_applied) ||
        c.position_applied === talentPoolPositionFilter;
      if (talentPoolFilter === 'future_hire') return matchesSearch && matchesPosition && c.is_future_hire_candidate;
      if (talentPoolFilter === 'regular') return matchesSearch && matchesPosition && !c.is_future_hire_candidate;
      return matchesSearch && matchesPosition;
    })
    .sort((a, b) => {
      switch (talentPoolSort) {
        case 'name_asc': return a.full_name.localeCompare(b.full_name);
        case 'name_desc': return b.full_name.localeCompare(a.full_name);
        case 'date_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'date_desc': 
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  // Talent pool statistics
  const talentPoolStats = useMemo(() => {
    const futureHireCount = talentPoolCandidates.filter(c => c.is_future_hire_candidate).length;
    const positionCounts: Record<string, number> = {};
    talentPoolCandidates.forEach(c => {
      const pos = c.position_applied || 'Não especificado';
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });
    const topPositions = Object.entries(positionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const uniquePositions = [...new Set(talentPoolCandidates.map(c => c.position_applied).filter(Boolean))] as string[];
    return { total: talentPoolCount, futureHire: futureHireCount, topPositions, uniquePositions };
  }, [talentPoolCandidates, talentPoolCount]);

  // Talent pool export functions
  const exportTalentPoolToExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = filteredTalentPool.map(c => ({
      'Nome': c.full_name,
      'Email': c.email || '',
      'Telefone': c.phone || '',
      'Cargo Pretendido': c.position_applied || '',
      'Estágio': STAGE_LABELS[c.current_stage],
      'Viável para Contratação': c.is_future_hire_candidate ? 'Sim' : 'Não',
      'Processo Anterior': jobOpenings.find(j => j.id === c.previous_job_opening_id)?.title || '',
      'Observações': c.future_hire_notes || '',
      'Data Cadastro': format(new Date(c.created_at), 'dd/MM/yyyy')
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Banco de Talentos');
    XLSX.writeFile(wb, `banco-talentos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Excel exportado com sucesso');
  };

  const exportTalentPoolToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Banco de Talentos', 14, 22);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 30);
    doc.text(`Total: ${filteredTalentPool.length} candidatos`, 14, 38);

    const tableData = filteredTalentPool.map(c => [
      c.full_name,
      c.email || '-',
      c.phone || '-',
      c.position_applied || '-',
      c.is_future_hire_candidate ? 'Sim' : 'Não',
      format(new Date(c.created_at), 'dd/MM/yyyy')
    ]);

    autoTable(doc, {
      startY: 48,
      head: [['Nome', 'Email', 'Telefone', 'Cargo', 'Viável', 'Data']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [245, 158, 11] }
    });

    doc.save(`banco-talentos-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF exportado com sucesso');
  };

  // Chart data calculations
  const chartData = useMemo(() => {
    const last12Months = eachMonthOfInterval({
      start: subMonths(new Date(), 11),
      end: new Date()
    });

    const hiringEvolution = last12Months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const hired = candidates.filter(c => 
        c.current_stage === 'contratado' && 
        c.hired_date &&
        new Date(c.hired_date) >= monthStart && 
        new Date(c.hired_date) <= monthEnd
      ).length;

      const newCandidates = candidates.filter(c =>
        new Date(c.created_at) >= monthStart &&
        new Date(c.created_at) <= monthEnd
      ).length;

      return {
        month: format(month, 'MMM/yy', { locale: ptBR }),
        contratados: hired,
        candidatos: newCandidates
      };
    });

    const stageDistribution = Object.entries(STAGE_LABELS).map(([stage, label]) => ({
      name: label,
      value: candidates.filter(c => c.current_stage === stage).length,
      stage
    })).filter(s => s.value > 0);

    const positionDistribution = candidates.reduce((acc, c) => {
      const pos = c.position_applied || 'Não informado';
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const positionData = Object.entries(positionDistribution).map(([name, value]) => ({ name, value }));

    return { hiringEvolution, stageDistribution, positionData };
  }, [candidates]);

  const CHART_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1'];

  // Export functions
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text('Relatório de Processo Seletivo', 14, 22);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 30);

    // Metrics summary
    doc.setFontSize(14);
    doc.text('Resumo', 14, 45);
    doc.setFontSize(10);
    doc.text(`Total de Candidatos: ${metrics.total}`, 14, 55);
    doc.text(`Contratados: ${metrics.hired}`, 14, 62);
    doc.text(`Taxa de Conversão: ${metrics.conversionRate}%`, 14, 69);
    doc.text(`Tempo Médio de Contratação: ${metrics.avgDaysToHire} dias`, 14, 76);
    doc.text(`Banco de Talentos: ${talentPoolCount}`, 14, 83);

    // Candidates table
    doc.setFontSize(14);
    doc.text('Candidatos', 14, 98);

    const tableData = candidates.map(c => [
      c.full_name,
      c.email || '-',
      c.position_applied || '-',
      STAGE_LABELS[c.current_stage],
      jobOpenings.find(j => j.id === c.job_opening_id)?.title || 'Banco de Talentos',
      format(new Date(c.created_at), 'dd/MM/yyyy')
    ]);

    autoTable(doc, {
      startY: 105,
      head: [['Nome', 'Email', 'Cargo', 'Estágio', 'Vaga', 'Data']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    // Job openings
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text('Vagas', 14, finalY);

    const jobsData = jobOpenings.map(jo => [
      jo.title,
      jo.position,
      jo.status === 'open' ? 'Aberta' : jo.status === 'paused' ? 'Pausada' : 'Encerrada',
      candidates.filter(c => c.job_opening_id === jo.id).length.toString(),
      format(new Date(jo.opened_at), 'dd/MM/yyyy')
    ]);

    autoTable(doc, {
      startY: finalY + 7,
      head: [['Título', 'Cargo', 'Status', 'Candidatos', 'Abertura']],
      body: jobsData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 197, 94] }
    });

    doc.save(`relatorio-processo-seletivo-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Relatório PDF gerado');
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Candidates sheet
    const candidatesData = candidates.map(c => ({
      'Nome': c.full_name,
      'Email': c.email || '',
      'Telefone': c.phone || '',
      'Cargo Pretendido': c.position_applied || '',
      'Estágio': STAGE_LABELS[c.current_stage],
      'Vaga': jobOpenings.find(j => j.id === c.job_opening_id)?.title || 'Banco de Talentos',
      'Data Cadastro': format(new Date(c.created_at), 'dd/MM/yyyy'),
      'Data Contratação': c.hired_date ? format(new Date(c.hired_date), 'dd/MM/yyyy') : '',
      'Ativo': c.is_active ? 'Sim' : 'Não'
    }));
    const wsCandidates = XLSX.utils.json_to_sheet(candidatesData);
    XLSX.utils.book_append_sheet(wb, wsCandidates, 'Candidatos');

    // Job openings sheet
    const jobsData = jobOpenings.map(jo => ({
      'Título': jo.title,
      'Cargo': jo.position,
      'Descrição': jo.description || '',
      'Requisitos': jo.requirements || '',
      'Status': jo.status === 'open' ? 'Aberta' : jo.status === 'paused' ? 'Pausada' : 'Encerrada',
      'Data Abertura': format(new Date(jo.opened_at), 'dd/MM/yyyy'),
      'Data Encerramento': jo.closed_at ? format(new Date(jo.closed_at), 'dd/MM/yyyy') : '',
      'Total Candidatos': candidates.filter(c => c.job_opening_id === jo.id).length,
      'Contratados': candidates.filter(c => c.job_opening_id === jo.id && c.current_stage === 'contratado').length
    }));
    const wsJobs = XLSX.utils.json_to_sheet(jobsData);
    XLSX.utils.book_append_sheet(wb, wsJobs, 'Vagas');

    // Metrics sheet
    const metricsData = [
      { 'Métrica': 'Total de Candidatos', 'Valor': metrics.total },
      { 'Métrica': 'Candidatos Ativos', 'Valor': metrics.active },
      { 'Métrica': 'Contratados', 'Valor': metrics.hired },
      { 'Métrica': 'Eliminados', 'Valor': metrics.eliminated },
      { 'Métrica': 'Taxa de Conversão (%)', 'Valor': metrics.conversionRate },
      { 'Métrica': 'Tempo Médio de Contratação (dias)', 'Valor': metrics.avgDaysToHire },
      { 'Métrica': 'Banco de Talentos', 'Valor': talentPoolCount }
    ];
    const wsMetrics = XLSX.utils.json_to_sheet(metricsData);
    XLSX.utils.book_append_sheet(wb, wsMetrics, 'Métricas');

    XLSX.writeFile(wb, `relatorio-processo-seletivo-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Relatório Excel gerado');
  };

  // Upcoming interviews
  const upcomingInterviews = interviews.filter(i => 
    i.status === 'scheduled' && new Date(i.scheduled_date) >= new Date()
  ).slice(0, 5);

  // Comparison functions
  const toggleCompareCandidate = (candidateId: string) => {
    setCompareList(prev => 
      prev.includes(candidateId) 
        ? prev.filter(id => id !== candidateId)
        : prev.length < 4 ? [...prev, candidateId] : prev
    );
  };

  const candidatesForComparison = candidates.filter(c => compareList.includes(c.id));

  // Get average feedback rating for a candidate
  const getCandidateAverageRating = (candidateId: string) => {
    const candidateInterviewsList = interviews.filter(i => i.candidate_id === candidateId && i.rating);
    if (candidateInterviewsList.length === 0) return null;
    const sum = candidateInterviewsList.reduce((acc, i) => acc + (i.rating || 0), 0);
    return (sum / candidateInterviewsList.length).toFixed(1);
  };

  if (roleLoading || permLoading) {
    return <Layout><div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Carregando...</div></div></Layout>;
  }

  if (!canView) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </Layout>
    );
  }

  const getNextStages = (currentStage: RecruitmentStage): RecruitmentStage[] => {
    const flow: Record<RecruitmentStage, RecruitmentStage[]> = {
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
    return flow[currentStage] || [];
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gestão de Contratação</h1>
            <p className="text-muted-foreground">Processos seletivos e banco de currículos</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToPDF}>
              <Download className="h-4 w-4 mr-2" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />Excel
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="vagas" className="gap-2"><Briefcase className="h-4 w-4" />Vagas</TabsTrigger>
            <TabsTrigger value="candidatos" className="gap-2"><Users className="h-4 w-4" />Candidatos</TabsTrigger>
            <TabsTrigger value="banco" className="gap-2"><Database className="h-4 w-4" />Banco ({talentPoolCount})</TabsTrigger>
            <TabsTrigger value="agenda" className="gap-2"><CalendarDays className="h-4 w-4" />Agenda</TabsTrigger>
            <TabsTrigger value="metricas" className="gap-2"><BarChart3 className="h-4 w-4" />Métricas</TabsTrigger>
          </TabsList>

          {/* VAGAS TAB */}
          <TabsContent value="vagas" className="space-y-4">
            {canEdit && (
              <div className="flex justify-end">
                <Button onClick={() => setShowAddJobOpening(true)}>
                  <Plus className="h-4 w-4 mr-2" />Abrir Vaga
                </Button>
              </div>
            )}

            <div className="grid gap-4">
              {jobOpenings.length === 0 ? (
                <Card><CardContent className="py-12 text-center">
                  <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma vaga cadastrada</p>
                </CardContent></Card>
              ) : (
                jobOpenings.map(jo => {
                  const joCandidates = candidates.filter(c => c.job_opening_id === jo.id);
                  const hired = joCandidates.filter(c => c.current_stage === 'contratado').length;
                  return (
                    <Card key={jo.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              {jo.title}
                              <Badge variant={jo.status === 'open' ? 'default' : jo.status === 'paused' ? 'secondary' : 'outline'}>
                                {jo.status === 'open' ? 'Aberta' : jo.status === 'paused' ? 'Pausada' : 'Encerrada'}
                              </Badge>
                            </CardTitle>
                            <CardDescription>{jo.position}</CardDescription>
                          </div>
                          <div className="flex gap-2">
                            {canEdit && jo.status === 'open' && (
                              <>
                                <Button size="sm" variant="outline" asChild>
                                  <label className="cursor-pointer">
                                    <Upload className="h-4 w-4 mr-1" />Currículos
                                    <input type="file" accept=".pdf" multiple onChange={(e) => handleFileUpload(e, jo.id)} className="hidden" disabled={uploading} />
                                  </label>
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleCloseJobOpening(jo.id)}>
                                  Encerrar
                                </Button>
                              </>
                            )}
                            {canEdit && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm(`Tem certeza que deseja excluir a vaga "${jo.title}"?`)) {
                                    handleDeleteJobOpening(jo.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div><span className="text-muted-foreground">Candidatos:</span> <strong>{joCandidates.length}</strong></div>
                          <div><span className="text-muted-foreground">Contratados:</span> <strong className="text-green-600">{hired}</strong></div>
                          <div><span className="text-muted-foreground">Abertura:</span> {format(new Date(jo.opened_at), 'dd/MM/yyyy')}</div>
                          {jo.closed_at && <div><span className="text-muted-foreground">Encerramento:</span> {format(new Date(jo.closed_at), 'dd/MM/yyyy')}</div>}
                        </div>
                        {jo.description && <p className="mt-3 text-sm text-muted-foreground">{jo.description}</p>}
                        <Button variant="link" className="mt-2 p-0" onClick={() => { setJobOpeningFilter(jo.id); setActiveTab('candidatos'); }}>
                          Ver candidatos desta vaga →
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* CANDIDATOS TAB */}
          <TabsContent value="candidatos" className="space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por nome, email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estágio" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(STAGE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={jobOpeningFilter} onValueChange={setJobOpeningFilter}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Vaga" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as vagas</SelectItem>
                    <SelectItem value="banco_talentos">
                      <span className="flex items-center gap-2">
                        <Database className="h-3 w-3" />Banco de Talentos
                      </span>
                    </SelectItem>
                    {jobOpenings.map(jo => <SelectItem key={jo.id} value={jo.id}>{jo.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowAddCandidate(true)}><UserPlus className="h-4 w-4 mr-2" />Manual</Button>
                    <Button asChild>
                      <label className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? `Processando ${uploadProgress.current}/${uploadProgress.total}...` : 'Upload'}
                        <input type="file" accept=".pdf" multiple onChange={(e) => handleFileUpload(e)} className="hidden" disabled={uploading} />
                      </label>
                    </Button>
                  </div>
                )}
                {compareList.length >= 2 && (
                  <Button onClick={() => setShowComparison(true)} className="bg-purple-600 hover:bg-purple-700">
                    <GitCompare className="h-4 w-4 mr-2" />Comparar ({compareList.length})
                  </Button>
                )}
                {compareList.length > 0 && compareList.length < 2 && (
                  <Badge variant="outline" className="py-2 px-3">
                    Selecione mais {2 - compareList.length} para comparar
                  </Badge>
                )}
              </div>
              
              {/* View Mode Toggle */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {filteredCandidates.length} candidato(s) encontrado(s)
                </div>
                <div className="flex items-center gap-2 border rounded-lg p-1">
                  <Button
                    variant={candidatesViewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setCandidatesViewMode('list')}
                    className="h-8"
                  >
                    <List className="h-4 w-4 mr-1" />
                    Lista
                  </Button>
                  <Button
                    variant={candidatesViewMode === 'kanban' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setCandidatesViewMode('kanban')}
                    className="h-8"
                  >
                    <LayoutGrid className="h-4 w-4 mr-1" />
                    Kanban
                  </Button>
                </div>
              </div>

              {/* Upload Progress */}
              {uploading && uploadProgress.total > 0 && (
                <Card>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <div className="flex-1">
                        <Progress value={(uploadProgress.current / uploadProgress.total) * 100} className="h-2" />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {uploadProgress.current}/{uploadProgress.total}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Kanban View */}
            {candidatesViewMode === 'kanban' ? (
              <RecruitmentKanban
                candidates={filteredCandidates}
                onStageChange={handleStageChange}
                onViewCandidate={(candidate) => {
                  setSelectedCandidate(candidate as Candidate);
                  fetchCandidateDetails(candidate.id);
                }}
                canEdit={canEdit}
              />
            ) : (
            <div className="grid gap-4">
              {filteredCandidates.length === 0 ? (
                <Card><CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum candidato encontrado</p>
                </CardContent></Card>
              ) : (
                filteredCandidates.map(candidate => {
                  const jo = jobOpenings.find(j => j.id === candidate.job_opening_id);
                  const nextStages = getNextStages(candidate.current_stage);
                  const isSelected = compareList.includes(candidate.id);
                  const avgRating = getCandidateAverageRating(candidate.id);
                  return (
                    <Card key={candidate.id} className={`${!candidate.is_active ? 'opacity-60' : ''} ${isSelected ? 'ring-2 ring-purple-500' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                          <div className="flex gap-3">
                            <button
                              onClick={() => toggleCompareCandidate(candidate.id)}
                              className={`h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                isSelected 
                                  ? 'bg-purple-600 border-purple-600 text-white' 
                                  : 'border-muted-foreground/30 hover:border-purple-400'
                              }`}
                            >
                              {isSelected && <Check className="h-4 w-4" />}
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold">{candidate.full_name}</h3>
                                <Badge className={STAGE_COLORS[candidate.current_stage]}>{STAGE_LABELS[candidate.current_stage]}</Badge>
                                {avgRating && (
                                  <Badge variant="outline" className="gap-1">
                                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />{avgRating}
                                  </Badge>
                                )}
                                {jo ? (
                                  <Badge variant="outline"><FolderOpen className="h-3 w-3 mr-1" />{jo.title}</Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                                    <Database className="h-3 w-3 mr-1" />Banco de Talentos
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {candidate.email && <p>{candidate.email}</p>}
                                {candidate.phone && <p>{candidate.phone}</p>}
                                {candidate.position_applied && <p>Cargo: {candidate.position_applied}</p>}
                                <p className="text-xs">Cadastrado em {format(new Date(candidate.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 items-start">
                            {candidate.resume_url && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => previewResume(candidate.resume_url!, candidate.resume_file_name || 'curriculo.pdf')} title="Visualizar Currículo">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => downloadFile(candidate.resume_url!, candidate.resume_file_name || 'curriculo.pdf')} title="Baixar Currículo">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="outline" onClick={() => { setSelectedCandidate(candidate); fetchCandidateDetails(candidate.id); }}>
                              <FileText className="h-4 w-4 mr-1" />Detalhes
                            </Button>
                            {canEdit && candidate.is_active && (
                              <>
                                {nextStages.map(stage => (
                                  <Button key={stage} size="sm" onClick={() => handleStageChange(candidate.id, stage)}>{STAGE_LABELS[stage]}</Button>
                                ))}
                                <EliminateDialog candidateId={candidate.id} onEliminate={handleEliminate} />
                                {/* Send to Talent Pool button - only show for candidates with a job opening */}
                                {candidate.job_opening_id && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                                    onClick={() => {
                                      setTalentPoolCandidate(candidate);
                                      setTalentPoolNotes('');
                                      setShowSendToTalentPool(true);
                                    }}
                                  >
                                    <Archive className="h-4 w-4 mr-1" />
                                    Banco de Talentos
                                  </Button>
                                )}
                              </>
                            )}
                            {canEdit && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm(`Tem certeza que deseja excluir o candidato "${candidate.full_name}"? Esta ação não pode ser desfeita.`)) {
                                    handleDeleteCandidate(candidate);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
            )}
          </TabsContent>

          {/* BANCO DE TALENTOS TAB */}
          <TabsContent value="banco" className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Banco de Talentos
                </h2>
                <p className="text-sm text-muted-foreground">
                  Currículos disponíveis para futuros processos seletivos ({talentPoolCount} candidatos)
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowAddCandidate(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />Adicionar Manual
                  </Button>
                  <Button asChild>
                    <label className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />{uploading ? 'Processando...' : 'Upload Currículo'}
                      <input type="file" accept=".pdf" multiple onChange={(e) => handleFileUpload(e)} className="hidden" disabled={uploading} />
                    </label>
                  </Button>
                </div>
              )}
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Database className="h-6 w-6 mx-auto mb-2 text-amber-600" />
                  <p className="text-2xl font-bold">{talentPoolStats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <UserCheck className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl font-bold">{talentPoolStats.futureHire}</p>
                  <p className="text-xs text-muted-foreground">Viáveis</p>
                </CardContent>
              </Card>
              {talentPoolStats.topPositions.slice(0, 2).map(([pos, count]) => (
                <Card key={pos}>
                  <CardContent className="p-4 text-center">
                    <Briefcase className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground truncate" title={pos}>{pos}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome..."
                  value={talentPoolSearch}
                  onChange={(e) => setTalentPoolSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={talentPoolFilter} onValueChange={setTalentPoolFilter}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="future_hire">Viáveis</SelectItem>
                  <SelectItem value="regular">Regulares</SelectItem>
                </SelectContent>
              </Select>
              <Select value={talentPoolPositionFilter} onValueChange={setTalentPoolPositionFilter}>
                <SelectTrigger className="w-[180px]">
                  <Briefcase className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os cargos</SelectItem>
                  <SelectItem value="unspecified">Não especificado</SelectItem>
                  {talentPoolStats.uniquePositions.sort().map(pos => (
                    <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={talentPoolSort} onValueChange={setTalentPoolSort}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Mais recentes</SelectItem>
                  <SelectItem value="date_asc">Mais antigos</SelectItem>
                  <SelectItem value="name_asc">Nome A-Z</SelectItem>
                  <SelectItem value="name_desc">Nome Z-A</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportTalentPoolToExcel()}>
                  <Download className="h-4 w-4 mr-1" />Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportTalentPoolToPDF()}>
                  <FileText className="h-4 w-4 mr-1" />PDF
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {filteredTalentPool.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhum currículo encontrado</p>
                  </CardContent>
                </Card>
              ) : (
                filteredTalentPool.map(candidate => (
                  <Card key={candidate.id} className="border-amber-200 bg-amber-50/30">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{candidate.full_name}</h3>
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                              <Database className="h-3 w-3 mr-1" />Banco de Talentos
                            </Badge>
                            {candidate.is_future_hire_candidate && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                <UserCheck className="h-3 w-3 mr-1" />Viável para contratação
                              </Badge>
                            )}
                            <Badge className={STAGE_COLORS[candidate.current_stage]}>{STAGE_LABELS[candidate.current_stage]}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {candidate.email && <p>{candidate.email}</p>}
                            {candidate.phone && <p>{candidate.phone}</p>}
                            {candidate.position_applied && <p>Cargo pretendido: {candidate.position_applied}</p>}
                            {candidate.previous_job_opening_id && (
                              <p className="text-xs text-amber-700">
                                Participou de: {jobOpenings.find(j => j.id === candidate.previous_job_opening_id)?.title || 'Processo anterior'}
                              </p>
                            )}
                            {candidate.future_hire_notes && (
                              <p className="text-xs italic mt-1">"{candidate.future_hire_notes}"</p>
                            )}
                            <p className="text-xs">Cadastrado em {format(new Date(candidate.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 items-start">
                          {candidate.resume_url && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => previewResume(candidate.resume_url!, candidate.resume_file_name || 'curriculo.pdf')} title="Visualizar Currículo">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => downloadFile(candidate.resume_url!, candidate.resume_file_name || 'curriculo.pdf')} title="Baixar Currículo">
                                <Download className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="outline" onClick={() => { setSelectedCandidate(candidate); fetchCandidateDetails(candidate.id); }}>
                            <FileText className="h-4 w-4 mr-1" />Detalhes
                          </Button>
                          {canEdit && jobOpenings.filter(j => j.status === 'open').length > 0 && (
                            <Select onValueChange={(jobId) => {
                              if (jobId) {
                                supabase.from('recruitment_candidates')
                                  .update({ job_opening_id: jobId })
                                  .eq('id', candidate.id)
                                  .then(() => {
                                    toast.success('Candidato vinculado à vaga');
                                    fetchCandidates();
                                  });
                              }
                            }}>
                              <SelectTrigger className="w-[160px] h-9">
                                <SelectValue placeholder="Vincular à vaga" />
                              </SelectTrigger>
                              <SelectContent>
                                {jobOpenings.filter(j => j.status === 'open').map(jo => (
                                  <SelectItem key={jo.id} value={jo.id}>{jo.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {canEdit && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setEditPositionCandidate(candidate);
                                setEditPositionValue(candidate.position_applied || '');
                                setShowEditPosition(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-1" />Cargo
                            </Button>
                          )}
                          {canEdit && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setEditContactCandidate(candidate);
                                setEditContactEmail(candidate.email || '');
                                setEditContactPhone(candidate.phone || '');
                                setShowEditContact(true);
                              }}
                            >
                              <Mail className="h-4 w-4 mr-1" />Contato
                            </Button>
                          )}
                          {canEdit && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                if (confirm(`Tem certeza que deseja excluir o candidato "${candidate.full_name}"? Esta ação não pode ser desfeita.`)) {
                                  handleDeleteCandidate(candidate);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* AGENDA TAB */}
          <TabsContent value="agenda" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Próximas Entrevistas</CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingInterviews.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhuma entrevista agendada</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingInterviews.map(interview => {
                      const candidate = candidates.find(c => c.id === interview.candidate_id);
                      return (
                        <div key={interview.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                          <div className="flex items-center gap-3">
                            {interview.interview_type === 'online' ? <Video className="h-5 w-5 text-blue-500" /> : <MapPin className="h-5 w-5 text-green-500" />}
                            <div>
                              <p className="font-medium">{candidate?.full_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(interview.scheduled_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                {interview.interview_type === 'online' ? ' - Online' : ` - ${interview.location || 'Presencial'}`}
                              </p>
                            </div>
                          </div>
                          <Badge>{interview.duration_minutes} min</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MÉTRICAS TAB */}
          <TabsContent value="metricas" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card><CardContent className="pt-6">
                <div className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-500" /><div><p className="text-2xl font-bold">{metrics.total}</p><p className="text-sm text-muted-foreground">Total Candidatos</p></div></div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /><div><p className="text-2xl font-bold">{metrics.hired}</p><p className="text-sm text-muted-foreground">Contratados</p></div></div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-yellow-500" /><div><p className="text-2xl font-bold">{metrics.avgDaysToHire} dias</p><p className="text-sm text-muted-foreground">Tempo Médio</p></div></div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-purple-500" /><div><p className="text-2xl font-bold">{metrics.conversionRate}%</p><p className="text-sm text-muted-foreground">Taxa Conversão</p></div></div>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <div className="flex items-center gap-2"><Database className="h-5 w-5 text-amber-500" /><div><p className="text-2xl font-bold">{talentPoolCount}</p><p className="text-sm text-muted-foreground">Banco Talentos</p></div></div>
              </CardContent></Card>
            </div>

            {/* Evolução de Contratações */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Evolução de Contratações (12 meses)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData.hiringEvolution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="candidatos" name="Novos Candidatos" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="contratados" name="Contratados" stroke="#22c55e" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Distribuição por Estágio */}
              <Card>
                <CardHeader><CardTitle>Distribuição por Estágio</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={chartData.stageDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${value}`}
                      >
                        {chartData.stageDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {chartData.stageDistribution.map((entry, index) => (
                      <div key={entry.stage} className="flex items-center gap-1 text-xs">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                        <span>{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Candidatos por Vaga */}
              <Card>
                <CardHeader><CardTitle>Candidatos por Vaga</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={jobOpenings.map(jo => ({
                      name: jo.title.length > 20 ? jo.title.substring(0, 20) + '...' : jo.title,
                      candidatos: candidates.filter(c => c.job_opening_id === jo.id).length,
                      contratados: candidates.filter(c => c.job_opening_id === jo.id && c.current_stage === 'contratado').length
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Bar dataKey="candidatos" name="Candidatos" fill="#3b82f6" />
                      <Bar dataKey="contratados" name="Contratados" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Funil de Conversão por Estágio</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {metrics.stageConversion.map(({ stage, count, rate }) => (
                  <div key={stage} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{STAGE_LABELS[stage as RecruitmentStage]}</span>
                      <span className="text-muted-foreground">{count} ({rate.toFixed(1)}%)</span>
                    </div>
                    <Progress value={rate} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Job Opening Dialog */}
        <Dialog open={showAddJobOpening} onOpenChange={setShowAddJobOpening}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Abrir Nova Vaga</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título da Vaga *</Label>
                <Input value={newJobOpening.title} onChange={(e) => setNewJobOpening({ ...newJobOpening, title: e.target.value })} placeholder="Ex: Processo Seletivo - Advogado Jr" />
              </div>
              <div>
                <Label>Cargo *</Label>
                <Select value={newJobOpening.position} onValueChange={(v) => setNewJobOpening({ ...newJobOpening, position: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="socio">Sócio</SelectItem>
                    <SelectItem value="advogado">Advogado</SelectItem>
                    <SelectItem value="estagiario">Estagiário</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="administrativo">Administrativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Template loading section */}
              {newJobOpening.position && positionTemplates.find(t => t.position === newJobOpening.position) && (
                <div className="p-3 bg-muted rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Template salvo para este cargo</span>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleLoadTemplate(newJobOpening.position)}
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />Carregar Template
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground">Usar IA para sugerir descrição e requisitos</span>
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm" 
                  onClick={handleSuggestJobOpening}
                  disabled={suggestingJobOpening || (!newJobOpening.title && !newJobOpening.position)}
                >
                  {suggestingJobOpening ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" />Sugerir com IA</>
                  )}
                </Button>
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea 
                  value={newJobOpening.description} 
                  onChange={(e) => setNewJobOpening({ ...newJobOpening, description: e.target.value })} 
                  placeholder="Descrição da vaga..." 
                  rows={4}
                />
              </div>
              <div>
                <Label>Requisitos</Label>
                <Textarea 
                  value={newJobOpening.requirements} 
                  onChange={(e) => setNewJobOpening({ ...newJobOpening, requirements: e.target.value })} 
                  placeholder="Requisitos..." 
                  rows={4}
                />
              </div>
              
              {/* Save as template checkbox */}
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                <input 
                  type="checkbox" 
                  id="saveAsTemplate"
                  checked={newJobOpening.saveAsTemplate}
                  onChange={(e) => setNewJobOpening({ ...newJobOpening, saveAsTemplate: e.target.checked })}
                  className="h-4 w-4"
                />
                <label htmlFor="saveAsTemplate" className="text-sm cursor-pointer">
                  Salvar descrição e requisitos como template para o cargo "{newJobOpening.position || '...'}"
                </label>
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowAddJobOpening(false)}>Cancelar</Button>
                <Button onClick={handleCreateJobOpening}>Criar Vaga</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Candidate Dialog */}
        <Dialog open={showAddCandidate} onOpenChange={setShowAddCandidate}>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar Candidato</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome Completo *</Label><Input value={newCandidate.full_name} onChange={(e) => setNewCandidate({ ...newCandidate, full_name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={newCandidate.email} onChange={(e) => setNewCandidate({ ...newCandidate, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={newCandidate.phone} onChange={(e) => setNewCandidate({ ...newCandidate, phone: e.target.value })} /></div>
              <div><Label>Cargo Pretendido</Label><Input value={newCandidate.position_applied} onChange={(e) => setNewCandidate({ ...newCandidate, position_applied: e.target.value })} /></div>
              <div><Label>Vaga</Label>
                <Select value={newCandidate.job_opening_id} onValueChange={(v) => setNewCandidate({ ...newCandidate, job_opening_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar vaga (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma vaga específica</SelectItem>
                    {jobOpenings.filter(j => j.status === 'open').map(jo => <SelectItem key={jo.id} value={jo.id}>{jo.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddCandidate(false)}>Cancelar</Button>
                <Button onClick={handleAddCandidate}>Adicionar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Candidate Details Dialog */}
        <Dialog open={!!selectedCandidate} onOpenChange={(open) => !open && setSelectedCandidate(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedCandidate && (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <DialogTitle className="flex items-center gap-2">
                      {selectedCandidate.full_name}
                      <Badge className={STAGE_COLORS[selectedCandidate.current_stage]}>{STAGE_LABELS[selectedCandidate.current_stage]}</Badge>
                    </DialogTitle>
                    {canEdit && (
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => {
                          if (confirm(`Tem certeza que deseja excluir o candidato "${selectedCandidate.full_name}"? Esta ação não pode ser desfeita.`)) {
                            handleDeleteCandidate(selectedCandidate);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />Excluir
                      </Button>
                    )}
                  </div>
                </DialogHeader>

                <Tabs defaultValue="info">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="info">Info</TabsTrigger>
                    <TabsTrigger value="entrevistas">Entrevistas</TabsTrigger>
                    <TabsTrigger value="documentos">Documentos</TabsTrigger>
                    <TabsTrigger value="historico">Histórico</TabsTrigger>
                    <TabsTrigger value="notas">Notas</TabsTrigger>
                  </TabsList>

                  <TabsContent value="info" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label className="text-muted-foreground">Email</Label><p>{selectedCandidate.email || '-'}</p></div>
                      <div><Label className="text-muted-foreground">Telefone</Label><p>{selectedCandidate.phone || '-'}</p></div>
                      <div><Label className="text-muted-foreground">Cargo</Label><p>{selectedCandidate.position_applied || '-'}</p></div>
                      <div><Label className="text-muted-foreground">Cadastro</Label><p>{format(new Date(selectedCandidate.created_at), "dd/MM/yyyy", { locale: ptBR })}</p></div>
                    </div>
                    {selectedCandidate.resume_url && (
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => previewResume(selectedCandidate.resume_url!, selectedCandidate.resume_file_name || 'curriculo.pdf')}>
                          <Eye className="h-4 w-4 mr-2" />Visualizar
                        </Button>
                        <Button variant="outline" onClick={() => downloadFile(selectedCandidate.resume_url!, selectedCandidate.resume_file_name || 'curriculo.pdf')}>
                          <Download className="h-4 w-4 mr-2" />Baixar
                        </Button>
                      </div>
                    )}
                    {selectedCandidate.extracted_data?.summary && (
                      <div><Label className="text-muted-foreground">Resumo</Label><p className="text-sm bg-muted p-3 rounded-md">{selectedCandidate.extracted_data.summary}</p></div>
                    )}
                  </TabsContent>

                  <TabsContent value="entrevistas" className="space-y-4">
                    {canEdit && (
                      <Button onClick={() => setShowScheduleInterview(true)}><Calendar className="h-4 w-4 mr-2" />Agendar Entrevista</Button>
                    )}
                    {candidateInterviews.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Nenhuma entrevista agendada</p>
                    ) : (
                      <div className="space-y-3">
                        {candidateInterviews.map(interview => {
                          const feedbacks = interviewFeedbacks[interview.id] || [];
                          return (
                          <div key={interview.id} className="p-3 bg-muted rounded-md">
                            <div className="flex items-center gap-2 flex-wrap">
                              {interview.interview_type === 'online' ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                              <span className="font-medium">{interview.interview_type === 'online' ? 'Online' : 'Presencial'}</span>
                              <Badge variant={interview.status === 'scheduled' ? 'default' : interview.status === 'completed' ? 'secondary' : 'destructive'}>
                                {interview.status === 'scheduled' ? 'Agendada' : interview.status === 'completed' ? 'Realizada' : interview.status === 'cancelled' ? 'Cancelada' : 'Não compareceu'}
                              </Badge>
                              {interview.rating && <div className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />{interview.rating}/5</div>}
                              {canEdit && (
                                <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setSelectedInterview(interview); setShowFeedbackDialog(true); }}>
                                  <Star className="h-4 w-4 mr-1" />Avaliar
                                </Button>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {format(new Date(interview.scheduled_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} - {interview.duration_minutes} min
                            </p>
                            {feedbacks.length > 0 && (
                              <div className="mt-3 p-2 bg-background rounded-md">
                                <p className="text-xs font-medium mb-1">Avaliação:</p>
                                {feedbacks.map(fb => (
                                  <div key={fb.id} className="text-sm">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline">{RECOMMENDATION_LABELS[fb.recommendation || ''] || fb.recommendation}</Badge>
                                      {fb.overall_rating && <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />{fb.overall_rating}/5</span>}
                                    </div>
                                    {fb.strengths && <p className="text-xs mt-1"><strong>Pontos fortes:</strong> {fb.strengths}</p>}
                                    {fb.weaknesses && <p className="text-xs"><strong>A melhorar:</strong> {fb.weaknesses}</p>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )})}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="documentos" className="space-y-4">
                    {canEdit && (
                      <div className="flex gap-2 flex-wrap">
                        {DOCUMENT_TYPES.map(dt => (
                          <Button key={dt.value} size="sm" variant="outline" asChild>
                            <label className="cursor-pointer">
                              <Paperclip className="h-4 w-4 mr-1" />{dt.label}
                              <input type="file" onChange={(e) => handleAddDocument(e, dt.value)} className="hidden" />
                            </label>
                          </Button>
                        ))}
                      </div>
                    )}
                    {candidateDocuments.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Nenhum documento anexado</p>
                    ) : (
                      <div className="space-y-2">
                        {candidateDocuments.map(doc => (
                          <div key={doc.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span>{doc.file_name}</span>
                              <Badge variant="outline">{DOCUMENT_TYPES.find(d => d.value === doc.document_type)?.label || doc.document_type}</Badge>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => downloadFile(doc.file_url, doc.file_name)}>Baixar</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="historico" className="space-y-4">
                    {candidateHistory.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Nenhum histórico</p>
                    ) : (
                      <div className="space-y-3">
                        {candidateHistory.map(h => (
                          <div key={h.id} className="flex items-start gap-3 p-3 bg-muted rounded-md">
                            <History className="h-4 w-4 mt-1" />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {h.from_stage && <><Badge variant="outline">{STAGE_LABELS[h.from_stage]}</Badge><span>→</span></>}
                                <Badge className={STAGE_COLORS[h.to_stage]}>{STAGE_LABELS[h.to_stage]}</Badge>
                              </div>
                              {h.notes && <p className="text-sm text-muted-foreground mt-1">{h.notes}</p>}
                              <p className="text-xs text-muted-foreground mt-1">{format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="notas" className="space-y-4">
                    {canEdit && (
                      <div className="flex gap-2">
                        <Textarea placeholder="Adicionar observação..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="flex-1" />
                        <Button onClick={handleAddNote} disabled={!newNote.trim()}><MessageSquare className="h-4 w-4" /></Button>
                      </div>
                    )}
                    {candidateNotes.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Nenhuma observação</p>
                    ) : (
                      <div className="space-y-3">
                        {candidateNotes.map(note => (
                          <div key={note.id} className="p-3 bg-muted rounded-md">
                            <p>{note.content}</p>
                            <p className="text-xs text-muted-foreground mt-2">{format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
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

        {/* Schedule Interview Dialog */}
        <Dialog open={showScheduleInterview} onOpenChange={setShowScheduleInterview}>
          <DialogContent>
            <DialogHeader><DialogTitle>Agendar Entrevista</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Tipo</Label>
                <Select value={newInterview.interview_type} onValueChange={(v) => setNewInterview({ ...newInterview, interview_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Data e Hora *</Label><Input type="datetime-local" value={newInterview.scheduled_date} onChange={(e) => setNewInterview({ ...newInterview, scheduled_date: e.target.value })} /></div>
              <div><Label>Duração (min)</Label><Input type="number" value={newInterview.duration_minutes} onChange={(e) => setNewInterview({ ...newInterview, duration_minutes: parseInt(e.target.value) || 60 })} /></div>
              {newInterview.interview_type === 'online' ? (
                <div><Label>Link da Reunião</Label><Input value={newInterview.meeting_link} onChange={(e) => setNewInterview({ ...newInterview, meeting_link: e.target.value })} placeholder="https://meet.google.com/..." /></div>
              ) : (
                <div><Label>Local</Label><Input value={newInterview.location} onChange={(e) => setNewInterview({ ...newInterview, location: e.target.value })} placeholder="Sala de reuniões..." /></div>
              )}
              <div><Label>Observações</Label><Textarea value={newInterview.notes} onChange={(e) => setNewInterview({ ...newInterview, notes: e.target.value })} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowScheduleInterview(false)}>Cancelar</Button>
                <Button onClick={handleScheduleInterview}>Agendar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Interview Feedback Dialog */}
        <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Avaliação da Entrevista</DialogTitle></DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {EVALUATION_CRITERIA.map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(rating => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setFeedbackForm({ ...feedbackForm, [key]: rating })}
                          className={`p-2 rounded-md transition-colors ${(feedbackForm as any)[key] >= rating ? 'bg-yellow-400 text-yellow-900' : 'bg-muted hover:bg-muted/80'}`}
                        >
                          <Star className={`h-5 w-5 ${(feedbackForm as any)[key] >= rating ? 'fill-current' : ''}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Avaliação Geral</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(rating => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setFeedbackForm({ ...feedbackForm, overall_rating: rating })}
                      className={`p-2 rounded-md transition-colors ${feedbackForm.overall_rating >= rating ? 'bg-yellow-400 text-yellow-900' : 'bg-muted hover:bg-muted/80'}`}
                    >
                      <Star className={`h-6 w-6 ${feedbackForm.overall_rating >= rating ? 'fill-current' : ''}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Recomendação</Label>
                <Select value={feedbackForm.recommendation} onValueChange={(v) => setFeedbackForm({ ...feedbackForm, recommendation: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strong_yes">Fortemente Recomendado</SelectItem>
                    <SelectItem value="yes">Recomendado</SelectItem>
                    <SelectItem value="maybe">Talvez</SelectItem>
                    <SelectItem value="no">Não Recomendado</SelectItem>
                    <SelectItem value="strong_no">Fortemente Não Recomendado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Pontos Fortes</Label>
                  <Textarea value={feedbackForm.strengths} onChange={(e) => setFeedbackForm({ ...feedbackForm, strengths: e.target.value })} rows={3} />
                </div>
                <div>
                  <Label>Pontos a Melhorar</Label>
                  <Textarea value={feedbackForm.weaknesses} onChange={(e) => setFeedbackForm({ ...feedbackForm, weaknesses: e.target.value })} rows={3} />
                </div>
              </div>

              <div>
                <Label>Observações Adicionais</Label>
                <Textarea value={feedbackForm.additional_notes} onChange={(e) => setFeedbackForm({ ...feedbackForm, additional_notes: e.target.value })} rows={3} />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>Cancelar</Button>
                <Button onClick={handleSaveFeedback}>Salvar Avaliação</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Candidate Comparison Dialog */}
        <Dialog open={showComparison} onOpenChange={setShowComparison}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Comparação de Candidatos
              </DialogTitle>
            </DialogHeader>
            <div className="flex justify-end mb-4">
              <Button variant="outline" size="sm" onClick={() => setCompareList([])}>
                Limpar Seleção
              </Button>
            </div>
            <div className={`grid gap-4 ${candidatesForComparison.length === 2 ? 'grid-cols-2' : candidatesForComparison.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {candidatesForComparison.map(candidate => {
                const jo = jobOpenings.find(j => j.id === candidate.job_opening_id);
                const avgRating = getCandidateAverageRating(candidate.id);
                const candidateInterviewsList = interviews.filter(i => i.candidate_id === candidate.id);
                return (
                  <Card key={candidate.id} className="relative">
                    <button 
                      onClick={() => toggleCompareCandidate(candidate.id)}
                      className="absolute top-2 right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 text-xs"
                    >
                      ✕
                    </button>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{candidate.full_name}</CardTitle>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge className={`${STAGE_COLORS[candidate.current_stage]} text-xs`}>
                          {STAGE_LABELS[candidate.current_stage]}
                        </Badge>
                        {avgRating && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />{avgRating}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {/* Contact Info */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Contato</p>
                        <p>{candidate.email || '-'}</p>
                        <p>{candidate.phone || '-'}</p>
                      </div>

                      {/* Position */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Cargo Pretendido</p>
                        <p>{candidate.position_applied || '-'}</p>
                      </div>

                      {/* Job Opening */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Vaga</p>
                        <p>{jo?.title || 'Banco de Talentos'}</p>
                      </div>

                      {/* Registration Date */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Cadastro</p>
                        <p>{format(new Date(candidate.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
                      </div>

                      {/* Test Score */}
                      {candidate.test_score !== null && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase">Nota da Prova</p>
                          <p className="text-lg font-bold">{candidate.test_score}</p>
                        </div>
                      )}

                      {/* Interview Count */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Entrevistas</p>
                        <p>{candidateInterviewsList.length} realizada(s)</p>
                      </div>

                      {/* Resume */}
                      {candidate.resume_url && (
                        <div className="flex gap-2 mt-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => previewResume(candidate.resume_url!, candidate.resume_file_name || 'curriculo.pdf')}
                          >
                            <Eye className="h-4 w-4 mr-1" />Ver
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => downloadFile(candidate.resume_url!, candidate.resume_file_name || 'curriculo.pdf')}
                          >
                            <Download className="h-4 w-4 mr-1" />Baixar
                          </Button>
                        </div>
                      )}

                      {/* Summary */}
                      {candidate.extracted_data?.summary && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase">Resumo</p>
                          <p className="text-xs bg-muted p-2 rounded-md line-clamp-4">{candidate.extracted_data.summary}</p>
                        </div>
                      )}

                      {/* Skills from extracted data */}
                      {candidate.extracted_data?.skills && candidate.extracted_data.skills.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase">Habilidades</p>
                          <div className="flex flex-wrap gap-1">
                            {candidate.extracted_data.skills.slice(0, 5).map((skill: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
                            ))}
                            {candidate.extracted_data.skills.length > 5 && (
                              <Badge variant="outline" className="text-xs">+{candidate.extracted_data.skills.length - 5}</Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* View Details Button */}
                      <Button 
                        size="sm" 
                        variant="default" 
                        className="w-full"
                        onClick={() => { 
                          setShowComparison(false);
                          setSelectedCandidate(candidate); 
                          fetchCandidateDetails(candidate.id); 
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />Ver Detalhes
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        {/* Send to Talent Pool Dialog */}
        <Dialog open={showSendToTalentPool} onOpenChange={setShowSendToTalentPool}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-amber-600" />
                Enviar ao Banco de Talentos
              </DialogTitle>
            </DialogHeader>
            {talentPoolCandidate && (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Confirma que deseja enviar <span className="font-semibold">{talentPoolCandidate.full_name}</span> para o banco de talentos como candidato viável para futura contratação?
                </p>
                
                {talentPoolCandidate.job_opening_id && (
                  <div className="bg-muted p-3 rounded-md text-sm">
                    <p className="font-medium mb-1">Vaga de origem:</p>
                    <p className="text-muted-foreground">
                      {jobOpenings.find(j => j.id === talentPoolCandidate.job_opening_id)?.title || 'Não identificada'}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="talent-pool-notes">Observações (opcional)</Label>
                  <Textarea
                    id="talent-pool-notes"
                    placeholder="Ex: Segunda opção no processo seletivo. Excelente candidato para futura oportunidade..."
                    value={talentPoolNotes}
                    onChange={(e) => setTalentPoolNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowSendToTalentPool(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSendToTalentPool} className="bg-amber-600 hover:bg-amber-700">
                    <Archive className="h-4 w-4 mr-2" />
                    Confirmar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        {/* Edit Position Dialog */}
        <Dialog open={showEditPosition} onOpenChange={setShowEditPosition}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Editar Cargo Pretendido
              </DialogTitle>
            </DialogHeader>
            {editPositionCandidate && (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Editando cargo de <span className="font-semibold">{editPositionCandidate.full_name}</span>
                </p>
                <div className="space-y-2">
                  <Label>Cargo Pretendido</Label>
                  <Input
                    placeholder="Ex: Advogado, Estagiário..."
                    value={editPositionValue}
                    onChange={(e) => setEditPositionValue(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowEditPosition(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdatePosition}>
                    <Check className="h-4 w-4 mr-2" />
                    Salvar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        {/* Edit Contact Dialog */}
        <Dialog open={showEditContact} onOpenChange={setShowEditContact}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Editar Contato
              </DialogTitle>
            </DialogHeader>
            {editContactCandidate && (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Editando contato de <span className="font-semibold">{editContactCandidate.full_name}</span>
                </p>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={editContactEmail}
                    onChange={(e) => setEditContactEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={editContactPhone}
                    onChange={(e) => setEditContactPhone(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowEditContact(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdateContact}>
                    <Check className="h-4 w-4 mr-2" />
                    Salvar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Resume Preview Dialog */}
        <Dialog open={showResumePreview} onOpenChange={setShowResumePreview}>
          <DialogContent className="max-w-4xl h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {previewFileName}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 h-full">
              {previewUrl && (
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true`}
                  className="w-full h-[calc(80vh-120px)] border rounded-md"
                  title="Preview do Currículo"
                />
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => window.open(previewUrl!, '_blank')}>
                <Eye className="h-4 w-4 mr-2" />Abrir em Nova Aba
              </Button>
              <Button onClick={() => downloadFile(previewFilePath, previewFileName)}>
                <Download className="h-4 w-4 mr-2" />Baixar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

// Eliminate Dialog Component
function EliminateDialog({ candidateId, onEliminate }: { candidateId: string; onEliminate: (id: string, reason: EliminationReason, notes: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<EliminationReason>('outro');
  const [notes, setNotes] = useState('');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive"><XCircle className="h-4 w-4 mr-1" />Eliminar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Eliminar Candidato</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Motivo</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as EliminationReason)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ELIMINATION_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { onEliminate(candidateId, reason, notes); setOpen(false); }}>Confirmar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
