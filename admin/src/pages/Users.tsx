import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Users.css';

interface Role {
  id: number;
  name: string;
  slug: string;
}

interface User {
  id: number;
  email: string;
  fullName: string | null;
  roles: Role[];
  createdAt: string;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { hasPermission, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPermission('gerenciar_usuarios')) {
      navigate('/dashboard');
      return;
    }

    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (err: any) {
      setError('Erro ao carregar usuários');
      console.error(err);
    } finally {
      setLoading(false);
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
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="no-data">
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
