import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Modal, Form, message, Tag, Space, Popconfirm, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { foundationService } from '../api/foundation.service';
import type { Batch } from '../api/foundation.service';
import { usePermissions } from '@/shared/hooks/usePermissions';

export const BatchesPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [form] = Form.useForm();

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const data = await foundationService.getBatches({ page, limit, search });
      setBatches(data.data);
      setTotal(data.total);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to fetch batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [page, limit, search]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleOpenModal = (batch?: Batch) => {
    if (batch) {
      setEditingBatch(batch);
      form.setFieldsValue({
        ...batch,
        startDate: batch.startDate ? dayjs(batch.startDate) : undefined
      });
    } else {
      setEditingBatch(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        startDate: values.startDate ? values.startDate.toISOString() : undefined
      };
      if (editingBatch) {
        await foundationService.updateBatch(editingBatch.id, payload);
        message.success('Batch updated');
      } else {
        await foundationService.createBatch(payload);
        message.success('Batch created');
      }
      setIsModalVisible(false);
      fetchBatches();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Action failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await foundationService.deleteBatch(id);
      message.success('Batch deleted');
      fetchBatches();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Delete failed');
    }
  };

  const handleBlock = async (id: string, block: boolean) => {
    try {
      await foundationService.blockBatch(id, block);
      message.success(`Batch ${block ? 'blocked' : 'unblocked'}`);
      fetchBatches();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Action failed');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Description', dataIndex: 'description', key: 'description' },
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
      render: (_: any, record: Batch) => (
        <Space>
          {hasPermission('batches:write') && (
            <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          )}
          {hasPermission('batches:block') && (
            <Popconfirm
              title={record.status === 'ACTIVE' ? 'Block Batch' : 'Unblock Batch'}
              onConfirm={() => handleBlock(record.id, record.status === 'ACTIVE')}
            >
              <Button type="text" danger={record.status === 'ACTIVE'} icon={record.status === 'ACTIVE' ? <StopOutlined /> : <CheckCircleOutlined />} />
            </Popconfirm>
          )}
          {hasPermission('batches:delete') && (
            <Popconfirm
              title="Are you sure you want to delete this batch?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <PageContainer>
      <PageHeader 
        title="Batches" 
        extra={
          hasPermission('batches:write') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
              Add Batch
            </Button>
          )
        } 
      />
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="mb-4 w-full sm:w-64 sm:max-w-md">
          <Input.Search placeholder="Search batches..." onSearch={handleSearch} allowClear />
        </div>

        <Table 
          scroll={{ x: 'max-content' }}
          columns={columns} 
          dataSource={batches} 
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
        title={editingBatch ? 'Edit Batch' : 'Add Batch'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="startDate" label="Start Date">
            <DatePicker className="w-full" />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setIsModalVisible(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit">Save</Button>
          </div>
        </Form>
      </Modal>
    </PageContainer>
  );
};
