import { Layout } from '@/components/Layout';
import { Bell, Check, CheckCheck, Trash2, Filter, Search, FileText, Target, Info, AlertTriangle, CheckCircle, X, Calendar, MailOpen, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotifications, UserNotification } from '@/hooks/useNotifications';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'contract':
      return <FileText className="h-5 w-5 text-blue-500" />;
    case 'task':
      return <Target className="h-5 w-5 text-purple-500" />;
    case 'success':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'error':
      return <X className="h-5 w-5 text-red-500" />;
    default:
      return <Info className="h-5 w-5 text-muted-foreground" />;
  }
};

const getNotificationTypeLabel = (type: string) => {
  switch (type) {
    case 'contract':
      return 'Contrato';
    case 'task':
      return 'Tarefa';
    case 'success':
      return 'Sucesso';
    case 'warning':
      return 'Aviso';
    case 'error':
      return 'Erro';
    default:
      return 'Informação';
  }
};

export default function Notificacoes() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    clearAll 
  } = useNotifications();

  const filteredNotifications = notifications.filter(n => 
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const unreadNotifications = filteredNotifications.filter(n => !n.is_read);
  const readNotifications = filteredNotifications.filter(n => n.is_read);

  const handleNotificationClick = (notification: UserNotification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const handleClearAll = () => {
    clearAll();
    setClearDialogOpen(false);
  };

  const NotificationCard = ({ notification }: { notification: UserNotification }) => (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        !notification.is_read && "border-primary/30 bg-primary/5"
      )}
      onClick={() => handleNotificationClick(notification)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-full bg-muted">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className={cn(
                "font-medium truncate",
                !notification.is_read && "text-primary"
              )}>
                {notification.title}
              </h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className="text-xs">
                  {getNotificationTypeLabel(notification.type)}
                </Badge>
                {!notification.is_read && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {notification.message}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>
                  {format(new Date(notification.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span>
                  {formatDistanceToNow(new Date(notification.created_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {!notification.is_read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => markAsRead(notification.id)}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Marcar como lida
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => deleteNotification(notification.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Bell className="h-12 w-12 mb-4 opacity-30" />
      <p>{message}</p>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Bell className="h-8 w-8 text-primary" />
              Minhas Notificações
            </h1>
            <p className="text-muted-foreground mt-2">
              Gerencie suas notificações individuais
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" onClick={markAllAsRead}>
                <CheckCheck className="h-4 w-4 mr-2" />
                Marcar todas como lidas
              </Button>
            )}
            {notifications.length > 0 && (
              <Button 
                variant="outline" 
                className="text-destructive hover:text-destructive"
                onClick={() => setClearDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar todas
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{notifications.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10">
                <Mail className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unreadCount}</p>
                <p className="text-xs text-muted-foreground">Não lidas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <MailOpen className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{notifications.length - unreadCount}</p>
                <p className="text-xs text-muted-foreground">Lidas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar notificações..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" className="gap-2">
              Todas
              <Badge variant="secondary" className="ml-1">{filteredNotifications.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="unread" className="gap-2">
              Não lidas
              <Badge variant="secondary" className="ml-1">{unreadNotifications.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="read" className="gap-2">
              Lidas
              <Badge variant="secondary" className="ml-1">{readNotifications.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-3 mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <EmptyState message={searchTerm ? "Nenhuma notificação encontrada" : "Você não tem notificações"} />
            ) : (
              filteredNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} />
              ))
            )}
          </TabsContent>

          <TabsContent value="unread" className="space-y-3 mt-4">
            {unreadNotifications.length === 0 ? (
              <EmptyState message="Nenhuma notificação não lida" />
            ) : (
              unreadNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} />
              ))
            )}
          </TabsContent>

          <TabsContent value="read" className="space-y-3 mt-4">
            {readNotifications.length === 0 ? (
              <EmptyState message="Nenhuma notificação lida" />
            ) : (
              readNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Clear all dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todas as notificações?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as suas notificações serão excluídas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Limpar todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
