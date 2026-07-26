import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Modal, Form, message, Space, Tag, List, Avatar, Typography } from 'antd';
import { PlusOutlined, MessageOutlined, CheckCircleOutlined, UserOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { foundationService } from '../api/foundation.service';
import type { Thread, ThreadMessage } from '../api/foundation.service';
import { usePermissions } from '@/shared/hooks/usePermissions';

const { Text, Paragraph } = Typography;

export const ThreadsPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();

  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);

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

  useEffect(() => {
    fetchThreads();
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

  const openThreadDetails = async (thread: Thread) => {
    setSelectedThread(thread);
    setIsDetailModalVisible(true);
    setMessagesLoading(true);
    try {
      const msgs = await foundationService.getThreadMessages(thread.id);
      setMessages(msgs);
    } catch (error: any) {
      message.error('Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedThread) return;
    try {
      const newMsg = await foundationService.createMessage(selectedThread.id, messageInput.trim());
      setMessages([...messages, newMsg]);
      setMessageInput('');
      fetchThreads(); // to update message count
    } catch (error: any) {
      message.error('Failed to send message');
    }
  };

  const handleUpdateStatus = async (threadId: string, newStatus: 'OPEN' | 'RESOLVED' | 'CLOSED') => {
    try {
      await foundationService.updateThreadStatus(threadId, newStatus);
      message.success(`Thread status updated to ${newStatus}`);
      fetchThreads();
      if (selectedThread && selectedThread.id === threadId) {
        setSelectedThread({ ...selectedThread, status: newStatus });
      }
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
            <Button
              type="text"
              icon={<CheckCircleOutlined />}
              onClick={() => handleUpdateStatus(record.id, 'RESOLVED')}
            >
              Resolve
            </Button>
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
        </Form>
      </Modal>

      <Modal
        title={selectedThread?.title || 'Thread Details'}
        open={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        footer={null}
        width={700}
      >
        <div className="flex flex-col h-[60vh]">
          <div className="flex-1 overflow-y-auto mb-4 p-2 bg-gray-50 rounded">
            <List
              loading={messagesLoading}
              itemLayout="horizontal"
              dataSource={messages}
              renderItem={(msg) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={
                      <div className="flex justify-between">
                        <span>{msg.sender?.name || 'Unknown'}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                    }
                    description={<div className="text-gray-800 whitespace-pre-wrap">{msg.message}</div>}
                  />
                </List.Item>
              )}
            />
            {messages.length === 0 && !messagesLoading && (
              <div className="text-center text-gray-400 py-10">No messages yet. Start the discussion!</div>
            )}
          </div>
          
          <div className="mt-auto">
            {selectedThread?.status === 'OPEN' ? (
              <div className="flex items-start gap-2">
                <Input.TextArea
                  rows={3}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type your message here..."
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button type="primary" onClick={handleSendMessage}>
                  Send
                </Button>
              </div>
            ) : (
              <div className="text-center text-gray-500 bg-gray-100 p-3 rounded">
                This thread is closed/resolved. No more messages can be sent.
              </div>
            )}
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};
