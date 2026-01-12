import api from './api';

interface IncorrectPlan {
  planId: number;
  userId: number;
  userName: string;
  userEmail: string;
  planName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  actualDays: number;
  chaptersPerDay: number;
  totalChapters: number;
  completedDays: number;
  completedChapters: number;
  progressPercentage: number;
  issue: string;
}

interface RecalculateResult {
  plan: {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    chaptersPerDay: number;
    completedChapters: number;
    remainingChapters: number;
  };
  changes: {
    deletedRecords: number;
    newRecords: number;
    keptCompletedRecords: number;
  };
}

class ReadingPlanService {
  async listIncorrectPlans(): Promise<{ total: number; plans: IncorrectPlan[] }> {
    const response = await api.get('/admin/reading-plans/incorrect');
    return response.data.data;
  }

  async recalculatePlan(planId: number): Promise<RecalculateResult> {
    const response = await api.post(`/admin/reading-plans/${planId}/recalculate`);
    return response.data.data;
  }
}

export default new ReadingPlanService();
