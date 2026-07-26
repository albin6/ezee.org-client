import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Select, Input, message, Form } from 'antd';
import { foundationService } from '../api/foundation.service';
import { usePermissions } from '../../../shared/hooks/usePermissions';

interface EvaluationsModalProps {
  visible: boolean;
  student: any;
  onClose: () => void;
}

export const EvaluationsModal: React.FC<EvaluationsModalProps> = ({ visible, student, onClose }) => {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [form] = Form.useForm();
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission('foundation_evaluation:write');

  useEffect(() => {
    if (visible && student) {
      fetchEvaluations();
    }
  }, [visible, student]);

  const fetchEvaluations = async () => {
    setLoading(true);
    try {
      const data = await foundationService.getEvaluationsByStudent(student.id);
      setEvaluations(data);
    } catch (error) {
      message.error('Failed to load evaluations');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (dayNumber: number) => {
    try {
      const values = await form.validateFields();
      const existing = evaluations.find(e => e.dayNumber === dayNumber);
      
      if (existing) {
        await foundationService.updateEvaluation(existing.id, {
          status: values.status,
          remarks: values.remarks,
        });
      } else {
        await foundationService.submitEvaluation({
          studentId: student.id,
          coordinatorId: null, // Ideally picked from current user
          dayNumber,
          status: values.status,
          remarks: values.remarks,
        });
      }
      message.success('Evaluation saved');
      setEditingDay(null);
      fetchEvaluations();
    } catch (error: any) {
      if (error.errorFields) return; // Validation error
      message.error(error.response?.data?.message || 'Failed to save');
    }
  };

  // Generate 10 days
  const days = Array.from({ length: 10 }, (_, i) => i + 1).map(dayNumber => {
    const record = evaluations.find(e => e.dayNumber === dayNumber);
    return {
      dayNumber,
      status: record?.status || 'PENDING',
      remarks: record?.remarks || '',
      id: record?.id,
    };
  });

  const columns = [
    { title: 'Day', dataIndex: 'dayNumber', key: 'dayNumber', width: 60 },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (text: string, record: any) => {
        if (editingDay === record.dayNumber) {
          return (
            <Form.Item name="status" initialValue={text} noStyle rules={[{ required: true }]}>
              <Select size="small" style={{ width: 120 }}>
                <Select.Option value="PRESENT">Present</Select.Option>
                <Select.Option value="ABSENT">Absent</Select.Option>
                <Select.Option value="PENDING">Pending</Select.Option>
              </Select>
            </Form.Item>
          );
        }
        return text;
      }
    },
    { 
      title: 'Remarks', 
      dataIndex: 'remarks', 
      key: 'remarks',
      render: (text: string, record: any) => {
        if (editingDay === record.dayNumber) {
          return (
            <Form.Item name="remarks" initialValue={text} noStyle>
              <Input size="small" />
            </Form.Item>
          );
        }
        return text;
      }
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => {
        if (!canWrite) return null;
        if (editingDay === record.dayNumber) {
          return (
            <div>
              <Button type="link" size="small" onClick={() => handleSave(record.dayNumber)}>Save</Button>
              <Button type="text" size="small" onClick={() => setEditingDay(null)}>Cancel</Button>
            </div>
          );
        }
        return <Button type="link" size="small" onClick={() => {
          setEditingDay(record.dayNumber);
          form.setFieldsValue({ status: record.status, remarks: record.remarks });
        }}>Edit</Button>;
      }
    }
  ];

  return (
    <Modal
      title={`10-Day Evaluation: ${student?.name}`}
      open={visible}
      onCancel={() => {
        setEditingDay(null);
        onClose();
      }}
      footer={null}
      width={700}
    >
      <Form form={form} component={false}>
        <Table
          size="small"
          dataSource={days}
          columns={columns}
          rowKey="dayNumber"
          pagination={false}
          loading={loading}
        />
      </Form>
    </Modal>
  );
};
