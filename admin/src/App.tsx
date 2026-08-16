import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import ActivePlans from "./pages/ActivePlans/ActivePlans";
import AuditLogs from "./pages/AuditLogs";
import AudioSync from "./pages/AudioSync";
import BibleBrainManager from "./pages/BibleBrain/BibleBrainManager";
import BibleCuriosities from "./pages/BibleCuriosities/BibleCuriosities";
import BulkEmail from "./pages/BulkEmail";
import Dashboard from "./pages/Dashboard";
import EmailLogs from "./pages/EmailLogs";
import HymnAudioList from "./pages/HymnAudioList/HymnAudioList";
import HymnAudioManager from "./pages/HymnAudioManager/HymnAudioManager";
import IncorrectPlans from "./pages/IncorrectPlans/IncorrectPlans";
import Login from "./pages/Login";
import Permissions from "./pages/Permissions";
import Quizzes from "./pages/Quizzes";
import ReadingPlanTemplates from "./pages/ReadingPlanTemplates";
import Reports from "./pages/Reports";
import Users from "./pages/Users";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute permission="acessar_painel_administrativo">
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute permission="gerenciar_usuarios">
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="/permissions"
            element={
              <ProtectedRoute permission="gerenciar_roles">
                <Permissions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quizzes"
            element={
              <ProtectedRoute permission="gerenciar_questionarios">
                <Quizzes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reading-plans"
            element={
              <ProtectedRoute permission="gerenciar_conteudo">
                <ReadingPlanTemplates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/active-plans"
            element={
              <ProtectedRoute permission="gerenciar_conteudo">
                <ActivePlans />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute permission="visualizar_relatorios">
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/hymn-audios"
            element={
              <ProtectedRoute permission="gerenciar_conteudo">
                <HymnAudioList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/hymn-audios/:hymnNumber"
            element={
              <ProtectedRoute permission="gerenciar_conteudo">
                <HymnAudioManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/incorrect-plans"
            element={
              <ProtectedRoute permission="gerenciar_conteudo">
                <IncorrectPlans />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bible-brain"
            element={
              <ProtectedRoute permission="gerenciar_conteudo">
                <BibleBrainManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bible-curiosities"
            element={
              <ProtectedRoute permission="gerenciar_conteudo">
                <BibleCuriosities />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bulk-email"
            element={
              <ProtectedRoute permission="gerenciar_usuarios">
                <BulkEmail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/email-logs"
            element={
              <ProtectedRoute permission="gerenciar_usuarios">
                <EmailLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute permission="gerenciar_usuarios">
                <AuditLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audio-sync"
            element={
              <ProtectedRoute permission="gerenciar_conteudo">
                <AudioSync />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/active-plans" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
