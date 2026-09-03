import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, message, Popconfirm, Select } from 'antd';
import { SendOutlined, FileTextOutlined, EyeOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { useKpiStore } from '../store/kpi.store';
import { kpiService } from '../api/kpi.service';
import type { KpiExecutiveReport } from '../api/types';
import { CurateKPIModal } from '../components/CurateKPIModal';
import { ExecutiveReportCard } from '../components/ExecutiveReportCard';
import type { ColumnsType } from 'antd/es/table';

export const ExecutiveReportCuratorPage: React.FC = () => {
  const { cycles, activeCycleId, setActiveCycleId, fetchCycles, melOverview, fetchMelOverview } = useKpiStore();

  const [reports, setReports] = useState<KpiExecutiveReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [curateModalVisible, setCurateModalVisible] = useState(false);
  const [previewReport, setPreviewReport] = useState<KpiExecutiveReport | null>(null);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await kpiService.getExecutiveReports(activeCycleId || undefined);
      setReports(data || []);
    } catch {
      message.error('Failed to load executive reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeCycleId) {
      fetchMelOverview();
      loadReports();
    }
  }, [activeCycleId, fetchMelOverview]);

  const handlePublish = async (reportId: string) => {
    try {
      await kpiService.publishReport(reportId);
      message.success('Report successfully published to Leadership (CEO/CMO)');
      loadReports();
    } catch (err: any) {
      if (err.message) message.error(err.message);
    }
  };

  const columns: ColumnsType<KpiExecutiveReport> = [
    {
      title: 'Report Title',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record) => (
        <div>
          <div className="font-semibold text-slate-800">{title}</div>
          <div className="text-xs text-slate-500">
            Prepared by {record.preparedBy?.name || 'MEL Team'} • {new Date(record.createdAt).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      title: 'Curated KPIs',
      key: 'curatedCount',
      render: (_, record) => (
        <Tag color="geekblue">{record.items?.length || 0} Highlight Items</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'PUBLISHED' ? 'green' : 'orange'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Published Date',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      render: (date?: string) => date ? new Date(date).toLocaleDateString() : <span className="text-slate-400">Not published</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setPreviewReport(record)}
          >
            Preview
          </Button>

          {record.status === 'DRAFT' && (
            <Popconfirm
              title="Publish to Executive Leadership"
              description="This will freeze KPI snapshot scores and deliver the brief to the CEO and CMO. Proceed?"
              onConfirm={() => handlePublish(record.id)}
            >
              <Button
                size="small"
                type="primary"
                icon={<SendOutlined />}
                className="bg-indigo-600"
              >
                Publish
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-indigo-600" />
            <span>Executive Report Curator</span>
            <Tag color="purple" icon={<SafetyCertificateOutlined />}>MEL Workstation</Tag>
          </div>
        }
        description="Author, curate, and publish strategic performance summaries for the CEO, CMO, and Executive Leadership"
        extra={
          <div className="flex items-center gap-3">
            <Select
              className="w-48"
              value={activeCycleId}
              onChange={setActiveCycleId}
              options={cycles.map(c => ({
                label: c.name,
                value: c.id,
              }))}
            />

            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => setCurateModalVisible(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Curate New Brief
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        <Card
          title={<span className="font-semibold text-slate-800 text-base">Executive Briefs History</span>}
          className="border border-slate-200 rounded-xl shadow-xs"
          styles={{ body: { padding: '0px' } }}
        >
          <Table
            dataSource={reports}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>

        {/* Live Preview Section if a report is selected */}
        {previewReport && (
          <div className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-800 m-0">Executive Brief Preview</h3>
              <Button size="small" onClick={() => setPreviewReport(null)}>Close Preview</Button>
            </div>
            <ExecutiveReportCard report={previewReport} />
          </div>
        )}
      </div>

      {activeCycleId && (
        <CurateKPIModal
          visible={curateModalVisible}
          onClose={() => setCurateModalVisible(false)}
          teams={melOverview?.teams || []}
          cycleId={activeCycleId}
          onSuccess={() => {
            loadReports();
          }}
        />
      )}
    </PageContainer>
  );
};
