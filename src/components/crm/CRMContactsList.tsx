import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Search, Eye, Mail, Phone, Building, MapPin, Globe, Linkedin, Twitter, Facebook, Calendar, Tag, FileText, Edit2, Save, X, History, UserCircle, CheckCircle, Circle, Video, MessageSquare, Package, Award, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lead_score: number | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  created_at: string;
  updated_at: string;
  website: string | null;
  linkedin: string | null;
  twitter: string | null;
  facebook: string | null;
  birthday: string | null;
  first_conversion: string | null;
  last_conversion: string | null;
  notes: string | null;
  rd_station_id: string | null;
  custom_fields: Record<string, unknown> | null;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  owner_id: string | null;
}

interface Deal {
  id: string;
  name: string;
  value: number;
  product_name: string | null;
  owner_id: string | null;
  campaign_name: string | null;
  stage?: {
    name: string;
    is_won: boolean;
    is_lost: boolean;
  };
}

interface CRMContactsListProps {
  syncEnabled: boolean;
}

export const CRMContactsList = ({ syncEnabled }: CRMContactsListProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);
  const [contactActivities, setContactActivities] = useState<Activity[]>([]);
  const [contactDeals, setContactDeals] = useState<Deal[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string }>>({});
  const [contactDealsMap, setContactDealsMap] = useState<Record<string, { owner_id: string | null; product_name: string | null; campaign_name: string | null }>>({});

  useEffect(() => {
    fetchContacts();
    fetchProfiles();
    fetchContactDealsMapping();
  }, []);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name');
    
    if (!error && data) {
      const profileMap: Record<string, { full_name: string }> = {};
      data.forEach(p => {
        profileMap[p.id] = { full_name: p.full_name };
      });
      setProfiles(profileMap);
    }
  };

  const fetchContactDealsMapping = async () => {
    // Fetch first deal for each contact to show owner, product and campaign
    const { data: deals } = await supabase
      .from('crm_deals')
      .select('contact_id, owner_id, product_name, campaign_name')
      .not('contact_id', 'is', null);
    
    if (deals) {
      const mapping: Record<string, { owner_id: string | null; product_name: string | null; campaign_name: string | null }> = {};
      deals.forEach(deal => {
        if (deal.contact_id && !mapping[deal.contact_id]) {
          mapping[deal.contact_id] = { 
            owner_id: deal.owner_id, 
            product_name: deal.product_name,
            campaign_name: deal.campaign_name 
          };
        }
      });
      setContactDealsMap(mapping);
    }
  };

  const fetchContacts = async () => {
    try {
      const allContacts: Contact[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('crm_contacts')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          console.error('Error fetching contacts:', error);
          break;
        }

        if (data && data.length > 0) {
          allContacts.push(...(data as Contact[]));
          page++;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      setContacts(allContacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
    setLoading(false);
  };

  const fetchContactDetails = async (contactId: string, contactRdStationId: string | null) => {
    setLoadingDetails(true);
    try {
      // First fetch deals associated with this contact
      const { data: deals } = await supabase
        .from('crm_deals')
        .select(`
          id, name, value, product_name, owner_id, rd_station_id, campaign_name,
          stage:crm_deal_stages(name, is_won, is_lost)
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });
      
      setContactDeals(deals as Deal[] || []);

      // Fetch activities - try multiple approaches
      let allActivities: Activity[] = [];
      
      // 1. Try by contact_id
      const { data: activitiesByContact } = await supabase
        .from('crm_activities')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });
      
      if (activitiesByContact && activitiesByContact.length > 0) {
        allActivities = [...activitiesByContact];
      }
      
      // 2. Also fetch by deal_ids associated with this contact
      if (deals && deals.length > 0) {
        const dealIds = deals.map(d => d.id);
        const { data: activitiesByDeal } = await supabase
          .from('crm_activities')
          .select('*')
          .in('deal_id', dealIds)
          .order('created_at', { ascending: false });
        
        if (activitiesByDeal && activitiesByDeal.length > 0) {
          // Merge and dedupe
          const existingIds = new Set(allActivities.map(a => a.id));
          activitiesByDeal.forEach(a => {
            if (!existingIds.has(a.id)) {
              allActivities.push(a as Activity);
            }
          });
        }
      }
      
      // 3. If still empty, try to fetch all activities and filter by deal name matching contact name
      if (allActivities.length === 0) {
        const { data: contact } = await supabase
          .from('crm_contacts')
          .select('name')
          .eq('id', contactId)
          .single();
        
        if (contact?.name) {
          // Find deals by contact name
          const { data: dealsByName } = await supabase
            .from('crm_deals')
            .select('id')
            .ilike('name', `%${contact.name}%`);
          
          if (dealsByName && dealsByName.length > 0) {
            const dealIdsByName = dealsByName.map(d => d.id);
            const { data: activitiesByDealName } = await supabase
              .from('crm_activities')
              .select('*')
              .in('deal_id', dealIdsByName)
              .order('created_at', { ascending: false });
            
            if (activitiesByDealName) {
              allActivities = activitiesByDealName as Activity[];
            }
          }
        }
      }
      
      // Sort by created_at descending
      allActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setContactActivities(allActivities);
    } catch (error) {
      console.error('Error fetching contact details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    setIsEditing(false);
    setContactActivities([]);
    setContactDeals([]);
    fetchContactDetails(contact.id, contact.rd_station_id);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'meeting': return <Video className="h-4 w-4" />;
      case 'task': return <CheckCircle className="h-4 w-4" />;
      case 'note': return <FileText className="h-4 w-4" />;
      case 'whatsapp': return <MessageSquare className="h-4 w-4" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  const getActivityTypeName = (type: string) => {
    const types: Record<string, string> = {
      call: 'Ligação', email: 'E-mail', meeting: 'Reunião',
      task: 'Tarefa', note: 'Nota', whatsapp: 'WhatsApp'
    };
    return types[type] || type;
  };

  const filteredContacts = contacts.filter(contact => {
    const search = searchTerm.toLowerCase();
    return (
      contact.name?.toLowerCase().includes(search) ||
      contact.email?.toLowerCase().includes(search) ||
      contact.phone?.includes(search) ||
      contact.company?.toLowerCase().includes(search)
    );
  });

  const handleEditClick = () => {
    if (selectedContact) {
      setEditForm({ ...selectedContact });
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSaveContact = async () => {
    if (!selectedContact || !editForm) return;

    setSaving(true);
    try {
      // Update local database
      const { error: dbError } = await supabase
        .from('crm_contacts')
        .update({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone,
          company: editForm.company,
          job_title: editForm.job_title,
          address: editForm.address,
          city: editForm.city,
          state: editForm.state,
          country: editForm.country,
          website: editForm.website,
          linkedin: editForm.linkedin,
          twitter: editForm.twitter,
          facebook: editForm.facebook,
          birthday: editForm.birthday,
          notes: editForm.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedContact.id);

      if (dbError) throw dbError;

      // If sync is enabled and contact has RD Station ID, sync to RD Station
      if (syncEnabled && selectedContact.rd_station_id) {
        const { error: syncError } = await supabase.functions.invoke('crm-sync', {
          body: {
            action: 'update_contact',
            data: {
              contact_id: selectedContact.id,
              rd_station_id: selectedContact.rd_station_id,
              updates: {
                name: editForm.name,
                email: editForm.email,
                phone: editForm.phone,
                company: editForm.company,
                job_title: editForm.job_title,
                city: editForm.city,
                state: editForm.state,
                country: editForm.country,
                website: editForm.website,
                linkedin: editForm.linkedin,
                twitter: editForm.twitter,
                facebook: editForm.facebook,
                birthday: editForm.birthday,
                notes: editForm.notes
              }
            }
          }
        });

        if (syncError) {
          console.error('Error syncing to RD Station:', syncError);
          toast.warning('Contato salvo localmente, mas houve erro ao sincronizar com RD Station');
        } else {
          toast.success('Contato atualizado e sincronizado com RD Station');
        }
      } else {
        toast.success('Contato atualizado com sucesso');
      }

      // Update local state
      const updatedContact = { ...selectedContact, ...editForm, updated_at: new Date().toISOString() };
      setSelectedContact(updatedContact as Contact);
      setContacts(prev => prev.map(c => c.id === selectedContact.id ? updatedContact as Contact : c));
      setIsEditing(false);
      setEditForm({});

    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error('Erro ao salvar contato');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contatos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{filteredContacts.length} contatos</Badge>
      </div>

      {/* Contacts table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Telefone</TableHead>
                <TableHead className="hidden lg:table-cell">Responsável</TableHead>
                <TableHead className="hidden lg:table-cell">Produto</TableHead>
                <TableHead className="hidden md:table-cell">Origem</TableHead>
                <TableHead className="hidden md:table-cell">Qualificado</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {contacts.length === 0 
                      ? 'Nenhum contato. Sincronize com o RD Station.'
                      : 'Nenhum contato encontrado.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => {
                  // Get first deal to show owner, product and campaign
                  const contactDeal = contactDealsMap[contact.id];
                  const ownerName = contactDeal?.owner_id && profiles[contactDeal.owner_id] 
                    ? profiles[contactDeal.owner_id].full_name 
                    : null;
                  // Origin: use utm_source, or campaign_name from deal as fallback
                  const origin = contact.utm_source || contactDeal?.campaign_name;
                  const isQualified = (contact.lead_score || 0) > 0;
                  
                  return (
                    <TableRow 
                      key={contact.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSelectContact(contact)}
                    >
                      <TableCell className="font-medium text-primary hover:underline">
                        {contact.name}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {contact.email && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[150px]">{contact.email}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {contact.phone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {ownerName ? (
                          <div className="flex items-center gap-1 text-sm">
                            <UserCircle className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[100px]">{ownerName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {contactDeal?.product_name ? (
                          <Badge variant="secondary" className="text-xs truncate max-w-[120px]">
                            <Package className="h-3 w-3 mr-1" />
                            {contactDeal.product_name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {origin ? (
                          <Badge variant="outline" className="text-xs truncate max-w-[120px]">
                            <Target className="h-3 w-3 mr-1" />
                            {origin}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {isQualified ? (
                          <Badge variant="default" className="text-xs bg-green-600">
                            <Award className="h-3 w-3 mr-1" />
                            Sim
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Não
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(contact.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Contact detail modal */}
      <Dialog open={!!selectedContact} onOpenChange={() => { setSelectedContact(null); setIsEditing(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{isEditing ? 'Editar Contato' : selectedContact?.name}</DialogTitle>
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={handleEditClick}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
            </div>
          </DialogHeader>
          
          {selectedContact && !isEditing && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="deals">
                  <Package className="h-4 w-4 mr-1" />
                  Oportunidades ({contactDeals.length})
                </TabsTrigger>
                <TabsTrigger value="history">
                  <History className="h-4 w-4 mr-1" />
                  Histórico
                </TabsTrigger>
              </TabsList>

              {/* Info Tab */}
              <TabsContent value="info" className="space-y-6 mt-4">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Informações de Contato</h4>
                    
                    {selectedContact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${selectedContact.email}`} className="text-primary hover:underline">
                          {selectedContact.email}
                        </a>
                      </div>
                    )}
                    
                    {selectedContact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${selectedContact.phone}`} className="text-primary hover:underline">
                          {selectedContact.phone}
                        </a>
                      </div>
                    )}

                    {selectedContact.birthday && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Aniversário: {new Date(selectedContact.birthday).toLocaleDateString('pt-BR')}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Empresa</h4>
                    
                    {selectedContact.company && (
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedContact.company}</span>
                      </div>
                    )}
                    
                    {selectedContact.job_title && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedContact.job_title}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Address */}
                {(selectedContact.address || selectedContact.city || selectedContact.state || selectedContact.country) && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Endereço</h4>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        {selectedContact.address && <p>{selectedContact.address}</p>}
                        <p>{[selectedContact.city, selectedContact.state, selectedContact.country].filter(Boolean).join(', ')}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Social Media */}
                {(selectedContact.website || selectedContact.linkedin || selectedContact.twitter || selectedContact.facebook) && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Redes Sociais</h4>
                    <div className="flex flex-wrap gap-3">
                      {selectedContact.website && (
                        <a href={selectedContact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <Globe className="h-4 w-4" /> Website
                        </a>
                      )}
                      {selectedContact.linkedin && (
                        <a href={selectedContact.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <Linkedin className="h-4 w-4" /> LinkedIn
                        </a>
                      )}
                      {selectedContact.twitter && (
                        <a href={selectedContact.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <Twitter className="h-4 w-4" /> Twitter
                        </a>
                      )}
                      {selectedContact.facebook && (
                        <a href={selectedContact.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <Facebook className="h-4 w-4" /> Facebook
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Tracking & Origin Info - Always show this section */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Origem e Tracking</h4>
                  
                  {/* Qualification Status */}
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-1">Status de Qualificação</p>
                    {(selectedContact.lead_score || 0) > 0 ? (
                      <Badge variant="default" className="bg-green-600">
                        <Award className="h-3 w-3 mr-1" />
                        Lead Qualificado ({selectedContact.lead_score} pontos)
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Não Qualificado
                      </Badge>
                    )}
                  </div>
                  
                  {/* UTM or Campaign Info */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedContact.utm_source && <Badge variant="outline"><Tag className="h-3 w-3 mr-1" />Fonte: {selectedContact.utm_source}</Badge>}
                    {selectedContact.utm_medium && <Badge variant="outline">Mídia: {selectedContact.utm_medium}</Badge>}
                    {selectedContact.utm_campaign && <Badge variant="outline">Campanha UTM: {selectedContact.utm_campaign}</Badge>}
                    {selectedContact.utm_content && <Badge variant="outline">Conteúdo: {selectedContact.utm_content}</Badge>}
                    {selectedContact.utm_term && <Badge variant="outline">Termo: {selectedContact.utm_term}</Badge>}
                  </div>
                  
                  {/* Campaign from deals if no UTM */}
                  {!selectedContact.utm_source && !selectedContact.utm_campaign && contactDeals.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {contactDeals.filter(d => d.campaign_name).map(deal => (
                        <Badge key={deal.id} variant="outline">
                          <Target className="h-3 w-3 mr-1" />
                          Campanha: {deal.campaign_name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {/* Show message if no tracking data */}
                  {!selectedContact.utm_source && !selectedContact.utm_campaign && contactDeals.filter(d => d.campaign_name).length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma informação de origem disponível</p>
                  )}
                </div>

                {/* Conversions */}
                {(selectedContact.first_conversion || selectedContact.last_conversion) && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Conversões</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedContact.first_conversion && (
                        <div>
                          <p className="text-xs text-muted-foreground">Primeira Conversão</p>
                          <p className="text-sm">{selectedContact.first_conversion}</p>
                        </div>
                      )}
                      {selectedContact.last_conversion && (
                        <div>
                          <p className="text-xs text-muted-foreground">Última Conversão</p>
                          <p className="text-sm">{selectedContact.last_conversion}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedContact.notes && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">Observações</h4>
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">{selectedContact.notes}</p>
                  </div>
                )}

                {/* Custom Fields */}
                {selectedContact.custom_fields && Object.keys(selectedContact.custom_fields).length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Campos Personalizados</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(selectedContact.custom_fields).map(([key, value]) => (
                        <div key={key} className="bg-muted/50 p-2 rounded">
                          <p className="text-xs text-muted-foreground">{key}</p>
                          <p className="text-sm">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="border-t pt-4 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    {selectedContact.rd_station_id && (
                      <div>
                        <p className="text-xs text-muted-foreground">ID RD Station</p>
                        <p className="text-xs font-mono">{selectedContact.rd_station_id}</p>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Criado em</p>
                    <p className="text-sm">{new Date(selectedContact.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </TabsContent>

              {/* Deals Tab */}
              <TabsContent value="deals" className="space-y-4 mt-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Oportunidades e Produtos</h4>
                
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : contactDeals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma oportunidade associada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contactDeals.map((deal) => (
                      <Card key={deal.id}>
                        <CardContent className="py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{deal.name}</p>
                              {deal.product_name && (
                                <p className="text-xs text-violet-600 mt-1 flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  {deal.product_name}
                                </p>
                              )}
                              {deal.campaign_name && (
                                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                  <Target className="h-3 w-3" />
                                  Campanha: {deal.campaign_name}
                                </p>
                              )}
                              {deal.owner_id && profiles[deal.owner_id] && (
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                  <UserCircle className="h-3 w-3" />
                                  Responsável: {profiles[deal.owner_id].full_name}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              {deal.value > 0 && (
                                <p className="text-sm font-semibold text-emerald-600">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value)}
                                </p>
                              )}
                              {deal.stage && (
                                <Badge variant={deal.stage.is_won ? 'default' : deal.stage.is_lost ? 'destructive' : 'secondary'} className="text-xs mt-1">
                                  {deal.stage.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="space-y-4 mt-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Histórico de Atividades</h4>
                
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : contactActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma atividade registrada</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {contactActivities.map((activity) => (
                        <Card key={activity.id} className={activity.completed ? 'opacity-60' : ''}>
                          <CardContent className="py-3">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-full shrink-0 ${activity.completed ? 'bg-green-500/10 text-green-600' : 'bg-primary/10 text-primary'}`}>
                                {getActivityIcon(activity.type)}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className={`font-medium text-sm ${activity.completed ? 'line-through' : ''}`}>
                                      {activity.title}
                                    </p>
                                    {activity.description && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {activity.description}
                                      </p>
                                    )}
                                  </div>
                                  <Badge variant="secondary" className="shrink-0 text-xs">
                                    {getActivityTypeName(activity.type)}
                                  </Badge>
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  {activity.owner_id && profiles[activity.owner_id] && (
                                    <span className="flex items-center gap-1">
                                      <UserCircle className="h-3 w-3" />
                                      {profiles[activity.owner_id].full_name}
                                    </span>
                                  )}
                                  {activity.due_date && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(activity.due_date).toLocaleDateString('pt-BR')}
                                    </span>
                                  )}
                                  <span>
                                    Criado: {new Date(activity.created_at).toLocaleDateString('pt-BR')}
                                  </span>
                                  {activity.completed && (
                                    <Badge variant="outline" className="text-green-600 border-green-600/20 text-xs">
                                      Concluída
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* Edit Form */}
          {selectedContact && isEditing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editForm.email || ''}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={editForm.phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Empresa</Label>
                  <Input
                    id="company"
                    value={editForm.company || ''}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job_title">Cargo</Label>
                  <Input
                    id="job_title"
                    value={editForm.job_title || ''}
                    onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthday">Data de Nascimento</Label>
                  <Input
                    id="birthday"
                    type="date"
                    value={editForm.birthday || ''}
                    onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={editForm.address || ''}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={editForm.city || ''}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={editForm.state || ''}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">País</Label>
                  <Input
                    id="country"
                    value={editForm.country || ''}
                    onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={editForm.website || ''}
                    onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedin">LinkedIn</Label>
                  <Input
                    id="linkedin"
                    value={editForm.linkedin || ''}
                    onChange={(e) => setEditForm({ ...editForm, linkedin: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter">Twitter</Label>
                  <Input
                    id="twitter"
                    value={editForm.twitter || ''}
                    onChange={(e) => setEditForm({ ...editForm, twitter: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input
                    id="facebook"
                    value={editForm.facebook || ''}
                    onChange={(e) => setEditForm({ ...editForm, facebook: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  value={editForm.notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleSaveContact} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar {syncEnabled && selectedContact.rd_station_id && '(+ RD Station)'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
