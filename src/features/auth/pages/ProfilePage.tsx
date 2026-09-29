import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Spin, Alert, Tag, message, Form, Input, Button, Typography, Space } from 'antd';
import { LockOutlined, CheckCircleOutlined, SafetyOutlined, KeyOutlined } from '@ant-design/icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { verifyCurrentPasswordSchema, profileSetNewPasswordSchema } from '../schemas/auth.schema';
import axios from 'axios';

const { Paragraph } = Typography;

export const ProfilePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, setUser } = useAuthStore();

  // Password reset state in profile
  const [currentPasswordVerified, setCurrentPasswordVerified] = useState(false);
  const [verifiedCurrentPassword, setVerifiedCurrentPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Form for verifying current password
  const {
    control: verifyControl,
    handleSubmit: handleVerifySubmit,
    reset: resetVerifyForm,
    formState: { errors: verifyErrors },
  } = useForm<{ currentPassword: string }>({
    resolver: zodResolver(verifyCurrentPasswordSchema),
    defaultValues: { currentPassword: '' },
  });

  // Form for setting new password & confirm password
  const {
    control: changeControl,
    handleSubmit: handleChangeSubmit,
    reset: resetChangeForm,
    formState: { errors: changeErrors },
  } = useForm<{ newPassword: string; confirmPassword: string }>({
    resolver: zodResolver(profileSetNewPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        let response;
        if (user?.type === 'user' || (user as any)?.email) {
          response = await authService.getUserProfile();
        } else {
          try {
            response = await authService.getProfile();
          } catch (e: any) {
            if (e.response?.status === 403) {
              response = await authService.getUserProfile();
            } else {
              throw e;
            }
          }
        }
        setUser(response.data);
      } catch {
        message.error('Failed to load profile. Please try again.');
        setError('Failed to load profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [setUser]);

  const onVerifyCurrentPassword = async (data: { currentPassword: string }) => {
    try {
      setVerifyingPassword(true);
      setPasswordError(null);
      await authService.verifyCurrentPassword(data.currentPassword);
      setVerifiedCurrentPassword(data.currentPassword);
      setCurrentPasswordVerified(true);
      message.success('Current password verified. You may now set your new password.');
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setPasswordError(err.response.data?.message || 'Current password is incorrect.');
      } else {
        setPasswordError('Failed to verify password. Please try again.');
      }
    } finally {
      setVerifyingPassword(false);
    }
  };

  const onSaveNewPassword = async (data: { newPassword: string; confirmPassword: string }) => {
    if (!verifiedCurrentPassword) {
      setPasswordError('Please verify your current password first.');
      setCurrentPasswordVerified(false);
      return;
    }

    try {
      setSavingPassword(true);
      setPasswordError(null);
      await authService.changePassword({
        currentPassword: verifiedCurrentPassword,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      message.success('Password updated successfully!');
      // Reset state back to initial locked mode
      setCurrentPasswordVerified(false);
      setVerifiedCurrentPassword('');
      resetVerifyForm();
      resetChangeForm();
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setPasswordError(err.response.data?.message || 'Failed to update password.');
      } else {
        setPasswordError('An error occurred while updating password.');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCancelPasswordReset = () => {
    setCurrentPasswordVerified(false);
    setVerifiedCurrentPassword('');
    setPasswordError(null);
    resetVerifyForm();
    resetChangeForm();
  };

  if (loading && !user) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <Alert message={error} type="error" showIcon className="my-4" />;
  }

  return (
    <PageContainer className="max-w-4xl space-y-6">
      <PageHeader
        title="User Profile"
        description="Manage your enterprise profile and account security."
      />

      {/* Profile Details Card */}
      <Card title={<span className="font-semibold text-gray-800">Account Information</span>}>
        <Descriptions bordered column={{ xxl: 1, xl: 1, lg: 1, md: 1, sm: 1, xs: 1 }}>
          {user?.type === 'user' ? (
            <>
              <Descriptions.Item label="Name">
                <span className="font-medium">{(user as any)?.name}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                <span className="font-medium">{(user as any)?.email}</span>
              </Descriptions.Item>
            </>
          ) : (
            <Descriptions.Item label="Identifier">
              <span className="font-medium">{(user as any)?.identifier}</span>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Account Type">
            <Tag color="purple" className="px-3 py-1 text-sm rounded-full font-medium">
              {user?.type ? user.type.toUpperCase().replace('_', ' ') : ((user as any)?.email ? 'USER' : 'SUPER ADMIN')}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Reset Password Card */}
      <Card
        title={
          <div className="flex items-center space-x-2">
            <SafetyOutlined className="text-purple-600 text-lg" />
            <span className="font-semibold text-gray-800">Reset Password</span>
          </div>
        }
      >
        <div className="max-w-lg">
          <Paragraph className="text-gray-500 text-sm mb-4">
            To reset your password, please confirm your current password. Once verified, you will be able to enter and confirm your new password.
          </Paragraph>

          {passwordError && (
            <Alert
              message={passwordError}
              type="error"
              showIcon
              className="mb-4"
              closable
              onClose={() => setPasswordError(null)}
            />
          )}

          {/* STEP 1: Verify Current Password */}
          {!currentPasswordVerified ? (
            <Form layout="vertical" onFinish={handleVerifySubmit(onVerifyCurrentPassword)}>
              <Form.Item
                label={<span className="font-medium text-gray-700">Current Password</span>}
                validateStatus={verifyErrors.currentPassword ? 'error' : ''}
                help={verifyErrors.currentPassword?.message}
              >
                <Controller
                  name="currentPassword"
                  control={verifyControl}
                  render={({ field }) => (
                    <Input.Password
                      {...field}
                      size="large"
                      prefix={<KeyOutlined className="text-gray-400" />}
                      placeholder="Enter your current password"
                      autoComplete="current-password"
                    />
                  )}
                />
              </Form.Item>

              <Form.Item className="mb-0">
                <Button
                  type="primary"
                  htmlType="submit"
                  size="middle"
                  loading={verifyingPassword}
                  className="bg-purple-600 hover:bg-purple-700 font-medium"
                >
                  Verify Current Password
                </Button>
              </Form.Item>
            </Form>
          ) : (
            /* STEP 2: Current password is correct -> Enter password and confirm password fields */
            <div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between mb-5">
                <div className="flex items-center space-x-2 text-emerald-800 font-medium text-sm">
                  <CheckCircleOutlined className="text-emerald-600 text-base" />
                  <span>Current password verified successfully</span>
                </div>
                <Button
                  size="small"
                  type="link"
                  onClick={handleCancelPasswordReset}
                  className="text-gray-500 hover:text-gray-700 text-xs"
                >
                  Change
                </Button>
              </div>

              <Form
                layout="vertical"
                onFinish={handleChangeSubmit((data) => onSaveNewPassword(data))}
              >
                <Form.Item
                  label={<span className="font-medium text-gray-700">New Password</span>}
                  validateStatus={changeErrors.newPassword ? 'error' : ''}
                  help={changeErrors.newPassword?.message}
                >
                  <Controller
                    name="newPassword"
                    control={changeControl}
                    render={({ field }) => (
                      <Input.Password
                        {...field}
                        size="large"
                        prefix={<LockOutlined className="text-gray-400" />}
                        placeholder="Enter new password (at least 8 characters)"
                        autoComplete="new-password"
                      />
                    )}
                  />
                </Form.Item>

                <Form.Item
                  label={<span className="font-medium text-gray-700">Confirm New Password</span>}
                  validateStatus={changeErrors.confirmPassword ? 'error' : ''}
                  help={changeErrors.confirmPassword?.message}
                >
                  <Controller
                    name="confirmPassword"
                    control={changeControl}
                    render={({ field }) => (
                      <Input.Password
                        {...field}
                        size="large"
                        prefix={<LockOutlined className="text-gray-400" />}
                        placeholder="Confirm your new password"
                        autoComplete="new-password"
                      />
                    )}
                  />
                </Form.Item>

                <Space className="mt-2">
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="middle"
                    loading={savingPassword}
                    className="bg-purple-600 hover:bg-purple-700 font-medium"
                  >
                    Set New Password
                  </Button>
                  <Button
                    onClick={handleCancelPasswordReset}
                    size="middle"
                    className="text-gray-600"
                  >
                    Cancel
                  </Button>
                </Space>
              </Form>
            </div>
          )}
        </div>
      </Card>
    </PageContainer>
  );
};
