import React, { useState } from 'react';
import { Button, Modal, Form, Input, Select, DatePicker } from 'antd';

interface TaskFormModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: any) => Promise<void>;
  initialValues?: any;
  teamMembers: any[]; // Expecting users with roles
  currentUserLevel: number;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  open,
  onCancel,
  onSubmit,
  initialValues,
  teamMembers,
  currentUserLevel
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Role-aware filtering: Only allow assigning to users with level >= currentUserLevel (assuming lower number = higher rank)
  // Super Admin (level 0) can assign to anyone.
  const eligibleAssignees = teamMembers.filter(member => {
    if (currentUserLevel === 0) return true;
    const memberLevel = member.role?.level ?? 99;
    return currentUserLevel <= memberLevel;
  });

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await onSubmit({
        ...values,
        deadline: values.deadline.toISOString()
      });
      form.resetFields();
      onCancel();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={initialValues ? 'Edit Task' : 'Create Task'}
      open={open}
      onCancel={onCancel}
      footer={null}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={handleSubmit}
      >
        <Form.Item name="title" label="Title" rules={[{ required: true }]}>
          <Input placeholder="Task title" />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea placeholder="Task description" rows={3} />
        </Form.Item>

        <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
          <Select>
            <Select.Option value="LOW">Low</Select.Option>
            <Select.Option value="MEDIUM">Medium</Select.Option>
            <Select.Option value="HIGH">High</Select.Option>
            <Select.Option value="CRITICAL">Critical</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="deadline" label="Deadline" rules={[{ required: true }]}>
          <DatePicker showTime className="w-full" />
        </Form.Item>

        <Form.Item name="assigneeIds" label="Assignees">
          <Select mode="multiple" placeholder="Select assignees">
            {eligibleAssignees.map(member => (
              <Select.Option key={member.user.id} value={member.user.id}>
                {member.user.name} ({member.role?.name})
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="recurrencePattern" label="Recurrence Pattern">
          <Select allowClear placeholder="Does not repeat">
            <Select.Option value="DAILY">Daily</Select.Option>
            <Select.Option value="WEEKLY">Weekly</Select.Option>
            <Select.Option value="MONTHLY">Monthly</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item 
          name="completionType" 
          label="Completion Type" 
          initialValue="INDIVIDUAL"
          tooltip="Shared: Any assignee completing the task completes it for everyone. Individual: Each assignee must complete it."
        >
          <Select>
            <Select.Option value="INDIVIDUAL">Individual (Requires completion from all assignees)</Select.Option>
            <Select.Option value="SHARED">Shared (Single completion marks task as done)</Select.Option>
          </Select>
        </Form.Item>

        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {initialValues ? 'Update Task' : 'Create Task'}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};
