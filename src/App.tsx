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
import NotFound from "./pages/NotFound";
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
