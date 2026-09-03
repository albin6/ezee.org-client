# KPI Module: Frontend Architecture & UI/UX Specification

## 1. Overview & UI/UX Philosophy

The **KPI Module Frontend** delivers tailored user experiences across three distinct organizational tiers:
1. **Executive Tier (CEO, CMO, COO)**: Clean, high-signal, noise-free strategic cockpit. Focuses on curated executive reports, macro health gauges, and cross-team trends without burying leadership in granular operational details.
2. **Tower Oversight Tier (MEL Team - Monitoring, Evaluation & Learning)**: Deep, multi-dimensional analytics hub. Rich visualizations (Recharts Radar, Org Heatmaps, Distribution curves), full drill-downs into any team or individual member, and an **Executive Report Curator** to author and publish reports for leadership.
3. **Operational Delivery Tier (Team Leads & Staff)**: Team scorecards, criteria factor managers, real-time scaling visualizers, and personal member progress tracking.

---

## 2. Directory Layout (`src/features/kpi/`)

Following the platform's **Feature-Sliced Architecture**, all KPI frontend assets are encapsulated in `src/features/kpi/`:

```text
src/features/kpi/
├── api/
│   ├── kpi.service.ts                 # Axios HTTP client methods for all /api/v1/kpi endpoints
│   └── types.ts                       # Strongly-typed TypeScript interfaces (KPI, Criteria, Report, Cycle)
├── components/
│   ├── KPIScoreCard.tsx               # Metric card with animated progress ring, target vs actual
│   ├── KPICriteriaDrawer.tsx          # Drawer for inspecting and scoring granular criteria factors
│   ├── CriteriaScalingVisualizer.tsx  # Dynamic widget visualizing: Raw Score -> Normalized % -> Parent KPI %
│   ├── ExecutiveReportCard.tsx        # High-level card displaying curated executive reports for CEO/CMO
│   ├── TeamKPIRadarChart.tsx          # Recharts Radar diagram comparing team performance across KPI dimensions
│   ├── OrgPerformanceHeatmap.tsx      # Color-coded grid: Teams (rows) vs. KPI Categories (columns)
│   ├── CurateKPIModal.tsx             # Modal allowing MEL analysts to select KPIs for CEO/CMO reports
│   └── CycleSelector.tsx              # Dropdown selector for active, upcoming, or past evaluation periods
├── pages/
│   ├── ExecutiveDashboardPage.tsx     # Route: /kpi/executive (CEO & CMO strategic overview)
│   ├── MELAnalyticsDashboardPage.tsx  # Route: /kpi/mel (MEL Tower team visual analytics center)
│   ├── TeamKPIPage.tsx                # Route: /kpi/teams/:teamId? (Operational Team & Member scorecards)
│   └── ExecutiveReportCuratorPage.tsx # Route: /kpi/curator (MEL curation and publishing workstation)
└── store/
    └── kpi.store.ts                   # Zustand store (active cycle, selected team, cached reports, live sync)
```

---

## 3. Persona-Specific UX Journeys

### 3.1. Executive Journey (CEO, CMO, COO)
- **Route**: `/kpi/executive`
- **Guarded by**: `kpi:read_executive_report`
- **Experience**:
  1. **Top Bar**: Displays the active evaluation cycle (e.g. *Q3 2026*) with quick cycle switching.
  2. **Macro Health Index**: Top 3 stat cards:
     - **Organization Health Score**: Aggregated weighted average across all operational teams.
     - **High-Risk Operational Areas**: Count of teams or critical KPIs scoring below threshold (<60%).
     - **Latest Published Brief**: Date and title of the latest curated MEL report.
  3. **Curated Executive Reports**: Prominent view of the latest report published by the MEL Tower team. Displays:
     - Strategic Executive Summary by MEL.
     - Key Strategic Highlights and Critical Risks.
     - Curated KPI items grid: Only the 2–3 selected KPIs per team with specific curator commentary for the executive team.
  4. **Team Performance Comparison**: High-level bar chart showing each operational team's overall score sorted by `priorityOrder`.

### 3.2. Tower-Level Governance Journey (MEL Team)
- **Routes**: `/kpi/mel` (Analytics Hub) & `/kpi/curator` (Report Workstation)
- **Guarded by**: `kpi:read_all` and `kpi:curate_report`
- **Experience**:
  1. **Team Filter & Matrix View**: Switch between "All Teams" and specific operational units.
  2. **Multi-Dimensional Radar Chart**: Recharts `RadarChart` mapping core organizational competencies (Quality, Velocity, SLA Adherence, Customer Satisfaction, Innovation).
  3. **Performance Heatmap**: Matrix grid where each cell represents a team's KPI status (Green: $\ge 80\%$, Yellow: $60-79\%$, Red: $< 60\%$).
  4. **Drill-Down Drawer**: Clicking any KPI opens the **KPICriteriaDrawer** revealing:
     - The underlying criteria factors.
     - The scoring models (`SCALE_1_TO_5`, `PERCENTAGE`, etc.).
     - Evaluator notes, timestamps, and score modification audit logs.
  5. **Report Curator Workflow** (`/kpi/curator`):
     - MEL analyst creates a new report draft.
     - Browses all teams (e.g. Team Alpha has 10 KPIs).
     - Selects only the 2 most critical KPIs (e.g., "SLA Breach Rate" and "CSAT").
     - Adds custom executive notes ("SLA improved by 12% following new shift rotations").
     - Writes Executive Summary, Key Highlights, and Critical Concerns.
     - Clicks **Publish to Leadership** $\to$ triggers confirmation $\to$ publishes to CEO/CMO portal.

### 3.3. Operational Team Lead & Member Journey
- **Route**: `/kpi/teams/:teamId?`
- **Guarded by**: `kpi:read`
- **Experience**:
  1. **Tabs**: "Team KPIs" vs. "Member Scorecards".
  2. **Team KPI Tab**: List of team-level KPIs with progress bars, targets, and current percentage.
  3. **Criteria Evaluation**: Team Leads with `kpi:evaluate` can click "Evaluate Criteria", input raw scores, attach evidence URLs, and see the parent percentage recompute in real time using the **CriteriaScalingVisualizer**.
  4. **Member Scorecards Tab**: View each individual team member's assigned KPIs and personal factor progress.

---

## 4. Key UI Components & Visualizations

### 4.1. `CriteriaScalingVisualizer.tsx`
An interactive component embedded in the criteria drawer that demonstrates the mathematical scaling:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Criteria Factor: First-Call Resolution Rate                            │
│ Scoring Type: SCALE_1_TO_5  (Min: 1, Max: 5)                           │
│ Factor Weight: 2.0                                                     │
├────────────────────────────────────────────────────────────────────────┤
│ Raw Score Input: [  4.0  ] ★ ★ ★ ★ ☆                                    │
│                                                                        │
│ Step 1: Normalized % = (4 - 1) / (5 - 1) * 100 = 75.0%                 │
│ Step 2: Weighted Contribution = 2.0 * 75.0% = 150.0 pts                │
│                                                                        │
│ [==================== 75% ====================]                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2. `KPIScoreCard.tsx`
Ant Design Card displaying:
- KPI Short Code Tag (e.g., `<Tag color="purple">SLA_RATE</Tag>`)
- Detailed Title and Description tooltip
- Dynamic Ant Design `<Progress type="circle">` colored according to score:
  - $\ge 80\%$: Green (`#52c41a`)
  - $60\% - 79\%$: Yellow / Orange (`#faad14`)
  - $< 60\%$: Red (`#f5222d`)
- Target Goal vs. Actual Value and Unit (e.g. `Target: 95% | Actual: 88.4%`)
- "Curated for Leadership" badge if included in active executive brief.

### 4.3. `TeamKPIRadarChart.tsx` (Recharts)
Visualizes team competencies across 5 standard axes:
- SLA Compliance
- Quality & Defect Rate
- Team Velocity & Throughput
- Stakeholder Satisfaction (CSAT/NPS)
- Innovation & Process Improvement

---

## 5. Team Management UI Enhancements

To support the Tower-level concept in the existing Team Management module (`src/features/teams/`):

### 5.1. `TeamsPage.tsx`
- Add a visual badge in the teams table:
  - Tower teams display a distinct purple `<Tag color="purple"><SafetyCertificateOutlined /> Tower Level</Tag>`.
  - Operational teams display `<Tag color="blue">Operational</Tag>`.
- Add a column or sort filter by **Priority Order**.

### 5.2. `CreateTeamModal` & `TeamDetailsPage`
- Add form fields:
  - **Team Type**: Radio or Select between `Operational Delivery Team` and `Tower Level Team (Governance / Oversight)`.
  - **Priority Order**: Numerical input (default: 0) to control dashboard display ordering.

---

## 6. State Management (`src/features/kpi/store/kpi.store.ts`)

Zustand store managing global KPI state:

```typescript
interface KpiState {
  cycles: KpiCycle[];
  activeCycleId: string | null;
  selectedTeamId: string | null;
  
  // Data caches
  teamKpis: Record<string, Kpi[]>; // teamId -> KPIs
  memberKpis: Record<string, Kpi[]>; // userId -> KPIs
  executiveReports: KpiExecutiveReport[];
  melOverviewMetrics: MelOverviewResponse | null;
  
  // UI states
  loading: boolean;
  criteriaDrawerOpen: boolean;
  selectedKpiForCriteria: Kpi | null;
  curateModalOpen: boolean;
  
  // Actions
  fetchCycles: () => Promise<void>;
  setActiveCycle: (cycleId: string) => void;
  fetchTeamKpis: (teamId: string, cycleId?: string) => Promise<void>;
  fetchMemberKpis: (userId: string, cycleId?: string) => Promise<void>;
  fetchMelOverview: (cycleId?: string) => Promise<void>;
  fetchExecutiveReports: (cycleId?: string) => Promise<void>;
  updateCriteriaScore: (criteriaId: string, score: number, notes?: string) => Promise<void>;
  publishExecutiveReport: (reportId: string) => Promise<void>;
}
```

---

## 7. Routing & Navigation Integration

### 7.1. React Router (`src/app/router/index.tsx`)
```typescript
{
  path: '/kpi/executive',
  element: <ExecutiveDashboardPage />, // Guard: kpi:read_executive_report
},
{
  path: '/kpi/mel',
  element: <MELAnalyticsDashboardPage />, // Guard: kpi:read_all
},
{
  path: '/kpi/teams/:teamId?',
  element: <TeamKPIPage />, // Guard: kpi:read
},
{
  path: '/kpi/curator',
  element: <ExecutiveReportCuratorPage />, // Guard: kpi:curate_report
}
```

### 7.2. Navigation Shell (`src/app/layouts/AdminLayout.tsx`)
Menu items conditionally rendered based on permissions:
1. If `hasPermission('kpi:read_executive_report')` (CEO, CMO, COO, Super Admin):
   - Icon: `<DashboardOutlined />`
   - Label: `Executive KPI Portal`
   - Target: `/kpi/executive`
2. If `hasPermission('kpi:read_all')` (MEL Tower Team):
   - Icon: `<RadarChartOutlined />`
   - Label: `MEL KPI Analytics`
   - Target: `/kpi/mel`
   - Submenu: `Executive Report Curator` (`/kpi/curator`)
3. If `hasPermission('kpi:read')` (Operational Staff & Leads):
   - Icon: `<AimOutlined />`
   - Label: `Team KPIs`
   - Target: `/kpi/teams`
