import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  permission?: string
}

export default function ProtectedRoute({ children, permission }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#667eea'
      }}>
        Carregando...
      </div>
    )
  }

  // Redirecionar para login se não estiver autenticado
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Verificar permissão específica se fornecida
  if (permission && user.permissions) {
    const hasPermission = user.permissions.includes(permission)
    if (!hasPermission) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          gap: '16px'
        }}>
          <h1 style={{ color: '#764ba2' }}>Acesso Negado</h1>
          <p style={{ color: '#666' }}>Você não tem permissão para acessar esta página.</p>
        </div>
      )
    }
  }

  return <>{children}</>
}
