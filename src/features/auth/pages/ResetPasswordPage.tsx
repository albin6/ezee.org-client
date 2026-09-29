import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Alert, Typography, Result } from 'antd';
import { LockOutlined, SafetyOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { resetPasswordSchema } from '../schemas/auth.schema';
import { authService } from '../services/auth.service';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;

type ResetPasswordFormInputs = {
  newPassword: string;
  confirmPassword: string;
};

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const navigate = useNavigate();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormInputs>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Countdown timer redirect after successful reset
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isSuccess && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isSuccess && countdown === 0) {
      navigate('/login');
    }
    return () => clearInterval(timer);
  }, [isSuccess, countdown, navigate]);

  const onSubmit = async (data: ResetPasswordFormInputs) => {
    if (!token || !email) {
      setError('Missing reset token or email. Please request a new password reset link.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await authService.resetPassword({
        token,
        email,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      setIsSuccess(true);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data?.message || 'Password reset failed. The link may have expired.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md shadow-xl border-0 rounded-xl overflow-hidden text-center p-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-3">
            <LockOutlined style={{ fontSize: '24px' }} />
          </div>
          <Title level={3} className="text-gray-900 mt-2">Invalid Reset Link</Title>
          <Paragraph className="text-gray-500 mb-6">
            The password reset link is invalid or incomplete. Please request a fresh reset link.
          </Paragraph>
          <Link to="/forgot-password">
            <Button type="primary" size="large" block className="bg-purple-600 hover:bg-purple-700">
              Request New Reset Link
            </Button>
          </Link>
          <div className="mt-4">
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">
              Return to Login
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md shadow-xl border-0 rounded-xl overflow-hidden">
        {isSuccess ? (
          <Result
            status="success"
            title="Password Reset Successful"
            subTitle={
              <div className="text-gray-600 text-sm mt-1">
                <Paragraph>
                  Your new password has been established. You will be automatically redirected to the login page in{' '}
                  <strong className="text-purple-600">{countdown}s</strong>.
                </Paragraph>
              </div>
            }
            extra={[
              <Button
                type="primary"
                key="login"
                size="large"
                block
                onClick={() => navigate('/login')}
                className="bg-purple-600 hover:bg-purple-700 font-medium"
              >
                Sign In Now
              </Button>,
            ]}
          />
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 text-purple-600 mb-3">
                <SafetyOutlined style={{ fontSize: '24px' }} />
              </div>
              <Title level={2} className="mt-1 text-gray-900">Set New Password</Title>
              <Text className="text-gray-500">
                Choose a strong password for <strong className="text-gray-700">{email}</strong>
              </Text>
            </div>

            {error && (
              <Alert
                message={error}
                type="error"
                showIcon
                className="mb-6"
                closable
                onClose={() => setError(null)}
              />
            )}

            <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
              <Form.Item
                label={<span className="font-medium text-gray-700">New Password</span>}
                validateStatus={errors.newPassword ? 'error' : ''}
                help={errors.newPassword?.message}
              >
                <Controller
                  name="newPassword"
                  control={control}
                  render={({ field }) => (
                    <Input.Password
                      {...field}
                      size="large"
                      prefix={<LockOutlined className="text-gray-400" />}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                    />
                  )}
                />
              </Form.Item>

              <Form.Item
                label={<span className="font-medium text-gray-700">Confirm New Password</span>}
                validateStatus={errors.confirmPassword ? 'error' : ''}
                help={errors.confirmPassword?.message}
              >
                <Controller
                  name="confirmPassword"
                  control={control}
                  render={({ field }) => (
                    <Input.Password
                      {...field}
                      size="large"
                      prefix={<LockOutlined className="text-gray-400" />}
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                    />
                  )}
                />
              </Form.Item>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs text-gray-500 mb-6">
                💡 Tip: Use a combination of uppercase letters, numbers, and symbols for high security.
              </div>

              <Form.Item className="mb-3">
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  loading={loading}
                  className="text-base font-medium bg-purple-600 hover:bg-purple-700"
                >
                  Save New Password
                </Button>
              </Form.Item>

              <div className="text-center mt-4">
                <Link to="/login" className="inline-flex items-center text-sm font-medium text-purple-600 hover:text-purple-700">
                  <ArrowLeftOutlined className="mr-1.5" /> Back to Sign In
                </Link>
              </div>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
};
