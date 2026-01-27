import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import "./Permissions.css";

interface Permission {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  isActive: boolean;
  createdAt: string;
}

interface Role {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  permissions: string[];
}

interface UserPermission {
  userId: number;
  userName: string;
  userEmail: string;
  permissions: string[];
}

const Permissions: React.FC = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedPermission, setSelectedPermission] =
    useState<Permission | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    category: "general",
    isActive: true,
  });
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { hasPermission, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPermission("gerenciar_roles")) {
      navigate("/dashboard");
      return;
    }

    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [permissionsRes, usersRes, rolesRes] = await Promise.all([
        api.get("/admin/permissions"),
        api.get("/admin/users"),
        api.get("/admin/roles"),
      ]);

      setPermissions(permissionsRes.data);
      setRoles(rolesRes.data);

      // Mapear usuários com suas permissões
      const userPerms = usersRes.data.map((user: any) => {
        const perms = user.roles.flatMap((role: any) => role.permissions || []);
        return {
          userId: user.id,
          userName: user.fullName || user.email,
          userEmail: user.email,
          permissions: [...new Set(perms)],
        };
      });

      setUserPermissions(userPerms);
    } catch (err: any) {
      setError("Erro ao carregar dados");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const categories = [
    { value: "all", label: "Todas" },
    { value: "admin", label: "Administração" },
    { value: "users", label: "Usuários" },
    { value: "content", label: "Conteúdo" },
    { value: "quizzes", label: "Questionários" },
    { value: "reports", label: "Relatórios" },
    { value: "roles", label: "Roles" },
    { value: "settings", label: "Configurações" },
  ];

  const filteredPermissions =
    selectedCategory === "all"
      ? permissions
      : permissions.filter((p) => p.category === selectedCategory);

  const getUsersWithPermission = (permissionSlug: string) => {
    return userPermissions.filter((up) =>
      up.permissions.includes(permissionSlug),
    );
  };

  const handleOpenModal = () => {
    setShowModal(true);
    setFormError("");
    setFormData({
      name: "",
      slug: "",
      description: "",
      category: "general",
      isActive: true,
    });
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormError("");
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));

    // Auto-generate slug from name
    if (name === "name" && !formData.slug) {
      const slug = value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      setFormData((prev) => ({ ...prev, slug }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      const response = await api.post("/admin/permissions", formData);
      setPermissions((prev) => [...prev, response.data]);
      handleCloseModal();
      await loadData(); // Recarregar dados
    } catch (err: any) {
      setFormError(err.response?.data?.error || "Erro ao criar permissão");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenRoleModal = (permission: Permission) => {
    setSelectedPermission(permission);
    setShowRoleModal(true);
    setFormError("");
  };

  const handleCloseRoleModal = () => {
    setShowRoleModal(false);
    setSelectedPermission(null);
    setFormError("");
  };

  const handleToggleRolePermission = async (
    roleId: number,
    hasPermission: boolean,
  ) => {
    if (!selectedPermission) return;

    setIsSubmitting(true);
    setFormError("");

    try {
      if (hasPermission) {
        // Remover permissão
        await api.delete(`/admin/roles/${roleId}/permissions`, {
          data: { permissionSlug: selectedPermission.slug },
        });
      } else {
        // Adicionar permissão
        await api.post(`/admin/roles/${roleId}/permissions`, {
          permissionSlug: selectedPermission.slug,
        });
      }

      // Recarregar dados
      await loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.error || "Erro ao atualizar permissão");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRolesWithPermission = (permissionSlug: string) => {
    return roles.filter((role) => role.permissions.includes(permissionSlug));
  };

  return (
    <>
      <Sidebar />
      <div className="permissions-page">
        <div className="permissions-header">
          <div className="header-content">
            <button
              onClick={() => navigate("/dashboard")}
              className="back-button"
            >
              ← Voltar
            </button>
            <h1>Gerenciamento de Permissões</h1>
          </div>
          <div className="header-actions">
            <button onClick={handleOpenModal} className="create-button">
              + Nova Permissão
            </button>
            <button onClick={handleLogout} className="logout-button">
              Sair
            </button>
          </div>
        </div>

        <div className="permissions-content">
          <div className="permissions-filters">
            <div className="filter-group">
              <label>Categoria:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="category-select"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="stats">
              <div className="stat-item">
                <span className="stat-value">{permissions.length}</span>
                <span className="stat-label">Total de Permissões</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">
                  {permissions.filter((p) => p.isActive).length}
                </span>
                <span className="stat-label">Ativas</span>
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          {loading ? (
            <div className="loading">Carregando permissões...</div>
          ) : (
            <div className="permissions-grid">
              {filteredPermissions.length === 0 ? (
                <div className="no-data">
                  Nenhuma permissão encontrada nesta categoria
                </div>
              ) : (
                filteredPermissions.map((permission) => {
                  const usersWithPerm = getUsersWithPermission(permission.slug);
                  const rolesWithPerm = getRolesWithPermission(permission.slug);

                  return (
                    <div key={permission.id} className="permission-card">
                      <div className="permission-header">
                        <div className="permission-info">
                          <h3>{permission.name}</h3>
                          <span
                            className={`category-badge ${permission.category}`}
                          >
                            {
                              categories.find(
                                (c) => c.value === permission.category,
                              )?.label
                            }
                          </span>
                        </div>
                        <div
                          className={`status-indicator ${permission.isActive ? "active" : "inactive"}`}
                        >
                          {permission.isActive ? "✓ Ativa" : "✗ Inativa"}
                        </div>
                      </div>

                      <div className="permission-body">
                        <p className="permission-description">
                          {permission.description || "Sem descrição"}
                        </p>

                        <div className="permission-slug">
                          <code>{permission.slug}</code>
                        </div>

                        <div className="roles-section">
                          <div className="section-header">
                            <strong>
                              Tipos de Usuário com esta permissão (
                              {rolesWithPerm.length}):
                            </strong>
                            <button
                              onClick={() => handleOpenRoleModal(permission)}
                              className="manage-roles-btn"
                            >
                              ⚙️ Gerenciar
                            </button>
                          </div>
                          {rolesWithPerm.length === 0 ? (
                            <p className="no-roles">
                              Nenhum tipo de usuário possui esta permissão
                            </p>
                          ) : (
                            <div className="roles-badges">
                              {rolesWithPerm.map((role) => (
                                <span key={role.id} className="role-badge">
                                  {role.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="users-with-permission">
                          <strong>
                            Usuários com esta permissão ({usersWithPerm.length}
                            ):
                          </strong>
                          {usersWithPerm.length === 0 ? (
                            <p className="no-users">
                              Nenhum usuário possui esta permissão
                            </p>
                          ) : (
                            <ul className="user-list">
                              {usersWithPerm.map((user) => (
                                <li key={user.userId}>
                                  <span className="user-name">
                                    {user.userName}
                                  </span>
                                  <span className="user-email">
                                    {user.userEmail}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          <div className="info-box">
            <p>
              <strong>ℹ️ Sobre as Permissões</strong>
            </p>
            <p>
              As permissões são atribuídas através de <strong>roles</strong>{" "}
              (papéis). Para gerenciar as permissões de um usuário, você deve
              editar a role associada a ele.
            </p>
            <ul>
              <li>Cada role pode ter múltiplas permissões</li>
              <li>Um usuário pode ter múltiplas roles</li>
              <li>As permissões são verificadas em tempo real no sistema</li>
            </ul>
          </div>
        </div>

        {/* Modal de Criação */}
        {showModal && (
          <div className="modal-overlay" onClick={handleCloseModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Nova Permissão</h2>
                <button className="close-button" onClick={handleCloseModal}>
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="permission-form">
                {formError && <div className="form-error">{formError}</div>}

                <div className="form-group">
                  <label htmlFor="name">Nome da Permissão *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Ex: Gerenciar Configurações"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="slug">Slug *</label>
                  <input
                    type="text"
                    id="slug"
                    name="slug"
                    value={formData.slug}
                    onChange={handleInputChange}
                    placeholder="Ex: gerenciar_configuracoes"
                    required
                    pattern="[a-z0-9_]+"
                    title="Apenas letras minúsculas, números e underscore"
                  />
                  <small>
                    Apenas letras minúsculas, números e underscore (_)
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="description">Descrição</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Descreva o que esta permissão permite fazer"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="category">Categoria *</label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="general">Geral</option>
                    <option value="admin">Administração</option>
                    <option value="users">Usuários</option>
                    <option value="content">Conteúdo</option>
                    <option value="quizzes">Questionários</option>
                    <option value="reports">Relatórios</option>
                    <option value="roles">Roles</option>
                    <option value="settings">Configurações</option>
                  </select>
                </div>

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleInputChange}
                    />
                    <span>Permissão ativa</span>
                  </label>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="cancel-button"
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="submit-button"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Criando..." : "Criar Permissão"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Gerenciamento de Roles */}
        {showRoleModal && selectedPermission && (
          <div className="modal-overlay" onClick={handleCloseRoleModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Gerenciar Tipos de Usuário</h2>
                <button className="close-button" onClick={handleCloseRoleModal}>
                  ×
                </button>
              </div>

              <div className="role-modal-body">
                {formError && <div className="form-error">{formError}</div>}

                <div className="permission-info-box">
                  <h3>{selectedPermission.name}</h3>
                  <code>{selectedPermission.slug}</code>
                  <p>{selectedPermission.description || "Sem descrição"}</p>
                </div>

                <div className="roles-list">
                  <h4>
                    Selecione os tipos de usuário que terão esta permissão:
                  </h4>
                  {roles.map((role) => {
                    const hasPermission = role.permissions.includes(
                      selectedPermission.slug,
                    );

                    return (
                      <div key={role.id} className="role-item">
                        <div className="role-info">
                          <strong>{role.name}</strong>
                          <span className="role-slug">{role.slug}</span>
                          {role.description && <p>{role.description}</p>}
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={hasPermission}
                            onChange={() =>
                              handleToggleRolePermission(role.id, hasPermission)
                            }
                            disabled={isSubmitting}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>
                    );
                  })}
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={handleCloseRoleModal}
                    className="cancel-button"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Permissions;
