import React, { useEffect, useState } from 'react';
import { Modal, Descriptions, Tag, Spin, Alert, Typography } from 'antd';
import { foundationService } from '../api/foundation.service';
import dayjs from 'dayjs';

const { Text, Link } = Typography;

interface ResultDetailsModalProps {
  open: boolean;
  resultId: string | null;
  onClose: () => void;
}

export const ResultDetailsModal: React.FC<ResultDetailsModalProps> = ({
  open,
  resultId,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && resultId) {
      fetchDetails();
    } else {
      setData(null);
      setError(null);
    }
  }, [open, resultId]);

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await foundationService.getResultDetails(resultId!);
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Exam Result Details"
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <Alert type="error" message={error} />
      ) : data ? (
        <Descriptions bordered column={2}>
          <Descriptions.Item label="Student" span={2}>
            {data.student.name} <br/>
            <Text type="secondary">{data.student.email}</Text>
          </Descriptions.Item>

          <Descriptions.Item label="Batch">{data.batch.name}</Descriptions.Item>
          <Descriptions.Item label="Exam Type">{data.thread.examType}</Descriptions.Item>

          <Descriptions.Item label="Theory Marks">{data.theoryMarks}</Descriptions.Item>
          <Descriptions.Item label="Practical Marks">{data.practicalMarks}</Descriptions.Item>

          <Descriptions.Item label="Total Marks">
            <strong>{data.theoryMarks + data.practicalMarks}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={data.status === 'PASS' ? 'success' : 'error'}>
              {data.status}
            </Tag>
          </Descriptions.Item>

          <Descriptions.Item label="Pending Topics & Feedback" span={2}>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
              {data.feedback}
            </pre>
          </Descriptions.Item>

          <Descriptions.Item label="Practical Questions Asked" span={2}>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
              {data.practicalQuestions}
            </pre>
          </Descriptions.Item>

          <Descriptions.Item label="Recording" span={2}>
            {data.hasRecording ? (
              <Link href={data.recordingUrl} target="_blank" rel="noopener noreferrer">
                View Recording
              </Link>
            ) : (
              <Text type="secondary">No recording: {data.noRecordingReason}</Text>
            )}
          </Descriptions.Item>

          <Descriptions.Item label="Submitted By">
            {data.coordinator.name}
          </Descriptions.Item>
          <Descriptions.Item label="Submitted At">
            {dayjs(data.createdAt).format('DD MMM YYYY, HH:mm')}
          </Descriptions.Item>
        </Descriptions>
      ) : null}
    </Modal>
  );
};
