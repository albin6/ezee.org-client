import React from 'react';
import { Card, Progress, Tag } from 'antd';
import type { ScoringType } from '../api/types';

interface CriteriaScalingVisualizerProps {
  scoringType: ScoringType;
  minScore: number;
  maxScore: number;
  currentScore: number;
  weight: number;
  normalizedPercentage: number;
}

export const CriteriaScalingVisualizer: React.FC<CriteriaScalingVisualizerProps> = ({
  scoringType,
  minScore,
  maxScore,
  currentScore,
  weight,
  normalizedPercentage,
}) => {
  const getScaleLabel = () => {
    switch (scoringType) {
      case 'SCALE_1_TO_5': return '1 to 5 Likert Scale';
      case 'SCALE_1_TO_10': return '1 to 10 Scale';
      case 'PERCENTAGE': return 'Direct Percentage (0 - 100%)';
      default: return `Numeric (${minScore} - ${maxScore})`;
    }
  };

  const getStatusColor = (percent: number) => {
    if (percent >= 80) return '#52c41a';
    if (percent >= 60) return '#faad14';
    return '#f5222d';
  };

  const weightedPoints = ((weight * normalizedPercentage) / 100).toFixed(1);

  return (
    <Card 
      size="small" 
      className="bg-slate-50 border border-slate-200 rounded-lg my-2 shadow-xs"
      styles={{ body: { padding: '12px' } }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Tag color="blue" className="font-medium">{getScaleLabel()}</Tag>
          <Tag color="purple">Weight: {weight}x</Tag>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          Raw Score: <span className="text-slate-800 text-sm">{currentScore}</span> / {maxScore}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-600">
          <span>Scaled Factor Score:</span>
          <span className="font-bold" style={{ color: getStatusColor(normalizedPercentage) }}>
            {normalizedPercentage}%
          </span>
        </div>
        <Progress 
          percent={normalizedPercentage} 
          strokeColor={getStatusColor(normalizedPercentage)}
          size="small"
          showInfo={false}
        />
        <div className="flex justify-between text-[11px] text-slate-500 pt-1">
          <span>Formula: (({currentScore} - {minScore}) / ({maxScore} - {minScore})) × 100</span>
          <span className="font-medium text-slate-700">Contributes {weightedPoints} pts</span>
        </div>
      </div>
    </Card>
  );
};
