import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Modal, Form, message, Tag, Space, Popconfirm, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined, UploadOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { foundationService } from '../api/foundation.service';
import type { Student, Batch } from '../api/foundation.service';
import { usePermissions } from '@/shared/hooks/usePermissions';

export const StudentsPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState<string | undefined>();
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [form] = Form.useForm();

  const [isImportVisible, setIsImportVisible] = useState(false);
  const [importForm] = Form.useForm();
  const [importLoading, setImportLoading] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = await foundationService.getStudents({ page, limit, search, batchId: batchFilter });
      setStudents(data.data);
      setTotal(data.total);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async () => {
    try {
      const data = await foundationService.getBatches({ limit: 1000, status: 'ACTIVE' });
      setBatches(data.data);
    } catch (error: any) {
      message.error('Failed to load batches');
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [page, limit, search, batchFilter]);

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

  const handleDelete = async (id: string) => {
    try {
      await foundationService.deleteStudent(id);
      message.success('Student deleted');
      fetchStudents();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Delete failed');
    }
  };

  const handleBlock = async (id: string, block: boolean) => {
    try {
      await foundationService.blockStudent(id, block);
      message.success(`Student ${block ? 'blocked' : 'unblocked'}`);
      fetchStudents();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Action failed');
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
        <Tag color={status === 'ACTIVE' ? 'green' : 'red'}>{status}</Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Student) => (
        <Space>
          {hasPermission('students:write') && (
            <Button icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          )}
          {hasPermission('students:block') && (
            <Popconfirm
              title={`Are you sure you want to ${record.status === 'ACTIVE' ? 'block' : 'unblock'} this student?`}
              onConfirm={() => handleBlock(record.id, record.status === 'ACTIVE')}
            >
              <Button icon={record.status === 'ACTIVE' ? <StopOutlined /> : <CheckCircleOutlined />} />
            </Popconfirm>
          )}
          {hasPermission('students:delete') && (
            <Popconfirm
              title="Are you sure you want to delete this student?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      )
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
        <div className="mb-4 flex flex-col sm:flex-row gap-4">
          <Input.Search placeholder="Search students..." onSearch={handleSearch} allowClear className="w-full sm:w-64" />
          <Select
            placeholder="Filter by Batch"
            allowClear
            onChange={(val) => { setBatchFilter(val); setPage(1); }}
            className="w-full sm:w-48"
            options={batches.map(b => ({ label: b.name, value: b.id }))}
          />
        </div>

        <Table 
          scroll={{ x: 'max-content' }}
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
    </PageContainer>
  );
};
