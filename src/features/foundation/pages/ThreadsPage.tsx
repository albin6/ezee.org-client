import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Modal, Form, message, Space, Tag, List, Select, Popconfirm, Card, Grid } from 'antd';
import { PlusOutlined, MessageOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { foundationService } from '../api/foundation.service';
import type { Thread } from '../api/foundation.service';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { useNavigate } from 'react-router-dom';

export const ThreadsPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const navigate = useNavigate();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter] = useState<string | undefined>(undefined);

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [batches, setBatches] = useState<any[]>([]);

  const fetchThreads = async () => {
    setLoading(true);
    try {
      const result = await foundationService.getThreads({ page, limit, status: statusFilter });
      setThreads(result.data);
      setTotal(result.total);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to fetch threads');
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async () => {
    try {
      const batchesRes = await foundationService.getBatches({ page: 1, limit: 100 });
      setBatches(batchesRes.data || []);
    } catch(e) {
      console.error('Failed to fetch batches');
    }
  };

  useEffect(() => {
    fetchThreads();
    fetchBatches();
  }, [page, limit, statusFilter]);

  const handleCreateSubmit = async (values: any) => {
    try {
      await foundationService.createThread(values);
      message.success('Thread created');
      setIsCreateModalVisible(false);
      createForm.resetFields();
      fetchThreads();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Create failed');
    }
  };

  const openThreadDetails = (thread: Thread) => { navigate(`/foundation/threads/${thread.id}`); };

  const handleUpdateStatus = async (threadId: string, newStatus: 'OPEN' | 'RESOLVED' | 'CLOSED') => {
    try {
      await foundationService.updateThreadStatus(threadId, newStatus);
      message.success(`Thread status updated to ${newStatus}`);
      fetchThreads();
    } catch (error: any) {
      message.error('Failed to update status');
    }
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Exam Type',
      dataIndex: 'examType',
      key: 'examType',
      render: (type: string) => <Tag color="purple">{type}</Tag>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'OPEN' ? 'green' : status === 'RESOLVED' ? 'blue' : 'default';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: 'Author',
      dataIndex: 'author',
      key: 'author',
      render: (author: any) => author?.name || 'Unknown',
    },
    {
      title: 'Messages',
      dataIndex: 'messageCount',
      key: 'messageCount',
      render: (count: number) => count || 0,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Thread) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<MessageOutlined />}
            onClick={() => openThreadDetails(record)}
          >
            View Thread
          </Button>
          {hasPermission('foundation_threads:write') && record.status === 'OPEN' && (
            <Popconfirm
              title="Resolve Thread"
              description="Are you sure you want to resolve this thread? It cannot be reopened easily."
              onConfirm={() => handleUpdateStatus(record.id, 'RESOLVED')}
              okText="Yes, Resolve"
              cancelText="Cancel"
            >
              <Button
                type="text"
                icon={<CheckCircleOutlined />}
              >
                Resolve
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
        title="Foundation Threads"
        description="Thread-based communication interface for exam coordination and discussions."
        extra={
          hasPermission('foundation_threads:write') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)}>
              New Thread
            </Button>
          )
        }
      />
      
      <div className="bg-white rounded-lg shadow-sm p-4">
        {isMobile ? (
          <List
            grid={{ gutter: 16, column: 1 }}
            dataSource={threads}
            loading={loading}
            pagination={{
              current: page,
              pageSize: limit,
              total,
              onChange: (p, s) => { setPage(p); setLimit(s); }
            }}
            renderItem={record => (
              <List.Item>
                <Card 
                  title={record.title}
                  extra={<Tag color={record.status === 'OPEN' ? 'green' : record.status === 'RESOLVED' ? 'blue' : 'default'}>{record.status}</Tag>}
                  actions={[
                    <Button
                      key="view"
                      type="link"
                      icon={<MessageOutlined />}
                      onClick={() => openThreadDetails(record)}
                    >
                      View
                    </Button>,
                    hasPermission('foundation_threads:write') && record.status === 'OPEN' ? (
                      <Popconfirm
                        key="resolve"
                        title="Resolve Thread"
                        onConfirm={() => handleUpdateStatus(record.id, 'RESOLVED')}
                        okText="Yes"
                        cancelText="Cancel"
                      >
                        <Button type="link" icon={<CheckCircleOutlined />}>Resolve</Button>
                      </Popconfirm>
                    ) : null
                  ].filter(Boolean) as React.ReactNode[]}
                >
                  <p className="text-gray-500 mb-1">Author: {record.author?.name || 'Unknown'}</p>
                  <p className="text-gray-500 mb-1">Type: <Tag color="purple">{record.examType}</Tag></p>
                  <p className="text-gray-500">Messages: {record.messageCount || 0}</p>
                </Card>
              </List.Item>
            )}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={threads}
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
        )}
      </div>

      <Modal
        title="Create New Thread"
        open={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        onOk={() => createForm.submit()}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateSubmit}>
          <Form.Item
            name="title"
            label="Thread Title"
            rules={[{ required: true, message: 'Please enter thread title' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="batchId"
            label="Batch"
            rules={[{ required: true, message: 'Please select a batch' }]}
          >
            <Select placeholder="Select Batch">
              {batches.map(b => (
                <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="examType"
            label="Exam Type"
            rules={[{ required: true, message: 'Please select an exam type' }]}
          >
            <Select placeholder="Select Exam Type">
              <Select.Option value="MOCK">Mock Exam</Select.Option>
              <Select.Option value="FINAL">Final Exam</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

    </PageContainer>
  );
};
