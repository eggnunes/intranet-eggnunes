import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Search, Eye, Mail, Phone, Building, MapPin, Globe, Linkedin, Twitter, Facebook, Calendar, Tag, FileText, Edit2, Save, X } from 'lucide-react';
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

  useEffect(() => {
    fetchContacts();
  }, []);

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
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Data</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {contacts.length === 0 
                      ? 'Nenhum contato. Sincronize com o RD Station.'
                      : 'Nenhum contato encontrado.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>
                      {contact.email && (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">{contact.email}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.company && (
                        <div className="flex items-center gap-1 text-sm">
                          <Building className="h-3 w-3 text-muted-foreground" />
                          <span>{contact.company}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.utm_source && (
                        <Badge variant="outline" className="text-xs">
                          {contact.utm_source}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(contact.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedContact(contact);
                          setIsEditing(false);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
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
            <div className="space-y-6">
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
                        <Globe className="h-4 w-4" />
                        Website
                      </a>
                    )}
                    {selectedContact.linkedin && (
                      <a href={selectedContact.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        <Linkedin className="h-4 w-4" />
                        LinkedIn
                      </a>
                    )}
                    {selectedContact.twitter && (
                      <a href={selectedContact.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        <Twitter className="h-4 w-4" />
                        Twitter
                      </a>
                    )}
                    {selectedContact.facebook && (
                      <a href={selectedContact.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        <Facebook className="h-4 w-4" />
                        Facebook
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* UTM Info */}
              {(selectedContact.utm_source || selectedContact.utm_medium || selectedContact.utm_campaign || selectedContact.utm_content || selectedContact.utm_term) && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Origem do Lead (UTM)</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedContact.utm_source && (
                      <Badge variant="outline">
                        <Tag className="h-3 w-3 mr-1" />
                        Fonte: {selectedContact.utm_source}
                      </Badge>
                    )}
                    {selectedContact.utm_medium && (
                      <Badge variant="outline">
                        Mídia: {selectedContact.utm_medium}
                      </Badge>
                    )}
                    {selectedContact.utm_campaign && (
                      <Badge variant="outline">
                        Campanha: {selectedContact.utm_campaign}
                      </Badge>
                    )}
                    {selectedContact.utm_content && (
                      <Badge variant="outline">
                        Conteúdo: {selectedContact.utm_content}
                      </Badge>
                    )}
                    {selectedContact.utm_term && (
                      <Badge variant="outline">
                        Termo: {selectedContact.utm_term}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

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
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
                    {selectedContact.notes}
                  </p>
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
                  <div>
                    <p className="text-xs text-muted-foreground">Lead Score</p>
                    <Badge variant={selectedContact.lead_score && selectedContact.lead_score > 50 ? 'default' : 'secondary'}>
                      {selectedContact.lead_score || 0} pontos
                    </Badge>
                  </div>
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
                  {selectedContact.updated_at && (
                    <>
                      <p className="text-xs text-muted-foreground mt-1">Atualizado em</p>
                      <p className="text-sm">{new Date(selectedContact.updated_at).toLocaleString('pt-BR')}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
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
