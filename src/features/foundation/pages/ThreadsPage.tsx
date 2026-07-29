import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Input, Modal, Form, message, Space, Tag, List, Avatar, Tabs, Select, Popconfirm, Row, Col, Card, Statistic, Mentions } from 'antd';
import { PlusOutlined, MessageOutlined, CheckCircleOutlined, UserOutlined, TeamOutlined, UserAddOutlined, UsergroupAddOutlined, DeleteOutlined, DashboardOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { foundationService } from '../api/foundation.service';
import type { Thread, ThreadMessage, StudentCoordinator } from '../api/foundation.service';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { socketService } from '@/shared/services/socket.service';
import { CompleteExamModal } from '../components/CompleteExamModal';


export const ThreadsPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const user = useAuthStore(state => state.user);
  const isCoordinator = (user as any)?.type === 'STUDENT_COORDINATOR' || (user as any)?.role === 'STUDENT_COORDINATOR';

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
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [batches, setBatches] = useState<any[]>([]);
  
  // New States for Coordinators & Assignments
  const [coordinators, setCoordinators] = useState<StudentCoordinator[]>([]);
  const [availableCoordinators, setAvailableCoordinators] = useState<StudentCoordinator[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [addCoordinatorLoading, setAddCoordinatorLoading] = useState(false);
  const [assignEngineLoading, setAssignEngineLoading] = useState(false);
  const [selectedCoordinator, setSelectedCoordinator] = useState<string | null>(null);
  const [meetingLinkMap, setMeetingLinkMap] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('overview');
  
  // Complete Exam Modal State
  const [completeExamVisible, setCompleteExamVisible] = useState(false);
  const [selectedStudentForExam, setSelectedStudentForExam] = useState<any>(null);
  
  // New State for Batches for creating threads
  // const [batches, setBatches] = useState<any[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'discussion') {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [messages, activeTab]);

  useEffect(() => {
    if (isDetailModalVisible && selectedThread && activeTab === 'discussion') {
      (window as any).activeDiscussionThreadId = selectedThread.id;
    } else {
      (window as any).activeDiscussionThreadId = null;
    }
    return () => {
      (window as any).activeDiscussionThreadId = null;
    };
  }, [isDetailModalVisible, selectedThread?.id, activeTab]);

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

  // Handle URL parameters for opening a specific thread
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get('threadId');
    const tab = params.get('tab');
    
    if (threadId && threads.length > 0 && !isDetailModalVisible) {
      const found = threads.find(t => t.id === threadId);
      if (found) {
        openThreadDetails(found, tab || 'overview');
        // Clear params to avoid re-triggering on future renders
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, [threads, isDetailModalVisible]);

  // Real-time socket logic for messages
  useEffect(() => {
    if (!isDetailModalVisible || !selectedThread) return;

    const socket = socketService.connect();

    // Use current messages state's latest message to get lastTimestamp
    // We pass it to a ref or just use it initially
    const lastTimestamp = messages.length > 0 ? messages[messages.length - 1].createdAt : undefined;

    socket.emit('joinThread', { threadId: selectedThread.id, lastTimestamp }, (response: any) => {
      if (response.status === 'success' && response.missedMessages?.length > 0) {
        setMessages(prev => {
          const newMessages = response.missedMessages.filter(
            (msg: any) => !prev.some(p => p.id === msg.id)
          );
          return [...prev, ...newMessages];
        });
      }
    });

    const handleNewMessage = (newMsg: ThreadMessage) => {
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    };

    socket.on('NEW_THREAD_MESSAGE', handleNewMessage);

    return () => {
      const s = socketService.getSocket();
      if (s) {
        s.emit('leaveThread', { threadId: selectedThread.id });
        s.off('NEW_THREAD_MESSAGE', handleNewMessage);
      }
    };
  }, [isDetailModalVisible, selectedThread?.id]);

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

  const openThreadDetails = async (thread: Thread, defaultTab = 'overview') => {
    setSelectedThread(thread);
    setIsDetailModalVisible(true);
    setActiveTab(defaultTab);
    setMessagesLoading(true);
    try {
      const [msgs, coords, assigns] = await Promise.all([
        foundationService.getThreadMessages(thread.id, undefined, 50),
        foundationService.getThreadCoordinators(thread.id),
        foundationService.getThreadAssignments(thread.id)
      ]);
      setMessages(msgs);
      setHasMoreMessages(msgs.length === 50);
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
      openThreadDetails(selectedThread);
    } catch (error: any) {
      message.error('Failed to remove coordinator');
    }
  };

  const handleUpdateLink = async (coordinatorId: string, link: string) => {
    if (!link.trim()) {
      message.error('Please enter a valid meeting link before saving');
      return;
    }
    if (!selectedThread) return;
    try {
      await foundationService.updateThreadCoordinatorLink(selectedThread.id, coordinatorId, link.trim());
      message.success('Meeting link updated successfully');
      openThreadDetails(selectedThread);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to update meeting link');
    }
  };

  const handleTabChange = async (key: string) => {
    setActiveTab(key);
    if (!selectedThread) return;
    
    try {
      if (key === 'discussion') {
        const msgs = await foundationService.getThreadMessages(selectedThread.id, undefined, 50);
        setMessages(msgs);
        setHasMoreMessages(msgs.length === 50);
        requestAnimationFrame(() => scrollToBottom());
      } else if (key === 'coordinators') {
        const coords = await foundationService.getThreadCoordinators(selectedThread.id);
        setCoordinators(coords);
      } else if (key === 'assignments' || key === 'overview' || key === 'assigned-students') {
        const assigns = await foundationService.getThreadAssignments(selectedThread.id);
        setAssignments(assigns);
      }
    } catch (error) {
      console.error('Failed to refresh tab data');
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

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.scrollTop === 0 && !messagesLoading && hasMoreMessages && messages.length > 0 && selectedThread) {
      const oldScrollHeight = target.scrollHeight;
      setMessagesLoading(true);
      try {
        const oldestMessage = messages[0];
        const olderMessages = await foundationService.getThreadMessages(selectedThread.id, oldestMessage.createdAt, 50);
        
        if (olderMessages.length < 50) {
          setHasMoreMessages(false);
        }
        
        if (olderMessages.length > 0) {
          setMessages(prev => [...olderMessages, ...prev]);
          // Maintain scroll position
          requestAnimationFrame(() => {
            if (messagesContainerRef.current) {
              const newScrollHeight = messagesContainerRef.current.scrollHeight;
              messagesContainerRef.current.scrollTop = newScrollHeight - oldScrollHeight;
            }
          });
        }
      } catch (error) {
        console.error('Failed to load older messages', error);
      } finally {
        setMessagesLoading(false);
      }
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
        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          <Tabs.TabPane tab={<span><DashboardOutlined /> Overview</span>} key="overview">
            {isCoordinator ? (
              <div className="p-4 h-[60vh]">
                <h3 className="text-lg font-semibold mb-4">My Analytics</h3>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Card variant="borderless">
                      <Statistic title="Assigned Students" value={assignments.find(a => a.coordinator.id === ((user as any)?.sub || (user as any)?.id))?.students.length || 0} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card variant="borderless">
                      <Statistic title="Thread Status" value={selectedThread?.status || 'UNKNOWN'} />
                    </Card>
                  </Col>
                </Row>
              </div>
            ) : (
              <div className="p-4 h-[60vh]">
                <h3 className="text-lg font-semibold mb-4">Thread Analytics</h3>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Card variant="borderless">
                      <Statistic title="Total Coordinators" value={coordinators.length} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card variant="borderless">
                      <Statistic title="Total Assigned Students" value={assignments.reduce((acc, curr) => acc + curr.students.length, 0)} />
                    </Card>
                  </Col>
                </Row>
              </div>
            )}
          </Tabs.TabPane>
          <Tabs.TabPane tab={<span><MessageOutlined /> Discussion</span>} key="discussion">
            <div className="flex flex-col h-[60vh]">
              <div 
                className="flex-1 overflow-y-auto mb-4 p-2 bg-gray-50 rounded"
                ref={messagesContainerRef}
                onScroll={handleScroll}
              >
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
                <div ref={messagesEndRef} />
              </div>
              
              <div className="mt-auto">
                {selectedThread?.status === 'OPEN' ? (
                  <div className="flex items-start gap-2">
                    <Mentions
                      rows={3}
                      value={messageInput}
                      onChange={(val) => setMessageInput(val)}
                      placeholder="Type your message here... Use @ to tag coordinators"
                      options={availableCoordinators.map(c => ({
                        value: c.name.replace(/\s+/g, ''),
                        label: c.name
                      }))}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="flex-1"
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
          {!isCoordinator && (
            <Tabs.TabPane tab={<span><TeamOutlined /> Coordinators</span>} key="coordinators">
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
                      actions={[
                        ...(hasPermission('foundation_threads:write') ? [
                          <Popconfirm
                            key="remove"
                            title="Remove Coordinator"
                            description="Removing this coordinator will also remove all their student assignments for this thread. Are you sure?"
                            onConfirm={() => handleRemoveCoordinator(coord.id)}
                            okText="Yes, Remove"
                            cancelText="Cancel"
                          >
                            <Button danger type="text" icon={<DeleteOutlined />}>Remove</Button>
                          </Popconfirm>
                        ] : [])
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<Avatar icon={<UserOutlined />} />}
                        title={coord.name}
                        description={
                          <div>
                            <div>Student No: {coord.studentNumber}</div>
                            {coord.meetingLink && (
                              <div className="mt-1">
                                Link: <a href={coord.meetingLink.startsWith('http') ? coord.meetingLink : `https://${coord.meetingLink}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{coord.meetingLink}</a>
                              </div>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                  locale={{ emptyText: 'No coordinators assigned.' }}
                />
              </div>
            </div>
          </Tabs.TabPane>
          )}
          {!isCoordinator && (
          <Tabs.TabPane tab={<span><UsergroupAddOutlined /> Assignments</span>} key="assignments">
            <div className="h-[60vh] overflow-y-auto">
              {hasPermission('foundation_threads:write') && (
                <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
                  <h3 className="font-semibold mb-2">Auto-Assign Engine</h3>
                  <div className="flex items-center gap-2">
                    <Popconfirm
                      title="Run Auto-Assign Engine"
                      description="This will distribute students evenly to assigned coordinators. Existing assignments may be modified. Proceed?"
                      onConfirm={handleRunAutoAssign}
                      okText="Run Engine"
                      cancelText="Cancel"
                    >
                      <Button 
                        type="primary" 
                        loading={assignEngineLoading}
                      >
                        Run Auto-Assign Engine
                      </Button>
                    </Popconfirm>
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
                    assignments
                      .map((group, idx) => (
                      <div key={idx} className="mb-4">
                        <div className="font-bold">
                          {group.coordinator.name} - {
                            (() => {
                              const coord = coordinators.find(c => c.id === group.coordinator.id);
                              const link = coord?.meetingLink || group.coordinator.meetingLink;
                              return link ? (link.startsWith('http') ? link : `https://${link}`) : 'meeting link Not available';
                            })()
                          }
                        </div>
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
          )}
          {isCoordinator && (
          <Tabs.TabPane tab={<span><VideoCameraOutlined /> Meetings</span>} key="meetings">
            <div className="p-4 h-[60vh]">
              <h3 className="font-semibold mb-4 text-lg">My Google Meet Link</h3>
              <p className="text-gray-500 mb-6">Update the link where your mock exam session will be held.</p>
              {coordinators.filter(c => c.id === ((user as any)?.sub || (user as any)?.id)).map(coord => (
                <div key={coord.id} className="flex items-center gap-4 mb-4 bg-gray-50 p-4 rounded border border-gray-200">
                  <Input 
                    className="flex-1"
                    size="large"
                    placeholder="https://meet.google.com/abc-defg-hij" 
                    defaultValue={coord.meetingLink}
                    onChange={(e) => setMeetingLinkMap({ ...meetingLinkMap, [coord.id]: e.target.value })}
                  />
                  <Button 
                    type="primary" 
                    size="large"
                    onClick={() => handleUpdateLink(coord.id, meetingLinkMap[coord.id] !== undefined ? meetingLinkMap[coord.id] : (coord.meetingLink || ''))}
                  >
                    Save Link
                  </Button>
                </div>
              ))}
              {coordinators.filter(c => c.id === ((user as any)?.sub || (user as any)?.id)).length === 0 && (
                <div className="text-gray-500">You are not assigned to this thread.</div>
              )}
            </div>
          </Tabs.TabPane>
          )}
          {isCoordinator && (
          <Tabs.TabPane tab={<span><UsergroupAddOutlined /> Assigned Students</span>} key="assigned-students">
            <div className="p-4 h-[60vh] overflow-y-auto">
              {(() => {
                const userId = (user as any)?.sub || (user as any)?.id;
                const myAssignment = assignments.find(a => a.coordinator.id === userId);
                const myCoordInfo = coordinators.find(c => c.id === userId);
                const link = myCoordInfo?.meetingLink || myAssignment?.coordinator.meetingLink;
                
                return (
                  <>
                    <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200 flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold mb-1">Quick Join Link</h3>
                        {link ? (
                          <a href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                            {link}
                          </a>
                        ) : (
                          <span className="text-gray-400 italic">No meeting link added yet. (Add one in the Meetings tab)</span>
                        )}
                      </div>
                    </div>
                    
                    <h3 className="font-semibold mb-4 text-lg">My Assigned Students ({myAssignment?.students.length || 0})</h3>
                    {myAssignment && myAssignment.students.length > 0 ? (
                      <List
                        dataSource={myAssignment.students}
                        renderItem={(st: any) => (
                          <List.Item
                            actions={[
                              <Button
                                type="primary"
                                disabled={st.isCompleted}
                                onClick={() => {
                                  setSelectedStudentForExam(st);
                                  setCompleteExamVisible(true);
                                }}
                              >
                                {st.isCompleted ? 'Completed' : 'Complete Exam'}
                              </Button>
                            ]}
                          >
                            <List.Item.Meta
                              avatar={<Avatar icon={<UserOutlined />} />}
                              title={st.name}
                              description={st.email}
                            />
                          </List.Item>
                        )}
                      />
                    ) : (
                      <div className="text-gray-400 italic text-center py-10">No students have been assigned to you yet.</div>
                    )}
                  </>
                );
              })()}
            </div>
          </Tabs.TabPane>
          )}
        </Tabs>
      </Modal>

      {selectedThread && selectedStudentForExam && (
        <CompleteExamModal
          open={completeExamVisible}
          threadId={selectedThread.id}
          student={selectedStudentForExam}
          onClose={() => {
            setCompleteExamVisible(false);
            setSelectedStudentForExam(null);
          }}
          onSuccess={() => {
            setCompleteExamVisible(false);
            setSelectedStudentForExam(null);
            handleTabChange('assigned-students'); // Refresh the list
          }}
        />
      )}
    </PageContainer>
  );
};
