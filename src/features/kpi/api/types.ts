export type ScoringType = 'SCALE_1_TO_5' | 'SCALE_1_TO_10' | 'PERCENTAGE' | 'NUMERIC';

export interface KpiCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'UPCOMING' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface KpiCriteria {
  id: string;
  kpiId: string;
  name: string;
  description?: string | null;
  weight: number;
  scoringType: ScoringType;
  minScore: number;
  maxScore: number;
  currentScore: number;
  normalizedPercentage: number;
  evidenceNotes?: string | null;
  evaluatedById?: string | null;
  evaluatedBy?: { id: string; name: string } | null;
  evaluatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Kpi {
  id: string;
  cycleId: string;
  teamId: string;
  userId?: string | null;
  targetType: 'TEAM' | 'MEMBER';
  kpiCode: string;
  title: string;
  description?: string | null;
  weightage: number;
  targetValue: number;
  unit: string;
  score: number;
  scorePercentage: number;
  status: 'DRAFT' | 'ACTIVE' | 'UNDER_REVIEW' | 'APPROVED';
  createdById: string;
  team?: { id: string; name: string; type?: string };
  user?: { id: string; name: string; email: string; designation?: string } | null;
  criteria?: KpiCriteria[];
  createdAt: string;
  updatedAt: string;
}

export interface KpiExecutiveReportItem {
  id: string;
  reportId: string;
  kpiId: string;
  teamId: string;
  displayOrder: number;
  curatorNotes?: string | null;
  snapshotScore: number;
  snapshotPercentage: number;
  team?: { id: string; name: string; priorityOrder?: number };
  kpi?: { id: string; kpiCode: string; title: string; unit: string; targetValue: number };
}

export interface KpiExecutiveReport {
  id: string;
  title: string;
  cycleId: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  executiveSummary: string;
  keyHighlights?: string | null;
  criticalConcerns?: string | null;
  preparedById: string;
  preparedBy?: { id: string; name: string; email: string };
  publishedAt?: string | null;
  items?: KpiExecutiveReportItem[];
  cycle?: KpiCycle;
  createdAt: string;
  updatedAt: string;
}

export interface TeamKpiOverview {
  teamId: string;
  teamName: string;
  teamType: 'OPERATIONAL' | 'TOWER';
  priorityOrder: number;
  kpiCount: number;
  memberKpiCount: number;
  overallScore: number;
  status: 'EXCEEDING' | 'ON_TRACK' | 'LAGGING';
  kpis: Kpi[];
}

export interface MelOverviewData {
  cycle: KpiCycle | null;
  organizationScore: number;
  distribution: {
    exceeding: number;
    onTrack: number;
    lagging: number;
  };
  teams: TeamKpiOverview[];
  radarDimensions: Array<{
    subject: string;
    score: number;
    fullMark: number;
  }>;
}

export interface CreateKpiPayload {
  cycleId: string;
  teamId: string;
  userId?: string | null;
  targetType: 'TEAM' | 'MEMBER';
  kpiCode: string;
  title: string;
  description?: string | null;
  weightage: number;
  targetValue: number;
  unit: string;
}

export interface CreateCriteriaPayload {
  kpiId: string;
  name: string;
  description?: string | null;
  weight: number;
  scoringType: ScoringType;
  minScore: number;
  maxScore: number;
  currentScore?: number;
  evidenceNotes?: string | null;
}

export interface EvaluateCriteriaPayload {
  currentScore: number;
  evidenceNotes?: string | null;
  reason?: string;
}

export interface CreateExecutiveReportPayload {
  title: string;
  cycleId: string;
  executiveSummary: string;
  keyHighlights?: string | null;
  criticalConcerns?: string | null;
  curatedItems: Array<{
    kpiId: string;
    teamId: string;
    displayOrder: number;
    curatorNotes?: string | null;
    snapshotScore: number;
    snapshotPercentage: number;
  }>;
}
