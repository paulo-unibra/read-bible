import { Reading, ReadingPlan, ReadingPlanDay } from '../types';
import DatabaseService from './DatabaseService';

export class ReadingPlanService {
  
  async createMonthlyPlan(name: string, startDate: Date, type: 'new-testament' | 'psalms-proverbs'): Promise<ReadingPlan> {
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    
    const planId = `monthly_${Date.now()}`;
    const totalDays = this.getDaysBetween(startDate, endDate);
    
    const plan: ReadingPlan = {
      id: planId,
      name,
      type: 'monthly',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      isActive: true,
      createdDate: new Date().toISOString(),
      totalDays,
      completedDays: 0,
    };

    await this.savePlan(plan);
    
    // Generate daily readings
    const readings = type === 'new-testament' 
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
      type: 'yearly',
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

  async createCustomPlan(name: string, startDate: Date, endDate: Date, books: number[]): Promise<ReadingPlan> {
    const planId = `custom_${Date.now()}`;
    const totalDays = this.getDaysBetween(startDate, endDate);
    
    const plan: ReadingPlan = {
      id: planId,
      name,
      type: 'custom',
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
    await DatabaseService.init();
    const db = (DatabaseService as any).db;
    
    await db.runAsync(
      'INSERT INTO reading_plans (id, name, type, startDate, endDate, isActive, createdDate, totalDays, completedDays) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [plan.id, plan.name, plan.type, plan.startDate, plan.endDate, plan.isActive ? 1 : 0, plan.createdDate, plan.totalDays, plan.completedDays]
    );
  }

  private async savePlanDays(planId: string, readings: ReadingPlanDay[]): Promise<void> {
    await DatabaseService.init();
    const db = (DatabaseService as any).db;
    
    for (const reading of readings) {
      await db.runAsync(
        'INSERT INTO reading_plan_days (id, planId, dayNumber, date, readings, isCompleted, completedDate) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [reading.id, planId, reading.dayNumber, reading.date, JSON.stringify(reading.readings), reading.isCompleted ? 1 : 0, reading.completedDate || null]
      );
    }
  }

  async getActivePlans(): Promise<ReadingPlan[]> {
    await DatabaseService.init();
    const db = (DatabaseService as any).db;
    
    const result = await db.getAllAsync('SELECT * FROM reading_plans WHERE isActive = 1 ORDER BY createdDate DESC');
    
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
      'SELECT * FROM reading_plan_days WHERE planId = ? ORDER BY dayNumber',
      [planId]
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
    await DatabaseService.init();
    const db = (DatabaseService as any).db;
    
    await db.runAsync(
      'UPDATE reading_plan_days SET isCompleted = 1, completedDate = ? WHERE id = ?',
      [new Date().toISOString(), dayId]
    );
  }

  async getTodayReading(planId: string): Promise<ReadingPlanDay | null> {
    const today = new Date().toISOString().split('T')[0];
    
    await DatabaseService.init();
    const db = (DatabaseService as any).db;
    
    const result = await db.getFirstAsync(
      'SELECT * FROM reading_plan_days WHERE planId = ? AND date LIKE ?',
      [planId, `${today}%`]
    ) as any;
    
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

  private generateNewTestamentReadings(startDate: Date, totalDays: number): ReadingPlanDay[] {
    // New Testament books (40-66 in most Bible numberings)
    const newTestamentBooks = Array.from({ length: 27 }, (_, i) => i + 40);
    return this.distributeReadings(startDate, totalDays, newTestamentBooks);
  }

  private generatePsalmsProverbsReadings(startDate: Date, totalDays: number): ReadingPlanDay[] {
    // Psalms (19) and Proverbs (20) in most Bible numberings
    const books = [19, 20];
    return this.distributeReadings(startDate, totalDays, books);
  }

  private generateFullBibleReadings(startDate: Date, totalDays: number): ReadingPlanDay[] {
    // All 66 books of the Bible
    const allBooks = Array.from({ length: 66 }, (_, i) => i + 1);
    return this.distributeReadings(startDate, totalDays, allBooks);
  }

  private generateCustomReadings(startDate: Date, totalDays: number, books: number[]): ReadingPlanDay[] {
    return this.distributeReadings(startDate, totalDays, books);
  }

  private distributeReadings(startDate: Date, totalDays: number, books: number[]): ReadingPlanDay[] {
    const readings: ReadingPlanDay[] = [];
    const bookChapters = this.getBookChapters();
    
    // Calculate total chapters to read
    const totalChapters = books.reduce((sum, bookId) => sum + (bookChapters[bookId] || 1), 0);
    const chaptersPerDay = Math.ceil(totalChapters / totalDays);
    
    let currentDate = new Date(startDate);
    let currentBookIndex = 0;
    let currentChapter = 1;
    let dayNumber = 1;
    
    while (dayNumber <= totalDays && currentBookIndex < books.length) {
      const dayReadings: Reading[] = [];
      let chaptersForToday = 0;
      
      while (chaptersForToday < chaptersPerDay && currentBookIndex < books.length) {
        const bookId = books[currentBookIndex];
        const maxChapters = bookChapters[bookId] || 1;
        
        const chaptersToRead = Math.min(
          chaptersPerDay - chaptersForToday,
          maxChapters - currentChapter + 1
        );
        
        dayReadings.push({
          id: `${bookId}_${currentChapter}_${currentChapter + chaptersToRead - 1}`,
          bookId,
          startChapter: currentChapter,
          endChapter: currentChapter + chaptersToRead - 1,
          bookName: this.getBookName(bookId),
        });
        
        currentChapter += chaptersToRead;
        chaptersForToday += chaptersToRead;
        
        if (currentChapter > maxChapters) {
          currentBookIndex++;
          currentChapter = 1;
        }
      }
      
      readings.push({
        id: `day_${dayNumber}`,
        planId: '', // Will be set by caller
        dayNumber,
        date: currentDate.toISOString(),
        readings: dayReadings,
        isCompleted: false,
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
      dayNumber++;
    }
    
    return readings;
  }

  private getBookChapters(): Record<number, number> {
    // Simplified chapter counts for common Bible books
    return {
      1: 50, 2: 40, 3: 27, 4: 36, 5: 34, // Genesis to Deuteronomy
      19: 150, 20: 31, // Psalms, Proverbs
      40: 28, 41: 16, 42: 24, 43: 21, 44: 28, 45: 16, 46: 16, 47: 13, 48: 6, 49: 4, // Matthew to Galatians
      50: 6, 51: 4, 52: 5, 53: 4, 54: 6, 55: 4, 56: 4, 57: 1, 58: 1, 59: 3, // Ephesians to Philemon, Hebrews to Jude
      60: 5, 61: 4, 62: 5, 63: 3, 64: 1, 65: 1, 66: 22, // 1 Peter to Revelation
      // Add more as needed
    };
  }

  private getBookName(bookId: number): string {
    const bookNames: Record<number, string> = {
      1: 'Gênesis', 2: 'Êxodo', 3: 'Levítico', 4: 'Números', 5: 'Deuteronômio',
      19: 'Salmos', 20: 'Provérbios',
      40: 'Mateus', 41: 'Marcos', 42: 'Lucas', 43: 'João', 44: 'Atos',
      45: 'Romanos', 46: '1 Coríntios', 47: '2 Coríntios', 48: 'Gálatas',
      49: 'Efésios', 50: 'Filipenses', 51: 'Colossenses', 52: '1 Tessalonicenses',
      53: '2 Tessalonicenses', 54: '1 Timóteo', 55: '2 Timóteo', 56: 'Tito',
      57: 'Filemom', 58: 'Hebreus', 59: 'Tiago', 60: '1 Pedro', 61: '2 Pedro',
      62: '1 João', 63: '2 João', 64: '3 João', 65: 'Judas', 66: 'Apocalipse',
    };
    
    return bookNames[bookId] || `Livro ${bookId}`;
  }
}

export default new ReadingPlanService();