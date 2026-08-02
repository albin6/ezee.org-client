import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Modal, Form, message, Tag, Space, Dropdown, Select, Tabs } from 'antd';
import type { MenuProps } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined, UploadOutlined, MoreOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { foundationService } from '../api/foundation.service';
import type { Student, Batch } from '../api/foundation.service';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { EvaluationsModal } from '../components/EvaluationsModal';
import { ExamsModal } from '../components/ExamsModal';

export const StudentsPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>('ACTIVE');
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [form] = Form.useForm();

  const [isImportVisible, setIsImportVisible] = useState(false);
  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [importForm] = Form.useForm();
  const [importLoading, setImportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const [evaluationModalVisible, setEvaluationModalVisible] = useState(false);
  const [selectedStudentForEval] = useState<any>(null);

  const [examsModalVisible, setExamsModalVisible] = useState(false);
  const [selectedStudentForExams, setSelectedStudentForExams] = useState<any>(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = activeTab === 'buffered' 
        ? await foundationService.getBufferedStudents({ page, limit, search, batchId: batchFilter })
        : await foundationService.getStudents({ page, limit, search, batchId: batchFilter, status: statusFilter });
      setStudents(data.data);
      setTotal(data.total);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [page, limit, search, batchFilter, statusFilter, activeTab]);

  const fetchBatches = async () => {
    try {
      const data = await foundationService.getBatches({ limit: 1000, status: 'ACTIVE' });
      setBatches(data.data);
    } catch (error: any) {
      message.error('Failed to load batches');
    }
  };



  useEffect(() => {
    fetchBatches();
  }, []);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleOpenModal = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      form.setFieldsValue(student);
    } else {
      setEditingStudent(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingStudent) {
        await foundationService.updateStudent(editingStudent.id, values);
        message.success('Student updated');
      } else {
        await foundationService.createStudent(values);
        message.success('Student created');
      }
      setIsModalVisible(false);
      fetchStudents();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Action failed');
    }
  };
  const handleBlock = async (id: string, block: boolean) => {
    try {
      await foundationService.blockStudent(id, block);
      message.success(`Student ${block ? 'blocked' : 'unblocked'}`);
      fetchStudents();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await foundationService.updateStudentStatus(id, status);
      message.success(`Student status updated to ${status}`);
      fetchStudents();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await foundationService.deleteStudent(id);
      message.success('Student deleted');
      fetchStudents();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  const handleAssignBatch = async (values: { targetBatchId: string }) => {
    if (selectedStudentIds.length === 0) return;
    try {
      await foundationService.bulkAssignBatch(selectedStudentIds, values.targetBatchId);
      message.success('Buffered students assigned to batch successfully');
      setIsAssignModalVisible(false);
      setSelectedStudentIds([]);
      fetchStudents();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to assign students');
    }
  };

  const handleBulkImport = async (values: any) => {
    setImportLoading(true);
    try {
      const result = await foundationService.bulkImportStudents(values.data, values.batchId);
      message.success(`Imported ${result.successCount} students.`);
      if (result.errors && result.errors.length > 0) {
        Modal.warning({
          title: 'Import Partial Success',
          content: (
            <div className="max-h-64 overflow-auto">
              <p>The following errors occurred:</p>
              <ul>
                {result.errors.map((err: string, i: number) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          ),
          width: 600,
        });
      }
      setIsImportVisible(false);
      importForm.resetFields();
      fetchStudents();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    { 
      title: 'Batch', 
      key: 'batch',
      render: (_: any, record: Student) => batches.find(b => b.id === record.batchId)?.name || 'Unknown'
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'green' : (status === 'BUFFERED' ? 'orange' : (status === 'QUIT' ? 'purple' : 'red'))}>{status}</Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Student) => {
        const items: MenuProps['items'] = [
          {
            key: 'exams',
            label: 'View Exams',
            onClick: () => {
              setSelectedStudentForExams(record);
              setExamsModalVisible(true);
            }
          },
          ...(hasPermission('students:write') ? [{
            key: 'edit',
            label: 'Edit Student',
            onClick: () => handleOpenModal(record)
          }] : []),
          ...(hasPermission('students:write') && record.status === 'ACTIVE' ? [
            {
              key: 'transferred',
              label: 'Mark as Transferred',
              onClick: () => {
                Modal.confirm({
                  title: 'Mark as Transferred?',
                  icon: <ExclamationCircleOutlined />,
                  content: 'This will move the student to the Buffered list.',
                  onOk: () => handleStatusChange(record.id, 'BUFFERED')
                });
              }
            },
            {
              key: 'quit',
              label: 'Mark as Quit',
              onClick: () => {
                Modal.confirm({
                  title: 'Mark as Quit?',
                  icon: <ExclamationCircleOutlined />,
                  content: 'This will remove the student from future batches.',
                  onOk: () => handleStatusChange(record.id, 'QUIT')
                });
              }
            }
          ] : []),
          ...(hasPermission('students:block') ? [{
            key: 'block',
            label: record.status === 'BLOCKED' ? 'Unblock' : 'Block',
            danger: record.status !== 'BLOCKED',
            onClick: () => {
              Modal.confirm({
                title: `${record.status === 'BLOCKED' ? 'Unblock' : 'Block'} Student?`,
                icon: <ExclamationCircleOutlined />,
                onOk: () => handleBlock(record.id, record.status !== 'BLOCKED')
              });
            }
          }] : []),
          ...(hasPermission('students:delete') ? [{
            key: 'delete',
            label: 'Delete',
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: 'Delete Student?',
                icon: <ExclamationCircleOutlined />,
                content: 'This action cannot be undone.',
                okType: 'danger',
                onOk: () => handleDelete(record.id)
              });
            }
          }] : []),
        ];

        return (
          <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
            <Button icon={<MoreOutlined />} type="text" />
          </Dropdown>
        );
      }
    }
  ];

  return (
    <PageContainer>
      <PageHeader 
        title="Students" 
        extra={
          <Space>
            {hasPermission('students:import') && (
              <Button icon={<UploadOutlined />} onClick={() => setIsImportVisible(true)}>
                Bulk Import
              </Button>
            )}
            {hasPermission('students:write') && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
                Add Student
              </Button>
            )}
          </Space>
        } 
      />
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <Tabs activeKey={activeTab} onChange={(k: string) => { setActiveTab(k); setPage(1); }} items={[
          { key: 'all', label: 'All Students' },
          { key: 'buffered', label: 'Buffered Students' }
        ]} />
        <div className="mb-4 flex flex-col sm:flex-row gap-4 mt-2">
          <Input.Search placeholder="Search students..." onSearch={handleSearch} allowClear className="w-full sm:w-64" />
          <Select
            placeholder="Filter by Batch"
            allowClear
            onChange={(val) => { setBatchFilter(val); setPage(1); }}
            className="w-full sm:w-48"
            options={batches.map(b => ({ label: b.name, value: b.id }))}
          />
          {activeTab === 'all' && (
            <Select
              placeholder="Filter by Status"
              allowClear
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val); setPage(1); }}
              className="w-full sm:w-48"
              options={[
                { label: 'Active', value: 'ACTIVE' },
                { label: 'Blocked', value: 'BLOCKED' },
                { label: 'Transferred (Buffered)', value: 'BUFFERED' },
                { label: 'Quit', value: 'QUIT' }
              ]}
            />
          )}
          {activeTab === 'buffered' && (
            <Button 
              type="primary" 
              disabled={selectedStudentIds.length === 0}
              onClick={() => setIsAssignModalVisible(true)}
            >
              Assign to Batch ({selectedStudentIds.length})
            </Button>
          )}
        </div>

        <Table 
          scroll={{ x: 'max-content' }}
          rowSelection={activeTab === 'buffered' ? {
            selectedRowKeys: selectedStudentIds,
            onChange: (keys) => setSelectedStudentIds(keys as string[])
          } : undefined}
          columns={columns} 
          dataSource={students} 
          rowKey="id" 
          loading={loading}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            onChange: (p, s) => { setPage(p); setLimit(s); }
          }}
        />
      </div>

      <Modal
        title={editingStudent ? 'Edit Student' : 'Add Student'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="batchId" label="Batch" rules={[{ required: true }]}>
            <Select options={batches.map(b => ({ label: b.name, value: b.id }))} />
          </Form.Item>
          {editingStudent && (
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select options={[
                { label: 'Active', value: 'ACTIVE' },
                { label: 'Transferred (Buffered)', value: 'BUFFERED' },
                { label: 'Quit', value: 'QUIT' },
                { label: 'Blocked', value: 'BLOCKED' }
              ]} />
            </Form.Item>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setIsModalVisible(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit">Save</Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title="Bulk Import Students"
        open={isImportVisible}
        onCancel={() => setIsImportVisible(false)}
        footer={null}
      >
        <Form form={importForm} layout="vertical" onFinish={handleBulkImport}>
          <div className="mb-4 text-gray-600">
            Paste student data below. Format: <code>name email phone</code> (one per line).
          </div>
          <Form.Item name="batchId" label="Target Batch" rules={[{ required: true }]}>
            <Select options={batches.map(b => ({ label: b.name, value: b.id }))} />
          </Form.Item>
          <Form.Item name="data" label="Student Data" rules={[{ required: true }]}>
            <Input.TextArea rows={8} placeholder="John Doe john@example.com 1234567890&#10;Jane Smith jane@example.com 0987654321" />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setIsImportVisible(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={importLoading}>Import</Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title="Assign Buffered Students to Batch"
        open={isAssignModalVisible}
        onCancel={() => setIsAssignModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" onFinish={handleAssignBatch}>
          <div className="mb-4 text-gray-600">
            Select the upcoming batch to assign these {selectedStudentIds.length} buffered students to.
          </div>
          <Form.Item name="targetBatchId" label="Target Batch" rules={[{ required: true, message: 'Please select a batch' }]}>
            <Select options={batches.map(b => ({ label: b.name, value: b.id }))} />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setIsAssignModalVisible(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit">Assign</Button>
          </div>
        </Form>
      </Modal>

      <EvaluationsModal 
        visible={evaluationModalVisible}
        student={selectedStudentForEval}
        onClose={() => setEvaluationModalVisible(false)}
      />

      <ExamsModal 
        visible={examsModalVisible}
        student={selectedStudentForExams}
        onClose={() => setExamsModalVisible(false)}
      />
    </PageContainer>
  );
};
