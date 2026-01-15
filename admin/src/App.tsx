import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './contexts/AuthContext'
import BibleCuriosities from './pages/BibleCuriosities/BibleCuriosities'
import Dashboard from './pages/Dashboard'
import HymnAudioList from './pages/HymnAudioList/HymnAudioList'
import HymnAudioManager from './pages/HymnAudioManager/HymnAudioManager'
import IncorrectPlans from './pages/IncorrectPlans/IncorrectPlans'
import Login from './pages/Login'
import Permissions from './pages/Permissions'
import Quizzes from './pages/Quizzes'
import ReadingPlanTemplates from './pages/ReadingPlanTemplates'
import Reports from './pages/Reports'
import Users from './pages/Users'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename='/admin'>
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
            path="/bible-curiosities"
            element={
              <ProtectedRoute permission="gerenciar_conteudo">
                <BibleCuriosities />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
