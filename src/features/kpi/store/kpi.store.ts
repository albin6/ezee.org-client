import { create } from 'zustand';
import { kpiService } from '../api/kpi.service';
import type { KpiCycle, Kpi, MelOverviewData, KpiExecutiveReport, EvaluateCriteriaPayload } from '../api/types';

interface KpiState {
  cycles: KpiCycle[];
  activeCycleId: string | null;
  melOverview: MelOverviewData | null;
  teamKpis: Kpi[];
  latestExecutiveReport: KpiExecutiveReport | null;
  loading: boolean;
  selectedKpiForCriteria: Kpi | null;
  criteriaDrawerOpen: boolean;

  fetchCycles: () => Promise<void>;
  setActiveCycleId: (cycleId: string) => void;
  fetchMelOverview: () => Promise<void>;
  fetchTeamKpis: (teamId: string) => Promise<void>;
  fetchLatestExecutiveReport: () => Promise<void>;
  openCriteriaDrawer: (kpi: Kpi) => void;
  closeCriteriaDrawer: () => void;
  evaluateCriteria: (criteriaId: string, payload: EvaluateCriteriaPayload) => Promise<void>;
}

export const useKpiStore = create<KpiState>((set, get) => ({
  cycles: [],
  activeCycleId: null,
  melOverview: null,
  teamKpis: [],
  latestExecutiveReport: null,
  loading: false,
  selectedKpiForCriteria: null,
  criteriaDrawerOpen: false,

  fetchCycles: async () => {
    try {
      set({ loading: true });
      const cycles = await kpiService.getCycles();
      const active = cycles.find(c => c.status === 'ACTIVE') || cycles[0];
      set({ cycles, activeCycleId: active ? active.id : null, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setActiveCycleId: (cycleId: string) => {
    set({ activeCycleId: cycleId });
    get().fetchMelOverview();
    get().fetchLatestExecutiveReport();
  },

  fetchMelOverview: async () => {
    try {
      set({ loading: true });
      const cycleId = get().activeCycleId;
      const data = await kpiService.getMelOverview(cycleId || undefined);
      set({ melOverview: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchTeamKpis: async (teamId: string) => {
    try {
      set({ loading: true });
      const cycleId = get().activeCycleId;
      const data = await kpiService.getKpis({ teamId, cycleId: cycleId || undefined });
      set({ teamKpis: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchLatestExecutiveReport: async () => {
    try {
      const cycleId = get().activeCycleId;
      const report = await kpiService.getLatestExecutiveReport(cycleId || undefined);
      set({ latestExecutiveReport: report });
    } catch {
      set({ latestExecutiveReport: null });
    }
  },

  openCriteriaDrawer: (kpi: Kpi) => {
    set({ selectedKpiForCriteria: kpi, criteriaDrawerOpen: true });
  },

  closeCriteriaDrawer: () => {
    set({ selectedKpiForCriteria: null, criteriaDrawerOpen: false });
  },

  evaluateCriteria: async (criteriaId: string, payload: EvaluateCriteriaPayload) => {
    await kpiService.evaluateCriteria(criteriaId, payload);
    const selectedKpi = get().selectedKpiForCriteria;
    if (selectedKpi) {
      const updatedKpi = await kpiService.getKpiById(selectedKpi.id);
      set({ selectedKpiForCriteria: updatedKpi });
      // Also refresh team KPIs if loaded
      if (selectedKpi.teamId) {
        get().fetchTeamKpis(selectedKpi.teamId);
      }
    }
  },
}));
