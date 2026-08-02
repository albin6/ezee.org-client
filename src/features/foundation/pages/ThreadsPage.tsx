import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Input, Modal, Form, message, Space, Tag, List, Avatar, Tabs, Select, Popconfirm, Row, Col, Card, Statistic, Mentions, TimePicker, InputNumber, DatePicker, Grid, Checkbox } from 'antd';
import dayjs from 'dayjs';
import { PlusOutlined, MessageOutlined, CheckCircleOutlined, UserOutlined, TeamOutlined, UserAddOutlined, UsergroupAddOutlined, DeleteOutlined, DashboardOutlined, VideoCameraOutlined, CalendarOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { foundationService } from '../api/foundation.service';
import type { Thread, ThreadMessage, StudentCoordinator } from '../api/foundation.service';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { socketService } from '@/shared/services/socket.service';
import { CompleteExamModal } from '../components/CompleteExamModal';


export const ThreadsPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const user = useAuthStore(state => state.user);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const navigate = useNavigate();
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
  const [isAssignmentsSynced, setIsAssignmentsSynced] = useState(true);
  const [addCoordinatorLoading, setAddCoordinatorLoading] = useState(false);
  const [assignEngineLoading, setAssignEngineLoading] = useState(false);
  const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleForm] = Form.useForm();
  const [selectedCoordinators, setSelectedCoordinators] = useState<string[]>([]);
  const [meetingLinkMap, setMeetingLinkMap] = useState<Record<string, string>>({});
  
  const [isBufferedModalVisible, setIsBufferedModalVisible] = useState(false);
  const [bufferedStudents, setBufferedStudents] = useState<any[]>([]);
  const [selectedBufferedStudents, setSelectedBufferedStudents] = useState<string[]>([]);
  const [bufferedLoading, setBufferedLoading] = useState(false);
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

  const openThreadDetails = (thread: Thread) => { navigate(`/foundation/threads/${thread.id}`); };

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
    if (!selectedThread || selectedCoordinators.length === 0) return;
    setAddCoordinatorLoading(true);
    try {
      await Promise.all(selectedCoordinators.map(coordId => 
        foundationService.addThreadCoordinator(selectedThread.id, coordId)
      ));
      message.success('Coordinators added successfully');
      setSelectedCoordinators([]);
      // refresh coordinators
      const coords = await foundationService.getThreadCoordinators(selectedThread.id);
      setCoordinators(coords);
    } catch (error: any) {
      message.error('Failed to add coordinators');
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

  const handleRemoveAllCoordinators = async () => {
    if (!selectedThread || coordinators.length === 0) return;
    try {
      await Promise.all(coordinators.map(c => 
        foundationService.removeThreadCoordinator(selectedThread.id, c.id)
      ));
      message.success('All coordinators removed successfully');
      openThreadDetails(selectedThread);
    } catch (error: any) {
      message.error('Failed to remove all coordinators');
    }
  };

  const handleMarkAbsent = async (studentId: string) => {
    if (!selectedThread) return;
    try {
      await foundationService.markStudentAbsent(selectedThread.id, studentId);
      message.success('Student marked as absent');
      openThreadDetails(selectedThread, 'assigned-students'); // Refresh the list
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to mark student as absent');
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
        setAssignments(assigns.assignments);
        setIsAssignmentsSynced(assigns.isSynced);
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
      message.success('Auto-assign completed');
      const assigns = await foundationService.getThreadAssignments(selectedThread.id);
      setAssignments(assigns.assignments);
      setIsAssignmentsSynced(assigns.isSynced);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Auto-assign failed');
    } finally {
      setAssignEngineLoading(false);
    }
  };

  const handleScheduleExams = async (values: any) => {
    if (!selectedThread) return;
    setScheduleLoading(true);
    try {
      await foundationService.scheduleExams(
        selectedThread.id,
        values.date.toISOString(),
        values.intervalMinutes
      );
      message.success('Exams scheduled successfully');
      setIsScheduleModalVisible(false);
      openThreadDetails(selectedThread, 'assignments');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to schedule exams');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleOpenBufferedModal = async () => {
    setIsBufferedModalVisible(true);
    setBufferedLoading(true);
    try {
      const bId = selectedThread?.batch?.id || selectedThread?.batchId;
      const res = await foundationService.getBufferedStudents({ limit: 1000, batchId: bId });
      setBufferedStudents(res.data);
    } catch (error) {
      message.error('Failed to load buffered students');
    } finally {
      setBufferedLoading(false);
    }
  };

  const handleAssignBuffered = async () => {
    if (!selectedThread || selectedBufferedStudents.length === 0) return;
    try {
      await foundationService.assignBufferedStudents(selectedThread.id, selectedBufferedStudents);
      message.success('Buffered students assigned successfully');
      setIsBufferedModalVisible(false);
      setSelectedBufferedStudents([]);
      openThreadDetails(selectedThread, 'assignments');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to assign buffered students');
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

  const hasScheduledExams = assignments.some(a => a.students.some((s: any) => s.scheduledTime));

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

      <Modal
        title={hasScheduledExams ? "Update Exam Schedule" : "Schedule Exams"}
        open={isScheduleModalVisible}
        onCancel={() => setIsScheduleModalVisible(false)}
        onOk={() => scheduleForm.submit()}
        confirmLoading={scheduleLoading}
      >
        <Form form={scheduleForm} layout="vertical" onFinish={handleScheduleExams} initialValues={{ intervalMinutes: 35 }}>
          <div className="mb-4 text-gray-500">
            This will schedule the first student for each coordinator at the start time, and subsequent students at the specified interval.
          </div>
          <Form.Item
            name="date"
            label="Date"
            rules={[{ required: true, message: 'Please select a date' }]}
          >
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item
            name="startTime"
            label="Start Time"
            rules={[{ required: true, message: 'Please select a start time' }]}
          >
            <TimePicker format="HH:mm" className="w-full" />
          </Form.Item>
          <Form.Item
            name="intervalMinutes"
            label="Interval (minutes)"
            rules={[{ required: true, message: 'Please set the interval' }]}
          >
            <InputNumber min={5} max={120} className="w-full" />
          </Form.Item>
        </Form>
      </Modal>

          </PageContainer>
  );
};
