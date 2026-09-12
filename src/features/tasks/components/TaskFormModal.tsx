import React, { useState, useEffect, useMemo } from 'react';
import { Button, Modal, Form, Input, Select, DatePicker, Tag } from 'antd';
import dayjs from 'dayjs';
import { useUserStore } from '@/features/users/store/user.store';
import { userService } from '@/features/users/api/user.service';

interface TaskFormModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: any) => Promise<void>;
  initialValues?: any;
  teamMembers: any[]; // Expecting users with team roles
  currentUserLevel: number;
}

const getAssigneeId = (a: any): string => {
  if (typeof a === 'string') return a;
  return a?.userId || a?.user?.id || a?.id || '';
};

const getAssigneeName = (a: any): string => {
  if (typeof a === 'string') return '';
  return a?.user?.name || a?.name || a?.userName || '';
};

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
  const { users: storeUsers } = useUserStore();
  const [extraNames, setExtraNames] = useState<Record<string, string>>({});

  // Synchronize form fields when opening or switching tasks to edit
  useEffect(() => {
    if (open) {
      if (initialValues) {
        // Extract assignee IDs whether they are an array of objects or strings
        const rawAssignees = initialValues.assignees || initialValues.assigneeIds || [];
        const assigneeIds = Array.isArray(rawAssignees)
          ? rawAssignees.map(getAssigneeId).filter(Boolean)
          : [];

        form.setFieldsValue({
          title: initialValues.title,
          description: initialValues.description,
          priority: initialValues.priority || 'MEDIUM',
          deadline: initialValues.deadline ? dayjs(initialValues.deadline) : undefined,
          assigneeIds,
          recurrencePattern: initialValues.recurrencePattern,
          completionType: initialValues.completionType || 'INDIVIDUAL',
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, initialValues, form]);

  // Asynchronously resolve any missing assignee names if needed
  useEffect(() => {
    if (!open || !initialValues) return;

    const rawAssignees = initialValues.assignees || initialValues.assigneeIds || [];
    if (!Array.isArray(rawAssignees)) return;

    const missingIds: string[] = [];

    rawAssignees.forEach((a: any) => {
      const id = getAssigneeId(a);
      const name = getAssigneeName(a);
      if (id && !name && !extraNames[id]) {
        const inTeam = teamMembers.find((m: any) => (m.user?.id || m.userId || m.id) === id);
        const inStore = storeUsers.find((u: any) => u.id === id);
        if (inTeam) {
          setExtraNames(prev => ({ ...prev, [id]: inTeam.user?.name || inTeam.name }));
        } else if (inStore) {
          setExtraNames(prev => ({ ...prev, [id]: inStore.name }));
        } else {
          missingIds.push(id);
        }
      }
    });

    if (missingIds.length > 0) {
      missingIds.forEach(id => {
        userService.getUser(id).then(res => {
          if (res?.name) {
            setExtraNames(prev => ({ ...prev, [id]: res.name }));
          }
        }).catch(err => {
          console.error(`Failed to fetch user name for ${id}:`, err);
        });
      });
    }
  }, [open, initialValues, teamMembers, storeUsers, extraNames]);

  // Team-specific role-aware filtering:
  // Only allow assigning to team members with level >= currentUserLevel (lower number = higher authority)
  // Super Admin (level 0) can assign to anyone.
  const eligibleAssignees = useMemo(() => {
    return teamMembers.filter(member => {
      if (currentUserLevel === 0) return true;
      const memberLevel = Number(member.role?.level ?? 99);
      return currentUserLevel <= memberLevel;
    });
  }, [teamMembers, currentUserLevel]);

  // Combined options map ensuring assignee names are always resolved and displayed
  const assigneeOptions = useMemo(() => {
    const optionsMap = new Map<string, { value: string; label: string; role?: string }>();

    // 1. Eligible team members
    eligibleAssignees.forEach((member: any) => {
      const id = member.user?.id || member.userId || member.id;
      const name = member.user?.name || member.name;
      const roleName = member.role?.name;
      if (id && name) {
        optionsMap.set(id, {
          value: id,
          label: name,
          role: roleName,
        });
      }
    });

    // 2. Add all users from user store for Super Admin (level 0)
    if (currentUserLevel === 0 && storeUsers.length > 0) {
      storeUsers.forEach((u: any) => {
        if (u.id && !optionsMap.has(u.id)) {
          optionsMap.set(u.id, {
            value: u.id,
            label: u.name,
            role: u.role?.name || u.designation || undefined,
          });
        }
      });
    }

    // 3. Existing assignees from initialValues (guarantees existing assignees have name labels immediately)
    if (initialValues) {
      const existingAssignees = initialValues.assignees || initialValues.assigneeIds || [];
      if (Array.isArray(existingAssignees)) {
        existingAssignees.forEach((a: any) => {
          const id = getAssigneeId(a);
          const name = getAssigneeName(a);
          if (id && !optionsMap.has(id)) {
            const storeUser = storeUsers.find((u: any) => u.id === id) as any;
            const teamMember = teamMembers.find((m: any) => (m.user?.id || m.userId || m.id) === id);
            const resolvedName = name || teamMember?.user?.name || teamMember?.name || storeUser?.name || extraNames[id] || 'Assignee';
            const resolvedRole = a.role?.name || teamMember?.role?.name || storeUser?.role?.name || storeUser?.designation;
            optionsMap.set(id, {
              value: id,
              label: resolvedName,
              role: resolvedRole,
            });
          }
        });
      }
    }

    // 4. Any extra resolved names
    Object.entries(extraNames).forEach(([id, name]) => {
      if (id && !optionsMap.has(id)) {
        optionsMap.set(id, {
          value: id,
          label: name,
        });
      }
    });

    return Array.from(optionsMap.values());
  }, [eligibleAssignees, storeUsers, initialValues, currentUserLevel, teamMembers, extraNames]);

  // Fail-safe tag renderer ensuring raw UUIDs are never displayed
  const tagRender = (props: any) => {
    const { label, value, closable, onClose } = props;
    const isUUID = typeof label === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(label);
    let displayLabel = label;
    if (isUUID || !label) {
      const match = assigneeOptions.find(o => o.value === value);
      displayLabel = match?.label || extraNames[value] || 'Assignee';
    }

    return (
      <Tag
        closable={closable}
        onClose={onClose}
        className="inline-flex items-center gap-1 my-0.5 mr-1 px-2 py-0.5 text-xs rounded bg-blue-50 text-blue-800 border-blue-200"
      >
        {displayLabel}
      </Tag>
    );
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await onSubmit({
        ...values,
        deadline: values.deadline ? values.deadline.toISOString() : undefined
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
      title={
        <span className="font-semibold text-base sm:text-lg text-gray-900">
          {initialValues ? 'Edit Task' : 'Create Task'}
        </span>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnHidden
      width="100%"
      style={{ maxWidth: 540, top: 16 }}
      styles={{
        body: { paddingTop: '8px' }
      }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          priority: 'MEDIUM',
          completionType: 'INDIVIDUAL',
        }}
      >
        <Form.Item 
          name="title" 
          label={<span className="text-xs sm:text-sm font-medium text-gray-700">Title</span>} 
          rules={[{ required: true, message: 'Please enter a task title' }]}
        >
          <Input placeholder="Task title" className="h-9 text-sm" />
        </Form.Item>

        <Form.Item 
          name="description" 
          label={<span className="text-xs sm:text-sm font-medium text-gray-700">Description</span>}
        >
          <Input.TextArea placeholder="Task description" rows={3} className="text-sm" />
        </Form.Item>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Form.Item 
            name="priority" 
            label={<span className="text-xs sm:text-sm font-medium text-gray-700">Priority</span>} 
            rules={[{ required: true }]}
          >
            <Select className="w-full h-9">
              <Select.Option value="LOW">Low</Select.Option>
              <Select.Option value="MEDIUM">Medium</Select.Option>
              <Select.Option value="HIGH">High</Select.Option>
              <Select.Option value="CRITICAL">Critical</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item 
            name="recurrencePattern" 
            label={<span className="text-xs sm:text-sm font-medium text-gray-700">Recurrence Pattern</span>}
          >
            <Select allowClear placeholder="Does not repeat" className="w-full h-9">
              <Select.Option value="DAILY">Daily</Select.Option>
              <Select.Option value="WEEKLY">Weekly</Select.Option>
              <Select.Option value="MONTHLY">Monthly</Select.Option>
            </Select>
          </Form.Item>
        </div>

        <Form.Item 
          name="deadline" 
          label={<span className="text-xs sm:text-sm font-medium text-gray-700">Deadline</span>} 
          rules={[
            { required: true, message: 'Please select a deadline' },
            {
              validator: (_, value) => {
                if (!initialValues && value && value.isBefore(dayjs())) {
                  return Promise.reject(new Error('Deadline must be in the future'));
                }
                return Promise.resolve();
              }
            }
          ]}
        >
          <DatePicker showTime className="w-full h-9" />
        </Form.Item>

        <Form.Item 
          name="assigneeIds" 
          label={<span className="text-xs sm:text-sm font-medium text-gray-700">Assignees</span>}
        >
          <Select 
            mode="multiple" 
            placeholder="Select assignees"
            options={assigneeOptions}
            tagRender={tagRender}
            optionRender={(option) => (
              <div className="flex items-center justify-between py-0.5">
                <span className="font-medium text-gray-900">{option.data.label}</span>
                {option.data.role && (
                  <span className="text-xs text-gray-400 font-normal">({option.data.role})</span>
                )}
              </div>
            )}
            filterOption={(input, option) => {
              const label = (option?.label ?? '').toString().toLowerCase();
              const role = (option?.role ?? '').toString().toLowerCase();
              const search = input.toLowerCase();
              return label.includes(search) || role.includes(search);
            }}
            maxTagCount={10}
            className="w-full min-h-9"
          />
        </Form.Item>

        <Form.Item 
          name="completionType" 
          label={<span className="text-xs sm:text-sm font-medium text-gray-700">Completion Type</span>} 
          tooltip="Shared: Any assignee completing the task completes it for everyone. Individual: Each assignee must complete it."
        >
          <Select className="w-full h-9">
            <Select.Option value="INDIVIDUAL">Individual (Requires completion from all assignees)</Select.Option>
            <Select.Option value="SHARED">Shared (Single completion marks task as done)</Select.Option>
          </Select>
        </Form.Item>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6 pt-2 border-t border-gray-100">
          <Button onClick={onCancel} className="w-full sm:w-auto h-9">
            Cancel
          </Button>
          <Button type="primary" htmlType="submit" loading={loading} className="w-full sm:w-auto h-9 font-medium shadow-xs">
            {initialValues ? 'Update Task' : 'Create Task'}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};
