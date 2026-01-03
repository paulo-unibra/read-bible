import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './Quizzes.css';

interface Quiz {
  id: number;
  bookName: string;
  chapter: number;
  bibleVersion: string;
  testament: string;
  category: string;
  questionsCount: number;
  createdAt: string;
  updatedAt: string;
}

interface QuizQuestion {
  id?: number;
  questionId: string;
  pergunta: string;
  alternativas: string[];
  respostaCorreta: string;
  order?: number;
}

interface QuizDetail extends Quiz {
  questions: QuizQuestion[];
  cloudStorageUrl: string | null;
}

const Quizzes: React.FC = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [testament, setTestament] = useState('');
  const [bibleVersion, setBibleVersion] = useState('');
  const [bookName, setBookName] = useState('');
  const [availableBooks, setAvailableBooks] = useState<string[]>([]);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizDetail | null>(null);
  const [createMode, setCreateMode] = useState<'manual' | 'ai'>('manual');
  const [isEditingView, setIsEditingView] = useState(false);
  const [editedQuestions, setEditedQuestions] = useState<QuizQuestion[]>([]);
  
  // Form states
  const [formData, setFormData] = useState({
    bookName: '',
    chapter: '',
    bibleVersion: 'NVI',
    testament: 'new',
    category: 'geral',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { hasPermission, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPermission('gerenciar_questionarios')) {
      navigate('/dashboard');
      return;
    }

    loadQuizzes();
    loadAvailableBooks();
  }, [page, search, testament, bibleVersion, bookName]);

  const loadAvailableBooks = async () => {
    try {
      const response = await api.get('/admin/quizzes?perPage=1000');
      const books = [...new Set(response.data.data.map((q: Quiz) => q.bookName))].sort();
      setAvailableBooks(books);
    } catch (err) {
      console.error('Erro ao carregar livros disponíveis:', err);
    }
  };

  const loadQuizzes = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        perPage: '20',
        ...(search && { search }),
        ...(bookName && { bookName }),
        ...(testament && { testament }),
        ...(bibleVersion && { bibleVersion }),
      });

      const response = await api.get(`/admin/quizzes?${params}`);
      setQuizzes(response.data.data);
      setTotalPages(response.data.meta.lastPage || 1);
    } catch (err: any) {
      setError('Erro ao carregar questionários');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadQuizDetail = async (id: number) => {
    try {
      const response = await api.get(`/admin/quizzes/${id}`);
      setSelectedQuiz(response.data);
      setEditedQuestions(response.data.questions);
      setIsEditingView(false);
      setShowViewModal(true);
    } catch (err: any) {
      setError('Erro ao carregar detalhes do questionário');
      console.error(err);
    }
  };

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    setCreateMode('manual');
    setFormError('');
    setFormData({
      bookName: '',
      chapter: '',
      bibleVersion: 'NVI',
      testament: 'new',
      category: 'geral',
    });
  };

  const handleCloseModals = () => {
    setShowCreateModal(false);
    setShowViewModal(false);
    setSelectedQuiz(null);
    setFormError('');
    setCreateMode('manual');
    setIsEditingView(false);
    setEditedQuestions([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditQuestion = (questionIndex: number, field: 'pergunta' | 'respostaCorreta', value: string) => {
    setEditedQuestions(prev => {
      const updated = [...prev];
      updated[questionIndex] = { ...updated[questionIndex], [field]: value };
      return updated;
    });
  };

  const handleEditAlternativa = (questionIndex: number, altIndex: number, value: string) => {
    setEditedQuestions(prev => {
      const updated = [...prev];
      const alternativas = [...updated[questionIndex].alternativas];
      alternativas[altIndex] = value;
      updated[questionIndex] = { ...updated[questionIndex], alternativas };
      return updated;
    });
  };

  const handleAddAlternativa = (questionIndex: number) => {
    setEditedQuestions(prev => {
      const updated = [...prev];
      const alternativas = [...updated[questionIndex].alternativas, ''];
      updated[questionIndex] = { ...updated[questionIndex], alternativas };
      return updated;
    });
  };

  const handleRemoveAlternativa = (questionIndex: number, altIndex: number) => {
    setEditedQuestions(prev => {
      const updated = [...prev];
      const alternativas = updated[questionIndex].alternativas.filter((_, i) => i !== altIndex);
      updated[questionIndex] = { ...updated[questionIndex], alternativas };
      return updated;
    });
  };

  const handleAddQuestion = () => {
    setEditedQuestions(prev => [
      ...prev,
      {
        questionId: `q${prev.length + 1}`,
        pergunta: '',
        alternativas: ['', '', '', ''],
        respostaCorreta: '',
      }
    ]);
  };

  const handleRemoveQuestion = (questionIndex: number) => {
    if (editedQuestions.length <= 1) {
      setFormError('O questionário deve ter pelo menos 1 questão.');
      return;
    }
    setEditedQuestions(prev => prev.filter((_, i) => i !== questionIndex));
  };

  const handleSaveEdits = async () => {
    if (!selectedQuiz) return;
    
    setIsSubmitting(true);
    setFormError('');

    try {
      await api.put(`/admin/quizzes/${selectedQuiz.id}`, {
        bookName: selectedQuiz.bookName,
        chapter: selectedQuiz.chapter,
        bibleVersion: selectedQuiz.bibleVersion,
        testament: selectedQuiz.testament,
        category: selectedQuiz.category,
        questions: editedQuestions.map((q, idx) => ({
          ...q,
          questionId: q.questionId || `q${idx + 1}`,
        })),
      });
      
      setIsEditingView(false);
      loadQuizzes();
      
      // Recarregar detalhes
      const response = await api.get(`/admin/quizzes/${selectedQuiz.id}`);
      setSelectedQuiz(response.data);
      setEditedQuestions(response.data.questions);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Erro ao salvar alterações');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      await api.post('/admin/quizzes/generate-ai', {
        bookName: formData.bookName,
        chapter: formData.chapter,
        bibleVersion: formData.bibleVersion,
      });
      
      handleCloseModals();
      loadQuizzes();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Erro ao gerar questionário com IA');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja deletar este questionário?')) {
      return;
    }

    try {
      await api.delete(`/admin/quizzes/${id}`);
      loadQuizzes();
    } catch (err: any) {
      setError('Erro ao deletar questionário');
      console.error(err);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="quizzes-page">
      <div className="quizzes-header">
        <div className="header-content">
          <button onClick={() => navigate('/dashboard')} className="back-button">
            ← Voltar
          </button>
          <h1>Gerenciamento de Questionários</h1>
        </div>
        <div className="header-actions">
          <button onClick={handleOpenCreateModal} className="create-button">
            + Criar Questionário
          </button>
          <button onClick={handleLogout} className="logout-button">
            Sair
          </button>
        </div>
      </div>

      <div className="quizzes-content">
        {/* Filters */}
        <div className="filters-section">
          <input
            type="text"
            placeholder="Buscar por livro..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setBookName('');
            }}
            className="search-input"
          />

          <select 
            value={bookName} 
            onChange={(e) => {
              setBookName(e.target.value);
              setSearch('');
            }} 
            className="filter-select"
          >
            <option value="">Selecionar Livro</option>
            {availableBooks.map(book => (
              <option key={book} value={book}>{book}</option>
            ))}
          </select>
          
          <select value={testament} onChange={(e) => setTestament(e.target.value)} className="filter-select">
            <option value="">Todos os Testamentos</option>
            <option value="old">Antigo Testamento</option>
            <option value="new">Novo Testamento</option>
          </select>

          <select value={bibleVersion} onChange={(e) => setBibleVersion(e.target.value)} className="filter-select">
            <option value="">Todas as Versões</option>
            <option value="NVI">NVI</option>
            <option value="ARC">ARC</option>
            <option value="ARA">ARA</option>
            <option value="NVT">NVT</option>
          </select>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading">Carregando questionários...</div>
        ) : (
          <>
            <div className="quizzes-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Livro</th>
                    <th>Capítulo</th>
                    <th>Versão</th>
                    <th>Testamento</th>
                    <th>Questões</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="no-data">Nenhum questionário encontrado</td>
                    </tr>
                  ) : (
                    quizzes.map(quiz => (
                      <tr key={quiz.id}>
                        <td>{quiz.id}</td>
                        <td>{quiz.bookName}</td>
                        <td>{quiz.chapter}</td>
                        <td><span className="version-badge">{quiz.bibleVersion}</span></td>
                        <td>
                          <span className={`testament-badge ${quiz.testament}`}>
                            {quiz.testament === 'old' ? 'AT' : 'NT'}
                          </span>
                        </td>
                        <td>{quiz.questionsCount}</td>
                        <td>{new Date(quiz.createdAt).toLocaleDateString('pt-BR')}</td>
                        <td className="actions">
                          <button onClick={() => loadQuizDetail(quiz.id)} className="view-btn" title="Visualizar">
                            👁️
                          </button>
                          <button onClick={() => handleDelete(quiz.id)} className="delete-btn" title="Deletar">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page === 1}
                >
                  ← Anterior
                </button>
                <span>Página {page} de {totalPages}</span>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                  disabled={page === totalPages}
                >
                  Próxima →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de Criação */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={handleCloseModals}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>+ Criar Questionário</h2>
              <button className="close-button" onClick={handleCloseModals}>×</button>
            </div>

            <div className="quiz-form">
              {formError && <div className="form-error">{formError}</div>}

              {/* Seleção de Modo */}
              <div className="mode-selection">
                <button
                  type="button"
                  className={`mode-button ${createMode === 'manual' ? 'active' : ''}`}
                  onClick={() => setCreateMode('manual')}
                >
                  ✍️ Manual
                </button>
                <button
                  type="button"
                  className={`mode-button ${createMode === 'ai' ? 'active' : ''}`}
                  onClick={() => setCreateMode('ai')}
                >
                  🤖 Gerar com IA
                </button>
              </div>

              {createMode === 'ai' ? (
                <form onSubmit={handleAISubmit}>
                  <div className="form-group">
                    <label>Livro da Bíblia *</label>
                    <input
                      type="text"
                      name="bookName"
                      value={formData.bookName}
                      onChange={handleInputChange}
                      placeholder="Ex: Gênesis, João, Romanos"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Capítulo *</label>
                    <input
                      type="number"
                      name="chapter"
                      value={formData.chapter}
                      onChange={handleInputChange}
                      placeholder="Ex: 1, 2, 3"
                      min="1"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Versão da Bíblia *</label>
                    <select name="bibleVersion" value={formData.bibleVersion} onChange={handleInputChange} required>
                      <option value="NVI">NVI - Nova Versão Internacional</option>
                      <option value="ARC">ARC - Almeida Revista e Corrigida</option>
                      <option value="ARA">ARA - Almeida Revista e Atualizada</option>
                      <option value="NVT">NVT - Nova Versão Transformadora</option>
                    </select>
                  </div>

                  <div className="info-box">
                    <p>💡 A IA irá ler o capítulo especificado e gerar automaticamente 10 questões de múltipla escolha com 4 alternativas cada.</p>
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={handleCloseModals} className="cancel-button" disabled={isSubmitting}>
                      Cancelar
                    </button>
                    <button type="submit" className="submit-button" disabled={isSubmitting}>
                      {isSubmitting ? '🤖 Gerando...' : '🤖 Gerar com IA'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="manual-mode-message">
                  <div className="info-box">
                    <p>📝 A criação manual de questionários será implementada em breve.</p>
                    <p>Por enquanto, utilize a opção "Gerar com IA" para criar questionários automaticamente.</p>
                  </div>
                  <div className="modal-footer">
                    <button type="button" onClick={handleCloseModals} className="cancel-button">
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização */}
      {showViewModal && selectedQuiz && (
        <div className="modal-overlay" onClick={handleCloseModals}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 {selectedQuiz.bookName} {selectedQuiz.chapter}</h2>
              <div className="modal-header-actions">
                {!isEditingView ? (
                  <button 
                    className="edit-mode-button" 
                    onClick={() => setIsEditingView(true)}
                  >
                    ✏️ Editar
                  </button>
                ) : (
                  <>
                    <button 
                      className="cancel-edit-button" 
                      onClick={() => {
                        setIsEditingView(false);
                        setEditedQuestions(selectedQuiz.questions);
                        setFormError('');
                      }}
                      disabled={isSubmitting}
                    >
                      Cancelar
                    </button>
                    <button 
                      className="save-edit-button" 
                      onClick={handleSaveEdits}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Salvando...' : '💾 Salvar'}
                    </button>
                  </>
                )}
                <button className="close-button" onClick={handleCloseModals}>×</button>
              </div>
            </div>

            <div className="quiz-view-body">
              {formError && <div className="form-error">{formError}</div>}
              
              <div className="quiz-meta">
                <span><strong>Versão:</strong> {selectedQuiz.bibleVersion}</span>
                <span><strong>Testamento:</strong> {selectedQuiz.testament === 'old' ? 'Antigo' : 'Novo'}</span>
                <span><strong>Categoria:</strong> {selectedQuiz.category}</span>
                <span><strong>Questões:</strong> {editedQuestions.length}</span>
              </div>

              <div className="questions-list">
                {editedQuestions.map((q, idx) => (
                  <div key={idx} className={`question-view ${isEditingView ? 'editing' : ''}`}>
                    <h4>Questão {idx + 1}</h4>
                    
                    {isEditingView ? (
                      <div className="question-edit-form">
                        <div className="form-group">
                          <label>Pergunta:</label>
                          <textarea
                            value={q.pergunta}
                            onChange={(e) => handleEditQuestion(idx, 'pergunta', e.target.value)}
                            className="question-textarea"
                            rows={3}
                          />
                        </div>

                        <div className="form-group">
                          <label>Alternativas:</label>
                          {q.alternativas.map((alt, altIdx) => (
                            <div key={altIdx} className="alternative-input-group">
                              <span className="alternative-letter">{String.fromCharCode(65 + altIdx)})</span>
                              <input
                                type="text"
                                value={alt}
                                onChange={(e) => handleEditAlternativa(idx, altIdx, e.target.value)}
                                className="alternative-input"
                                placeholder={`Alternativa ${String.fromCharCode(65 + altIdx)}`}
                              />
                              {q.alternativas.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAlternativa(idx, altIdx)}
                                  className="remove-alt-button"
                                  title="Remover alternativa"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleAddAlternativa(idx)}
                            className="add-alt-button"
                          >
                            + Adicionar Alternativa
                          </button>
                        </div>

                        <div className="form-group">
                          <label>Resposta Correta:</label>
                          <select
                            value={q.respostaCorreta}
                            onChange={(e) => handleEditQuestion(idx, 'respostaCorreta', e.target.value)}
                            className="correct-answer-select"
                          >
                            <option value="">Selecione a resposta correta</option>
                            {q.alternativas.map((alt, altIdx) => (
                              <option key={altIdx} value={alt}>
                                {String.fromCharCode(65 + altIdx)}) {alt}
                              </option>
                            ))}
                          </select>
                        </div>

                        {editedQuestions.length > 1 && (
                          <div className="question-actions">
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(idx)}
                              className="remove-question-button"
                            >
                              🗑️ Remover Questão
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="question-text">{q.pergunta}</p>
                        <ul className="alternatives-list">
                          {q.alternativas.map((alt, altIdx) => (
                            <li key={altIdx} className={alt === q.respostaCorreta ? 'correct' : ''}>
                              {String.fromCharCode(65 + altIdx)}) {alt}
                              {alt === q.respostaCorreta && <span className="correct-badge">✓ Correta</span>}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {isEditingView && (
                <div className="add-question-section">
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="add-question-button"
                  >
                    + Adicionar Nova Questão
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quizzes;
