import React, { useState } from 'react';
import { Modal, Form, InputNumber, Input, Radio, Button, message } from 'antd';
import { foundationService } from '../api/foundation.service';

const { TextArea } = Input;

interface CompleteExamModalProps {
  open: boolean;
  threadId: string;
  student: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const CompleteExamModal: React.FC<CompleteExamModalProps> = ({
  open,
  threadId,
  student,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const hasRecording = Form.useWatch('hasRecording', form);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await foundationService.completeStudentExam(threadId, student.id, values);
      message.success('Exam completed successfully');
      form.resetFields();
      onSuccess();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to complete exam');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Complete Exam for ${student?.name || 'Student'}`}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ hasRecording: true }}
      >
        <Form.Item
          name="theoryMarks"
          label="Theory Marks (0-10)"
          rules={[{ required: true, message: 'Please enter theory marks' }]}
        >
          <InputNumber min={0} max={10} className="w-full" />
        </Form.Item>

        <Form.Item
          name="practicalMarks"
          label="Practical Marks (0-10)"
          rules={[{ required: true, message: 'Please enter practical marks' }]}
        >
          <InputNumber min={0} max={10} className="w-full" />
        </Form.Item>

        <Form.Item
          name="feedback"
          label="Pending Topics & Feedback"
          rules={[
            { required: true, message: 'Please provide feedback' },
            { min: 20, message: 'Must be at least 20 characters' },
            { max: 2000, message: 'Must be less than 2000 characters' }
          ]}
        >
          <TextArea rows={4} placeholder="Provide complete feedback about performance and pending topics" />
        </Form.Item>

        <Form.Item
          name="practicalQuestions"
          label="Practical Questions Asked"
          rules={[
            { required: true, message: 'Please provide the practical questions asked' },
            { min: 10, message: 'Must be at least 10 characters' },
            { max: 2000, message: 'Must be less than 2000 characters' }
          ]}
        >
          <TextArea rows={4} placeholder="List the practical questions you asked during the evaluation" />
        </Form.Item>

        <Form.Item
          name="hasRecording"
          label="Is TLDV Recording Available?"
        >
          <Radio.Group>
            <Radio value={true}>Yes</Radio>
            <Radio value={false}>No</Radio>
          </Radio.Group>
        </Form.Item>

        {hasRecording ? (
          <Form.Item
            name="recordingUrl"
            label="TLDV Recording URL"
            rules={[
              { required: true, message: 'Please enter recording URL' },
              { type: 'url', message: 'Please enter a valid URL' }
            ]}
          >
            <Input placeholder="https://tldv.io/..." />
          </Form.Item>
        ) : (
          <Form.Item
            name="noRecordingReason"
            label="Reason for No Recording"
            rules={[
              { required: true, message: 'Please provide reason' },
              { max: 1000, message: 'Max 1000 characters' }
            ]}
          >
            <TextArea rows={2} placeholder="Why is the recording missing?" />
          </Form.Item>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            Complete Evaluation
          </Button>
        </div>
      </Form>
    </Modal>
  );
};
