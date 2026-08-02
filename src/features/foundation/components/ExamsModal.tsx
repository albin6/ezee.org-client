import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Select, InputNumber, message, Form } from 'antd';
import { foundationService } from '../api/foundation.service';
import { usePermissions } from '../../../shared/hooks/usePermissions';

interface ExamsModalProps {
  visible: boolean;
  student: any;
  onClose: () => void;
}

export const ExamsModal: React.FC<ExamsModalProps> = ({ visible, student, onClose }) => {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingExamType, setEditingExamType] = useState<string | null>(null);
  const [form] = Form.useForm();
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission('foundation_exam:write');

  useEffect(() => {
    if (visible && student) {
      fetchExams();
    }
  }, [visible, student]);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const data = await foundationService.getExamsByStudent(student.id);
      setExams(data);
    } catch (error) {
      message.error('Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (examType: string) => {
    try {
      const values = await form.validateFields();
      const existing = exams.find(e => e.examType === examType);

      if (existing) {
        await foundationService.updateExam(existing.id, {
          score: values.score,
          maxScore: values.maxScore,
          status: values.status,
        });
      } else {
        await foundationService.recordExam({
          studentId: student.id,
          examType,
          score: values.score,
          maxScore: values.maxScore,
          status: values.status,
        });
      }
      message.success('Exam saved');
      setEditingExamType(null);
      fetchExams();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error.response?.data?.message || 'Failed to save');
    }
  };

  const examTypes = ['MOCK_TEST', 'FINAL_EXAM'].map(type => {
    const record = exams.find(e => e.examType === type);
    return {
      examType: type,
      score: record?.score || 0,
      maxScore: record?.maxScore || 100,
      status: record?.status || 'PENDING',
      id: record?.id,
      isFromThread: record?.isFromThread,
    };
  });

  const columns = [
    {
      title: 'Exam',
      dataIndex: 'examType',
      key: 'examType',
      render: (text: string) => text.replace('_', ' ')
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      render: (text: number, record: any) => {
        if (editingExamType === record.examType) {
          return (
            <Form.Item name="score" initialValue={text} noStyle rules={[{ required: true }]}>
              <InputNumber size="small" min={0} />
            </Form.Item>
          );
        }
        return text;
      }
    },
    {
      title: 'Max Score',
      dataIndex: 'maxScore',
      key: 'maxScore',
      render: (text: number, record: any) => {
        if (editingExamType === record.examType) {
          return (
            <Form.Item name="maxScore" initialValue={text} noStyle rules={[{ required: true }]}>
              <InputNumber size="small" min={1} />
            </Form.Item>
          );
        }
        return text;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (text: string, record: any) => {
        if (editingExamType === record.examType) {
          return (
            <Form.Item name="status" initialValue={text} noStyle rules={[{ required: true }]}>
              <Select size="small" style={{ width: 120 }}>
                <Select.Option value="PASSED">Passed</Select.Option>
                <Select.Option value="FAILED">Failed</Select.Option>
                <Select.Option value="PENDING">Pending</Select.Option>
              </Select>
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
        if (record.isFromThread) {
          return <span className="text-gray-400 text-xs italic">Managed via Threads</span>;
        }
        if (editingExamType === record.examType) {
          return (
            <div>
              <Button type="link" size="small" onClick={() => handleSave(record.examType)}>Save</Button>
              <Button type="text" size="small" onClick={() => setEditingExamType(null)}>Cancel</Button>
            </div>
          );
        }
        return <Button type="link" size="small" onClick={() => {
          setEditingExamType(record.examType);
          form.setFieldsValue({ score: record.score, maxScore: record.maxScore, status: record.status });
        }}>Edit</Button>;
      }
    }
  ];

  return (
    <Modal
      title={`Exams: ${student?.name}`}
      open={visible}
      onCancel={() => {
        setEditingExamType(null);
        onClose();
      }}
      footer={null}
      width={700}
    >
      <Form form={form} component={false}>
        <Table
          size="small"
          dataSource={examTypes}
          columns={columns}
          rowKey="examType"
          pagination={false}
          loading={loading}
        />
      </Form>
    </Modal>
  );
};
