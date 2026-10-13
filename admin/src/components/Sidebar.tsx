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
    <aside className="fixed bottom-6 left-6 top-6 z-[100] flex h-auto w-[240px] flex-col overflow-y-auto rounded-[26px] border border-white/70 bg-white/45 text-[#4b365a] shadow-[0_18px_55px_rgba(91,41,125,0.12)] backdrop-blur-2xl max-lg:left-4 max-lg:w-[224px] max-md:left-3 max-md:w-[208px]">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-white/60 px-5 py-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#f47dcb] to-[#a55be5] text-[15px] font-bold text-white shadow-md">
          📖
        </div>
        <div>
          <h2 className="m-0 text-[15px] font-semibold leading-[1.3] text-[#342441]">ReadBible</h2>
          <span className="block text-[11px] text-[#846d93]">Painel Administrativo</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
        {menuSections.map((section) => (
          <React.Fragment key={section.label}>
            <p className="mx-2 mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9a83a7] first:mt-0">
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
                  className={`mb-0.5 flex w-full items-center gap-2.5 rounded-xl border-0 px-3 py-2.5 text-left text-[13px] transition-all disabled:cursor-not-allowed disabled:opacity-35 ${active ? "border border-white/80 bg-white/75 font-semibold text-[#6d3a9c] shadow-[0_5px_18px_rgba(143,75,181,0.1)]" : "bg-transparent font-medium text-[#665476] hover:bg-white/45 hover:text-[#4d2f68]"}`}
                >
                  <span className="w-[18px] shrink-0 text-center text-[14px] grayscale">{item.icon}</span>
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{item.label}</span>
                  {!permitted && <span className="text-[11px] opacity-60">🔒</span>}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-white/60 p-3.5">
        <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#f47dcb] to-[#a55be5] text-[13px] font-bold uppercase text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-[#342441]" title={displayName}>
            {displayName}
          </strong>
          <span className="text-xs text-[#846d93]">Logado</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          title="Sair"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-white/80 bg-white/35 text-sm text-[#846d93] transition-colors hover:border-[#e7a9ce] hover:bg-[#ffe3f1] hover:text-[#aa3e7a]"
        >
          ⏻
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
