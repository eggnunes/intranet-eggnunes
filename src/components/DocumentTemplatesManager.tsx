import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  FileText, 
  Scale, 
  FileCheck, 
  Plus, 
  Trash2, 
  Edit, 
  Loader2,
  Save,
  Eye,
  AlertTriangle
} from "lucide-react";

interface DocumentTemplate {
  id: string;
  type: 'procuracao' | 'contrato' | 'declaracao';
  name: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

interface DocumentTemplatesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DocumentTemplatesManager = ({ open, onOpenChange }: DocumentTemplatesManagerProps) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'procuracao' | 'contrato' | 'declaracao'>('procuracao');
  
  // Estado para criação/edição
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formContent, setFormContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Preview
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplate | null>(null);

  const { user } = useAuth();

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data as DocumentTemplate[]) || []);
    } catch (error) {
      console.error('Erro ao carregar modelos:', error);
      toast.error("Erro ao carregar modelos de documentos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'procuracao':
        return <Scale className="h-4 w-4" />;
      case 'contrato':
        return <FileText className="h-4 w-4" />;
      case 'declaracao':
        return <FileCheck className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'procuracao':
        return 'Procuração';
      case 'contrato':
        return 'Contrato';
      case 'declaracao':
        return 'Declaração';
      default:
        return type;
    }
  };

  const filteredTemplates = templates.filter(t => t.type === activeTab);

  const openNewForm = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormContent("");
    setShowForm(true);
  };

  const openEditForm = (template: DocumentTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormContent(template.content);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTemplate(null);
    setFormName("");
    setFormContent("");
  };

  const saveTemplate = async () => {
    if (!formName.trim() || !formContent.trim()) {
      toast.error("Preencha o nome e o conteúdo do modelo");
      return;
    }

    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        // Atualizar
        const { error } = await supabase
          .from('document_templates')
          .update({
            name: formName.trim(),
            content: formContent.trim(),
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success("Modelo atualizado com sucesso!");
      } else {
        // Criar
        const { error } = await supabase
          .from('document_templates')
          .insert({
            type: activeTab,
            name: formName.trim(),
            content: formContent.trim(),
            created_by: user.id,
          });

        if (error) throw error;
        toast.success("Modelo criado com sucesso!");
      }

      await loadTemplates();
      closeForm();
    } catch (error) {
      console.error('Erro ao salvar modelo:', error);
      toast.error("Erro ao salvar modelo");
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    setDeleting(templateId);
    try {
      const { error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success("Modelo excluído com sucesso!");
    } catch (error) {
      console.error('Erro ao excluir modelo:', error);
      toast.error("Erro ao excluir modelo");
    } finally {
      setDeleting(null);
    }
  };

  const toggleActive = async (template: DocumentTemplate) => {
    try {
      const { error } = await supabase
        .from('document_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);

      if (error) throw error;
      
      setTemplates(prev => 
        prev.map(t => t.id === template.id ? { ...t, is_active: !t.is_active } : t)
      );
      toast.success(template.is_active ? "Modelo desativado" : "Modelo ativado");
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error("Erro ao alterar status do modelo");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Gerenciar Modelos de Documentos
            </DialogTitle>
            <DialogDescription>
              Adicione, edite ou exclua modelos de procuração, contrato e declaração para justiça gratuita.
              Útil quando há mudanças no quadro de advogados do escritório.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="procuracao" className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                <span className="hidden sm:inline">Procuração</span>
              </TabsTrigger>
              <TabsTrigger value="contrato" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Contrato</span>
              </TabsTrigger>
              <TabsTrigger value="declaracao" className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Declaração</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {showForm ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">
                      {editingTemplate ? 'Editar Modelo' : `Novo Modelo de ${getTypeName(activeTab)}`}
                    </h3>
                    <Button variant="ghost" size="sm" onClick={closeForm}>
                      Cancelar
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="templateName">Nome do modelo *</Label>
                      <Input
                        id="templateName"
                        placeholder={`Ex: ${getTypeName(activeTab)} - Versão Atualizada 2024`}
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="templateContent">Conteúdo do modelo *</Label>
                      <p className="text-xs text-muted-foreground">
                        Use placeholders: [qualificação do cliente], [nome completo do cliente], [data], etc.
                      </p>
                      <Textarea
                        id="templateContent"
                        placeholder="Cole aqui o texto completo do modelo..."
                        value={formContent}
                        onChange={(e) => setFormContent(e.target.value)}
                        className="min-h-[300px] font-mono text-sm"
                      />
                    </div>

                    <Button onClick={saveTemplate} disabled={saving} className="w-full">
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {editingTemplate ? 'Salvar Alterações' : 'Criar Modelo'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {filteredTemplates.length} modelo(s) de {getTypeName(activeTab).toLowerCase()}
                    </p>
                    <Button size="sm" onClick={openNewForm}>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Modelo
                    </Button>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="font-medium mb-2">Nenhum modelo cadastrado</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Adicione um modelo de {getTypeName(activeTab).toLowerCase()} para usar na geração de documentos.
                        </p>
                        <Button onClick={openNewForm}>
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Modelo
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {filteredTemplates.map((template) => (
                          <Card key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
                            <CardHeader className="py-3">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  {getTypeIcon(template.type)}
                                  <CardTitle className="text-base">{template.name}</CardTitle>
                                  {!template.is_active && (
                                    <Badge variant="secondary" className="text-xs">Inativo</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setPreviewTemplate(template)}
                                    title="Visualizar"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditForm(template)}
                                    title="Editar"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleActive(template)}
                                    title={template.is_active ? 'Desativar' : 'Ativar'}
                                  >
                                    {template.is_active ? '✓' : '○'}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteTemplate(template.id)}
                                    disabled={deleting === template.id}
                                    className="text-destructive hover:text-destructive"
                                    title="Excluir"
                                  >
                                    {deleting === template.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                              <CardDescription className="text-xs">
                                Criado em {new Date(template.created_at).toLocaleDateString('pt-BR')}
                              </CardDescription>
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Pré-visualização: {previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <pre className="whitespace-pre-wrap text-sm font-mono p-4 bg-muted rounded-lg">
              {previewTemplate?.content}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
