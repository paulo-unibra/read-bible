import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./Dashboard.css";

const Dashboard: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Painel Administrativo</h1>
        <div className="user-info">
          <span className="user-name">{user?.fullName || user?.email}</span>
          <button onClick={handleLogout} className="logout-button">
            Sair
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="welcome-card">
          <h2>Bem-vindo ao Painel Administrativo!</h2>
          <p>
            Olá, <strong>{user?.fullName || user?.email}</strong>
          </p>

          <div className="user-details">
            <h3>Seus Perfis:</h3>
            <ul>
              {user?.roles.map((role) => (
                <li key={role.id}>
                  <span className="role-badge">{role.name}</span>
                </li>
              ))}
            </ul>

            {/* <h3>Suas Permissões:</h3>
            <div className="permissions-grid">
              {user?.permissions.map(permission => (
                <span key={permission} className="permission-badge">
                  {permission.replace(/_/g, ' ')}
                </span>
              ))}
            </div> */}
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <h3>📊 Relatórios</h3>
            <p>Visualize estatísticas e relatórios</p>
            <button
              className="card-button"
              onClick={() => navigate("/reports")}
              disabled={!hasPermission("visualizar_relatorios")}
            >
              {hasPermission("visualizar_relatorios")
                ? "Acessar"
                : "Sem permissão"}
            </button>
          </div>

          <div className="dashboard-card">
            <h3>👥 Usuários</h3>
            <p>Gerenciar usuários do sistema</p>
            <button
              className="card-button"
              onClick={() => navigate("/users")}
              disabled={!hasPermission("gerenciar_usuarios")}
            >
              {hasPermission("gerenciar_usuarios")
                ? "Acessar"
                : "Sem permissão"}
            </button>
          </div>

          <div className="dashboard-card">
            <h3>📝 Questionários</h3>
            <p>Gerenciar questionários bíblicos</p>
            <button
              className="card-button"
              onClick={() => navigate("/quizzes")}
              disabled={!hasPermission("gerenciar_questionarios")}
            >
              {hasPermission("gerenciar_questionarios")
                ? "Acessar"
                : "Sem permissão"}
            </button>
          </div>

          <div className="dashboard-card">
            <h3>📖 Planos de Leitura</h3>
            <p>Gerenciar planos de leitura</p>
            <button
              className="card-button"
              onClick={() => navigate("/reading-plans")}
              disabled={!hasPermission("gerenciar_conteudo")}
            >
              {hasPermission("gerenciar_conteudo")
                ? "Acessar"
                : "Sem permissão"}
            </button>
          </div>

          <div className="dashboard-card">
            <h3>� Planos Ativos</h3>
            <p>Gerenciar e desabilitar planos ativos</p>
            <button
              className="card-button"
              onClick={() => navigate("/active-plans")}
              disabled={!hasPermission("gerenciar_conteudo")}
            >
              {hasPermission("gerenciar_conteudo")
                ? "Acessar"
                : "Sem permissão"}
            </button>
          </div>

          <div className="dashboard-card">
            <h3>�🔑 Permissões</h3>
            <p>Visualizar e gerenciar permissões</p>
            <button
              className="card-button"
              onClick={() => navigate("/permissions")}
              disabled={!hasPermission("gerenciar_roles")}
            >
              {hasPermission("gerenciar_roles") ? "Acessar" : "Sem permissão"}
            </button>
          </div>

          <div className="dashboard-card">
            <h3>🎵 Áudios de Hinos</h3>
            <p>Gerenciar sincronização de áudios</p>
            <button
              className="card-button"
              onClick={() => navigate("/admin/hymn-audios")}
              disabled={!hasPermission("gerenciar_conteudo")}
            >
              {hasPermission("gerenciar_conteudo")
                ? "Acessar"
                : "Sem permissão"}
            </button>
          </div>

          <div className="dashboard-card">
            <h3>⚠️ Planos Incorretos</h3>
            <p>Corrigir planos com cálculo incorreto</p>
            <button
              className="card-button"
              onClick={() => navigate("/incorrect-plans")}
              disabled={!hasPermission("gerenciar_conteudo")}
            >
              {hasPermission("gerenciar_conteudo")
                ? "Acessar"
                : "Sem permissão"}
            </button>
          </div>

          <div className="dashboard-card">
            <h3>📖 Curiosidades Bíblicas</h3>
            <p>Gerenciar curiosidades geradas por IA</p>
            <button
              className="card-button"
              onClick={() => navigate("/bible-curiosities")}
              disabled={!hasPermission("gerenciar_conteudo")}
            >
              {hasPermission("gerenciar_conteudo")
                ? "Acessar"
                : "Sem permissão"}
            </button>
          </div>

          <div className="dashboard-card">
            <h3>📧 E-mails em Lote</h3>
            <p>Enviar e-mails personalizados por status</p>
            <button
              className="card-button"
              onClick={() => navigate("/bulk-email")}
              disabled={!hasPermission("gerenciar_usuarios")}
            >
              {hasPermission("gerenciar_usuarios")
                ? "Acessar"
                : "Sem permissão"}
            </button>
          </div>

          <div className="dashboard-card">
            <h3>🎵 Sincronização de Áudio</h3>
            <p>Sincronizar áudios bíblicos com versículos</p>
            <button
              className="card-button"
              onClick={() => navigate("/audio-sync")}
              disabled={!hasPermission("gerenciar_conteudo")}
            >
              {hasPermission("gerenciar_conteudo")
                ? "Acessar"
                : "Sem permissão"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
