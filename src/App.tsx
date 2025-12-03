import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Historico from "./pages/Historico";
import RotaDoc from "./pages/RotaDoc";
import AgentesIA from "./pages/AgentesIA";
import Sugestoes from "./pages/Sugestoes";
import DashboardSugestoes from "./pages/DashboardSugestoes";
import Forum from "./pages/Forum";
import ForumTopic from "./pages/ForumTopic";
import DocumentosUteis from "./pages/DocumentosUteis";
import Aniversarios from "./pages/Aniversarios";
import Profile from "./pages/Profile";
import Equipe from "./pages/Equipe";
import Onboarding from "./pages/Onboarding";
import MuralAvisos from "./pages/MuralAvisos";
import GaleriaEventos from "./pages/GaleriaEventos";
import NotFound from "./pages/NotFound";
import ProcessosDashboard from "./pages/ProcessosDashboard";
import AniversariosClientes from "./pages/AniversariosClientes";
import PublicacoesFeed from "./pages/PublicacoesFeed";
import TarefasAdvbox from "./pages/TarefasAdvbox";
import RelatoriosFinanceiros from "./pages/RelatoriosFinanceiros";
import AdvboxConfig from "./pages/AdvboxConfig";
import AdvboxAnalytics from "./pages/AdvboxAnalytics";
import RelatoriosProdutividadeTarefas from "./pages/RelatoriosProdutividadeTarefas";
import Ferias from "./pages/Ferias";
import SolicitacoesAdministrativas from "./pages/SolicitacoesAdministrativas";
import HistoricoMensagensAniversario from "./pages/HistoricoMensagensAniversario";
import CollectionManagement from "./pages/CollectionManagement";
import CopaCozinha from "./pages/CopaCozinha";
import HomeOffice from "./pages/HomeOffice";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Navigate to="/dashboard" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/historico"
              element={
                <ProtectedRoute>
                  <Historico />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/rotadoc"
              element={
                <ProtectedRoute>
                  <RotaDoc />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agentes-ia"
              element={
                <ProtectedRoute>
                  <AgentesIA />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sugestoes"
              element={
                <ProtectedRoute>
                  <Sugestoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard-sugestoes"
              element={
                <ProtectedRoute>
                  <DashboardSugestoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forum"
              element={
                <ProtectedRoute>
                  <Forum />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forum/:id"
              element={
                <ProtectedRoute>
                  <ForumTopic />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documentos-uteis"
              element={
                <ProtectedRoute>
                  <DocumentosUteis />
                </ProtectedRoute>
              }
            />
            <Route
              path="/aniversarios"
              element={
                <ProtectedRoute>
                  <Aniversarios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/equipe"
              element={
                <ProtectedRoute>
                  <Equipe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mural-avisos"
              element={
                <ProtectedRoute>
                  <MuralAvisos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/galeria-eventos"
              element={
                <ProtectedRoute>
                  <GaleriaEventos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/processos"
              element={
                <ProtectedRoute>
                  <ProcessosDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/aniversarios-clientes"
              element={
                <ProtectedRoute>
                  <AniversariosClientes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/publicacoes"
              element={
                <ProtectedRoute>
                  <PublicacoesFeed />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tarefas-advbox"
              element={
                <ProtectedRoute>
                  <TarefasAdvbox />
                </ProtectedRoute>
              }
            />
            <Route
              path="/relatorios-financeiros"
              element={
                <ProtectedRoute>
                  <RelatoriosFinanceiros />
                </ProtectedRoute>
              }
            />
            <Route
              path="/advbox-analytics"
              element={
                <ProtectedRoute>
                  <AdvboxAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/relatorios-produtividade-tarefas"
              element={
                <ProtectedRoute>
                  <RelatoriosProdutividadeTarefas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ferias"
              element={
                <ProtectedRoute>
                  <Ferias />
                </ProtectedRoute>
              }
            />
            <Route
              path="/solicitacoes-administrativas"
              element={
                <ProtectedRoute>
                  <SolicitacoesAdministrativas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/historico-mensagens-aniversario"
              element={
                <ProtectedRoute>
                  <HistoricoMensagensAniversario />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestao-cobrancas"
              element={
                <ProtectedRoute>
                  <CollectionManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/copa-cozinha"
              element={
                <ProtectedRoute>
                  <CopaCozinha />
                </ProtectedRoute>
              }
            />
            <Route
              path="/home-office"
              element={
                <ProtectedRoute>
                  <HomeOffice />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
