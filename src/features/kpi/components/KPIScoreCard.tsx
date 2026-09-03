import React from 'react';
import { Card, Progress, Tag, Button, Tooltip } from 'antd';
import { SlidersOutlined, InfoCircleOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import type { Kpi } from '../api/types';
import { useKpiStore } from '../store/kpi.store';

interface KPIScoreCardProps {
  kpi: Kpi;
  onOpenCriteria?: (kpi: Kpi) => void;
}

export const KPIScoreCard: React.FC<KPIScoreCardProps> = ({ kpi, onOpenCriteria }) => {
  const openCriteriaDrawer = useKpiStore((state) => state.openCriteriaDrawer);

  const getStatusColor = (percent: number) => {
    if (percent >= 80) return '#52c41a';
    if (percent >= 60) return '#faad14';
    return '#f5222d';
  };

  const isExceeding = kpi.scorePercentage >= 80;
  const isLagging = kpi.scorePercentage < 60;

  const handleOpen = () => {
    if (onOpenCriteria) {
      onOpenCriteria(kpi);
    } else {
      openCriteriaDrawer(kpi);
    }
  };

  return (
    <Card
      hoverable
      className="border border-slate-200 rounded-xl shadow-xs transition-all duration-200 hover:shadow-md"
      styles={{ body: { padding: '20px' } }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tag color="geekblue" className="font-bold tracking-wider px-2 py-0.5">
              {kpi.kpiCode}
            </Tag>
            <Tag color={kpi.targetType === 'TEAM' ? 'purple' : 'cyan'}>
              {kpi.targetType}
            </Tag>
          </div>
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-slate-800 text-base line-clamp-1 m-0">
              {kpi.title}
            </h3>
            {kpi.description && (
              <Tooltip title={kpi.description}>
                <InfoCircleOutlined className="text-slate-400 hover:text-slate-600 text-xs" />
              </Tooltip>
            )}
          </div>
        </div>

        <div className="text-right">
          <Tag 
            icon={isExceeding ? <CheckCircleOutlined /> : isLagging ? <WarningOutlined /> : undefined}
            color={isExceeding ? 'success' : isLagging ? 'error' : 'warning'}
            className="font-medium"
          >
            {isExceeding ? 'Exceeding' : isLagging ? 'Needs Attention' : 'On Track'}
          </Tag>
        </div>
      </div>

      <div className="flex items-center justify-between my-4 px-2">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 font-medium">Target Goal</div>
          <div className="text-lg font-bold text-slate-800">
            {kpi.targetValue} {kpi.unit}
          </div>
          <div className="text-xs text-slate-500">
            Weightage: <span className="font-semibold text-slate-700">{kpi.weightage}%</span>
          </div>
        </div>

        <Progress
          type="circle"
          percent={kpi.scorePercentage}
          size={72}
          strokeColor={getStatusColor(kpi.scorePercentage)}
          format={(percent) => (
            <span className="font-bold text-sm" style={{ color: getStatusColor(percent || 0) }}>
              {percent}%
            </span>
          )}
        />
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>
          <span className="font-semibold text-slate-700">{kpi.criteria?.length || 0}</span> Criteria Factors
        </span>
        <Button
          type="link"
          size="small"
          icon={<SlidersOutlined />}
          onClick={handleOpen}
          className="p-0 font-medium text-indigo-600 hover:text-indigo-700"
        >
          View / Evaluate
        </Button>
      </div>
    </Card>
  );
};
