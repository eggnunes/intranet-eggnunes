import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar, Users, Building2 } from 'lucide-react';

interface PublicationPreviewProps {
  publication: {
    date: string;
    event_date?: string;
    process_number?: string;
    lawsuit_number?: string;
    title?: string;
    header?: string;
    description?: string;
    customers?: string;
    court?: string;
  };
}

function extractCourtCode(header: string | undefined): string {
  if (!header) return 'Desconhecido';
  const match = header.match(/^([A-Z0-9]+)\s*-/);
  return match ? match[1] : header.split(' ')[0] || 'Desconhecido';
}

export function PublicationPreview({ publication }: PublicationPreviewProps) {
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    try {
      return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const courtCode = publication.court || extractCourtCode(publication.header);

  return (
    <Card className="bg-muted/30 border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Dados da Publicação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Processo */}
        <div className="flex items-start gap-2">
          <Badge variant="secondary" className="shrink-0">
            {publication.process_number || publication.lawsuit_number || 'Sem número'}
          </Badge>
          <Badge variant="outline" className="shrink-0">
            <Building2 className="h-3 w-3 mr-1" />
            {courtCode}
          </Badge>
        </div>

        {/* Datas */}
        <div className="space-y-1">
          {publication.date && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span className="font-medium">Publicado:</span>
              <span>{formatDate(publication.date)}</span>
            </div>
          )}
          {publication.event_date && publication.event_date !== publication.date && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span className="font-medium">Evento:</span>
              <span>{formatDate(publication.event_date)}</span>
            </div>
          )}
        </div>

        {/* Título/Descrição */}
        {(publication.title || publication.header || publication.description) && (
          <div className="p-2 bg-background rounded border">
            <p className="text-xs text-muted-foreground mb-1">Conteúdo:</p>
            <p className="text-sm line-clamp-4">
              {publication.description || publication.title || publication.header}
            </p>
          </div>
        )}

        {/* Cliente */}
        {publication.customers && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-3 w-3" />
            <span className="font-medium">Cliente(s):</span>
            <span className="truncate">{publication.customers}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
