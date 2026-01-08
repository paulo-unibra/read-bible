import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './Users.css';

interface Role {
  id: number;
  name: string;
  slug: string;
}

interface ReadingStatus {
  status: 'no_plan' | 'not_started' | 'late' | 'up_to_date';
  currentDay: number;
  totalDays: number;
  completedDays: number;
  daysLate: number;
  planName: string | null;
}

interface User {
  id: number;
  email: string;
  fullName: string | null;
  roles: Role[];
  createdAt: string;
  readingStatus: ReadingStatus;
}

interface UserStats {
  all: number;
  up_to_date: number;
  late: number;
  not_started: number;
  no_plan: number;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats>({
    all: 0,
    up_to_date: 0,
    late: 0,
    not_started: 0,
    no_plan: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { hasPermission, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPermission('gerenciar_usuarios')) {
      navigate('/dashboard');
      return;
    }

    loadUsers();
    loadStats();
  }, [statusFilter]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = statusFilter !== 'all' ? { readingStatus: statusFilter } : {};
      const response = await api.get('/admin/users', { params });
      setUsers(response.data);
    } catch (err: any) {
      setError('Erro ao carregar usuários');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/admin/users/stats');
      setStats(response.data);
    } catch (err: any) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="users-page">
      <div className="users-header">
        <div className="header-content">
          <button onClick={() => navigate('/dashboard')} className="back-button">
            ← Voltar
          </button>
          <h1>Gerenciamento de Usuários</h1>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Sair
        </button>
      </div>

      <div className="users-content">
        <div className="users-actions">
          <button className="btn-primary" disabled>
            + Novo Usuário
          </button>
          <div className="search-box">
            <input 
              type="text" 
              placeholder="Buscar usuários..." 
              disabled
            />
          </div>
        </div>

        <div className="filter-section">
          <label>Filtrar por status de leitura:</label>
          <div className="filter-buttons">
            <button 
              className={statusFilter === 'all' ? 'filter-btn active' : 'filter-btn'}
              onClick={() => setStatusFilter('all')}
            >
              📊 Todos ({stats.all})
            </button>
            <button 
              className={statusFilter === 'up_to_date' ? 'filter-btn active' : 'filter-btn'}
              onClick={() => setStatusFilter('up_to_date')}
            >
              ✅ Em dia ({stats.up_to_date})
            </button>
            <button 
              className={statusFilter === 'late' ? 'filter-btn active' : 'filter-btn'}
              onClick={() => setStatusFilter('late')}
            >
              ⚠️ Atrasados ({stats.late})
            </button>
            <button 
              className={statusFilter === 'not_started' ? 'filter-btn active' : 'filter-btn'}
              onClick={() => setStatusFilter('not_started')}
            >
              ⏸️ Não iniciaram ({stats.not_started})
            </button>
            <button 
              className={statusFilter === 'no_plan' ? 'filter-btn active' : 'filter-btn'}
              onClick={() => setStatusFilter('no_plan')}
            >
              📝 Sem plano ({stats.no_plan})
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading">
            Carregando usuários...
          </div>
        ) : (
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Roles</th>
                  <th>Status de Leitura</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="no-data">
                      Nenhum usuário encontrado
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.fullName || '-'}</td>
                      <td>{user.email}</td>
                      <td>
                        <div className="roles-cell">
                          {user.roles.map(role => (
                            <span key={role.id} className="role-badge">
                              {role.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="status-cell">
                          {user.readingStatus.status === 'up_to_date' && (
                            <span className="status-badge status-up-to-date">
                              ✅ Em dia ({user.readingStatus.currentDay}/{user.readingStatus.totalDays})
                            </span>
                          )}
                          {user.readingStatus.status === 'late' && (
                            <span className="status-badge status-late">
                              ⚠️ Atrasado ({user.readingStatus.daysLate} {user.readingStatus.daysLate === 1 ? 'dia' : 'dias'})
                            </span>
                          )}
                          {user.readingStatus.status === 'not_started' && (
                            <span className="status-badge status-not-started">
                              ⏸️ Não iniciou
                            </span>
                          )}
                          {user.readingStatus.status === 'no_plan' && (
                            <span className="status-badge status-no-plan">
                              📝 Sem plano
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-edit" disabled title="Em breve">
                            ✏️
                          </button>
                          <button className="btn-delete" disabled title="Em breve">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="info-box">
          <p>
            <strong>ℹ️ Funcionalidade em desenvolvimento</strong>
          </p>
          <p>
            As seguintes ações serão implementadas em breve:
          </p>
          <ul>
            <li>Criar novos usuários</li>
            <li>Editar informações de usuários</li>
            <li>Excluir usuários</li>
            <li>Atribuir/remover roles</li>
            <li>Buscar e filtrar usuários</li>
            <li>Paginação</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Users;
