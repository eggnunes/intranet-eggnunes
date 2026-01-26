import { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { User, Mail, Phone, GripVertical, FileText, Eye, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

interface Candidate {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  position_applied: string | null;
  resume_url: string | null;
  current_stage: RecruitmentStage;
  created_at: string;
  [key: string]: any;
}

interface RecruitmentKanbanProps {
  candidates: Candidate[];
  onStageChange: (candidateId: string, newStage: RecruitmentStage) => void;
  onViewCandidate: (candidate: Candidate) => void;
  canEdit: boolean;
}

const STAGE_ORDER: RecruitmentStage[] = [
  'curriculo_recebido',
  'entrevista_agendada',
  'entrevista_realizada',
  'aguardando_prova',
  'prova_realizada',
  'entrevista_presencial_agendada',
  'entrevista_presencial_realizada',
  'contratado',
  'eliminado'
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
  curriculo_recebido: 'bg-blue-500 border-blue-600',
  entrevista_agendada: 'bg-yellow-500 border-yellow-600',
  entrevista_realizada: 'bg-orange-500 border-orange-600',
  aguardando_prova: 'bg-purple-500 border-purple-600',
  prova_realizada: 'bg-indigo-500 border-indigo-600',
  entrevista_presencial_agendada: 'bg-cyan-500 border-cyan-600',
  entrevista_presencial_realizada: 'bg-teal-500 border-teal-600',
  contratado: 'bg-green-500 border-green-600',
  eliminado: 'bg-red-500 border-red-600'
};

const STAGE_BG_COLORS: Record<RecruitmentStage, string> = {
  curriculo_recebido: 'bg-blue-50 dark:bg-blue-950/20',
  entrevista_agendada: 'bg-yellow-50 dark:bg-yellow-950/20',
  entrevista_realizada: 'bg-orange-50 dark:bg-orange-950/20',
  aguardando_prova: 'bg-purple-50 dark:bg-purple-950/20',
  prova_realizada: 'bg-indigo-50 dark:bg-indigo-950/20',
  entrevista_presencial_agendada: 'bg-cyan-50 dark:bg-cyan-950/20',
  entrevista_presencial_realizada: 'bg-teal-50 dark:bg-teal-950/20',
  contratado: 'bg-green-50 dark:bg-green-950/20',
  eliminado: 'bg-red-50 dark:bg-red-950/20'
};

export function RecruitmentKanban({ candidates, onStageChange, onViewCandidate, canEdit }: RecruitmentKanbanProps) {
  const [draggedCandidate, setDraggedCandidate] = useState<Candidate | null>(null);
  const [dragOverStage, setDragOverStage] = useState<RecruitmentStage | null>(null);

  const getCandidatesByStage = (stage: RecruitmentStage) => {
    return candidates.filter(c => c.current_stage === stage);
  };

  // Desktop drag handlers
  const handleDragStart = (e: React.DragEvent, candidate: Candidate) => {
    if (!canEdit) return;
    setDraggedCandidate(candidate);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedCandidate(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e: React.DragEvent, stage: RecruitmentStage) => {
    if (!canEdit) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, targetStage: RecruitmentStage) => {
    if (!canEdit) return;
    e.preventDefault();
    if (draggedCandidate && draggedCandidate.current_stage !== targetStage) {
      onStageChange(draggedCandidate.id, targetStage);
    }
    setDraggedCandidate(null);
    setDragOverStage(null);
  };

  // Mobile: move via dropdown menu
  const handleMoveToStage = (candidate: Candidate, targetStage: RecruitmentStage) => {
    if (candidate.current_stage !== targetStage) {
      onStageChange(candidate.id, targetStage);
    }
  };

  return (
    <div className="w-full overflow-hidden -mx-4 px-4">
      {/* Kanban Container com scroll horizontal */}
      <div 
        id="recruitment-kanban-scroll"
        className="pb-6"
        style={{
          overflowX: 'scroll',
          overflowY: 'visible',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="inline-flex gap-4 py-2" style={{ minWidth: 'max-content' }}>
          {STAGE_ORDER.map(stage => {
            const stageCandidates = getCandidatesByStage(stage);
            const isDragOver = dragOverStage === stage;
            
            return (
              <div
                key={stage}
                className={`w-72 flex-shrink-0 flex flex-col rounded-lg border-2 transition-all ${
                  isDragOver ? 'border-primary border-dashed' : 'border-border'
                } ${STAGE_BG_COLORS[stage]}`}
                onDragOver={(e) => handleDragOver(e, stage)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage)}
              >
                <div className={`p-3 rounded-t-md ${STAGE_COLORS[stage]}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white text-sm truncate" title={STAGE_LABELS[stage]}>
                      {STAGE_LABELS[stage]}
                    </h3>
                    <Badge variant="secondary" className="bg-white/20 text-white border-0">
                      {stageCandidates.length}
                    </Badge>
                  </div>
                </div>
                
                <ScrollArea className="flex-1 max-h-[500px]">
                  <div className="p-2 space-y-2">
                    {stageCandidates.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Nenhum candidato
                      </div>
                    ) : (
                      stageCandidates.map(candidate => (
                        <Card
                          key={candidate.id}
                          className={`hover:shadow-md transition-shadow ${
                            draggedCandidate?.id === candidate.id ? 'opacity-50' : ''
                          }`}
                          draggable={canEdit}
                          onDragStart={(e) => handleDragStart(e, candidate)}
                          onDragEnd={handleDragEnd}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start gap-2">
                              {canEdit && (
                                <div className="flex-shrink-0 mt-0.5">
                                  {/* Desktop: drag handle */}
                                  <GripVertical className="h-4 w-4 text-muted-foreground hidden sm:block cursor-grab" />
                                  {/* Mobile: dropdown to move */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 sm:hidden"
                                      >
                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-56">
                                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                        Mover para:
                                      </div>
                                      {STAGE_ORDER.filter(s => s !== candidate.current_stage).map(targetStage => (
                                        <DropdownMenuItem
                                          key={targetStage}
                                          onClick={() => handleMoveToStage(candidate, targetStage)}
                                        >
                                          <div className={`w-2 h-2 rounded-full mr-2 ${STAGE_COLORS[targetStage].split(' ')[0]}`} />
                                          {STAGE_LABELS[targetStage]}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-medium text-sm truncate flex-1" title={candidate.full_name}>
                                    {candidate.full_name}
                                  </h4>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 flex-shrink-0"
                                    onClick={() => onViewCandidate(candidate)}
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                </div>
                                
                                {candidate.position_applied && (
                                  <p className="text-xs text-muted-foreground truncate" title={candidate.position_applied}>
                                    {candidate.position_applied}
                                  </p>
                                )}
                                
                                <div className="mt-2 space-y-1">
                                  {candidate.email && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Mail className="h-3 w-3 flex-shrink-0" />
                                      <span className="truncate" title={candidate.email}>{candidate.email}</span>
                                    </div>
                                  )}
                                  {candidate.phone && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Phone className="h-3 w-3 flex-shrink-0" />
                                      <span>{candidate.phone}</span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(candidate.created_at), 'dd/MM/yy', { locale: ptBR })}
                                  </span>
                                  {candidate.resume_url && (
                                    <FileText className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* CSS para scrollbar sempre visível e funcional */}
      <style>{`
        #recruitment-kanban-scroll {
          scrollbar-width: auto;
          scrollbar-color: hsl(var(--primary)) hsl(var(--muted));
        }
        #recruitment-kanban-scroll::-webkit-scrollbar {
          height: 16px;
          display: block !important;
        }
        #recruitment-kanban-scroll::-webkit-scrollbar-track {
          background: hsl(var(--muted));
          border-radius: 8px;
        }
        #recruitment-kanban-scroll::-webkit-scrollbar-thumb {
          background: hsl(var(--primary));
          border-radius: 8px;
          border: 3px solid hsl(var(--muted));
          cursor: grab;
        }
        #recruitment-kanban-scroll::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--primary) / 0.8);
        }
        #recruitment-kanban-scroll::-webkit-scrollbar-thumb:active {
          cursor: grabbing;
          background: hsl(var(--primary) / 0.7);
        }
      `}</style>
    </div>
  );
}
