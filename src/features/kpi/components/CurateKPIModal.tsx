import React, { useState } from 'react';
import { Modal, Form, Input, Button, Select, Tag, message, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import type { TeamKpiOverview, Kpi } from '../api/types';
import { kpiService } from '../api/kpi.service';

interface CurateKPIModalProps {
  visible: boolean;
  onClose: () => void;
  teams: TeamKpiOverview[];
  cycleId: string;
  onSuccess: () => void;
}

export const CurateKPIModal: React.FC<CurateKPIModalProps> = ({
  visible,
  onClose,
  teams,
  cycleId,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Helper to extract team KPIs
  const allKpisByTeam = teams.reduce<Record<string, Kpi[]>>((acc, t) => {
    acc[t.teamId] = t.kpis || [];
    return acc;
  }, {});

  const handleSubmit = async (publishImmediately = false) => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const curatedItems = values.items.map((item: any, index: number) => {
        const teamKpis = allKpisByTeam[item.teamId] || [];
        const selectedKpi = teamKpis.find(k => k.id === item.kpiId);

        return {
          teamId: item.teamId,
          kpiId: item.kpiId,
          displayOrder: index + 1,
          curatorNotes: item.curatorNotes,
          snapshotScore: selectedKpi ? selectedKpi.score : 0,
          snapshotPercentage: selectedKpi ? selectedKpi.scorePercentage : 0,
        };
      });

      const report = await kpiService.createReport({
        title: values.title,
        cycleId,
        executiveSummary: values.executiveSummary,
        keyHighlights: values.keyHighlights,
        criticalConcerns: values.criticalConcerns,
        curatedItems,
      });

      if (publishImmediately && report.id) {
        await kpiService.publishReport(report.id);
        message.success('Executive Report published to Leadership (CEO/CMO)');
      } else {
        message.success('Executive Report draft saved successfully');
      }

      form.resetFields();
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.message) message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Tag color="purple">MEL Governance</Tag>
          <span className="font-bold text-slate-800">Curate Executive Report for Leadership</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={720}
      footer={[
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Button 
          key="draft" 
          loading={submitting} 
          onClick={() => handleSubmit(false)}
        >
          Save as Draft
        </Button>,
        <Button 
          key="publish" 
          type="primary" 
          icon={<SendOutlined />} 
          loading={submitting} 
          onClick={() => handleSubmit(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          Publish to Leadership
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          title: `Executive Performance Brief - ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
          items: [{}],
        }}
      >
        <Form.Item
          name="title"
          label="Report Title"
          rules={[{ required: true, message: 'Please enter report title' }]}
        >
          <Input placeholder="e.g. Executive Performance Brief - Q3 2026" />
        </Form.Item>

        <Form.Item
          name="executiveSummary"
          label="Strategic Executive Summary"
          rules={[{ required: true, message: 'Executive summary is required for leadership' }]}
        >
          <Input.TextArea
            rows={3}
            placeholder="High-level narrative synthesis of overall organizational momentum, SLA health, and capacity..."
          />
        </Form.Item>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Form.Item name="keyHighlights" label="Key Highlights">
            <Input.TextArea rows={2} placeholder="Top wins, breakthrough metrics, or improved teams" />
          </Form.Item>
          <Form.Item name="criticalConcerns" label="Critical Concerns / Risks">
            <Input.TextArea rows={2} placeholder="SLA bottlenecks, quality dips, or underperforming teams" />
          </Form.Item>
        </div>

        <Divider className="my-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Select & Curate Team Highlight KPIs
          </span>
        </Divider>

        <Form.List name="items">
          {(fields, { add, remove }) => (
            <div className="space-y-3">
              {fields.map(({ key, name, ...restField }, idx) => (
                <div 
                  key={key} 
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg relative"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-600">Curated Item #{idx + 1}</span>
                    {fields.length > 1 && (
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Form.Item
                      {...restField}
                      name={[name, 'teamId']}
                      label="Select Team"
                      rules={[{ required: true, message: 'Select team' }]}
                      className="mb-2"
                    >
                      <Select
                        placeholder="Choose operational team"
                        options={teams.map(t => ({ label: t.teamName, value: t.teamId }))}
                      />
                    </Form.Item>

                    <Form.Item
                      noStyle
                      shouldUpdate={(prevValues, currentValues) =>
                        prevValues.items?.[name]?.teamId !== currentValues.items?.[name]?.teamId
                      }
                    >
                      {() => {
                        const selectedTeamId = form.getFieldValue(['items', name, 'teamId']);
                        const kpis = allKpisByTeam[selectedTeamId] || [];

                        return (
                          <Form.Item
                            {...restField}
                            name={[name, 'kpiId']}
                            label="Select Highlight KPI"
                            rules={[{ required: true, message: 'Select KPI' }]}
                            className="mb-2"
                          >
                            <Select
                              disabled={!selectedTeamId}
                              placeholder={selectedTeamId ? 'Pick key KPI' : 'Select team first'}
                              options={kpis.map(k => ({
                                label: `${k.kpiCode} - ${k.title} (${k.scorePercentage}%)`,
                                value: k.id,
                              }))}
                            />
                          </Form.Item>
                        );
                      }}
                    </Form.Item>
                  </div>

                  <Form.Item
                    {...restField}
                    name={[name, 'curatorNotes']}
                    label="Curator Commentary for Leadership"
                    className="mb-0"
                  >
                    <Input placeholder="Explain why this KPI is highlighted and its strategic context" />
                  </Form.Item>
                </div>
              ))}

              <Button
                type="dashed"
                onClick={() => add()}
                block
                icon={<PlusOutlined />}
                className="mt-2 text-indigo-600"
              >
                Add Another Highlight KPI
              </Button>
            </div>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
};
