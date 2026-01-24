import { Reading, ReadingPlan, ReadingPlanDay } from "../types";
import DatabaseService from "./DatabaseService";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:1999";

export class ReadingPlanService {
  async createDefaultAnnualPlan(customName: string): Promise<ReadingPlan> {
    try {
      console.log(
        "☁️ Criando plano sequencial APENAS no backend (sem salvar localmente)...",
      );

      // Verificar autenticação
      const authService = (await import("./AuthService")).default;
      const token = authService.getToken();
      const user = authService.getUser();

      if (!token || !user) {
        throw new Error(
          "Usuário não autenticado. É necessário estar logado para criar um plano de leitura.",
        );
      }

      console.log("👤 Usuário autenticado:", user.email);

      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59);
      const totalDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      console.log("📅 Datas:", { startDate, endDate, totalDays });

      // Criar plano APENAS no backend (SEM enviar leituras - o backend gera automaticamente)
      console.log("☁️ Enviando apenas metadados para o backend...");
      const backendResponse = await authService.createCustomReadingPlan({
        name: customName,
        type: "sequential",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDays,
        // NÃO envia readings - o backend gera os primeiros 5 dias automaticamente
      });

      console.log(
        "📡 [createDefaultAnnualPlan] Resposta do backend:",
        JSON.stringify(backendResponse, null, 2),
      );

      if (!backendResponse.success) {
        console.error(
          "❌ [createDefaultAnnualPlan] Backend retornou erro:",
          backendResponse.message,
        );
        throw new Error(
          backendResponse.message || "Falha ao criar plano no backend",
        );
      }

      console.log(
        "✅ Plano criado no backend com ID:",
        backendResponse.data?.plan?.id,
      );
      console.log("📊 Backend criou os primeiros 5 dias automaticamente");

      // Retornar o plano do backend
      const plan: ReadingPlan = {
        id: backendResponse.data?.plan?.id || `annual_${Date.now()}`,
        name: customName,
        type: "sequential",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isActive: true,
        createdDate: new Date().toISOString(),
        totalDays,
        completedDays: 0,
      };

      return plan;
    } catch (error) {
      console.error("❌ Error creating default annual plan:", error);
      throw error;
    }
  }

  async createInterleavedPlan(customName: string): Promise<ReadingPlan> {
    try {
      console.log(
        "☁️ Criando plano intercalado APENAS no backend (sem salvar localmente)...",
      );

      // Verificar autenticação
      const authService = (await import("./AuthService")).default;
      const token = authService.getToken();
      const user = authService.getUser();

      if (!token || !user) {
        throw new Error(
          "Usuário não autenticado. É necessário estar logado para criar um plano intercalado.",
        );
      }

      console.log("👤 Usuário autenticado:", user.email);

      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59);
      const totalDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      console.log("📅 Datas:", { startDate, endDate, totalDays });

      // Criar plano APENAS no backend (SEM enviar leituras - o backend gera automaticamente)
      console.log("☁️ Enviando apenas metadados para o backend...");
      const backendResponse = await authService.createCustomReadingPlan({
        name: customName,
        type: "interleaved",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDays,
        // NÃO envia readings - o backend gera os primeiros 5 dias automaticamente
      });

      console.log(
        "📡 [createInterleavedPlan] Resposta do backend:",
        JSON.stringify(backendResponse, null, 2),
      );

      if (!backendResponse.success) {
        console.error(
          "❌ [createInterleavedPlan] Backend retornou erro:",
          backendResponse.message,
        );
        throw new Error(
          backendResponse.message || "Falha ao criar plano no backend",
        );
      }

      console.log(
        "✅ Plano criado no backend com ID:",
        backendResponse.data?.plan?.id,
      );
      console.log("📊 Backend criou os primeiros 5 dias automaticamente");

      // Retornar o plano do backend
      const plan: ReadingPlan = {
        id: backendResponse.data?.plan?.id || `interleaved_${Date.now()}`,
        name: customName,
        type: "interleaved",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isActive: true,
        createdDate: new Date().toISOString(),
        totalDays,
        completedDays: 0,
      };

      return plan;
    } catch (error) {
      console.error("❌ Error creating interleaved plan:", error);
      throw error;
    }
  }

  async createNT100DaysPlan(customName: string): Promise<ReadingPlan> {
    try {
      console.log(
        "☁️ Criando plano NT 100 dias APENAS no backend (sem salvar localmente)...",
      );

      // Verificar autenticação
      const authService = (await import("./AuthService")).default;
      const token = authService.getToken();
      const user = authService.getUser();

      if (!token || !user) {
        throw new Error(
          "Usuário não autenticado. É necessário estar logado para criar um plano de leitura.",
        );
      }

      console.log("👤 Usuário autenticado:", user.email);

      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 100);
      const totalDays = 100;

      console.log("📅 Datas:", { startDate, endDate, totalDays });

      // Criar plano APENAS no backend (SEM enviar leituras - o backend gera automaticamente)
      console.log("☁️ Enviando apenas metadados para o backend...");
      const backendResponse = await authService.createCustomReadingPlan({
        name: customName,
        type: "nt-100", // Tipo especial para NT 100 dias
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDays,
        // NÃO envia readings - o backend gera os primeiros 5 dias automaticamente
      });

      console.log(
        "📡 [createNT100DaysPlan] Resposta do backend:",
        JSON.stringify(backendResponse, null, 2),
      );

      if (!backendResponse.success) {
        console.error(
          "❌ [createNT100DaysPlan] Backend retornou erro:",
          backendResponse.message,
        );
        throw new Error(
          backendResponse.message || "Falha ao criar plano no backend",
        );
      }

      console.log(
        "✅ Plano criado no backend com ID:",
        backendResponse.data?.plan?.id,
      );
      console.log("📊 Backend criou os primeiros 5 dias automaticamente");

      // Retornar o plano do backend
      const plan: ReadingPlan = {
        id: backendResponse.data?.plan?.id || `nt100_${Date.now()}`,
        name: customName,
        type: "nt-100",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isActive: true,
        createdDate: new Date().toISOString(),
        totalDays,
        completedDays: 0,
      };

      return plan;
    } catch (error) {
      console.error("❌ Error creating NT 100 days plan:", error);
      throw error;
    }
  }

  async getTemplates() {
    try {
      console.log(
        "Buscando templates de:",
        `${API_URL}/reading-plan-templates`,
      );
      const response = await fetch(`${API_URL}/reading-plan-templates`);
      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }
      const data = await response.json();
      console.log("Templates recebidos:", data);
      return data.templates || [];
    } catch (error) {
      console.error("Error fetching templates:", error);
      throw error;
    }
  }

  async createPlanFromTemplate(
    templateId: number,
    customName: string,
  ): Promise<ReadingPlan> {
    try {
      console.log(
        "📋 [createPlanFromTemplate] INÍCIO - Template ID:",
        templateId,
        "Nome:",
        customName,
      );

      // Verificar autenticação
      const authService = (await import("./AuthService")).default;
      const token = authService.getToken();
      const user = authService.getUser();

      console.log("🔐 [createPlanFromTemplate] Token existe?", !!token);
      console.log("👤 [createPlanFromTemplate] Usuário existe?", !!user);

      if (!token || !user) {
        console.error("❌ [createPlanFromTemplate] Usuário não autenticado");
        throw new Error(
          "Usuário não autenticado. É necessário estar logado para criar um plano a partir de template.",
        );
      }

      console.log(
        "👤 [createPlanFromTemplate] Usuário autenticado:",
        user.email,
      );

      // Fetch template details (apenas para pegar metadados)
      console.log(
        "📡 [createPlanFromTemplate] Buscando template do backend:",
        `${API_URL}/reading-plan-templates/${templateId}`,
      );
      const response = await fetch(
        `${API_URL}/reading-plan-templates/${templateId}`,
      );
      console.log(
        "📡 [createPlanFromTemplate] Response status:",
        response.status,
        response.statusText,
      );

      if (!response.ok) {
        console.error("❌ [createPlanFromTemplate] Falha ao buscar template");
        throw new Error("Failed to fetch template");
      }
      const template = await response.json();
      console.log("📋 [createPlanFromTemplate] Template recebido:", {
        id: template.id,
        name: template.name,
        type: template.type,
        readingsCount: template.readings?.length || 0,
      });

      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      let endDate = new Date(startDate);

      // Calculate end date based on template type
      if (template.type === "annual") {
        endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59);
      } else {
        endDate.setDate(endDate.getDate() + template.duration);
      }

      const totalDays = template.readings.length;
      console.log("📅 [createPlanFromTemplate] Datas calculadas:", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDays,
      });

      // Create plan in backend (APENAS metadados, SEM enviar leituras)
      console.log(
        "☁️ [createPlanFromTemplate] Enviando APENAS metadados para backend...",
      );
      console.log("📦 [createPlanFromTemplate] Payload:", {
        name: customName,
        type: template.type,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDays,
      });

      const backendResponse = await authService.createCustomReadingPlan({
        name: customName,
        type: template.type,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDays,
        // NÃO envia readings - o backend gera os primeiros 5 dias automaticamente
      });

      console.log("📡 [createPlanFromTemplate] Resposta do backend:", {
        success: backendResponse.success,
        message: backendResponse.message,
        planId: backendResponse.data?.plan?.id,
      });

      if (!backendResponse.success) {
        console.error(
          "❌ [createPlanFromTemplate] Backend retornou erro:",
          backendResponse.message,
        );
        throw new Error(
          backendResponse.message || "Falha ao criar plano no backend",
        );
      }

      console.log(
        "✅ [createPlanFromTemplate] Plano criado no backend com sucesso! ID:",
        backendResponse.data?.plan?.id,
      );
      console.log("📊 Backend criou os primeiros 5 dias automaticamente");

      // Return plan structure (but it's stored only in backend)
      const plan: ReadingPlan = {
        id:
          backendResponse.data?.plan?.id ||
          `template_${templateId}_${Date.now()}`,
        name: customName,
        type: template.type,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isActive: true,
        createdDate: new Date().toISOString(),
        totalDays,
        completedDays: 0,
      };

      console.log(
        "✅ [createPlanFromTemplate] FIM - Retornando plano:",
        plan.id,
      );
      return plan;
    } catch (error) {
      console.error("❌ [createPlanFromTemplate] ERRO:", error);
      console.error(
        "❌ [createPlanFromTemplate] Stack:",
        (error as Error).stack,
      );
      throw error;
    }
  }

  private getBookIdByName(bookName: string): number {
    // Map book names to IDs (1-66)
    const bookMap: Record<string, number> = {
      Gênesis: 1,
      Êxodo: 2,
      Levítico: 3,
      Números: 4,
      Deuteronômio: 5,
      Josué: 6,
      Juízes: 7,
      Rute: 8,
      "1 Samuel": 9,
      "2 Samuel": 10,
      "1 Reis": 11,
      "2 Reis": 12,
      "1 Crônicas": 13,
      "2 Crônicas": 14,
      Esdras: 15,
      Neemias: 16,
      Ester: 17,
      Jó: 18,
      Salmos: 19,
      Provérbios: 20,
      Eclesiastes: 21,
      Cantares: 22,
      Isaías: 23,
      Jeremias: 24,
      Lamentações: 25,
      Ezequiel: 26,
      Daniel: 27,
      Oséias: 28,
      Joel: 29,
      Amós: 30,
      Obadias: 31,
      Jonas: 32,
      Miquéias: 33,
      Naum: 34,
      Habacuque: 35,
      Sofonias: 36,
      Ageu: 37,
      Zacarias: 38,
      Malaquias: 39,
      Mateus: 40,
      Marcos: 41,
      Lucas: 42,
      João: 43,
      Atos: 44,
      Romanos: 45,
      "1 Coríntios": 46,
      "2 Coríntios": 47,
      Gálatas: 48,
      Efésios: 49,
      Filipenses: 50,
      Colossenses: 51,
      "1 Tessalonicenses": 52,
      "2 Tessalonicenses": 53,
      "1 Timóteo": 54,
      "2 Timóteo": 55,
      Tito: 56,
      Filemom: 57,
      Hebreus: 58,
      Tiago: 59,
      "1 Pedro": 60,
      "2 Pedro": 61,
      "1 João": 62,
      "2 João": 63,
      "3 João": 64,
      Judas: 65,
      Apocalipse: 66,
    };

    return bookMap[bookName] || 1; // Default to Genesis if not found
  }

  async createMonthlyPlan(
    name: string,
    startDate: Date,
    type: "new-testament" | "psalms-proverbs",
  ): Promise<ReadingPlan> {
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const planId = `monthly_${Date.now()}`;
    const totalDays = this.getDaysBetween(startDate, endDate);

    const plan: ReadingPlan = {
      id: planId,
      name,
      type: "monthly",
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      isActive: true,
      createdDate: new Date().toISOString(),
      totalDays,
      completedDays: 0,
    };

    await this.savePlan(plan);

    // Generate daily readings
    const readings =
      type === "new-testament"
        ? this.generateNewTestamentReadings(startDate, totalDays)
        : this.generatePsalmsProverbsReadings(startDate, totalDays);

    await this.savePlanDays(planId, readings);

    return plan;
  }

  async createYearlyPlan(name: string, startDate: Date): Promise<ReadingPlan> {
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);

    const planId = `yearly_${Date.now()}`;
    const totalDays = 365;

    const plan: ReadingPlan = {
      id: planId,
      name,
      type: "yearly",
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      isActive: true,
      createdDate: new Date().toISOString(),
      totalDays,
      completedDays: 0,
    };

    await this.savePlan(plan);

    // Generate daily readings for entire Bible
    const readings = this.generateFullBibleReadings(startDate, totalDays);
    await this.savePlanDays(planId, readings);

    return plan;
  }

  async createCustomPlan(
    name: string,
    startDate: Date,
    endDate: Date,
    books: number[],
  ): Promise<ReadingPlan> {
    const planId = `custom_${Date.now()}`;
    const totalDays = this.getDaysBetween(startDate, endDate);

    const plan: ReadingPlan = {
      id: planId,
      name,
      type: "custom",
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      isActive: true,
      createdDate: new Date().toISOString(),
      totalDays,
      completedDays: 0,
    };

    await this.savePlan(plan);

    // Generate custom readings
    const readings = this.generateCustomReadings(startDate, totalDays, books);
    await this.savePlanDays(planId, readings);

    return plan;
  }

  private async savePlan(plan: ReadingPlan): Promise<void> {
    try {
      console.log("💾 [savePlan] Inicializando banco...");
      await DatabaseService.init();
      const db = (DatabaseService as any).db;

      console.log("💾 [savePlan] Executando INSERT...", {
        id: plan.id,
        name: plan.name,
        type: plan.type,
        isActive: plan.isActive ? 1 : 0,
      });

      const result = await db.runAsync(
        "INSERT INTO reading_plans (id, name, type, startDate, endDate, isActive, createdDate, totalDays, completedDays) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          plan.id,
          plan.name,
          plan.type,
          plan.startDate,
          plan.endDate,
          plan.isActive ? 1 : 0,
          plan.createdDate,
          plan.totalDays,
          plan.completedDays,
        ],
      );

      console.log("✅ [savePlan] INSERT executado, result:", result);

      // Verificar se foi realmente salvo
      const verification = await db.getFirstAsync(
        "SELECT * FROM reading_plans WHERE id = ?",
        [plan.id],
      );
      console.log("🔍 [savePlan] Verificação após INSERT:", verification);

      if (!verification) {
        throw new Error("Plano não foi salvo no banco de dados!");
      }
    } catch (error) {
      console.error("❌ [savePlan] ERRO ao salvar plano:", error);
      throw error;
    }
  }

  private async savePlanDays(
    planId: string,
    readings: ReadingPlanDay[],
  ): Promise<void> {
    try {
      console.log(
        `💾 [savePlanDays] Salvando ${readings.length} dias para plano ${planId}`,
      );
      await DatabaseService.init();
      const db = (DatabaseService as any).db;

      let savedCount = 0;
      for (const reading of readings) {
        const readingWithPlanId = { ...reading, planId };
        await db.runAsync(
          "INSERT INTO reading_plan_days (id, planId, dayNumber, date, readings, isCompleted, completedDate) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            readingWithPlanId.id,
            planId,
            readingWithPlanId.dayNumber,
            readingWithPlanId.date,
            JSON.stringify(readingWithPlanId.readings),
            readingWithPlanId.isCompleted ? 1 : 0,
            readingWithPlanId.completedDate,
          ],
        );
        savedCount++;

        if (savedCount % 50 === 0) {
          console.log(`   📝 Salvos ${savedCount}/${readings.length} dias...`);
        }
      }

      console.log(`✅ [savePlanDays] ${savedCount} dias salvos com sucesso`);

      // Verificar quantos foram realmente salvos
      const verification = await db.getFirstAsync(
        "SELECT COUNT(*) as count FROM reading_plan_days WHERE planId = ?",
        [planId],
      );
      console.log("🔍 [savePlanDays] Verificação após INSERTs:", verification);
    } catch (error) {
      console.error("❌ [savePlanDays] ERRO ao salvar dias:", error);
      throw error;
    }
  }

  async getActivePlans(): Promise<ReadingPlan[]> {
    await DatabaseService.init();
    const db = (DatabaseService as any).db;

    const result = await db.getAllAsync(
      "SELECT * FROM reading_plans WHERE isActive = 1 ORDER BY createdDate DESC",
    );

    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      startDate: row.startDate,
      endDate: row.endDate,
      isActive: Boolean(row.isActive),
      createdDate: row.createdDate,
      totalDays: row.totalDays,
      completedDays: row.completedDays,
    }));
  }

  async getPlanDays(planId: string): Promise<ReadingPlanDay[]> {
    await DatabaseService.init();
    const db = (DatabaseService as any).db;

    const result = await db.getAllAsync(
      "SELECT * FROM reading_plan_days WHERE planId = ? ORDER BY dayNumber",
      [planId],
    );

    return result.map((row: any) => ({
      id: row.id,
      planId: row.planId,
      dayNumber: row.dayNumber,
      date: row.date,
      readings: JSON.parse(row.readings),
      isCompleted: Boolean(row.isCompleted),
      completedDate: row.completedDate,
    }));
  }

  async markDayAsCompleted(dayId: string): Promise<void> {
    console.log(`📝 [markDayAsCompleted] Iniciando marcação do dia ${dayId}`);

    await DatabaseService.init();
    const db = (DatabaseService as any).db;

    console.log("🔍 [markDayAsCompleted] Buscando informações do dia...");

    // Pegar o planId e o dayNumber do dia
    const day = await db.getFirstAsync(
      "SELECT planId, dayNumber FROM reading_plan_days WHERE id = ?",
      [dayId],
    );

    console.log("📊 [markDayAsCompleted] Dia encontrado:", day);

    if (!day) {
      console.error(
        "❌ [markDayAsCompleted] Dia de leitura não encontrado para ID:",
        dayId,
      );
      throw new Error("Dia de leitura não encontrado");
    }

    console.log(
      "💾 [markDayAsCompleted] Marcando dia como concluído no banco...",
    );

    // Marcar o dia como concluído
    await db.runAsync(
      "UPDATE reading_plan_days SET isCompleted = 1, completedDate = ? WHERE id = ?",
      [new Date().toISOString(), dayId],
    );

    console.log(
      "📈 [markDayAsCompleted] Incrementando contador de dias completados...",
    );

    // Incrementar o contador de dias completados no plano
    await db.runAsync(
      "UPDATE reading_plans SET completedDays = completedDays + 1 WHERE id = ?",
      [day.planId],
    );

    console.log(
      `✅ [markDayAsCompleted] Dia ${dayId} (dia ${day.dayNumber}) marcado como concluído`,
    );

    // Tentar sincronizar com backend (se estiver autenticado)
    try {
      console.log(
        "🔄 [markDayAsCompleted] Verificando autenticação para sincronização...",
      );
      const authService = (await import("./AuthService")).default;
      const token = authService.getToken();

      if (token) {
        console.log(
          "☁️ [markDayAsCompleted] Sincronizando conclusão com backend...",
        );
        const response = await authService.completeDay(day.dayNumber);
        console.log("📥 [markDayAsCompleted] Resposta do backend:", response);

        if (response.success) {
          console.log(
            "✅ [markDayAsCompleted] Leitura sincronizada com backend",
          );
        } else {
          console.warn(
            "⚠️ [markDayAsCompleted] Falha ao sincronizar com backend:",
            response.message,
          );
        }
      } else {
        console.log(
          "ℹ️ [markDayAsCompleted] Usuário não autenticado - leitura mantida apenas localmente",
        );
      }
    } catch (backendError) {
      console.warn(
        "⚠️ [markDayAsCompleted] Erro ao sincronizar com backend (leitura mantida localmente):",
        backendError,
      );
    }
  }

  async deletePlan(planId: string): Promise<void> {
    console.log(
      `🗑️ [ReadingPlanService] Iniciando exclusão do plano: ${planId}`,
    );

    await DatabaseService.init();
    const db = (DatabaseService as any).db;

    // Primeiro, verificar se o plano existe
    const existingPlan = await db.getFirstAsync(
      "SELECT * FROM reading_plans WHERE id = ?",
      [planId],
    );
    console.log(`🗑️ [ReadingPlanService] Plano encontrado:`, existingPlan);

    // Verificar quantos dias existem
    const daysCount = await db.getFirstAsync(
      "SELECT COUNT(*) as count FROM reading_plan_days WHERE planId = ?",
      [planId],
    );
    console.log(`🗑️ [ReadingPlanService] Dias do plano:`, daysCount);

    // Excluir os dias do plano
    console.log(`🗑️ [ReadingPlanService] Excluindo dias do plano...`);
    await db.runAsync("DELETE FROM reading_plan_days WHERE planId = ?", [
      planId,
    ]);
    console.log(`✅ [ReadingPlanService] Dias excluídos`);

    // Excluir o plano
    console.log(`🗑️ [ReadingPlanService] Excluindo plano...`);
    await db.runAsync("DELETE FROM reading_plans WHERE id = ?", [planId]);
    console.log(`✅ [ReadingPlanService] Plano excluído com sucesso!`);
  }

  async getTodayReading(planId: string): Promise<ReadingPlanDay | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    await DatabaseService.init();
    const db = (DatabaseService as any).db;

    const result = (await db.getFirstAsync(
      "SELECT * FROM reading_plan_days WHERE planId = ? AND date LIKE ?",
      [planId, `${todayStr}%`],
    )) as any;

    if (!result) return null;

    return {
      id: result.id,
      planId: result.planId,
      dayNumber: result.dayNumber,
      date: result.date,
      readings: JSON.parse(result.readings),
      isCompleted: Boolean(result.isCompleted),
      completedDate: result.completedDate,
    };
  }

  private getDaysBetween(startDate: Date, endDate: Date): number {
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  private generateNewTestamentReadings(
    startDate: Date,
    totalDays: number,
  ): ReadingPlanDay[] {
    // New Testament books (40-66 in most Bible numberings)
    const newTestamentBooks = Array.from({ length: 27 }, (_, i) => i + 40);
    return this.distributeReadings(startDate, totalDays, newTestamentBooks);
  }

  private generatePsalmsProverbsReadings(
    startDate: Date,
    totalDays: number,
  ): ReadingPlanDay[] {
    // Psalms (19) and Proverbs (20) in most Bible numberings
    const books = [19, 20];
    return this.distributeReadings(startDate, totalDays, books);
  }

  private generateFullBibleReadings(
    startDate: Date,
    totalDays: number,
  ): ReadingPlanDay[] {
    // All 66 books of the Bible
    const allBooks = Array.from({ length: 66 }, (_, i) => i + 1);
    return this.distributeReadings(startDate, totalDays, allBooks);
  }

  private generateSequentialBibleReadings(
    startDate: Date,
    totalDays: number,
  ): ReadingPlanDay[] {
    // Leitura sequencial de Genesis a Apocalipse
    const allBooks = Array.from({ length: 66 }, (_, i) => i + 1);
    return this.distributeReadings(startDate, totalDays, allBooks);
  }

  private generateInterleavedBibleReadings(
    startDate: Date,
    totalDays: number,
  ): ReadingPlanDay[] {
    console.log("📚 Gerando leituras intercaladas - Início");
    console.log("  Total de dias:", totalDays);

    const readings: ReadingPlanDay[] = [];
    const bookChapters = this.getBookChapters();

    // Livros do Antigo Testamento (1-39)
    const oldTestamentBooks = Array.from({ length: 39 }, (_, i) => i + 1);
    // Livros do Novo Testamento (40-66)
    const newTestamentBooks = Array.from({ length: 27 }, (_, i) => i + 40);

    // Calcular total de capítulos
    const totalOTChapters = oldTestamentBooks.reduce(
      (sum, bookId) => sum + (bookChapters[bookId] || 1),
      0,
    );
    const totalNTChapters = newTestamentBooks.reduce(
      (sum, bookId) => sum + (bookChapters[bookId] || 1),
      0,
    );
    const totalChapters = totalOTChapters + totalNTChapters;

    console.log("  Total AT:", totalOTChapters, "capítulos");
    console.log("  Total NT:", totalNTChapters, "capítulos");
    console.log("  Total geral:", totalChapters, "capítulos");

    // Calcular distribuição balanceada
    const baseChaptersPerDay = Math.floor(totalChapters / totalDays);
    const extraChapterDays = totalChapters % totalDays;

    // Calcular base para cada testamento
    const baseOTPerDay = Math.floor(totalOTChapters / totalDays);
    const baseNTPerDay = Math.floor(totalNTChapters / totalDays);
    const extraOTDays = totalOTChapters % totalDays;
    const extraNTDays = totalNTChapters % totalDays;

    console.log("  Base capítulos/dia:", baseChaptersPerDay);
    console.log("  Dias com capítulo extra:", extraChapterDays);
    console.log("  Base AT/dia:", baseOTPerDay, "+ extras:", extraOTDays);
    console.log("  Base NT/dia:", baseNTPerDay, "+ extras:", extraNTDays);

    let currentDate = new Date(startDate);
    let otBookIndex = 0;
    let otChapter = 1;
    let ntBookIndex = 0;
    let ntChapter = 1;
    let otChaptersDistributed = 0;
    let ntChaptersDistributed = 0;

    for (let dayNumber = 1; dayNumber <= totalDays; dayNumber++) {
      const dayReadings: Reading[] = [];

      // Calcular quantos capítulos de cada testamento ler hoje
      // baseado na distribuição balanceada
      let otChaptersToday = baseOTPerDay + (dayNumber <= extraOTDays ? 1 : 0);
      let ntChaptersToday = baseNTPerDay + (dayNumber <= extraNTDays ? 1 : 0);

      // Se um testamento acabou, ajustar para garantir que continuamos lendo até o fim
      if (otBookIndex >= oldTestamentBooks.length) {
        // AT acabou, mas precisamos continuar distribuindo dias até totalDays
        otChaptersToday = 0;
        // Recalcular NT para usar os dias restantes
        const ntChaptersRemaining = totalNTChapters - ntChaptersDistributed;
        const daysRemaining = totalDays - dayNumber + 1;
        ntChaptersToday = Math.ceil(ntChaptersRemaining / daysRemaining);
      } else if (ntBookIndex >= newTestamentBooks.length) {
        // NT acabou, mas precisamos continuar distribuindo dias até totalDays
        ntChaptersToday = 0;
        // Recalcular AT para usar os dias restantes
        const otChaptersRemaining = totalOTChapters - otChaptersDistributed;
        const daysRemaining = totalDays - dayNumber + 1;
        otChaptersToday = Math.ceil(otChaptersRemaining / daysRemaining);
      }

      // Adicionar leituras do Antigo Testamento
      let otChaptersRead = 0;
      while (
        otChaptersRead < otChaptersToday &&
        otBookIndex < oldTestamentBooks.length
      ) {
        const bookId = oldTestamentBooks[otBookIndex];
        const maxChapters = bookChapters[bookId] || 1;

        const chaptersToRead = Math.min(
          otChaptersToday - otChaptersRead,
          maxChapters - otChapter + 1,
        );

        if (chaptersToRead > 0) {
          dayReadings.push({
            id: `${bookId}_${otChapter}_${otChapter + chaptersToRead - 1}`,
            bookId,
            startChapter: otChapter,
            endChapter: otChapter + chaptersToRead - 1,
            bookName: this.getBookName(bookId),
          });

          otChapter += chaptersToRead;
          otChaptersRead += chaptersToRead;
          otChaptersDistributed += chaptersToRead;

          if (otChapter > maxChapters) {
            otBookIndex++;
            otChapter = 1;
          }
        } else {
          break;
        }
      }

      // Adicionar leituras do Novo Testamento
      let ntChaptersRead = 0;
      while (
        ntChaptersRead < ntChaptersToday &&
        ntBookIndex < newTestamentBooks.length
      ) {
        const bookId = newTestamentBooks[ntBookIndex];
        const maxChapters = bookChapters[bookId] || 1;

        const chaptersToRead = Math.min(
          ntChaptersToday - ntChaptersRead,
          maxChapters - ntChapter + 1,
        );

        if (chaptersToRead > 0) {
          dayReadings.push({
            id: `${bookId}_${ntChapter}_${ntChapter + chaptersToRead - 1}`,
            bookId,
            startChapter: ntChapter,
            endChapter: ntChapter + chaptersToRead - 1,
            bookName: this.getBookName(bookId),
          });

          ntChapter += chaptersToRead;
          ntChaptersRead += chaptersToRead;
          ntChaptersDistributed += chaptersToRead;

          if (ntChapter > maxChapters) {
            ntBookIndex++;
            ntChapter = 1;
          }
        } else {
          break;
        }
      }

      readings.push({
        id: `day_${dayNumber}`,
        planId: "", // Will be set by caller
        dayNumber,
        date: currentDate.toISOString(),
        readings: dayReadings,
        isCompleted: false,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`📚 Leituras intercaladas geradas: ${readings.length} dias`);
    console.log(
      `  AT: ${otChaptersDistributed}/${totalOTChapters} capítulos distribuídos`,
    );
    console.log(
      `  NT: ${ntChaptersDistributed}/${totalNTChapters} capítulos distribuídos`,
    );
    console.log(
      `  Total: ${otChaptersDistributed + ntChaptersDistributed}/${totalChapters} capítulos`,
    );
    if (readings.length > 0) {
      const firstDayChapters = readings[0].readings.reduce(
        (sum, r) => sum + (r.endChapter - r.startChapter + 1),
        0,
      );
      const lastDayChapters = readings[readings.length - 1].readings.reduce(
        (sum, r) => sum + (r.endChapter - r.startChapter + 1),
        0,
      );
      console.log("  Primeiro dia:", firstDayChapters, "capítulos");
      console.log("  Último dia:", lastDayChapters, "capítulos");
    }

    return readings;
  }

  private generateCustomReadings(
    startDate: Date,
    totalDays: number,
    books: number[],
  ): ReadingPlanDay[] {
    return this.distributeReadings(startDate, totalDays, books);
  }

  private distributeReadings(
    startDate: Date,
    totalDays: number,
    books: number[],
  ): ReadingPlanDay[] {
    const readings: ReadingPlanDay[] = [];
    const bookChapters = this.getBookChapters();

    // Calculate total chapters to read
    const totalChapters = books.reduce(
      (sum, bookId) => sum + (bookChapters[bookId] || 1),
      0,
    );

    console.log(
      `📖 Distribuindo ${totalChapters} capítulos em ${totalDays} dias`,
    );

    // Calcular capítulos base por dia e quantos dias precisam de um capítulo extra
    const baseChaptersPerDay = Math.floor(totalChapters / totalDays);
    const extraChapterDays = totalChapters % totalDays;

    console.log(`  Base: ${baseChaptersPerDay} capítulos/dia`);
    console.log(`  Dias com capítulo extra: ${extraChapterDays}`);

    let currentDate = new Date(startDate);
    let currentBookIndex = 0;
    let currentChapter = 1;
    let dayNumber = 1;
    let chaptersDistributed = 0;

    while (dayNumber <= totalDays && currentBookIndex < books.length) {
      // Determinar quantos capítulos ler hoje
      // Os primeiros dias recebem um capítulo extra se necessário
      const chaptersForToday =
        dayNumber <= extraChapterDays
          ? baseChaptersPerDay + 1
          : baseChaptersPerDay;

      const dayReadings: Reading[] = [];
      let chaptersReadToday = 0;

      while (
        chaptersReadToday < chaptersForToday &&
        currentBookIndex < books.length
      ) {
        const bookId = books[currentBookIndex];
        const maxChapters = bookChapters[bookId] || 1;

        const chaptersToRead = Math.min(
          chaptersForToday - chaptersReadToday,
          maxChapters - currentChapter + 1,
        );

        dayReadings.push({
          id: `${bookId}_${currentChapter}_${currentChapter + chaptersToRead - 1}`,
          bookId,
          startChapter: currentChapter,
          endChapter: currentChapter + chaptersToRead - 1,
          bookName: this.getBookName(bookId),
        });

        currentChapter += chaptersToRead;
        chaptersReadToday += chaptersToRead;
        chaptersDistributed += chaptersToRead;

        if (currentChapter > maxChapters) {
          currentBookIndex++;
          currentChapter = 1;
        }
      }

      readings.push({
        id: `day_${dayNumber}`,
        planId: "", // Will be set by caller
        dayNumber,
        date: currentDate.toISOString(),
        readings: dayReadings,
        isCompleted: false,
      });

      currentDate.setDate(currentDate.getDate() + 1);
      dayNumber++;
    }

    console.log(
      `✅ Distribuídos ${chaptersDistributed} capítulos em ${readings.length} dias`,
    );
    console.log(
      `  Primeiro dia: ${readings[0]?.readings.reduce((sum, r) => sum + (r.endChapter - r.startChapter + 1), 0)} capítulos`,
    );
    console.log(
      `  Último dia: ${readings[readings.length - 1]?.readings.reduce((sum, r) => sum + (r.endChapter - r.startChapter + 1), 0)} capítulos`,
    );

    return readings;
  }

  private getBookChapters(): Record<number, number> {
    // Capítulos de todos os 66 livros da Bíblia
    return {
      // Antigo Testamento (1-39)
      1: 50, // Gênesis
      2: 40, // Êxodo
      3: 27, // Levítico
      4: 36, // Números
      5: 34, // Deuteronômio
      6: 24, // Josué
      7: 21, // Juízes
      8: 4, // Rute
      9: 31, // 1 Samuel
      10: 24, // 2 Samuel
      11: 22, // 1 Reis
      12: 25, // 2 Reis
      13: 29, // 1 Crônicas
      14: 36, // 2 Crônicas
      15: 10, // Esdras
      16: 13, // Neemias
      17: 10, // Ester
      18: 42, // Jó
      19: 150, // Salmos
      20: 31, // Provérbios
      21: 12, // Eclesiastes
      22: 8, // Cantares
      23: 66, // Isaías
      24: 52, // Jeremias
      25: 5, // Lamentações
      26: 48, // Ezequiel
      27: 12, // Daniel
      28: 14, // Oséias
      29: 3, // Joel
      30: 9, // Amós
      31: 1, // Obadias
      32: 4, // Jonas
      33: 7, // Miqueias
      34: 3, // Naum
      35: 3, // Habacuque
      36: 3, // Sofonias
      37: 2, // Ageu
      38: 14, // Zacarias
      39: 4, // Malaquias

      // Novo Testamento (40-66)
      40: 28, // Mateus
      41: 16, // Marcos
      42: 24, // Lucas
      43: 21, // João
      44: 28, // Atos
      45: 16, // Romanos
      46: 16, // 1 Coríntios
      47: 13, // 2 Coríntios
      48: 6, // Gálatas
      49: 6, // Efésios
      50: 4, // Filipenses
      51: 4, // Colossenses
      52: 5, // 1 Tessalonicenses
      53: 3, // 2 Tessalonicenses
      54: 6, // 1 Timóteo
      55: 4, // 2 Timóteo
      56: 3, // Tito
      57: 1, // Filemom
      58: 13, // Hebreus
      59: 5, // Tiago
      60: 5, // 1 Pedro
      61: 3, // 2 Pedro
      62: 5, // 1 João
      63: 1, // 2 João
      64: 1, // 3 João
      65: 1, // Judas
      66: 22, // Apocalipse
    };
  }

  private getBookName(bookId: number): string {
    const bookNames: Record<number, string> = {
      // Antigo Testamento
      1: "Gênesis",
      2: "Êxodo",
      3: "Levítico",
      4: "Números",
      5: "Deuteronômio",
      6: "Josué",
      7: "Juízes",
      8: "Rute",
      9: "1 Samuel",
      10: "2 Samuel",
      11: "1 Reis",
      12: "2 Reis",
      13: "1 Crônicas",
      14: "2 Crônicas",
      15: "Esdras",
      16: "Neemias",
      17: "Ester",
      18: "Jó",
      19: "Salmos",
      20: "Provérbios",
      21: "Eclesiastes",
      22: "Cantares",
      23: "Isaías",
      24: "Jeremias",
      25: "Lamentações",
      26: "Ezequiel",
      27: "Daniel",
      28: "Oséias",
      29: "Joel",
      30: "Amós",
      31: "Obadias",
      32: "Jonas",
      33: "Miqueias",
      34: "Naum",
      35: "Habacuque",
      36: "Sofonias",
      37: "Ageu",
      38: "Zacarias",
      39: "Malaquias",

      // Novo Testamento
      40: "Mateus",
      41: "Marcos",
      42: "Lucas",
      43: "João",
      44: "Atos",
      45: "Romanos",
      46: "1 Coríntios",
      47: "2 Coríntios",
      48: "Gálatas",
      49: "Efésios",
      50: "Filipenses",
      51: "Colossenses",
      52: "1 Tessalonicenses",
      53: "2 Tessalonicenses",
      54: "1 Timóteo",
      55: "2 Timóteo",
      56: "Tito",
      57: "Filemom",
      58: "Hebreus",
      59: "Tiago",
      60: "1 Pedro",
      61: "2 Pedro",
      62: "1 João",
      63: "2 João",
      64: "3 João",
      65: "Judas",
      66: "Apocalipse",
    };

    return bookNames[bookId] || `Livro ${bookId}`;
  }
}

export default new ReadingPlanService();
