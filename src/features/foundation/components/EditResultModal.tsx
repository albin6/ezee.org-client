import React, { useState } from 'react';
import { Modal, Form, InputNumber, Input, message } from 'antd';
import { foundationService } from '../api/foundation.service';

interface EditResultModalProps {
  open: boolean;
  result: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditResultModal: React.FC<EditResultModalProps> = ({
  open,
  result,
  onClose,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await foundationService.updateMarks(
        result.thread.id,
        result.student.id,
        {
          theoryMarks: values.theoryMarks,
          practicalMarks: values.practicalMarks,
          reason: values.reason
        }
      );
      message.success('Marks updated successfully');
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to update marks');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Edit Marks - ${result.student.name}`}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="Update Marks"
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          theoryMarks: result.theoryMarks,
          practicalMarks: result.practicalMarks
        }}
      >
        <Form.Item
          name="theoryMarks"
          label="Theory Marks"
          rules={[{ required: true, message: 'Required' }]}
        >
          <InputNumber min={0} max={10} className="w-full" />
        </Form.Item>

        <Form.Item
          name="practicalMarks"
          label="Practical Marks"
          rules={[{ required: true, message: 'Required' }]}
        >
          <InputNumber min={0} max={10} className="w-full" />
        </Form.Item>

        <Form.Item
          name="reason"
          label="Reason for Modification"
          rules={[{ required: true, message: 'Please provide a reason' }]}
        >
          <Input.TextArea rows={3} placeholder="Provide a brief explanation for updating the marks" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
