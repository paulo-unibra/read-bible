import React from 'react';
import api from '../services/api';

interface JobProgress {
  id: number;
  bookName: string;
  bibleVersion: string;
  chapter: number | null;
  totalChapters: number;
  processedChapters: number;
  createdQuizzes: number[];
  errors: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
}

interface JobProgressModalProps {
  jobId: number;
  onClose: () => void;
  onComplete: () => void;
}

const JobProgressModal: React.FC<JobProgressModalProps> = ({ jobId, onClose, onComplete }) => {
  const [jobData, setJobData] = React.useState<JobProgress | null>(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const fetchJobStatus = async () => {
      try {
        const response = await api.get(`/admin/quizzes/jobs/${jobId}`);
        const data = response.data;
        
        setJobData(data);

        // Se completou ou falhou, para de consultar
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(intervalId);
          if (data.status === 'completed') {
            setTimeout(() => {
              onComplete();
              onClose();
            }, 2000);
          }
        }
      } catch (err: unknown) {
        const failure = err as {
          response?: { data?: { error?: string } };
          message?: string;
        };
        setError(failure.response?.data?.error || failure.message || 'Erro ao carregar o progresso');
        clearInterval(intervalId);
      }
    };

    const intervalId = setInterval(fetchJobStatus, 2000);
    fetchJobStatus();

    return () => clearInterval(intervalId);
  }, [jobId, onClose, onComplete]);

  if (error) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
        <div className="flex max-h-[90vh] w-full max-w-[520px] flex-col overflow-hidden rounded-lg bg-white shadow-[0_10px_40px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] p-6">
            <h2 className="m-0 text-2xl font-semibold">❌ Erro</h2>
            <button className="flex h-8 w-8 items-center justify-center rounded text-2xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]" onClick={onClose}>×</button>
          </div>
          <div className="overflow-y-auto p-5">
            <p className="mt-6 rounded border-l-4 border-[var(--color-danger)] bg-[var(--color-danger-bg)] p-4 text-center text-[var(--color-danger)]">{error}</p>
            <button onClick={onClose} className="cursor-pointer rounded bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]">Fechar</button>
          </div>
        </div>
      </div>
    );
  }

  if (!jobData) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
        <div className="flex max-h-[90vh] w-full max-w-[520px] flex-col overflow-hidden rounded-lg bg-white shadow-[0_10px_40px_rgba(0,0,0,0.2)]">
          <div className="p-5">
            <div className="p-10 text-center text-base text-[var(--color-text-secondary)]">Carregando status...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-[520px] flex-col overflow-hidden rounded-lg bg-white shadow-[0_10px_40px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-6">
          <h2 className="m-0 text-2xl font-semibold">
            {jobData.status === 'pending' && '⏳ Aguardando...'}
            {jobData.status === 'processing' && '🤖 Gerando Questionários'}
            {jobData.status === 'completed' && '✅ Concluído!'}
            {jobData.status === 'failed' && '❌ Falhou'}
          </h2>
          {jobData.status !== 'processing' && (
            <button className="flex h-8 w-8 items-center justify-center rounded text-2xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]" onClick={onClose}>×</button>
          )}
        </div>

        <div className="overflow-y-auto p-5">
          <div className="mb-6 rounded-lg bg-[var(--color-bg)] p-4">
            <p className="my-2 text-sm text-[var(--color-text)]"><strong>Livro:</strong> {jobData.bookName}</p>
            <p className="my-2 text-sm text-[var(--color-text)]"><strong>Versão:</strong> {jobData.bibleVersion}</p>
            {jobData.chapter && <p className="my-2 text-sm text-[var(--color-text)]"><strong>Capítulo:</strong> {jobData.chapter}</p>}
          </div>

          <div className="relative my-6 h-10 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div 
              className="flex h-full min-w-10 items-center justify-center bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-sm font-bold text-white transition-[width] duration-500"
              style={{ width: `${jobData.progress}%` }}
            >
              {jobData.progress}%
            </div>
          </div>

          <div className="mt-6">
            <p className="my-3 text-sm text-[var(--color-text)]">
              <strong>Progresso:</strong> {jobData.processedChapters} de {jobData.totalChapters} capítulos
            </p>
            {jobData.createdQuizzes.length > 0 && (
              <p className="my-3 text-sm text-[var(--color-text)]">
                <strong>✅ Criados:</strong> {jobData.createdQuizzes.length} questionários
              </p>
            )}
            {jobData.errors.length > 0 && (
              <div className="mt-4 rounded border-l-4 border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-4">
                <p className="mb-3 font-bold text-[var(--color-warning)]"><strong>⚠️ Erros:</strong></p>
                <ul className="list-disc pl-5">
                  {jobData.errors.slice(0, 5).map((err, idx) => (
                    <li className="my-1.5 text-[13px] text-[var(--color-warning)]" key={idx}>{err}</li>
                  ))}
                  {jobData.errors.length > 5 && (
                    <li className="my-1.5 text-[13px] text-[var(--color-warning)]">... e mais {jobData.errors.length - 5} erros</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {jobData.status === 'completed' && (
            <div className="mt-6 rounded border-l-4 border-[var(--color-success)] bg-[var(--color-success-bg)] p-4 text-center">
              <p className="my-2 font-medium text-[var(--color-success)]">✅ Geração concluída com sucesso!</p>
              <p className="my-2 font-medium text-[var(--color-success)]">Redirecionando...</p>
            </div>
          )}

          {jobData.status === 'failed' && (
            <div className="mt-6 rounded border-l-4 border-[var(--color-danger)] bg-[var(--color-danger-bg)] p-4 text-center">
              <p className="my-2 text-[var(--color-danger)]">❌ A geração falhou. Verifique os erros acima.</p>
              <button onClick={onClose} className="cursor-pointer rounded bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]">Fechar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobProgressModal;
