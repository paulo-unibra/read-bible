import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useAuth } from "../contexts/AuthContext";

const SidebarContainer = styled.aside`
  width: var(--sidebar-width);
  background-color: var(--sidebar-bg);
  color: var(--sidebar-text);
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  z-index: 100;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 22px 20px;
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;

  .mark {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: var(--color-primary);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 700;
    flex-shrink: 0;
  }

  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #fff;
    line-height: 1.3;
  }

  span {
    display: block;
    font-size: 11px;
    color: var(--sidebar-text);
  }
`;

const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  padding: 16px 12px;
`;

const SectionLabel = styled.p`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6b7280;
  margin: 16px 8px 6px;

  &:first-child {
    margin-top: 0;
  }
`;

const NavItem = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  margin-bottom: 2px;
  background: ${(props) =>
    props.$active ? "rgba(79, 70, 229, 0.16)" : "transparent"};
  border: none;
  border-radius: var(--radius-sm);
  color: ${(props) => (props.$active ? "#ffffff" : "var(--sidebar-text)")};
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  font-size: 13.5px;
  font-weight: ${(props) => (props.$active ? 600 : 500)};

  .icon {
    font-size: 15px;
    width: 18px;
    text-align: center;
    flex-shrink: 0;
  }

  .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lock {
    font-size: 11px;
    opacity: 0.6;
  }

  &:hover:not(:disabled) {
    background: ${(props) =>
      props.$active ? "rgba(79, 70, 229, 0.22)" : "var(--sidebar-bg-hover)"};
    color: #ffffff;
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
`;

const UserSection = styled.div`
  padding: 14px;
  border-top: 1px solid var(--sidebar-border);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Avatar = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  text-transform: uppercase;
`;

const UserMeta = styled.div`
  flex: 1;
  min-width: 0;

  strong {
    display: block;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    font-size: 12px;
    color: var(--sidebar-text);
  }
`;

const LogoutButton = styled.button`
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--sidebar-text);
  border: 1px solid var(--sidebar-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;

  &:hover {
    background: var(--color-danger-bg);
    border-color: var(--color-danger);
    color: var(--color-danger);
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

  const menuSections = [
    {
      label: "Geral",
      items: [
        {
          path: "/dashboard",
          icon: "🏠",
          label: "Dashboard",
          permission: "acessar_painel_administrativo",
        },
      ],
    },
    {
      label: "Conteúdo",
      items: [
        {
          path: "/quizzes",
          icon: "📝",
          label: "Questionários",
          permission: "gerenciar_questionarios",
        },
        {
          path: "/reading-plans",
          icon: "📖",
          label: "Templates de Planos",
          permission: "gerenciar_conteudo",
        },
        {
          path: "/active-plans",
          icon: "📋",
          label: "Planos Ativos",
          permission: "gerenciar_conteudo",
        },
        {
          path: "/incorrect-plans",
          icon: "⚠️",
          label: "Planos Incorretos",
          permission: "gerenciar_conteudo",
        },
        {
          path: "/bible-brain",
          icon: "🧠",
          label: "BibleBrain",
          permission: "gerenciar_conteudo",
        },
        {
          path: "/bible-curiosities",
          icon: "📚",
          label: "Curiosidades",
          permission: "gerenciar_conteudo",
        },
        {
          path: "/admin/hymn-audios",
          icon: "🎵",
          label: "Áudios de Hinos",
          permission: "gerenciar_conteudo",
        },
        {
          path: "/audio-sync",
          icon: "🔊",
          label: "Sync Áudio",
          permission: "gerenciar_conteudo",
        },
      ],
    },
    {
      label: "Usuários & Acesso",
      items: [
        { path: "/users", icon: "👥", label: "Usuários", permission: "gerenciar_usuarios" },
        {
          path: "/permissions",
          icon: "🔑",
          label: "Permissões",
          permission: "gerenciar_roles",
        },
      ],
    },
    {
      label: "Comunicação & Relatórios",
      items: [
        {
          path: "/bulk-email",
          icon: "📧",
          label: "E-mails em Massa",
          permission: "gerenciar_usuarios",
        },
        {
          path: "/email-logs",
          icon: "📬",
          label: "Logs de E-mails",
          permission: "gerenciar_usuarios",
        },
        {
          path: "/reports",
          icon: "📊",
          label: "Relatórios",
          permission: "visualizar_relatorios",
        },
      ],
    },
  ];

  const displayName = user?.fullName || user?.email || "";
  const initial = displayName.trim().charAt(0) || "?";

  return (
    <SidebarContainer>
      <Logo>
        <div className="mark">📖</div>
        <div>
          <h2>ReadBible</h2>
          <span>Painel Administrativo</span>
        </div>
      </Logo>

      <Nav>
        {menuSections.map((section) => (
          <React.Fragment key={section.label}>
            <SectionLabel>{section.label}</SectionLabel>
            {section.items.map((item) => (
              <NavItem
                key={item.path}
                $active={location.pathname === item.path}
                disabled={!hasPermission(item.permission)}
                onClick={() => navigate(item.path)}
                title={item.label}
              >
                <span className="icon">{item.icon}</span>
                <span className="label">{item.label}</span>
                {!hasPermission(item.permission) && <span className="lock">🔒</span>}
              </NavItem>
            ))}
          </React.Fragment>
        ))}
      </Nav>

      <UserSection>
        <Avatar>{initial}</Avatar>
        <UserMeta>
          <strong title={displayName}>{displayName}</strong>
          <span>Logado</span>
        </UserMeta>
        <LogoutButton onClick={handleLogout} title="Sair">
          ⏻
        </LogoutButton>
      </UserSection>
    </SidebarContainer>
  );
};

export default Sidebar;
