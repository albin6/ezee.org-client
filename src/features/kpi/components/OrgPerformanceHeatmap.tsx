import React from 'react';
import { Card, Table, Tag, Progress, Button } from 'antd';
import { SafetyCertificateOutlined, EyeOutlined } from '@ant-design/icons';
import type { TeamKpiOverview } from '../api/types';
import type { ColumnsType } from 'antd/es/table';

interface OrgPerformanceHeatmapProps {
  teams: TeamKpiOverview[];
  onSelectTeam?: (teamId: string) => void;
}

export const OrgPerformanceHeatmap: React.FC<OrgPerformanceHeatmapProps> = ({ teams, onSelectTeam }) => {
  const getStatusColor = (percent: number) => {
    if (percent >= 80) return '#52c41a';
    if (percent >= 60) return '#faad14';
    return '#f5222d';
  };

  const columns: ColumnsType<TeamKpiOverview> = [
    {
      title: 'Priority',
      dataIndex: 'priorityOrder',
      key: 'priorityOrder',
      width: 80,
      render: (order: number) => <span className="font-semibold text-slate-400">#{order}</span>,
      sorter: (a, b) => a.priorityOrder - b.priorityOrder,
    },
    {
      title: 'Team Name',
      dataIndex: 'teamName',
      key: 'teamName',
      render: (name: string, record) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{name}</span>
          {record.teamType === 'TOWER' ? (
            <Tag color="purple" icon={<SafetyCertificateOutlined />}>Tower Level</Tag>
          ) : (
            <Tag color="blue">Operational</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Active KPIs',
      key: 'kpiCount',
      render: (_, record) => (
        <span className="text-slate-600 text-xs font-medium">
          {record.kpiCount} Team / {record.memberKpiCount} Member
        </span>
      ),
    },
    {
      title: 'Overall Score',
      dataIndex: 'overallScore',
      key: 'overallScore',
      sorter: (a, b) => a.overallScore - b.overallScore,
      render: (score: number) => (
        <div className="flex items-center gap-3 min-w-[140px]">
          <Progress
            percent={score}
            size="small"
            strokeColor={getStatusColor(score)}
            className="flex-1"
          />
          <span className="font-bold text-xs" style={{ color: getStatusColor(score) }}>
            {score}%
          </span>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        if (status === 'EXCEEDING') return <Tag color="success">Exceeding (≥80%)</Tag>;
        if (status === 'LAGGING') return <Tag color="error">Lagging (&lt;60%)</Tag>;
        return <Tag color="warning">On Track (60-79%)</Tag>;
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => onSelectTeam && onSelectTeam(record.teamId)}
          className="text-indigo-600 p-0"
        >
          View Team
        </Button>
      ),
    },
  ];

  return (
    <Card
      title={<span className="font-semibold text-slate-800 text-base">Cross-Team Performance Matrix</span>}
      className="border border-slate-200 rounded-xl shadow-xs"
      styles={{ body: { padding: '0px' } }}
    >
      <Table
        dataSource={teams}
        columns={columns}
        rowKey="teamId"
        pagination={false}
        className="overflow-x-auto"
      />
    </Card>
  );
};
