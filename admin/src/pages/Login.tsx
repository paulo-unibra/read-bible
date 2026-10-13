import type { FormEvent } from 'react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const failure = err as { response?: { data?: { error?: string } } };
      const errorMessage = failure.response?.data?.error || 'Erro ao fazer login';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex min-h-screen w-screen items-center justify-center bg-[var(--color-primary)] p-5">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)] sm:p-12">
        <h1 className="mb-2 text-center text-[28px] font-bold text-[var(--color-text)]">Painel Administrativo</h1>
        <p className="mb-8 text-center text-sm text-[var(--color-text-secondary)]">Bíblia em Foco</p>

        {error && (
          <div className="mb-5 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-semibold text-[var(--color-text)]">E-mail</label>
            <input
              className="rounded-lg border-2 border-[var(--color-border)] px-4 py-3 text-[15px] transition-all focus:border-[var(--color-primary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-primary-light)]"
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              placeholder="seu@email.com"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-semibold text-[var(--color-text)]">Senha</label>
            <input
              className="rounded-lg border-2 border-[var(--color-border)] px-4 py-3 text-[15px] transition-all focus:border-[var(--color-primary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-primary-light)]"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer rounded-lg border-0 bg-[var(--color-primary)] px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-[var(--color-text-muted)]">
          Acesso restrito a administradores autorizados
        </p>
      </div>
    </div>
  );
};

export default Login;
