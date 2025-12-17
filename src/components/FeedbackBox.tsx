import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquareHeart, Send, Shield, Eye, EyeOff } from 'lucide-react';

export const FeedbackBox = () => {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    if (!subject.trim() || !message.trim()) {
      toast.error('Preencha o assunto e a mensagem');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from('feedback_box')
        .insert({
          sender_id: user.id,
          subject: subject.trim(),
          message: message.trim(),
          is_anonymous: isAnonymous
        });

      if (error) throw error;

      // Create notification for Rafael
      const { data: rafaelProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', 'rafael@eggnunes.com.br')
        .single();

      if (rafaelProfile) {
        await supabase
          .from('user_notifications')
          .insert({
            user_id: rafaelProfile.id,
            title: 'Nova mensagem na Caixinha de Desabafo',
            message: isAnonymous 
              ? `Mensagem anônima: ${subject}` 
              : `Mensagem de ${user.user_metadata?.full_name || 'um colaborador'}: ${subject}`,
            type: 'feedback',
            action_url: '/caixinha-desabafo'
          });
      }

      toast.success('Mensagem enviada com sucesso!');
      setSubject('');
      setMessage('');
      setIsAnonymous(false);
    } catch (error) {
      console.error('Error sending feedback:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageSquareHeart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Caixinha de Desabafo</CardTitle>
            <CardDescription>
              Fale com os sócios de forma confidencial
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Assunto</Label>
            <Input
              id="subject"
              placeholder="Sobre o que você quer falar?"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Sua mensagem</Label>
            <Textarea
              id="message"
              placeholder="Escreva aqui sua mensagem, sugestão, desabafo ou reclamação..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              disabled={loading}
              className="resize-none"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-3">
              {isAnonymous ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <Label htmlFor="anonymous" className="text-sm font-medium cursor-pointer">
                  Enviar anonimamente
                </Label>
                <p className="text-xs text-muted-foreground">
                  Sua identidade não será revelada
                </p>
              </div>
            </div>
            <Switch
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
              disabled={loading}
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>Suas mensagens são tratadas com confidencialidade</span>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            <Send className="h-4 w-4 mr-2" />
            {loading ? 'Enviando...' : 'Enviar Mensagem'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
