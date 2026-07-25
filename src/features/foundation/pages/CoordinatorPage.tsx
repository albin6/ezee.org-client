import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Modal, Form, message, Popconfirm, Space, Tabs, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { foundationService } from '../api/foundation.service';
import type { StudentCoordinator } from '../api/foundation.service';
import { usePermissions } from '@/shared/hooks/usePermissions';

export const CoordinatorPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [coordinators, setCoordinators] = useState<StudentCoordinator[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCoordinator, setEditingCoordinator] = useState<StudentCoordinator | null>(null);
  const [form] = Form.useForm();

  const [isImportVisible, setIsImportVisible] = useState(false);
  const [importForm] = Form.useForm();
  const [importLoading, setImportLoading] = useState(false);
  const [importMode, setImportMode] = useState('json');

  const fetchCoordinators = async () => {
    setLoading(true);
    try {
      const result = await foundationService.getCoordinators({ page, limit, search });
      setCoordinators(result.data);
      setTotal(result.total);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to fetch coordinators');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoordinators();
  }, [page, limit, search]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleOpenModal = (coordinator?: StudentCoordinator) => {
    if (coordinator) {
      setEditingCoordinator(coordinator);
      form.setFieldsValue(coordinator);
    } else {
      setEditingCoordinator(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingCoordinator) {
        await foundationService.updateCoordinator(editingCoordinator.id, values);
        message.success('Coordinator updated');
      } else {
        await foundationService.createCoordinator(values);
        message.success('Coordinator created');
      }
      setIsModalVisible(false);
      fetchCoordinators();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Action failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await foundationService.deleteCoordinator(id);
      message.success('Coordinator deleted');
      fetchCoordinators();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Delete failed');
    }
  };

  const handleBulkImport = async () => {
    try {
      const values = await importForm.validateFields();
      setImportLoading(true);
      
      let parsedData: any[] = [];
      
      if (importMode === 'json') {
        try {
          parsedData = JSON.parse(values.jsonData);
        } catch (e) {
          throw new Error('Invalid JSON format');
        }

        if (!Array.isArray(parsedData)) {
          throw new Error('Data must be an array of objects');
        }
      } else {
        const textData = values.textData || '';
        const lines = textData.split('\n').filter((l: string) => l.trim().length > 0);
        parsedData = lines.map((line: string) => {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 3) {
            throw new Error(`Invalid format on line: "${line}". Expected: Name BatchNumber StudentNumber`);
          }
          const studentNumber = parts.pop();
          const batchNumber = parts.pop();
          const name = parts.join(' ');
          return { name, batchNumber, studentNumber };
        });
      }

      await foundationService.createCoordinatorsBulk(parsedData);
      message.success(`Successfully imported ${parsedData.length} coordinators`);
      setIsImportVisible(false);
      importForm.resetFields();
      fetchCoordinators();
    } catch (error: any) {
      message.error(error.message || error.response?.data?.message || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Typography.Text copyable>{text}</Typography.Text>,
    },
    {
      title: 'Batch Number',
      dataIndex: 'batchNumber',
      key: 'batchNumber',
    },
    {
      title: 'Phone (Student No.)',
      dataIndex: 'studentNumber',
      key: 'studentNumber',
      render: (text: string) => <Typography.Text copyable>{text}</Typography.Text>,
    },
    {
      title: 'Password',
      dataIndex: 'password',
      key: 'password',
      render: (text: string) => text ? <Typography.Text copyable>{text}</Typography.Text> : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: StudentCoordinator) => (
        <Space size="middle">
          {hasPermission('foundation_coordinator:write') && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleOpenModal(record)}
            />
          )}
          {hasPermission('foundation_coordinator:write') && (
            <Popconfirm
              title="Delete this coordinator?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Student Coordinators"
        description="Track student progress and manage 10-day evaluations."
        extra={
          <Space>
            {hasPermission('foundation_coordinator:write') && (
              <Button icon={<UploadOutlined />} onClick={() => setIsImportVisible(true)}>
                Bulk Import
              </Button>
            )}
            {hasPermission('foundation_coordinator:write') && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
                Add Coordinator
              </Button>
            )}
          </Space>
        }
      />
      
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="mb-4">
          <Input.Search
            placeholder="Search by name, batch number, student number..."
            onSearch={handleSearch}
            allowClear
            className="max-w-md"
          />
        </div>

        <Table
          columns={columns}
          dataSource={coordinators}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            onChange: (p, s) => {
              setPage(p);
              setLimit(s);
            },
            showSizeChanger: true,
          }}
        />
      </div>

      <Modal
        title={editingCoordinator ? 'Edit Coordinator' : 'Add Coordinator'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter name' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="batchNumber"
            label="Batch Number"
            rules={[{ required: true, message: 'Please enter batch number' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="studentNumber"
            label="Student Number"
            rules={[{ required: true, message: 'Please enter student number' }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Bulk Import Coordinators"
        open={isImportVisible}
        onCancel={() => setIsImportVisible(false)}
        onOk={handleBulkImport}
        confirmLoading={importLoading}
        width={600}
        destroyOnClose
      >
        <Form form={importForm} layout="vertical">
          <Tabs activeKey={importMode} onChange={(key) => setImportMode(key)}>
            <Tabs.TabPane tab="JSON Array" key="json">
              <div className="mb-4 text-gray-600">
                Paste a JSON array of coordinators. Example:
                <pre className="bg-gray-100 p-2 mt-2 rounded text-sm">
  {`[
    {
      "name": "John Doe",
      "batchNumber": "B101",
      "studentNumber": "S1001"
    }
  ]`}
                </pre>
              </div>
              <Form.Item
                name="jsonData"
                rules={[{ required: importMode === 'json', message: 'Please enter JSON data' }]}
              >
                <Input.TextArea
                  rows={10}
                  placeholder="Paste JSON array here..."
                  className="font-mono"
                />
              </Form.Item>
            </Tabs.TabPane>
            
            <Tabs.TabPane tab="Text Data" key="text">
              <div className="mb-4 text-gray-600">
                Paste coordinator data below. Format: <code>name batchNumber studentNumber</code> (one per line).<br/>
                Example:<br/>
                <code>John Doe B101 S1001</code><br/>
                <code>Jane Smith B102 S1002</code>
              </div>
              <Form.Item
                name="textData"
                rules={[{ required: importMode === 'text', message: 'Please enter text data' }]}
              >
                <Input.TextArea
                  rows={10}
                  placeholder="John Doe B101 S1001&#10;Jane Smith B102 S1002"
                />
              </Form.Item>
            </Tabs.TabPane>
          </Tabs>
        </Form>
      </Modal>
    </PageContainer>
  );
};
