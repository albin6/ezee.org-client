import React, { useState } from 'react';
import { Drawer, Button, Form, Input, InputNumber, Select, Tag, Divider, Empty, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckOutlined, SlidersOutlined } from '@ant-design/icons';
import { useKpiStore } from '../store/kpi.store';
import { CriteriaScalingVisualizer } from './CriteriaScalingVisualizer';
import { kpiService } from '../api/kpi.service';
import type { KpiCriteria } from '../api/types';
import { usePermissions } from '@/shared/hooks/usePermissions';

export const KPICriteriaDrawer: React.FC = () => {
  const { hasPermission } = usePermissions();
  const canEvaluate = hasPermission('kpi:evaluate') || hasPermission('kpi:manage_all');
  const canWrite = hasPermission('kpi:write') || hasPermission('kpi:manage_all');

  const selectedKpi = useKpiStore((state) => state.selectedKpiForCriteria);
  const isOpen = useKpiStore((state) => state.criteriaDrawerOpen);
  const closeDrawer = useKpiStore((state) => state.closeCriteriaDrawer);
  const evaluateCriteria = useKpiStore((state) => state.evaluateCriteria);

  const [scoringCriteriaId, setScoringCriteriaId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [evalForm] = Form.useForm();
  const [addForm] = Form.useForm();

  if (!selectedKpi) return null;

  const handleEvaluateSubmit = async (criteriaId: string) => {
    try {
      const values = await evalForm.validateFields();
      setSubmitting(true);
      await evaluateCriteria(criteriaId, {
        currentScore: values.currentScore,
        evidenceNotes: values.evidenceNotes,
        reason: values.reason,
      });
      message.success('Criteria evaluation score updated successfully');
      setScoringCriteriaId(null);
      evalForm.resetFields();
    } catch (err: any) {
      if (err.message) message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCriteria = async () => {
    try {
      const values = await addForm.validateFields();
      setSubmitting(true);
      await kpiService.createCriteria({
        kpiId: selectedKpi.id,
        name: values.name,
        description: values.description,
        weight: values.weight,
        scoringType: values.scoringType,
        minScore: values.scoringType === 'SCALE_1_TO_5' ? 1 : values.scoringType === 'SCALE_1_TO_10' ? 1 : values.minScore || 0,
        maxScore: values.scoringType === 'SCALE_1_TO_5' ? 5 : values.scoringType === 'SCALE_1_TO_10' ? 10 : values.maxScore || 100,
        currentScore: values.currentScore || 0,
      });
      message.success('Criteria factor added successfully');
      setShowAddForm(false);
      addForm.resetFields();
      // Reload current KPI
      const updated = await kpiService.getKpiById(selectedKpi.id);
      useKpiStore.setState({ selectedKpiForCriteria: updated });
    } catch (err: any) {
      if (err.message) message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCriteria = async (criteriaId: string) => {
    try {
      await kpiService.deleteCriteria(criteriaId);
      message.success('Criteria factor removed');
      const updated = await kpiService.getKpiById(selectedKpi.id);
      useKpiStore.setState({ selectedKpiForCriteria: updated });
    } catch (err: any) {
      if (err.message) message.error(err.message);
    }
  };

  return (
    <Drawer
      title={
        <div>
          <div className="flex items-center gap-2">
            <Tag color="geekblue">{selectedKpi.kpiCode}</Tag>
            <span className="font-semibold text-slate-800 text-base">{selectedKpi.title}</span>
          </div>
          <div className="text-xs text-slate-500 font-normal mt-1">
            Current KPI Score: <span className="font-bold text-slate-700">{selectedKpi.scorePercentage}%</span> (Weighted from criteria factors)
          </div>
        </div>
      }
      placement="right"
      width={600}
      onClose={closeDrawer}
      open={isOpen}
      extra={
        canWrite && !showAddForm && (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setShowAddForm(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Add Factor
          </Button>
        )
      }
    >
      {showAddForm && (
        <div className="bg-slate-50 p-4 border border-indigo-100 rounded-xl mb-6 shadow-xs">
          <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
            <SlidersOutlined className="text-indigo-600" /> Add New Criteria Factor
          </h4>
          <Form form={addForm} layout="vertical" initialValues={{ scoringType: 'SCALE_1_TO_5', weight: 1 }}>
            <Form.Item name="name" label="Factor Name" rules={[{ required: true, message: 'Please enter factor name' }]}>
              <Input placeholder="e.g., Code Review Turnaround SLA" />
            </Form.Item>
            <Form.Item name="description" label="Description / Measurement Standard">
              <Input.TextArea rows={2} placeholder="Clarify what this factor measures and standards" />
            </Form.Item>
            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="scoringType" label="Scoring Scale" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: '1 to 5 Scale (Likert)', value: 'SCALE_1_TO_5' },
                    { label: '1 to 10 Scale', value: 'SCALE_1_TO_10' },
                    { label: 'Direct Percentage (0-100%)', value: 'PERCENTAGE' },
                    { label: 'Custom Numeric Bounds', value: 'NUMERIC' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="weight" label="Weight (Multiplier)" rules={[{ required: true }]}>
                <InputNumber min={0.1} max={10} step={0.5} className="w-full" />
              </Form.Item>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="small" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button size="small" type="primary" loading={submitting} onClick={handleAddCriteria} className="bg-indigo-600">
                Save Factor
              </Button>
            </div>
          </Form>
          <Divider className="my-4" />
        </div>
      )}

      {(!selectedKpi.criteria || selectedKpi.criteria.length === 0) ? (
        <Empty
          description="No criteria factors defined for this KPI yet"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          className="my-12"
        >
          {canWrite && (
            <Button type="primary" size="small" onClick={() => setShowAddForm(true)} className="bg-indigo-600">
              Add First Criteria Factor
            </Button>
          )}
        </Empty>
      ) : (
        <div className="space-y-4">
          {selectedKpi.criteria.map((criteria: KpiCriteria, idx: number) => {
            const isEditingScore = scoringCriteriaId === criteria.id;

            return (
              <div 
                key={criteria.id} 
                className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                      <h4 className="font-semibold text-slate-800 text-sm m-0">{criteria.name}</h4>
                    </div>
                    {criteria.description && (
                      <p className="text-xs text-slate-500 mt-1 mb-0">{criteria.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {canEvaluate && !isEditingScore && (
                      <Button
                        size="small"
                        type="default"
                        onClick={() => {
                          setScoringCriteriaId(criteria.id);
                          evalForm.setFieldsValue({
                            currentScore: criteria.currentScore,
                            evidenceNotes: criteria.evidenceNotes,
                          });
                        }}
                      >
                        Evaluate
                      </Button>
                    )}
                    {canWrite && (
                      <Popconfirm
                        title="Delete factor"
                        description="Are you sure you want to remove this factor?"
                        onConfirm={() => handleDeleteCriteria(criteria.id)}
                      >
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    )}
                  </div>
                </div>

                <CriteriaScalingVisualizer
                  scoringType={criteria.scoringType}
                  minScore={criteria.minScore}
                  maxScore={criteria.maxScore}
                  currentScore={criteria.currentScore}
                  weight={criteria.weight}
                  normalizedPercentage={criteria.normalizedPercentage}
                />

                {criteria.evidenceNotes && (
                  <div className="mt-2 text-xs bg-slate-50 p-2 rounded border border-slate-100 text-slate-600">
                    <span className="font-semibold text-slate-700">Evidence / Notes:</span> {criteria.evidenceNotes}
                  </div>
                )}

                {isEditingScore && (
                  <div className="mt-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                    <Form form={evalForm} layout="vertical">
                      <Form.Item 
                        name="currentScore" 
                        label={`Evaluate Score (${criteria.minScore} to ${criteria.maxScore})`}
                        rules={[{ required: true, message: 'Please input score' }]}
                      >
                        <InputNumber 
                          min={criteria.minScore} 
                          max={criteria.maxScore} 
                          step={criteria.scoringType === 'SCALE_1_TO_5' ? 0.5 : 1}
                          className="w-full" 
                        />
                      </Form.Item>
                      <Form.Item name="evidenceNotes" label="Evidence / Performance Notes">
                        <Input.TextArea rows={2} placeholder="Observations, ticket counts, or audit evidence" />
                      </Form.Item>
                      <Form.Item name="reason" label="Reason for update">
                        <Input placeholder="Periodic evaluation, calibration review, etc." />
                      </Form.Item>
                      <div className="flex justify-end gap-2">
                        <Button size="small" onClick={() => setScoringCriteriaId(null)}>Cancel</Button>
                        <Button 
                          size="small" 
                          type="primary" 
                          icon={<CheckOutlined />}
                          loading={submitting} 
                          onClick={() => handleEvaluateSubmit(criteria.id)}
                          className="bg-indigo-600"
                        >
                          Save Score
                        </Button>
                      </div>
                    </Form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
};
