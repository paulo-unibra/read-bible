import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import JobProgressModal from "../components/JobProgressModal";
import Sidebar from "../components/Sidebar";
import {
    ActionButton,
    Badge,
    Button,
    EmptyState,
    ErrorMessage,
    FiltersSection,
    Input,
    MainContent,
    PageTitle,
    Pagination,
    Select,
    Table,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
} from "../components/ui/StyledComponents";
import { BIBLE_BOOKS, getChapterOptions } from "../constants/bibleBooks";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import "./Quizzes.css";

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
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [testament, setTestament] = useState("");
  const [bibleVersion, setBibleVersion] = useState("");
  const [bookName, setBookName] = useState("");
  const [availableBooks, setAvailableBooks] = useState<string[]>([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showJobProgressModal, setShowJobProgressModal] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<number | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizDetail | null>(null);
  const [createMode, setCreateMode] = useState<"manual" | "ai">("manual");
  const [isEditingView, setIsEditingView] = useState(false);
  const [editedQuestions, setEditedQuestions] = useState<QuizQuestion[]>([]);
  const [availableChapters, setAvailableChapters] = useState<number[]>([]);

  // Form states
  const [formData, setFormData] = useState({
    bookName: "",
    chapter: "",
    bibleVersion: "NVI",
    testament: "new",
    category: "geral",
  });
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPermission("gerenciar_questionarios")) {
      navigate("/dashboard");
      return;
    }

    loadQuizzes();
    loadAvailableBooks();
  }, [page, perPage, search, testament, bibleVersion, bookName]);

  const loadAvailableBooks = async () => {
    try {
      const response = await api.get("/admin/quizzes?perPage=1000");
      const booksInDatabase = new Set(
        response.data.data.map((q: Quiz) => q.bookName),
      );

      // Ordenar pelos livros da Bíblia que existem no banco
      const books = BIBLE_BOOKS.map((book) => book.name).filter((bookName) =>
        booksInDatabase.has(bookName),
      );

      setAvailableBooks(books);
    } catch (err) {
      console.error("Erro ao carregar livros disponíveis:", err);
    }
  };

  const loadQuizzes = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
        ...(search && { search }),
        ...(bookName && { bookName }),
        ...(testament && { testament }),
        ...(bibleVersion && { bibleVersion }),
      });

      const response = await api.get(`/admin/quizzes?${params}`);
      setQuizzes(response.data.data);
      setTotalPages(response.data.meta.lastPage || 1);
    } catch (err: any) {
      setError("Erro ao carregar questionários");
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
      setError("Erro ao carregar detalhes do questionário");
      console.error(err);
    }
  };

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    setCreateMode("manual");
    setFormError("");
    setFormData({
      bookName: "",
      chapter: "",
      bibleVersion: "NVI",
      testament: "new",
      category: "geral",
    });
  };

  const handleCloseModals = () => {
    setShowCreateModal(false);
    setShowViewModal(false);
    setSelectedQuiz(null);
    setFormError("");
    setCreateMode("manual");
    setIsEditingView(false);
    setEditedQuestions([]);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    if (name === "bookName") {
      const chapters = getChapterOptions(value);
      setAvailableChapters(chapters);
      setFormData((prev) => ({ ...prev, bookName: value, chapter: "" }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleEditQuestion = (
    questionIndex: number,
    field: "pergunta" | "respostaCorreta",
    value: string,
  ) => {
    setEditedQuestions((prev) => {
      const updated = [...prev];
      updated[questionIndex] = { ...updated[questionIndex], [field]: value };
      return updated;
    });
  };

  const handleEditAlternativa = (
    questionIndex: number,
    altIndex: number,
    value: string,
  ) => {
    setEditedQuestions((prev) => {
      const updated = [...prev];
      const alternativas = [...updated[questionIndex].alternativas];
      alternativas[altIndex] = value;
      updated[questionIndex] = { ...updated[questionIndex], alternativas };
      return updated;
    });
  };

  const handleAddAlternativa = (questionIndex: number) => {
    setEditedQuestions((prev) => {
      const updated = [...prev];
      const alternativas = [...updated[questionIndex].alternativas, ""];
      updated[questionIndex] = { ...updated[questionIndex], alternativas };
      return updated;
    });
  };

  const handleRemoveAlternativa = (questionIndex: number, altIndex: number) => {
    setEditedQuestions((prev) => {
      const updated = [...prev];
      const alternativas = updated[questionIndex].alternativas.filter(
        (_, i) => i !== altIndex,
      );
      updated[questionIndex] = { ...updated[questionIndex], alternativas };
      return updated;
    });
  };

  const handleAddQuestion = () => {
    setEditedQuestions((prev) => [
      ...prev,
      {
        questionId: `q${prev.length + 1}`,
        pergunta: "",
        alternativas: ["", "", "", ""],
        respostaCorreta: "",
      },
    ]);
  };

  const handleRemoveQuestion = (questionIndex: number) => {
    if (editedQuestions.length <= 1) {
      setFormError("O questionário deve ter pelo menos 1 questão.");
      return;
    }
    setEditedQuestions((prev) => prev.filter((_, i) => i !== questionIndex));
  };

  const handleSaveEdits = async () => {
    if (!selectedQuiz) return;

    setIsSubmitting(true);
    setFormError("");

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
      setFormError(err.response?.data?.error || "Erro ao salvar alterações");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      const payload: any = {
        bookName: formData.bookName,
        bibleVersion: formData.bibleVersion,
      };

      // Só adiciona chapter se foi informado (senão gera para o livro todo)
      if (formData.chapter) {
        payload.chapter = formData.chapter;
      }

      const response = await api.post("/admin/quizzes/generate-ai", payload);

      // Fechar modal de criação e abrir modal de progresso
      setShowCreateModal(false);
      setCurrentJobId(response.data.jobId);
      setShowJobProgressModal(true);
    } catch (err: any) {
      setFormError(
        err.response?.data?.error || "Erro ao gerar questionário com IA",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJobComplete = () => {
    loadQuizzes();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Tem certeza que deseja deletar este questionário?")) {
      return;
    }

    try {
      await api.delete(`/admin/quizzes/${id}`);
      loadQuizzes();
    } catch (err: any) {
      setError("Erro ao deletar questionário");
      console.error(err);
    }
  };



  return (
    <>
      <Sidebar />
      <MainContent className="!min-h-screen !bg-transparent !px-6 !py-7 !pb-[140px] sm:!px-8">
        <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#9b6db7]">Conteúdo bíblico</p>
            <PageTitle className="!mb-0 !text-[28px] !tracking-[-0.03em] !text-[#382747]">Gerenciamento de Questionários</PageTitle>
          </div>
          <Button className="!rounded-xl !bg-gradient-to-r !from-[#b76bdd] !to-[#e276c5] !px-5 !py-3 !font-semibold shadow-[0_8px_20px_rgba(186,103,207,0.2)]" onClick={handleOpenCreateModal}>
            + Criar Questionário
          </Button>
        </header>

        <FiltersSection className="sticky top-3 z-50 !mb-5 !items-center !rounded-2xl !border !border-white/80 !bg-white/55 !p-4 !shadow-[0_8px_28px_rgba(110,69,135,0.08)] !backdrop-blur-xl">
          <Input
            className="!min-w-0 !rounded-xl !border-white/80 !bg-white/65 !px-4 !py-3 placeholder:!text-[#a28eae]"
            type="text"
            placeholder="Buscar por livro..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setBookName("");
              setPage(1);
            }}
          />

          <Select
            className="!rounded-xl !border-white/80 !bg-white/65 !px-4 !py-3 !text-[#665476]"
            value={bookName}
            onChange={(e) => {
              setBookName(e.target.value);
              setSearch("");
              setPage(1);
            }}
          >
            <option value="">Selecionar Livro</option>
            {availableBooks.map((book) => (
              <option key={book} value={book}>
                {book}
              </option>
            ))}
          </Select>

          <Select
            className="!rounded-xl !border-white/80 !bg-white/65 !px-4 !py-3 !text-[#665476]"
            value={testament}
            onChange={(e) => {
              setTestament(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os Testamentos</option>
            <option value="old">Antigo Testamento</option>
            <option value="new">Novo Testamento</option>
          </Select>

          <Select
            className="!rounded-xl !border-white/80 !bg-white/65 !px-4 !py-3 !text-[#665476]"
            value={bibleVersion}
            onChange={(e) => {
              setBibleVersion(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as Versões</option>
            <option value="NVI">NVI</option>
            <option value="ARC">ARC</option>
            <option value="ARA">ARA</option>
            <option value="NVT">NVT</option>
          </Select>
        </FiltersSection>

        {error && <ErrorMessage className="!rounded-xl !border-white/70 !bg-white/60 !backdrop-blur-xl">{error}</ErrorMessage>}

        {loading ? (
          <EmptyState className="!rounded-2xl !border-white/80 !bg-white/50 !backdrop-blur-xl">Carregando questionários...</EmptyState>
        ) : quizzes.length === 0 ? (
          <EmptyState className="!rounded-2xl !border-white/80 !bg-white/50 !backdrop-blur-xl">Nenhum questionário encontrado</EmptyState>
        ) : (
          <>
            <Table className="!rounded-2xl !border-white/80 !bg-white/55 !shadow-[0_10px_32px_rgba(110,69,135,0.08)]">
              <Thead className="!bg-white/45">
                <Tr>
                  <Th className="!border-b !border-[#e8dcef] !text-[#755c84]">ID</Th>
                  <Th className="!border-b !border-[#e8dcef] !text-[#755c84]">Livro</Th>
                  <Th className="!border-b !border-[#e8dcef] !text-[#755c84]">Capítulo</Th>
                  <Th className="!border-b !border-[#e8dcef] !text-[#755c84]">Versão</Th>
                  <Th className="!border-b !border-[#e8dcef] !text-[#755c84]">Testamento</Th>
                  <Th className="!border-b !border-[#e8dcef] !text-[#755c84]">Questões</Th>
                  <Th className="!border-b !border-[#e8dcef] !text-[#755c84]">Criado em</Th>
                  <Th className="!border-b !border-[#e8dcef] !text-[#755c84]">Ações</Th>
                </Tr>
              </Thead>
              <Tbody>
                {quizzes.map((quiz) => (
                  <Tr key={quiz.id} className="!border-[#eee5f3] hover:!bg-white/65">
                    <Td>{quiz.id}</Td>
                    <Td>{quiz.bookName}</Td>
                    <Td>{quiz.chapter}</Td>
                    <Td>
                      <Badge type="info">{quiz.bibleVersion}</Badge>
                    </Td>
                    <Td>
                      <Badge
                        type={quiz.testament === "old" ? "warning" : "success"}
                      >
                        {quiz.testament === "old" ? "AT" : "NT"}
                      </Badge>
                    </Td>
                    <Td>{quiz.questionsCount}</Td>
                    <Td>
                      {new Date(quiz.createdAt).toLocaleDateString("pt-BR")}
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <ActionButton
                          onClick={() => loadQuizDetail(quiz.id)}
                          title="Visualizar"
                        >
                          👁️
                        </ActionButton>
                        <ActionButton
                          onClick={() => handleDelete(quiz.id)}
                          title="Deletar"
                        >
                          🗑️
                        </ActionButton>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            <Pagination className="!fixed !bottom-0 !left-[calc(var(--sidebar-width)_+_32px)] !right-8 !z-[90] !mx-auto !mt-0 !mb-0 !max-w-[1500px] !min-h-[72px] !justify-between !gap-3 !rounded-t-2xl !border-x !border-t !border-white/80 !bg-white/65 !px-8 !py-3 !shadow-[0_-8px_28px_rgba(110,69,135,0.12)] !backdrop-blur-2xl max-sm:!flex-col max-sm:!items-stretch max-sm:!px-3">
                <div className="flex items-center gap-2 max-sm:justify-center">
                  <label htmlFor="quizzes-page-size" className="text-xs font-medium text-[#755c84]">Itens por página</label>
                  <Select
                    id="quizzes-page-size"
                    aria-label="Itens por página"
                    value={perPage}
                    onChange={(event) => {
                      setPerPage(Number(event.target.value));
                      setPage(1);
                    }}
                    className="!min-w-0 !flex-none !rounded-xl !border-white/80 !bg-white/70 !px-3 !py-2 !text-xs"
                  >
                    {[10, 20, 50, 100].map((count) => (
                      <option key={count} value={count}>{count}</option>
                    ))}
                  </Select>
                </div>
                {totalPages > 1 ? (
                  <div className="flex items-center gap-4 max-sm:justify-center">
                    <Button
                      className="!rounded-xl !bg-white/70 !px-4 !py-2 !text-xs !text-[#715487] hover:!bg-white"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      ← Anterior
                    </Button>
                    <span className="whitespace-nowrap text-xs font-semibold text-[#755c84]">
                      Página {page} de {totalPages}
                    </span>
                    <Button
                      className="!rounded-xl !bg-white/70 !px-4 !py-2 !text-xs !text-[#715487] hover:!bg-white"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Próxima →
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-[#755c84]">Página 1 de 1</span>
                )}
            </Pagination>
          </>
        )}

        </div>

        {/* Modal de Criação */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={handleCloseModals}>
            <div
              className="modal-content modal-small"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>+ Criar Questionário</h2>
                <button className="close-button" onClick={handleCloseModals}>
                  ×
                </button>
              </div>

              <div className="quiz-form">
                {formError && <div className="form-error">{formError}</div>}

                {/* Seleção de Modo */}
                <div className="mode-selection">
                  <button
                    type="button"
                    className={`mode-button ${createMode === "manual" ? "active" : ""}`}
                    onClick={() => setCreateMode("manual")}
                  >
                    ✍️ Manual
                  </button>
                  <button
                    type="button"
                    className={`mode-button ${createMode === "ai" ? "active" : ""}`}
                    onClick={() => setCreateMode("ai")}
                  >
                    🤖 Gerar com IA
                  </button>
                </div>

                {createMode === "ai" ? (
                  <form onSubmit={handleAISubmit}>
                    <div className="form-group">
                      <label>Livro da Bíblia *</label>
                      <select
                        name="bookName"
                        value={formData.bookName}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Selecione um livro</option>
                        <optgroup label="Antigo Testamento">
                          {BIBLE_BOOKS.filter((b) => b.testament === "old").map(
                            (book) => (
                              <option key={book.name} value={book.name}>
                                {book.name}
                              </option>
                            ),
                          )}
                        </optgroup>
                        <optgroup label="Novo Testamento">
                          {BIBLE_BOOKS.filter((b) => b.testament === "new").map(
                            (book) => (
                              <option key={book.name} value={book.name}>
                                {book.name}
                              </option>
                            ),
                          )}
                        </optgroup>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Capítulo (opcional)</label>
                      <select
                        name="chapter"
                        value={formData.chapter}
                        onChange={handleInputChange}
                        disabled={!formData.bookName}
                      >
                        <option value="">
                          Livro completo (todos os capítulos)
                        </option>
                        {availableChapters.map((num) => (
                          <option key={num} value={num}>
                            Capítulo {num}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Versão da Bíblia *</label>
                      <select
                        name="bibleVersion"
                        value={formData.bibleVersion}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="NVI">
                          NVI - Nova Versão Internacional
                        </option>
                        <option value="ARC">
                          ARC - Almeida Revista e Corrigida
                        </option>
                        <option value="ARA">
                          ARA - Almeida Revista e Atualizada
                        </option>
                        <option value="NVT">
                          NVT - Nova Versão Transformadora
                        </option>
                      </select>
                    </div>

                    <div className="info-box">
                      <p>
                        💡 A IA irá gerar automaticamente 10 questões de
                        múltipla escolha com 4 alternativas cada.
                      </p>
                      <p>
                        <strong>Dica:</strong> Se não informar o capítulo, a IA
                        criará questionários para todo o livro!
                      </p>
                    </div>

                    <div className="modal-footer">
                      <button
                        type="button"
                        onClick={handleCloseModals}
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
                        {isSubmitting ? "🤖 Gerando..." : "🤖 Gerar com IA"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="manual-mode-message">
                    <div className="info-box">
                      <p>
                        📝 A criação manual de questionários será implementada
                        em breve.
                      </p>
                      <p>
                        Por enquanto, utilize a opção "Gerar com IA" para criar
                        questionários automaticamente.
                      </p>
                    </div>
                    <div className="modal-footer">
                      <button
                        type="button"
                        onClick={handleCloseModals}
                        className="cancel-button"
                      >
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
            <div
              className="modal-content modal-large"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>
                  📋 {selectedQuiz.bookName} {selectedQuiz.chapter}
                </h2>
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
                          setFormError("");
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
                        {isSubmitting ? "Salvando..." : "💾 Salvar"}
                      </button>
                    </>
                  )}
                  <button className="close-button" onClick={handleCloseModals}>
                    ×
                  </button>
                </div>
              </div>

              <div className="quiz-view-body">
                {formError && <div className="form-error">{formError}</div>}

                <div className="quiz-meta">
                  <span>
                    <strong>Versão:</strong> {selectedQuiz.bibleVersion}
                  </span>
                  <span>
                    <strong>Testamento:</strong>{" "}
                    {selectedQuiz.testament === "old" ? "Antigo" : "Novo"}
                  </span>
                  <span>
                    <strong>Categoria:</strong> {selectedQuiz.category}
                  </span>
                  <span>
                    <strong>Questões:</strong> {editedQuestions.length}
                  </span>
                </div>

                <div className="questions-list">
                  {editedQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className={`question-view ${isEditingView ? "editing" : ""}`}
                    >
                      <h4>Questão {idx + 1}</h4>

                      {isEditingView ? (
                        <div className="question-edit-form">
                          <div className="form-group">
                            <label>Pergunta:</label>
                            <textarea
                              value={q.pergunta}
                              onChange={(e) =>
                                handleEditQuestion(
                                  idx,
                                  "pergunta",
                                  e.target.value,
                                )
                              }
                              className="question-textarea"
                              rows={3}
                            />
                          </div>

                          <div className="form-group">
                            <label>Alternativas:</label>
                            {q.alternativas.map((alt, altIdx) => (
                              <div
                                key={altIdx}
                                className="alternative-input-group"
                              >
                                <span className="alternative-letter">
                                  {String.fromCharCode(65 + altIdx)})
                                </span>
                                <input
                                  type="text"
                                  value={alt}
                                  onChange={(e) =>
                                    handleEditAlternativa(
                                      idx,
                                      altIdx,
                                      e.target.value,
                                    )
                                  }
                                  className="alternative-input"
                                  placeholder={`Alternativa ${String.fromCharCode(65 + altIdx)}`}
                                />
                                {q.alternativas.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveAlternativa(idx, altIdx)
                                    }
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
                              onChange={(e) =>
                                handleEditQuestion(
                                  idx,
                                  "respostaCorreta",
                                  e.target.value,
                                )
                              }
                              className="correct-answer-select"
                            >
                              <option value="">
                                Selecione a resposta correta
                              </option>
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
                              <li
                                key={altIdx}
                                className={
                                  alt === q.respostaCorreta ? "correct" : ""
                                }
                              >
                                {String.fromCharCode(65 + altIdx)}) {alt}
                                {alt === q.respostaCorreta && (
                                  <span className="correct-badge">
                                    ✓ Correta
                                  </span>
                                )}
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

        {/* Modal de Progresso do Job */}
        {showJobProgressModal && currentJobId && (
          <JobProgressModal
            jobId={currentJobId}
            onClose={() => {
              setShowJobProgressModal(false);
              setCurrentJobId(null);
            }}
            onComplete={handleJobComplete}
          />
        )}
      </MainContent>
    </>
  );
};

export default Quizzes;
