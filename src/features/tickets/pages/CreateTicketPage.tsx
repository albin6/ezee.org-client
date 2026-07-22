import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Form, Select, message, Divider, Image, Modal } from 'antd';
import { AudioOutlined, PauseCircleOutlined, PlayCircleOutlined, StopOutlined, DeleteOutlined, PaperClipOutlined, FileOutlined, CloseOutlined, DownloadOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { useTicketStore } from '../store/ticket.store';
import { apiClient } from '@/shared/api/axios';
import { ticketService } from '../api/ticket.service';

export const CreateTicketPage: React.FC = () => {
  const navigate = useNavigate();
  const { createTicket } = useTicketStore();
  const [form] = Form.useForm();

  const [teams, setTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // First Message State
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string, name: string, type: string } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch user's teams
    apiClient.get('/tickets/teams-lookup').then((res: any) => setTeams(res.data.data)).catch(console.error);
    return () => clearInterval(timerRef.current);
  }, []);

  const handleTeamChange = async (teamId: string) => {
    form.setFieldValue('assignees', []);
    try {
      const res: any = await apiClient.get(`/tickets/teams/${teamId}/members-lookup`);
      setTeamMembers(res.data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioPreviewUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      message.error('Microphone access denied or unavailable');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setIsPaused(false);
    clearInterval(timerRef.current);
    setAudioBlob(null);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    setIsUploading(true);
    try {
      let audioUrl = undefined;
      if (audioBlob) {
        const audioRes = await ticketService.uploadAudio(audioBlob);
        audioUrl = audioRes.url;
      }

      let uploadedAttachments = undefined;
      if (attachments.length > 0) {
        uploadedAttachments = await Promise.all(
          attachments.map(file => ticketService.uploadAttachment(file))
        );
      }

      const firstMessage = (values.firstMessageText || audioUrl || uploadedAttachments) ? {
        content: values.firstMessageText || '',
        audioUrl,
        attachments: uploadedAttachments,
      } : undefined;

      await createTicket({
        title: values.title,
        description: values.description,
        teamId: values.teamId,
        assignees: values.assignees,
        firstMessage
      });
      message.success('Ticket created successfully');
      navigate('/tickets');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
      setIsUploading(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Create Ticket"
        description="Submit a new ticket or issue to a team."
      />

      <Card className="max-w-2xl">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter a ticket title' }]}
          >
            <Input placeholder="E.g., Server down in production" />
          </Form.Item>

          <Form.Item
            name="teamId"
            label="Target Team"
            rules={[{ required: true, message: 'Please select a target team' }]}
          >
            <Select
              placeholder="Select Team"
              onChange={handleTeamChange}
              options={teams.map(t => ({ value: t.id, label: t.name }))}
            />
          </Form.Item>

          <Form.Item
            name="assignees"
            label="Assignees"
          >
            <Select
              mode="multiple"
              placeholder="Select Assignees (Optional)"
              disabled={teamMembers.length === 0}
              options={teamMembers.map(m => ({ value: m.user.id, label: m.user.name }))}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={4} placeholder="Describe the issue in detail..." />
          </Form.Item>

          <Divider orientation={"left" as any} plain>First Message (Optional)</Divider>

          <Form.Item name="firstMessageText" className="mb-2">
            <Input.TextArea rows={3} placeholder="Type your initial message..." />
          </Form.Item>

          {/* Audio and File Queue */}
          <div className="flex flex-col gap-3 mb-6 bg-gray-50 p-3 rounded-lg border border-gray-100">
            {audioPreviewUrl ? (
              <div className="flex items-center gap-3 bg-white p-2 rounded border border-gray-200 inline-flex w-fit">
                <audio controls src={audioPreviewUrl} className="h-8 w-[200px]" />
                <Button type="text" danger icon={<DeleteOutlined />} onClick={cancelRecording} />
              </div>
            ) : isRecording || isPaused ? (
              <div className="flex items-center gap-4 bg-red-50 text-red-600 px-4 py-2 rounded-full border border-red-100 w-fit">
                <div className={`w-2.5 h-2.5 rounded-full bg-red-500 ${isRecording ? 'animate-pulse' : ''}`} />
                <span className="font-mono font-medium">{formatDuration(recordingDuration)}</span>
                <div className="flex items-center gap-2 border-l border-red-200 pl-4 ml-2">
                  {isPaused ? (
                    <Button type="text" className="text-red-600 hover:bg-red-100 p-1 min-w-0 h-auto" icon={<PlayCircleOutlined className="text-xl" />} onClick={resumeRecording} />
                  ) : (
                    <Button type="text" className="text-red-600 hover:bg-red-100 p-1 min-w-0 h-auto" icon={<PauseCircleOutlined className="text-xl" />} onClick={pauseRecording} />
                  )}
                  <Button type="text" className="text-red-600 hover:bg-red-100 p-1 min-w-0 h-auto" icon={<StopOutlined className="text-xl" />} onClick={stopRecording} />
                  <Button type="text" className="text-gray-500 hover:bg-red-100 p-1 min-w-0 h-auto ml-2" icon={<DeleteOutlined className="text-lg" />} onClick={cancelRecording} />
                </div>
              </div>
            ) : null}

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => {
                  const isImage = file.type.startsWith('image/');
                  return (
                    <div key={index} className="flex items-center gap-2 bg-white border border-gray-200 rounded px-2 py-1 text-sm max-w-[200px]">
                      {isImage ? (
                        <Image src={URL.createObjectURL(file)} alt={file.name} width={24} height={24} className="object-cover rounded flex-shrink-0" />
                      ) : (
                        <FileOutlined className="text-gray-400 flex-shrink-0" />
                      )}
                      <span
                        className={`truncate max-w-[120px] text-gray-700 ${!isImage ? 'cursor-pointer hover:text-blue-500 hover:underline' : ''}`}
                        onClick={() => {
                          if (!isImage) {
                            setPreviewFile({ url: URL.createObjectURL(file), name: file.name, type: file.type });
                          }
                        }}
                      >
                        {file.name}
                      </span>
                      <Button type="text" size="small" className="p-0 min-w-0 h-auto text-gray-400 hover:text-red-500" icon={<CloseOutlined className="text-[10px]" />} onClick={() => removeAttachment(index)} disabled={isUploading || loading} />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                type="text"
                icon={<AudioOutlined />}
                onClick={startRecording}
                disabled={isRecording || isPaused || !!audioBlob || isUploading || loading}
                title="Record voice message"
              >
                Record Audio
              </Button>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleAttachmentChange}
              />
              <Button
                type="text"
                icon={<PaperClipOutlined />}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || loading}
                title="Attach files"
              >
                Attach Files
              </Button>
            </div>
          </div>

          <Form.Item className="mb-0">
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button onClick={() => navigate('/tickets')} disabled={isUploading || loading}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={loading || isUploading} disabled={isRecording || isPaused}>
                Create Ticket
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>

      <Modal
        title={previewFile?.name}
        open={!!previewFile}
        onCancel={() => setPreviewFile(null)}
        footer={[
          <Button key="download" type="primary" icon={<DownloadOutlined />} href={previewFile?.url} target="_blank" download>
            Download
          </Button>,
          <Button key="close" onClick={() => setPreviewFile(null)}>Close</Button>
        ]}
        width={800}
        centered
        styles={{ body: { padding: 0, height: '70vh' } }}
      >
        {previewFile?.type.startsWith('video/') ? (
          <video src={previewFile.url} controls autoPlay className="w-full h-full bg-black object-contain" />
        ) : (
          <iframe src={previewFile?.url} className="w-full h-full border-none" title={previewFile?.name} />
        )}
      </Modal>
    </PageContainer>
  );
};
