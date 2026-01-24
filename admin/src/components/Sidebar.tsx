import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import styled from "styled-components";

const SidebarContainer = styled.aside`
  width: 250px;
  background-color: #1a1a2e;
  color: white;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  overflow-y: auto;
  padding: 20px 0;
`;

const Logo = styled.div`
  padding: 0 20px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 20px;
  
  h2 {
    margin: 0;
    font-size: 20px;
    color: #4ecca3;
  }
`;

const Nav = styled.nav`
  display: flex;
  flex-direction: column;
`;

const NavItem = styled.button<{ active?: boolean }>`
  padding: 12px 20px;
  background: ${props => props.active ? 'rgba(78, 204, 163, 0.2)' : 'transparent'};
  border: none;
  border-left: 3px solid ${props => props.active ? '#4ecca3' : 'transparent'};
  color: white;
  text-align: left;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;
  
  &:hover {
    background: rgba(78, 204, 163, 0.1);
  }
  
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const UserSection = styled.div`
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: auto;
  
  p {
    margin: 0 0 10px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }
  
  strong {
    color: white;
    font-size: 14px;
  }
`;

const LogoutButton = styled.button`
  width: 100%;
  padding: 10px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
  font-size: 14px;
  
  &:hover {
    background: #c82333;
  }
`;

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  const menuItems = [
    { path: "/dashboard", label: "🏠 Dashboard", permission: "acessar_painel_administrativo" },
    { path: "/users", label: "👥 Usuários", permission: "gerenciar_usuarios" },
    { path: "/permissions", label: "🔑 Permissões", permission: "gerenciar_roles" },
    { path: "/quizzes", label: "📝 Questionários", permission: "gerenciar_questionarios" },
    { path: "/reading-plans", label: "📖 Templates de Planos", permission: "gerenciar_conteudo" },
    { path: "/active-plans", label: "📋 Planos Ativos", permission: "gerenciar_conteudo" },
    { path: "/incorrect-plans", label: "⚠️ Planos Incorretos", permission: "gerenciar_conteudo" },
    { path: "/bible-curiosities", label: "📚 Curiosidades", permission: "gerenciar_conteudo" },
    { path: "/admin/hymn-audios", label: "🎵 Áudios de Hinos", permission: "gerenciar_conteudo" },
    { path: "/audio-sync", label: "🔊 Sync Áudio", permission: "gerenciar_conteudo" },
    { path: "/bulk-email", label: "📧 E-mails", permission: "gerenciar_usuarios" },
    { path: "/reports", label: "📊 Relatórios", permission: "visualizar_relatorios" },
  ];

  return (
    <SidebarContainer>
      <Logo>
        <h2>ReadBible Admin</h2>
      </Logo>
      
      <Nav>
        {menuItems.map((item) => (
          <NavItem
            key={item.path}
            active={location.pathname === item.path}
            disabled={!hasPermission(item.permission)}
            onClick={() => navigate(item.path)}
          >
            {item.label} {!hasPermission(item.permission) && "🔒"}
          </NavItem>
        ))}
      </Nav>
      
      <UserSection>
        <p>Logado como</p>
        <strong>{user?.fullName || user?.email}</strong>
        <LogoutButton onClick={handleLogout}>Sair</LogoutButton>
      </UserSection>
    </SidebarContainer>
  );
};

export default Sidebar;
