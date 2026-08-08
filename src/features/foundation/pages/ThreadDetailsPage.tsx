import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Input, Modal, Form, message, List, Avatar, Tabs, Select, Popconfirm, Row, Col, Card, Statistic, Mentions, TimePicker, InputNumber, DatePicker, Grid, Checkbox } from 'antd';
import dayjs from 'dayjs';
import { MessageOutlined, UserOutlined, TeamOutlined, UserAddOutlined, UsergroupAddOutlined, DeleteOutlined, DashboardOutlined, VideoCameraOutlined, CalendarOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { foundationService } from '../api/foundation.service';
import type { Thread, ThreadMessage, StudentCoordinator } from '../api/foundation.service';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { socketService } from '@/shared/services/socket.service';
import { CompleteExamModal } from '../components/CompleteExamModal';


import { useParams, useNavigate } from 'react-router-dom';
export const ThreadDetailsPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const user = useAuthStore(state => state.user);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const isCoordinator = (user as any)?.type === 'STUDENT_COORDINATOR' || (user as any)?.role === 'STUDENT_COORDINATOR';
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();







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
    if (selectedThread && activeTab === 'discussion') {
      (window as any).activeDiscussionThreadId = selectedThread.id;
    } else {
      (window as any).activeDiscussionThreadId = null;
    }
    return () => {
      (window as any).activeDiscussionThreadId = null;
    };
  }, [selectedThread?.id, activeTab]);

  const renderMessageWithLinks = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };


  const fetchThread = async () => {
    if (!threadId) return;
    try {
      const thread = await foundationService.getThread(threadId);
      openThreadDetails(thread, activeTab);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to fetch thread');
      navigate('/foundation/threads');
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
    } catch (e) {
      console.error('Failed to fetch available coordinators');
    }
  };

  useEffect(() => { fetchThread(); fetchGlobalData(); }, [threadId]);

  // Real-time socket logic for messages
  useEffect(() => {
    if (!selectedThread) return;

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
  }, [selectedThread?.id]);



  const openThreadDetails = async (thread: Thread, defaultTab = 'overview') => {
    setSelectedThread(thread);
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
      setAssignments(assigns.assignments);
      setIsAssignmentsSynced(assigns.isSynced);

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
    } catch (error: any) {
      message.error('Failed to send message');
    }
  };

  const handleUpdateStatus = async (threadId: string, newStatus: 'OPEN' | 'RESOLVED' | 'CLOSED') => {
    try {
      await foundationService.updateThreadStatus(threadId, newStatus);
      message.success(`Thread status updated to ${newStatus}`);
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

  return (
    <PageContainer>
      <PageHeader
        title={selectedThread?.title || 'Thread Details'}
        // @ts-ignore - onBack is kept for compatibility
        onBack={() => navigate('/foundation/threads')}
        extra={
          hasPermission('foundation_threads:write') && selectedThread && (
            <Select
              value={selectedThread.status}
              onChange={(value) => handleUpdateStatus(selectedThread.id, value)}
              options={[
                { label: 'Open', value: 'OPEN' },
                { label: 'Resolved', value: 'RESOLVED' },
                { label: 'Closed', value: 'CLOSED' },
              ]}
              style={{ width: 120 }}
            />
          )
        }
      />
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        {selectedThread ? (
          <Tabs activeKey={activeTab} onChange={handleTabChange} items={[
            {
              key: 'overview',
              label: <span><DashboardOutlined /> Overview</span>,
              children: isCoordinator ? (
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
              )
            },
            {
              key: 'discussion',
              label: <span><MessageOutlined /> Discussion</span>,
              children: (
                <div className="flex flex-col h-[60vh]">
                  <div
                    className="flex-1 overflow-y-auto mb-4 p-2 bg-gray-50 rounded"
                    ref={messagesContainerRef}
                    onScroll={handleScroll}
                  >
                    {messagesLoading ? (
                      <div className="text-center py-4 text-gray-500">Loading messages...</div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {messages.map((msg) => (
                          <div key={msg.id} className="flex gap-3 px-2 py-1">
                            <Avatar icon={<UserOutlined />} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-gray-800">{msg.sender?.name || 'System'}</span>
                                <span className="text-gray-400 text-xs">{dayjs(msg.createdAt).format('MMM D, YYYY h:mm A')}</span>
                              </div>
                              <div className="text-gray-600 whitespace-pre-wrap">{renderMessageWithLinks(msg.message)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                          options={coordinators.map(c => ({
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
              )
            },
            ...(!isCoordinator ? [
              {
                key: 'coordinators',
                label: <span><TeamOutlined /> Coordinators</span>,
                children: (
                  <div className="h-[60vh] overflow-y-auto">
                    {hasPermission('foundation_threads:write') && selectedThread?.status === 'OPEN' && (
                      <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
                        <h3 className="font-semibold mb-2">Add Coordinator</h3>
                        <div className="flex items-center gap-2">
                          <Select
                            mode="multiple"
                            className="w-64"
                            placeholder="Select Coordinators"
                            value={selectedCoordinators}
                            onChange={setSelectedCoordinators}
                            options={availableCoordinators
                              .filter(c => !coordinators.some(existing => existing.id === c.id))
                              .map(c => ({ label: c.name, value: c.id }))}
                          />
                          <Button
                            type="default"
                            icon={<UserAddOutlined />}
                            onClick={handleAddCoordinator}
                            loading={addCoordinatorLoading}
                            disabled={selectedCoordinators.length === 0}
                          >
                            Add to Thread
                          </Button>
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-lg m-0">Assigned Coordinators</h3>
                        {hasPermission('foundation_threads:write') && selectedThread?.status === 'OPEN' && coordinators.length > 0 && (
                          <Popconfirm
                            title="Remove All Coordinators"
                            description="This will remove all assigned coordinators and their student assignments. Are you sure?"
                            onConfirm={handleRemoveAllCoordinators}
                            okText="Yes, Remove All"
                            cancelText="Cancel"
                          >
                            <Button danger type="default" icon={<DeleteOutlined />}>Remove All</Button>
                          </Popconfirm>
                        )}
                      </div>
                      <List
                        dataSource={coordinators}
                        renderItem={(coord) => (
                          <List.Item
                            actions={[
                              ...(hasPermission('foundation_threads:write') && selectedThread?.status === 'OPEN' ? [
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
                )
              }
            ] : []),
            ...(!isCoordinator ? [
              {
                key: 'assignments',
                label: <span><UsergroupAddOutlined /> Assignments</span>,
                children: (
                  <div className="h-[60vh] overflow-y-auto">
                    {hasPermission('foundation_threads:write') && selectedThread?.status === 'OPEN' && (
                      <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
                        <h3 className="font-semibold mb-2">Auto-Assign Engine</h3>
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
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
                            <span className="text-gray-500 text-sm">Distributes students evenly.</span>
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                            <Button
                              type="default"
                              icon={<CalendarOutlined />}
                              onClick={() => {
                                let defaultDate = dayjs();
                                if (selectedThread?.batch?.id || selectedThread?.batchId) {
                                  const bId = selectedThread.batch?.id || selectedThread.batchId;
                                  const batch = batches.find((b: any) => b.id === bId);
                                  if (batch && batch.startDate) {
                                    if (selectedThread.examType === 'MOCK') {
                                      defaultDate = dayjs(batch.startDate).add(5, 'day');
                                    } else if (selectedThread.examType === 'FINAL') {
                                      defaultDate = dayjs(batch.startDate).add(9, 'day');
                                    }
                                  }
                                }

                                scheduleForm.setFieldsValue({
                                  date: defaultDate,
                                  intervalMinutes: 35
                                });
                                setIsScheduleModalVisible(true);
                              }}
                            >
                              {hasScheduledExams ? "Update Schedule" : "Schedule Exams"}
                            </Button>
                            <span className="text-gray-500 text-sm">Assign a start time & intervals for all exams.</span>
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                            <Button type="dashed" onClick={handleOpenBufferedModal}>
                              Assign Buffered Students
                            </Button>
                            <span className="text-gray-500 text-sm">Add students from the buffer list to this thread.</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="font-semibold mb-4 text-lg">Assignments List (Copyable)</h3>
                      {!isAssignmentsSynced && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded flex justify-between items-center">
                          <span>
                            <strong>Warning:</strong> The coordinator list has changed. The current assignments are incomplete or unbalanced.
                          </span>
                          <Button size="small" type="primary" onClick={handleRunAutoAssign} loading={assignEngineLoading} disabled={selectedThread?.status !== 'OPEN'}>
                            Re-run Engine
                          </Button>
                        </div>
                      )}
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
                                  <div key={i} className="flex gap-4">
                                    <span>- {st.name}</span>
                                    {st.scheduledTime && (
                                      <span className="text-blue-600">
                                        ({new Date(st.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ))
                        ) : (
                          <div className="text-gray-400 italic">No assignments generated yet. Run Auto-Assign Engine.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }
            ] : []),
            ...(isCoordinator ? [
              {
                key: 'meetings',
                label: <span><VideoCameraOutlined /> Meetings</span>,
                children: (
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
                          disabled={selectedThread?.status !== 'OPEN'}
                        />
                        <Button
                          type="primary"
                          size="large"
                          onClick={() => handleUpdateLink(coord.id, meetingLinkMap[coord.id] !== undefined ? meetingLinkMap[coord.id] : (coord.meetingLink || ''))}
                          disabled={selectedThread?.status !== 'OPEN'}
                        >
                          Save Link
                        </Button>
                      </div>
                    ))}
                    {coordinators.filter(c => c.id === ((user as any)?.sub || (user as any)?.id)).length === 0 && (
                      <div className="text-gray-500">You are not assigned to this thread.</div>
                    )}
                  </div>
                )
              }
            ] : []),
            ...(isCoordinator ? [
              {
                key: 'assigned-students',
                label: <span><UsergroupAddOutlined /> Assigned Students</span>,
                children: (
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
                                      disabled={st.isCompleted || selectedThread?.status !== 'OPEN'}
                                      onClick={() => {
                                        setSelectedStudentForExam(st);
                                        setCompleteExamVisible(true);
                                      }}
                                    >
                                      {st.isCompleted ? 'Completed' : 'Complete Exam'}
                                    </Button>,
                                    <Popconfirm
                                      title="Mark student as absent?"
                                      description="This will set their result to CANCELLED_FAIL and move them to the buffer list."
                                      onConfirm={() => handleMarkAbsent(st.id)}
                                      okText="Yes, mark absent"
                                      cancelText="Cancel"
                                    >
                                      <Button
                                        type="default"
                                        danger
                                        disabled={st.isCompleted || selectedThread?.status !== 'OPEN'}
                                      >
                                        Mark Absent
                                      </Button>
                                    </Popconfirm>
                                  ]}
                                >
                                  <List.Item.Meta
                                    avatar={<Avatar icon={<UserOutlined />} />}
                                    title={st.name}
                                    description={
                                      <div>
                                        <div>{st.email}</div>
                                        {st.scheduledTime && (
                                          <div className="text-blue-600 font-medium mt-1">
                                            Scheduled for: {new Date(st.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </div>
                                        )}
                                      </div>
                                    }
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
                )
              }
            ] : [])
          ]} />
        ) : (
          <div>Loading...</div>
        )}
      </div>

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
      <Modal
        title="Assign Buffered Students"
        open={isBufferedModalVisible}
        onCancel={() => setIsBufferedModalVisible(false)}
        onOk={handleAssignBuffered}
        okText="Assign Selected"
        okButtonProps={{ disabled: selectedBufferedStudents.length === 0 }}
      >
        {isMobile ? (
          <List
            dataSource={bufferedStudents}
            loading={bufferedLoading}
            pagination={{ pageSize: 10 }}
            renderItem={student => (
              <List.Item
                onClick={() => {
                  if (selectedBufferedStudents.includes(student.id)) {
                    setSelectedBufferedStudents(selectedBufferedStudents.filter(id => id !== student.id));
                  } else {
                    setSelectedBufferedStudents([...selectedBufferedStudents, student.id]);
                  }
                }}
                className="cursor-pointer border rounded mb-2 p-3 hover:bg-gray-50"
              >
                <List.Item.Meta
                  avatar={<Checkbox checked={selectedBufferedStudents.includes(student.id)} />}
                  title={student.name}
                  description={student.email}
                />
              </List.Item>
            )}
          />
        ) : (
          <Table
            rowSelection={{
              type: 'checkbox',
              onChange: (selectedRowKeys) => setSelectedBufferedStudents(selectedRowKeys as string[])
            }}
            columns={[
              { title: 'Name', dataIndex: 'name', key: 'name' },
              { title: 'Email', dataIndex: 'email', key: 'email' },
            ]}
            dataSource={bufferedStudents}
            rowKey="id"
            loading={bufferedLoading}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Modal>
    </PageContainer>
  );
};
