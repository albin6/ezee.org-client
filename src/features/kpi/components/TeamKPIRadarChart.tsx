import React from 'react';
import { Card } from 'antd';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';

interface RadarDataPoint {
  subject: string;
  score: number;
  fullMark: number;
}

interface TeamKPIRadarChartProps {
  data: RadarDataPoint[];
  title?: string;
}

export const TeamKPIRadarChart: React.FC<TeamKPIRadarChartProps> = ({ 
  data, 
  title = 'Organizational Competency Radar' 
}) => {
  return (
    <Card 
      title={<span className="font-semibold text-slate-800 text-base">{title}</span>}
      className="border border-slate-200 rounded-xl shadow-xs"
      styles={{ body: { padding: '16px 8px' } }}
    >
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }} 
            />
            <PolarRadiusAxis 
              angle={30} 
              domain={[0, 100]} 
              tick={{ fill: '#94a3b8', fontSize: 10 }} 
            />
            <Radar
              name="Score %"
              dataKey="score"
              stroke="#6366f1"
              fill="#818cf8"
              fillOpacity={0.4}
            />
            <Tooltip 
              formatter={(value: any) => [`${value}%`, 'Score']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
