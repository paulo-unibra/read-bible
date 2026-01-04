import React from 'react';
import api from '../services/api';
import './JobProgressModal.css';

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
    let intervalId: NodeJS.Timeout;

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
      } catch (err: any) {
        setError(err.response?.data?.error || err.message);
        clearInterval(intervalId);
      }
    };

    // Buscar imediatamente
    fetchJobStatus();

    // Depois buscar a cada 2 segundos
    intervalId = setInterval(fetchJobStatus, 2000);

    return () => clearInterval(intervalId);
  }, [jobId, onClose, onComplete]);

  if (error) {
    return (
      <div className="modal-overlay">
        <div className="modal-content modal-small">
          <div className="modal-header">
            <h2>❌ Erro</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="job-progress-content">
            <p className="error-message">{error}</p>
            <button onClick={onClose} className="cancel-button">Fechar</button>
          </div>
        </div>
      </div>
    );
  }

  if (!jobData) {
    return (
      <div className="modal-overlay">
        <div className="modal-content modal-small">
          <div className="job-progress-content">
            <div className="loading">Carregando status...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-small">
        <div className="modal-header">
          <h2>
            {jobData.status === 'pending' && '⏳ Aguardando...'}
            {jobData.status === 'processing' && '🤖 Gerando Questionários'}
            {jobData.status === 'completed' && '✅ Concluído!'}
            {jobData.status === 'failed' && '❌ Falhou'}
          </h2>
          {jobData.status !== 'processing' && (
            <button className="close-button" onClick={onClose}>×</button>
          )}
        </div>

        <div className="job-progress-content">
          <div className="job-info">
            <p><strong>Livro:</strong> {jobData.bookName}</p>
            <p><strong>Versão:</strong> {jobData.bibleVersion}</p>
            {jobData.chapter && <p><strong>Capítulo:</strong> {jobData.chapter}</p>}
          </div>

          <div className="progress-bar-container">
            <div 
              className="progress-bar" 
              style={{ width: `${jobData.progress}%` }}
            >
              {jobData.progress}%
            </div>
          </div>

          <div className="progress-details">
            <p>
              <strong>Progresso:</strong> {jobData.processedChapters} de {jobData.totalChapters} capítulos
            </p>
            {jobData.createdQuizzes.length > 0 && (
              <p>
                <strong>✅ Criados:</strong> {jobData.createdQuizzes.length} questionários
              </p>
            )}
            {jobData.errors.length > 0 && (
              <div className="job-errors">
                <p><strong>⚠️ Erros:</strong></p>
                <ul>
                  {jobData.errors.slice(0, 5).map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                  {jobData.errors.length > 5 && (
                    <li>... e mais {jobData.errors.length - 5} erros</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {jobData.status === 'completed' && (
            <div className="success-message">
              <p>✅ Geração concluída com sucesso!</p>
              <p>Redirecionando...</p>
            </div>
          )}

          {jobData.status === 'failed' && (
            <div className="error-message">
              <p>❌ A geração falhou. Verifique os erros acima.</p>
              <button onClick={onClose} className="cancel-button">Fechar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobProgressModal;
