import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

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
      { path: "/quizzes", icon: "📝", label: "Questionários", permission: "gerenciar_questionarios" },
      { path: "/reading-plans", icon: "📖", label: "Templates de Planos", permission: "gerenciar_conteudo" },
      { path: "/active-plans", icon: "📋", label: "Planos Ativos", permission: "gerenciar_conteudo" },
      { path: "/incorrect-plans", icon: "⚠️", label: "Planos Incorretos", permission: "gerenciar_conteudo" },
      { path: "/bible-brain", icon: "🧠", label: "BibleBrain", permission: "gerenciar_conteudo" },
      { path: "/bible-curiosities", icon: "📚", label: "Curiosidades", permission: "gerenciar_conteudo" },
      { path: "/admin/hymn-audios", icon: "🎵", label: "Áudios de Hinos", permission: "gerenciar_conteudo" },
      { path: "/audio-sync", icon: "🔊", label: "Sync Áudio", permission: "gerenciar_conteudo" },
    ],
  },
  {
    label: "Usuários & Acesso",
    items: [
      { path: "/users", icon: "👥", label: "Usuários", permission: "gerenciar_usuarios" },
      { path: "/permissions", icon: "🔑", label: "Permissões", permission: "gerenciar_roles" },
    ],
  },
  {
    label: "Comunicação & Relatórios",
    items: [
      { path: "/bulk-email", icon: "📧", label: "E-mails em Massa", permission: "gerenciar_usuarios" },
      { path: "/email-logs", icon: "📬", label: "Logs de E-mails", permission: "gerenciar_usuarios" },
      { path: "/audit-logs", icon: "📜", label: "Logs de Auditoria", permission: "gerenciar_usuarios" },
      { path: "/reports", icon: "📊", label: "Relatórios", permission: "visualizar_relatorios" },
    ],
  },
];

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

  const displayName = user?.fullName || user?.email || "";
  const initial = displayName.trim().charAt(0) || "?";

  return (
    <aside className="fixed left-0 top-0 z-[100] flex h-screen w-[var(--sidebar-width)] flex-col overflow-y-auto bg-[var(--sidebar-bg)] text-[var(--sidebar-text)]">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--sidebar-border)] px-5 py-[22px]">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[var(--color-primary)] text-[15px] font-bold text-white">
          📖
        </div>
        <div>
          <h2 className="m-0 text-[15px] font-semibold leading-[1.3] text-white">ReadBible</h2>
          <span className="block text-[11px] text-[var(--sidebar-text)]">Painel Administrativo</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
        {menuSections.map((section) => (
          <React.Fragment key={section.label}>
            <p className="mx-2 mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500 first:mt-0">
              {section.label}
            </p>
            {section.items.map((item) => {
              const active = location.pathname === item.path;
              const permitted = hasPermission(item.permission);

              return (
                <button
                  key={item.path}
                  type="button"
                  disabled={!permitted}
                  onClick={() => navigate(item.path)}
                  title={item.label}
                  className={`mb-0.5 flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] border-0 px-2.5 py-[9px] text-left text-[13.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${active ? "bg-[rgba(79,70,229,0.16)] font-semibold text-white hover:bg-[rgba(79,70,229,0.22)]" : "bg-transparent font-medium text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)] hover:text-white"}`}
                >
                  <span className="w-[18px] shrink-0 text-center text-[15px]">{item.icon}</span>
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{item.label}</span>
                  {!permitted && <span className="text-[11px] opacity-60">🔒</span>}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-[var(--sidebar-border)] p-3.5">
        <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[var(--color-primary)] text-[13px] font-bold uppercase text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-white" title={displayName}>
            {displayName}
          </strong>
          <span className="text-xs text-[var(--sidebar-text)]">Logado</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          title="Sair"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--sidebar-border)] bg-transparent text-sm text-[var(--sidebar-text)] transition-colors hover:border-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
        >
          ⏻
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
