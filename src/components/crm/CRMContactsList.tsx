import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Search, Eye, Mail, Phone, Building, MapPin, Globe, Linkedin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  city: string | null;
  state: string | null;
  lead_score: number;
  utm_source: string | null;
  utm_campaign: string | null;
  created_at: string;
  website: string | null;
  linkedin: string | null;
  notes: string | null;
}

interface CRMContactsListProps {
  syncEnabled: boolean;
}

export const CRMContactsList = ({ syncEnabled }: CRMContactsListProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from('crm_contacts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching contacts:', error);
    } else {
      setContacts(data || []);
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
                        onClick={() => setSelectedContact(contact)}
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
      <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedContact?.name}</DialogTitle>
          </DialogHeader>
          
          {selectedContact && (
            <div className="space-y-6">
              {/* Contact info */}
              <div className="grid grid-cols-2 gap-4">
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
                
                {selectedContact.company && (
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedContact.company}</span>
                    {selectedContact.job_title && (
                      <span className="text-muted-foreground">- {selectedContact.job_title}</span>
                    )}
                  </div>
                )}
                
                {(selectedContact.city || selectedContact.state) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {[selectedContact.city, selectedContact.state].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                
                {selectedContact.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a href={selectedContact.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {selectedContact.website}
                    </a>
                  </div>
                )}
                
                {selectedContact.linkedin && (
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                    <a href={selectedContact.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      LinkedIn
                    </a>
                  </div>
                )}
              </div>

              {/* UTM Info */}
              {(selectedContact.utm_source || selectedContact.utm_campaign) && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Origem do Lead</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedContact.utm_source && (
                      <Badge variant="outline">
                        Fonte: {selectedContact.utm_source}
                      </Badge>
                    )}
                    {selectedContact.utm_campaign && (
                      <Badge variant="outline">
                        Campanha: {selectedContact.utm_campaign}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedContact.notes && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Observações</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedContact.notes}
                  </p>
                </div>
              )}

              {/* Lead Score */}
              <div className="border-t pt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Lead Score</span>
                <Badge variant={selectedContact.lead_score > 50 ? 'default' : 'secondary'}>
                  {selectedContact.lead_score} pontos
                </Badge>
              </div>

              {syncEnabled && (
                <div className="border-t pt-4">
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                    Edição desabilitada - Modo espelho RD Station
                  </Badge>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
