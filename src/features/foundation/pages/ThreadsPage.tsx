import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Modal, Form, message, Space, Tag, List, Avatar, Tabs, Select, Popconfirm } from 'antd';
import { PlusOutlined, MessageOutlined, CheckCircleOutlined, UserOutlined, TeamOutlined, UserAddOutlined, UsergroupAddOutlined, DeleteOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { foundationService } from '../api/foundation.service';
import type { Thread, ThreadMessage, StudentCoordinator } from '../api/foundation.service';
import { usePermissions } from '@/shared/hooks/usePermissions';



export const ThreadsPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter] = useState<string | undefined>(undefined);

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();

  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [batches, setBatches] = useState<any[]>([]);
  
  // New States for Coordinators & Assignments
  const [coordinators, setCoordinators] = useState<StudentCoordinator[]>([]);
  const [availableCoordinators, setAvailableCoordinators] = useState<StudentCoordinator[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [addCoordinatorLoading, setAddCoordinatorLoading] = useState(false);
  const [assignEngineLoading, setAssignEngineLoading] = useState(false);
  const [selectedCoordinator, setSelectedCoordinator] = useState<string | null>(null);
  
  // New State for Batches for creating threads
  // const [batches, setBatches] = useState<any[]>([]);

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

  const fetchGlobalData = async () => {
    try {
      const [coords, batchesRes] = await Promise.all([
        foundationService.getStudentCoordinators(),
        foundationService.getBatches({ page: 1, limit: 100 })
      ]);
      setAvailableCoordinators(Array.isArray(coords) ? coords : []);
      setBatches(batchesRes.data || []);
    } catch(e) {
      console.error('Failed to fetch available coordinators');
    }
  };

  useEffect(() => {
    fetchThreads();
    fetchGlobalData();
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
      const [msgs, coords, assigns] = await Promise.all([
        foundationService.getThreadMessages(thread.id),
        foundationService.getThreadCoordinators(thread.id),
        foundationService.getThreadAssignments(thread.id)
      ]);
      setMessages(msgs);
      setCoordinators(coords);
      setAssignments(assigns);
      
      // We should also fetch students in the batch
      // For now we'll just show the assignment data
    } catch (error: any) {
      message.error('Failed to load thread details');
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

  const handleAddCoordinator = async () => {
    if (!selectedThread || !selectedCoordinator) return;
    setAddCoordinatorLoading(true);
    try {
      await foundationService.addThreadCoordinator(selectedThread.id, selectedCoordinator);
      message.success('Coordinator added successfully');
      setSelectedCoordinator(null);
      // refresh coordinators
      const coords = await foundationService.getThreadCoordinators(selectedThread.id);
      setCoordinators(coords);
    } catch (error: any) {
      message.error('Failed to add coordinator');
    } finally {
      setAddCoordinatorLoading(false);
    }
  };

  const handleRemoveCoordinator = async (coordinatorId: string) => {
    if (!selectedThread) return;
    try {
      await foundationService.removeThreadCoordinator(selectedThread.id, coordinatorId);
      message.success('Coordinator removed successfully');
      // Refresh coordinators & assignments
      const [coords, assigns] = await Promise.all([
        foundationService.getThreadCoordinators(selectedThread.id),
        foundationService.getThreadAssignments(selectedThread.id)
      ]);
      setCoordinators(coords);
      setAssignments(assigns);
    } catch (error: any) {
      message.error('Failed to remove coordinator');
    }
  };

  const handleRunAutoAssign = async () => {
    if (!selectedThread) return;
    setAssignEngineLoading(true);
    try {
      await foundationService.runThreadAutoAssign(selectedThread.id);
      message.success('Auto-assignment completed');
      // refresh assignments
      const assigns = await foundationService.getThreadAssignments(selectedThread.id);
      setAssignments(assigns);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Auto-assign failed');
    } finally {
      setAssignEngineLoading(false);
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

      <Modal
        title={selectedThread?.title || 'Thread Details'}
        open={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        footer={null}
        width={700}
      >
        <Tabs defaultActiveKey="1">
          <Tabs.TabPane tab={<span><MessageOutlined /> Overview</span>} key="1">
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
          </Tabs.TabPane>
          <Tabs.TabPane tab={<span><TeamOutlined /> Coordinators</span>} key="2">
            <div className="h-[60vh] overflow-y-auto">
              {hasPermission('foundation_threads:write') && (
                <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
                  <h3 className="font-semibold mb-2">Add Coordinator</h3>
                  <div className="flex items-center gap-2">
                    <Select
                      className="w-64"
                      placeholder="Select Coordinator"
                      value={selectedCoordinator}
                      onChange={setSelectedCoordinator}
                      options={availableCoordinators.map(c => ({ label: c.name, value: c.id }))}
                    />
                    <Button
                      type="default"
                      icon={<UserAddOutlined />}
                      onClick={handleAddCoordinator}
                      loading={addCoordinatorLoading}
                      disabled={!selectedCoordinator}
                    >
                      Add to Thread
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-4 text-lg">Assigned Coordinators</h3>
                <List
                  dataSource={coordinators}
                  renderItem={(coord) => (
                    <List.Item
                      actions={
                        hasPermission('foundation_threads:write') ? [
                          <Popconfirm
                            title="Remove Coordinator"
                            description="Removing this coordinator will also remove all their student assignments for this thread. Are you sure?"
                            onConfirm={() => handleRemoveCoordinator(coord.id)}
                            okText="Yes, Remove"
                            cancelText="Cancel"
                          >
                            <Button danger type="text" icon={<DeleteOutlined />}>Remove</Button>
                          </Popconfirm>
                        ] : []
                      }
                    >
                      <List.Item.Meta
                        avatar={<Avatar icon={<UserOutlined />} />}
                        title={coord.name}
                        description={coord.email}
                      />
                    </List.Item>
                  )}
                  locale={{ emptyText: 'No coordinators assigned.' }}
                />
              </div>
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane tab={<span><UsergroupAddOutlined /> Assignments</span>} key="3">
            <div className="h-[60vh] overflow-y-auto">
              {hasPermission('foundation_threads:write') && (
                <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
                  <h3 className="font-semibold mb-2">Auto-Assign Engine</h3>
                  <div className="flex items-center gap-2">
                    <Button 
                      type="primary" 
                      onClick={handleRunAutoAssign} 
                      loading={assignEngineLoading}
                    >
                      Run Auto-Assign Engine
                    </Button>
                    <span className="text-gray-500 text-sm">Distributes students evenly to assigned coordinators.</span>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-4 text-lg">Assignments List (Copyable)</h3>
                <div 
                  className="bg-gray-50 p-4 rounded border border-gray-200 font-mono text-sm select-all whitespace-pre-wrap"
                  style={{ minHeight: '100px' }}
                >
                  {assignments.length > 0 ? (
                    assignments.map((group, idx) => (
                      <div key={idx} className="mb-4">
                        <div className="font-bold">{group.coordinator.name}</div>
                        {group.students.map((st: any, i: number) => (
                          <div key={i}>- {st.name}</div>
                        ))}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400 italic">No assignments generated yet. Run Auto-Assign Engine.</div>
                  )}
                </div>
              </div>
            </div>
          </Tabs.TabPane>
        </Tabs>
      </Modal>
    </PageContainer>
  );
};
