import React from 'react';
import { Card, Tag, Progress, Divider, Empty } from 'antd';
import { CheckCircleOutlined, AlertOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import type { KpiExecutiveReport } from '../api/types';

interface ExecutiveReportCardProps {
  report: KpiExecutiveReport | null;
}

export const ExecutiveReportCard: React.FC<ExecutiveReportCardProps> = ({ report }) => {
  if (!report) {
    return (
      <Card className="border border-slate-200 rounded-xl shadow-xs text-center py-8">
        <Empty
          description="No published executive report available for this cycle"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  const getStatusColor = (percent: number) => {
    if (percent >= 80) return '#52c41a';
    if (percent >= 60) return '#faad14';
    return '#f5222d';
  };

  return (
    <Card 
      className="border border-indigo-100 rounded-xl shadow-sm bg-gradient-to-b from-white to-slate-50/50"
      styles={{ body: { padding: '24px' } }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tag color="purple" icon={<SafetyCertificateOutlined />}>Curated Executive Brief</Tag>
            <Tag color="green">{report.status}</Tag>
            {report.cycle && <Tag>{report.cycle.name}</Tag>}
          </div>
          <h2 className="text-xl font-bold text-slate-800 m-0">{report.title}</h2>
          <p className="text-xs text-slate-500 mt-1 mb-0">
            Prepared by <span className="font-semibold text-slate-700">{report.preparedBy?.name || 'MEL Tower Team'}</span>
            {report.publishedAt && ` • Published ${new Date(report.publishedAt).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      {/* Strategic Executive Summary */}
      <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-4 mb-5 text-sm text-indigo-950 leading-relaxed">
        <div className="font-bold text-xs uppercase tracking-wider text-indigo-700 mb-1">
          Executive Summary
        </div>
        {report.executiveSummary}
      </div>

      {/* Highlights and Concerns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {report.keyHighlights && (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-4 text-xs text-emerald-950">
            <div className="font-bold uppercase tracking-wider text-emerald-700 mb-1 flex items-center gap-1">
              <CheckCircleOutlined /> Strategic Highlights
            </div>
            {report.keyHighlights}
          </div>
        )}

        {report.criticalConcerns && (
          <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-4 text-xs text-amber-950">
            <div className="font-bold uppercase tracking-wider text-amber-700 mb-1 flex items-center gap-1">
              <AlertOutlined /> Critical Focus Areas
            </div>
            {report.criticalConcerns}
          </div>
        )}
      </div>

      <Divider className="my-4" />

      {/* Curated KPI Items */}
      <div>
        <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-3">
          Curated Team Highlight KPIs ({report.items?.length || 0} Selected)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {report.items?.map((item) => (
            <div 
              key={item.id}
              className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs hover:border-indigo-200 transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs text-slate-600">{item.team?.name}</span>
                  <Tag color="blue" className="text-[10px] py-0 px-1">{item.kpi?.kpiCode}</Tag>
                </div>
                <span className="font-bold text-xs" style={{ color: getStatusColor(item.snapshotPercentage) }}>
                  {item.snapshotPercentage}%
                </span>
              </div>

              <div className="font-medium text-slate-800 text-sm mb-1.5 line-clamp-1">
                {item.kpi?.title}
              </div>

              <Progress 
                percent={item.snapshotPercentage}
                size="small"
                strokeColor={getStatusColor(item.snapshotPercentage)}
                showInfo={false}
              />

              {item.curatorNotes && (
                <div className="mt-2 text-xs bg-slate-50 p-1.5 rounded text-slate-600 italic border-l-2 border-indigo-400">
                  "{item.curatorNotes}"
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
