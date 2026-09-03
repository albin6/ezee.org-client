import { apiClient } from '@/shared/api/axios';
import type {
  KpiCycle,
  Kpi,
  KpiCriteria,
  KpiExecutiveReport,
  MelOverviewData,
  CreateKpiPayload,
  CreateCriteriaPayload,
  EvaluateCriteriaPayload,
  CreateExecutiveReportPayload,
} from './types';

export const kpiService = {
  // Cycles
  getCycles: async (): Promise<KpiCycle[]> => {
    const response = await apiClient.get('/kpi/cycles');
    return response.data.data;
  },

  createCycle: async (data: { name: string; startDate: string; endDate: string }): Promise<KpiCycle> => {
    const response = await apiClient.post('/kpi/cycles', data);
    return response.data.data;
  },

  // KPIs
  getKpis: async (params?: { cycleId?: string; teamId?: string; userId?: string; targetType?: string }): Promise<Kpi[]> => {
    const response = await apiClient.get('/kpi', { params });
    return response.data.data;
  },

  getKpiById: async (id: string): Promise<Kpi> => {
    const response = await apiClient.get(`/kpi/${id}`);
    return response.data.data;
  },

  createKpi: async (data: CreateKpiPayload): Promise<Kpi> => {
    const response = await apiClient.post('/kpi', data);
    return response.data.data;
  },

  updateKpi: async (id: string, data: Partial<CreateKpiPayload>): Promise<Kpi> => {
    const response = await apiClient.patch(`/kpi/${id}`, data);
    return response.data.data;
  },

  deleteKpi: async (id: string): Promise<void> => {
    await apiClient.delete(`/kpi/${id}`);
  },

  // Criteria
  createCriteria: async (data: CreateCriteriaPayload): Promise<KpiCriteria> => {
    const response = await apiClient.post('/kpi/criteria', data);
    return response.data.data;
  },

  evaluateCriteria: async (criteriaId: string, data: EvaluateCriteriaPayload): Promise<KpiCriteria> => {
    const response = await apiClient.patch(`/kpi/criteria/${criteriaId}/score`, data);
    return response.data.data;
  },

  deleteCriteria: async (criteriaId: string): Promise<void> => {
    await apiClient.delete(`/kpi/criteria/${criteriaId}`);
  },

  // Analytics
  getMelOverview: async (cycleId?: string): Promise<MelOverviewData> => {
    const response = await apiClient.get('/kpi/analytics/mel-overview', { params: { cycleId } });
    return response.data.data;
  },

  getTeamAnalytics: async (teamId: string, cycleId?: string): Promise<any> => {
    const response = await apiClient.get(`/kpi/analytics/team/${teamId}`, { params: { cycleId } });
    return response.data.data;
  },

  // Executive Reports
  getExecutiveReports: async (cycleId?: string): Promise<KpiExecutiveReport[]> => {
    const response = await apiClient.get('/kpi/reports/executive', { params: { cycleId } });
    return response.data.data;
  },

  getLatestExecutiveReport: async (cycleId?: string): Promise<KpiExecutiveReport | null> => {
    const response = await apiClient.get('/kpi/reports/executive/latest', { params: { cycleId } });
    return response.data.data;
  },

  getReportById: async (id: string): Promise<KpiExecutiveReport> => {
    const response = await apiClient.get(`/kpi/reports/executive/${id}`);
    return response.data.data;
  },

  createReport: async (data: CreateExecutiveReportPayload): Promise<KpiExecutiveReport> => {
    const response = await apiClient.post('/kpi/reports/executive', data);
    return response.data.data;
  },

  publishReport: async (id: string): Promise<KpiExecutiveReport> => {
    const response = await apiClient.patch(`/kpi/reports/executive/${id}/publish`);
    return response.data.data;
  },
};
