import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BIBLE_BOOKS } from '../constants/bibleBooks';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './ReadingPlanTemplates.css';

interface Template {
  id: number;
  name: string;
  description: string;
  type: 'annual' | 'custom' | 'sequential' | 'thematic';
  duration: number;
  testament: 'old' | 'new' | 'both';
  readingsCount: number;
  isActive: boolean;
  order: number;
  createdAt: string;
}

interface PlanType {
  id: number;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  order: number;
}

interface BookReading {
  book: string;
  chapters: number[];
}

interface Reading {
  day: number;
  bookReadings: BookReading[];
  description?: string;
}

const ReadingPlanTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [planTypes, setPlanTypes] = useState<PlanType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'annual' as 'annual' | 'custom' | 'sequential' | 'thematic',
    duration: '',
    testament: 'both' as 'old' | 'new' | 'both',
    isActive: true,
    order: 0,
  });
  
  const [readings, setReadings] = useState<Reading[]>([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importSuccess, setImportSuccess] = useState('');
  
  // Estados para IA
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');

  const { hasPermission, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPermission('gerenciar_conteudo')) {
      navigate('/dashboard');
      return;
    }

    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    setError('');
    
    try {
      const [templatesRes, typesRes] = await Promise.all([
        api.get('/admin/reading-plan-templates'),
        api.get('/admin/plan-types')
      ]);
      setTemplates(templatesRes.data.data);
      setPlanTypes(typesRes.data.data);
    } catch (err) {
      setError('Erro ao carregar dados');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlanType = async (id: number) => {
    try {
      await api.patch(`/admin/plan-types/${id}/toggle`);
      loadTemplates();
    } catch (err) {
      alert('Erro ao atualizar tipo de plano');
      console.error(err);
    }
  };

  const handleOpenModal = (template?: Template) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description,
        type: template.type,
        duration: template.duration.toString(),
        testament: template.testament,
        isActive: template.isActive,
        order: template.order,
      });
      loadTemplateReadings(template.id);
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        type: 'annual',
        duration: '',
        testament: 'both',
        isActive: true,
        order: 0,
      });
      setReadings([]);
    }
    setShowModal(true);
    setFormError('');
  };

  const loadTemplateReadings = async (templateId: number) => {
    try {
      const response = await api.get(`/admin/reading-plan-templates/${templateId}`);
      setReadings(response.data.readings || []);
    } catch (err) {
      console.error('Erro ao carregar leituras:', err);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setFormError('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleAddReading = () => {
    setReadings(prev => [...prev, {
      day: prev.length + 1,
      bookReadings: [{ book: '', chapters: [] }],
      description: ''
    }]);
  };

  const handleRemoveReading = (index: number) => {
    setReadings(prev => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, day: i + 1 })));
  };

  const handleReadingChange = (index: number, field: keyof Reading, value: string | BookReading[]) => {
    setReadings(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddBookToReading = (readingIndex: number) => {
    setReadings(prev => {
      const updated = [...prev];
      updated[readingIndex].bookReadings.push({ book: '', chapters: [] });
      return updated;
    });
  };

  const handleRemoveBookFromReading = (readingIndex: number, bookIndex: number) => {
    setReadings(prev => {
      const updated = [...prev];
      updated[readingIndex].bookReadings.splice(bookIndex, 1);
      return updated;
    });
  };

  const handleBookReadingChange = (readingIndex: number, bookIndex: number, field: keyof BookReading, value: string | number[]) => {
    setReadings(prev => {
      const updated = [...prev];
      updated[readingIndex].bookReadings[bookIndex] = {
        ...updated[readingIndex].bookReadings[bookIndex],
        [field]: value
      };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        readings,
      };

      console.log('Enviando template:', payload);

      if (editingTemplate) {
        await api.put(`/admin/reading-plan-templates/${editingTemplate.id}`, payload);
      } else {
        await api.post('/admin/reading-plan-templates', payload);
      }

      handleCloseModal();
      loadTemplates();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setFormError(error.response?.data?.error || 'Erro ao salvar template');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja deletar este template?')) {
      return;
    }

    try {
      await api.delete(`/admin/reading-plan-templates/${id}`);
      loadTemplates();
    } catch (err) {
      setError('Erro ao deletar template');
      console.error(err);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) {
      setFormError('Digite uma instrução para a IA');
      return;
    }

    setIsGenerating(true);
    setFormError('');
    setGenerationProgress('🤖 Enviando instrução para a IA...');

    try {
      setGenerationProgress('🧠 IA processando sua solicitação...');
      
      const response = await api.post('/admin/reading-plan-templates/generate-with-ai', {
        prompt: aiPrompt
      });

      setGenerationProgress('✅ Plano gerado com sucesso!');
      
      const generatedPlan = response.data.plan;
      
      // Preencher formulário com dados gerados
      setFormData({
        name: generatedPlan.name || '',
        description: generatedPlan.description || '',
        type: generatedPlan.type || 'custom',
        duration: generatedPlan.duration?.toString() || generatedPlan.readings.length.toString(),
        testament: generatedPlan.testament || 'both',
        isActive: generatedPlan.isActive !== undefined ? generatedPlan.isActive : true,
        order: generatedPlan.order || 0,
      });

      // Preencher leituras
      const generatedReadings: Reading[] = generatedPlan.readings.map((reading: any, index: number) => ({
        day: reading.day || index + 1,
        bookReadings: Array.isArray(reading.bookReadings) 
          ? reading.bookReadings.map((br: any) => ({
              book: br.book || '',
              chapters: Array.isArray(br.chapters) ? br.chapters : []
            }))
          : [],
        description: reading.description || ''
      }));

      setReadings(generatedReadings);
      setImportSuccess(`🎉 Plano gerado pela IA! ${generatedReadings.length} dias de leitura criados.`);
      setTimeout(() => setImportSuccess(''), 5000);
      
      // Fechar modal de IA e abrir modal de criação
      setShowAIModal(false);
      setShowModal(true);
      setAiPrompt('');
      
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setFormError(error.response?.data?.error || 'Erro ao gerar plano com IA');
      setGenerationProgress('');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target?.result as string);
        
        // Validar estrutura básica
        if (!jsonData.name || !jsonData.readings || !Array.isArray(jsonData.readings)) {
          setFormError('JSON inválido: deve conter "name" e "readings" (array)');
          return;
        }

        // Preencher formulário com dados do JSON
        setFormData({
          name: jsonData.name || '',
          description: jsonData.description || '',
          type: jsonData.type || 'custom',
          duration: jsonData.duration?.toString() || jsonData.readings.length.toString(),
          testament: jsonData.testament || 'both',
          isActive: jsonData.isActive !== undefined ? jsonData.isActive : true,
          order: jsonData.order || 0,
        });

        // Preencher leituras
        const importedReadings: Reading[] = jsonData.readings.map((reading: any, index: number) => ({
          day: reading.day || index + 1,
          bookReadings: Array.isArray(reading.bookReadings) 
            ? reading.bookReadings.map((br: any) => ({
                book: br.book || '',
                chapters: Array.isArray(br.chapters) ? br.chapters : []
              }))
            : [],
          description: reading.description || ''
        }));

        setReadings(importedReadings);
        setImportSuccess(`✅ JSON importado com sucesso! ${importedReadings.length} leituras carregadas.`);
        setTimeout(() => setImportSuccess(''), 5000);
        setFormError('');
      } catch (error) {
        setFormError(`Erro ao processar JSON: ${error instanceof Error ? error.message : 'Formato inválido'}`);
      }
    };

    reader.onerror = () => {
      setFormError('Erro ao ler arquivo');
    };

    reader.readAsText(file);
    // Limpar input para permitir reimportar o mesmo arquivo
    e.target.value = '';
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      annual: 'Anual',
      custom: 'Personalizado',
      sequential: 'Sequencial',
      thematic: 'Temático'
    };
    return labels[type] || type;
  };

  const getTestamentLabel = (testament: string) => {
    const labels: Record<string, string> = {
      old: 'AT',
      new: 'NT',
      both: 'Ambos'
    };
    return labels[testament] || testament;
  };

  return (
    <div className="templates-page">
      <div className="templates-header">
        <div className="header-content">
          <button onClick={() => navigate('/dashboard')} className="back-button">
            ← Voltar
          </button>
          <h1>Planos de Leitura</h1>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowAIModal(true)} className="ai-button">
            🤖 Pedir para IA
          </button>
          <button onClick={() => handleOpenModal()} className="create-button">
            + Criar Plano
          </button>
          <button onClick={handleLogout} className="logout-button">
            Sair
          </button>
        </div>
      </div>

      <div className="templates-content">
        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading">Carregando planos...</div>
        ) : (
          <>
            {/* Seção de Tipos de Planos Padrão */}
            <div className="plan-types-section">
              <h2>Tipos de Planos Padrão</h2>
              <p className="section-description">
                Ative ou desative os tipos de planos que os usuários podem escolher no app
              </p>
              <div className="plan-types-grid">
                {planTypes.map(planType => (
                  <div key={planType.id} className={`plan-type-card ${!planType.isActive ? 'inactive' : ''}`}>
                    <div className="plan-type-header">
                      <h3>{planType.name}</h3>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={planType.isActive}
                          onChange={() => handleTogglePlanType(planType.id)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                    <p className="plan-type-description">{planType.description}</p>
                    <div className="plan-type-info">
                      <span className={`status-badge ${planType.isActive ? 'active' : 'inactive'}`}>
                        {planType.isActive ? '✓ Ativo' : '✗ Inativo'}
                      </span>
                      <span className="key-badge">{planType.key}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seção de Templates Personalizados */}
            <div className="templates-section">
              <h2>Templates Personalizados</h2>
              <div className="templates-grid">
                {templates.length === 0 ? (
                  <div className="no-data">Nenhum template personalizado encontrado</div>
                ) : (
                  templates.map(template => (
                <div key={template.id} className={`template-card ${!template.isActive ? 'inactive' : ''}`}>
                  <div className="template-header">
                    <h3>{template.name}</h3>
                    <div className="template-badges">
                      <span className={`type-badge ${template.type}`}>
                        {getTypeLabel(template.type)}
                      </span>
                      <span className="testament-badge">
                        {getTestamentLabel(template.testament)}
                      </span>
                    </div>
                  </div>
                  
                  <p className="template-description">{template.description}</p>
                  
                  <div className="template-stats">
                    <div className="stat">
                      <span className="stat-label">Duração:</span>
                      <span className="stat-value">{template.duration} dias</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Leituras:</span>
                      <span className="stat-value">{template.readingsCount}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Status:</span>
                      <span className={`stat-value ${template.isActive ? 'active' : 'inactive'}`}>
                        {template.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>

                  <div className="template-actions">
                    <button onClick={() => handleOpenModal(template)} className="edit-btn">
                      ✏️ Editar
                    </button>
                    <button onClick={() => handleDelete(template.id)} className="delete-btn">
                      🗑️ Deletar
                    </button>
                  </div>
                </div>
              ))
              )}
            </div>
          </div>
          </>
        )}
      </div>

      {/* Modal de IA */}
      {showAIModal && (
        <div className="modal-overlay" onClick={() => !isGenerating && setShowAIModal(false)}>
          <div className="modal-content modal-ai" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🤖 Gerar Plano com IA</h2>
              {!isGenerating && (
                <button className="close-button" onClick={() => setShowAIModal(false)}>×</button>
              )}
            </div>

            <div className="ai-modal-body">
              {formError && <div className="form-error">{formError}</div>}
              
              {!isGenerating ? (
                <>
                  <div className="ai-instructions">
                    <p>💡 <strong>Dica:</strong> Seja específico sobre o que deseja. Exemplos:</p>
                    <ul>
                      <li>"Criar plano de 30 dias lendo os Salmos"</li>
                      <li>"Plano de 90 dias lendo os Evangelhos e Atos"</li>
                      <li>"Leitura do Novo Testamento em 100 dias"</li>
                      <li>"Plano de 1 ano lendo toda a Bíblia sequencialmente"</li>
                    </ul>
                  </div>

                  <div className="form-group">
                    <label>Descreva o plano que deseja criar:</label>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Ex: Criar um plano de 30 dias focado nos livros proféticos do Antigo Testamento, começando por Isaías e terminando em Malaquias..."
                      rows={6}
                      className="ai-textarea"
                    />
                  </div>

                  <div className="modal-footer">
                    <button 
                      type="button" 
                      onClick={() => setShowAIModal(false)} 
                      className="cancel-button"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button" 
                      onClick={handleGenerateWithAI} 
                      className="ai-generate-button"
                      disabled={!aiPrompt.trim()}
                    >
                      ✨ Gerar Plano
                    </button>
                  </div>
                </>
              ) : (
                <div className="ai-generating">
                  <div className="ai-loader">
                    <div className="ai-spinner"></div>
                    <div className="ai-brain">🧠</div>
                  </div>
                  <p className="ai-progress-text">{generationProgress}</p>
                  <p className="ai-wait-text">Isso pode levar alguns segundos...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTemplate ? '✏️ Editar Plano' : '➕ Criar Plano'}</h2>
              <button className="close-button" onClick={handleCloseModal}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="template-form">
              {formError && <div className="form-error">{formError}</div>}
              {importSuccess && <div className="form-success">{importSuccess}</div>}

              {/* Botão de Importar JSON */}
              <div className="import-section">
                <div>
                  <label htmlFor="json-import" className="import-button">
                    📥 Importar JSON
                    <input
                      id="json-import"
                      type="file"
                      accept=".json"
                      onChange={handleImportJson}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <span className="import-hint">
                    Importar plano de leitura a partir de arquivo JSON
                  </span>
                </div>
                <details className="json-example">
                  <summary>Ver exemplo de estrutura JSON</summary>
                  <pre className="json-code">
{`{
  "name": "Plano Exemplo",
  "description": "Descrição do plano",
  "type": "custom",
  "duration": 7,
  "testament": "both",
  "isActive": true,
  "order": 0,
  "readings": [
    {
      "day": 1,
      "bookReadings": [
        {
          "book": "Gênesis",
          "chapters": [1, 2, 3]
        }
      ],
      "description": "A criação"
    },
    {
      "day": 2,
      "bookReadings": [
        {
          "book": "Mateus",
          "chapters": [1]
        },
        {
          "book": "Salmos",
          "chapters": [1]
        }
      ],
      "description": "Múltiplas leituras"
    }
  ]
}`}
                  </pre>
                </details>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Nome do Plano *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Ex: Leitura Anual da Bíblia"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Tipo *</label>
                  <select name="type" value={formData.type} onChange={handleInputChange} required>
                    <option value="annual">Anual</option>
                    <option value="custom">Personalizado</option>
                    <option value="sequential">Sequencial</option>
                    <option value="thematic">Temático</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Descrição *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Descreva o plano de leitura..."
                  rows={3}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Duração (dias) *</label>
                  <input
                    type="number"
                    name="duration"
                    value={formData.duration}
                    onChange={handleInputChange}
                    placeholder="365"
                    min="1"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Testamento *</label>
                  <select name="testament" value={formData.testament} onChange={handleInputChange} required>
                    <option value="both">Ambos</option>
                    <option value="old">Antigo Testamento</option>
                    <option value="new">Novo Testamento</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Ordem</label>
                  <input
                    type="number"
                    name="order"
                    value={formData.order}
                    onChange={handleInputChange}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                  />
                  <span>Ativo (visível no app)</span>
                </label>
              </div>

              <div className="readings-section">
                <div className="readings-header">
                  <h3>📚 Leituras Diárias ({readings.length})</h3>
                  <button type="button" onClick={handleAddReading} className="add-reading-btn">
                    + Adicionar Dia
                  </button>
                </div>

                <div className="readings-list">
                  {readings.length === 0 ? (
                    <div className="no-readings">
                      <p>Nenhuma leitura adicionada ainda.</p>
                      <button type="button" onClick={handleAddReading} className="add-first-reading">
                        + Adicionar Primeira Leitura
                      </button>
                    </div>
                  ) : (
                    readings.map((reading, idx) => (
                      <div key={idx} className="reading-item">
                        <div className="reading-header">
                          <span className="reading-day">Dia {reading.day}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveReading(idx)}
                            className="remove-reading-btn"
                          >
                            🗑️
                          </button>
                        </div>

                        <div className="book-readings-list">
                          {reading.bookReadings.map((bookReading, bookIdx) => (
                            <div key={bookIdx} className="book-reading-item">
                              <div className="book-reading-header">
                                <span className="book-reading-label">📖 Leitura {bookIdx + 1}</span>
                                {reading.bookReadings.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBookFromReading(idx, bookIdx)}
                                    className="remove-book-btn"
                                    title="Remover livro"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                              <div className="book-reading-fields">
                                <div className="form-group">
                                  <label>Livro</label>
                                  <select
                                    value={bookReading.book}
                                    onChange={(e) => handleBookReadingChange(idx, bookIdx, 'book', e.target.value)}
                                  >
                                    <option value="">Selecione um livro</option>
                                    <optgroup label="Antigo Testamento">
                                      {BIBLE_BOOKS.filter(b => b.testament === 'old').map(book => (
                                        <option key={book.name} value={book.name}>{book.name}</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="Novo Testamento">
                                      {BIBLE_BOOKS.filter(b => b.testament === 'new').map(book => (
                                        <option key={book.name} value={book.name}>{book.name}</option>
                                      ))}
                                    </optgroup>
                                  </select>
                                </div>

                                <div className="form-group">
                                  <label>Capítulos (separados por vírgula)</label>
                                  <input
                                    type="text"
                                    value={bookReading.chapters.join(', ')}
                                    onChange={(e) => {
                                      const chapters = e.target.value
                                        .split(',')
                                        .map(c => parseInt(c.trim()))
                                        .filter(c => !isNaN(c));
                                      handleBookReadingChange(idx, bookIdx, 'chapters', chapters);
                                    }}
                                    placeholder="Ex: 1, 2, 3"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleAddBookToReading(idx)}
                            className="add-book-btn"
                          >
                            + Adicionar Livro ao Dia
                          </button>
                        </div>

                        <div className="form-group full-width reading-description">
                          <label>Descrição do dia (opcional)</label>
                          <input
                            type="text"
                            value={reading.description || ''}
                            onChange={(e) => handleReadingChange(idx, 'description', e.target.value)}
                            placeholder="Ex: A criação do mundo e início da história"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={handleCloseModal} className="cancel-button" disabled={isSubmitting}>
                  Cancelar
                </button>
                <button type="submit" className="submit-button" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : editingTemplate ? '💾 Salvar' : '➕ Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingPlanTemplates;
