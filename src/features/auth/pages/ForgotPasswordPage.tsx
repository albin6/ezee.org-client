import React, { useState } from 'react';
import { Card, Form, Input, Button, Alert, Typography, Result } from 'antd';
import { MailOutlined, ArrowLeftOutlined, KeyOutlined, SyncOutlined } from '@ant-design/icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { forgotPasswordEmailSchema } from '../schemas/auth.schema';
import { authService } from '../services/auth.service';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;

export const ForgotPasswordPage: React.FC = () => {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string }>({
    resolver: zodResolver(forgotPasswordEmailSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: { email: string }) => {
    try {
      setLoading(true);
      setError(null);
      await authService.requestPasswordResetLink(data.email);
      setSubmittedEmail(data.email);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data?.message || 'Failed to send password reset link. Please check your email.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!submittedEmail) return;
    try {
      setLoading(true);
      setError(null);
      await authService.requestPasswordResetLink(submittedEmail);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data?.message || 'Failed to resend password reset link.');
      } else {
        setError('Could not resend link. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md shadow-xl border-0 rounded-xl overflow-hidden">
        {submittedEmail ? (
          /* Confirmation Screen after email is sent */
          <Result
            status="success"
            title="Password Reset Link Sent"
            subTitle={
              <div className="text-gray-600 text-sm mt-1">
                <Paragraph className="mb-2">
                  A new password setting link has been shared to:
                </Paragraph>
                <div className="font-semibold text-gray-800 text-base mb-3 break-all">
                  {submittedEmail}
                </div>
                <Paragraph className="text-gray-500 mb-3">
                  Please open the link from your email to set your new password.
                </Paragraph>
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 text-xs text-purple-700 font-medium my-3">
                  ⏳ The password reset link is active for <strong>15 minutes</strong>.
                </div>
              </div>
            }
            extra={[
              <Link to="/login" key="signin">
                <Button
                  type="primary"
                  size="large"
                  block
                  className="bg-purple-600 hover:bg-purple-700 font-medium mb-2"
                >
                  Return to Sign In
                </Button>
              </Link>,
              <div key="resend" className="text-center mt-3">
                <Button
                  type="link"
                  size="small"
                  onClick={handleResend}
                  loading={loading}
                  icon={<SyncOutlined />}
                  className="text-purple-600 hover:text-purple-700 text-xs"
                >
                  Didn't receive the email? Resend link
                </Button>
                <div className="mt-1">
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setSubmittedEmail(null);
                      setError(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ← Use a different email address
                  </Button>
                </div>
              </div>,
            ]}
          />
        ) : (
          /* Initial Screen: Enter Email */
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 text-purple-600 mb-3">
                <KeyOutlined style={{ fontSize: '24px' }} />
              </div>
              <Title level={2} className="mt-1 text-gray-900">Forgot Password</Title>
              <Text className="text-gray-500">
                Enter your registered email address and we will send you a link to reset your password.
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
                label={<span className="font-medium text-gray-700">Email Address</span>}
                validateStatus={errors.email ? 'error' : ''}
                help={errors.email?.message}
              >
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      size="large"
                      prefix={<MailOutlined className="text-gray-400" />}
                      placeholder="name@company.com"
                      autoComplete="email"
                    />
                  )}
                />
              </Form.Item>

              <Form.Item className="mt-6 mb-3">
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  loading={loading}
                  className="text-base font-medium bg-purple-600 hover:bg-purple-700"
                >
                  Send Reset Link
                </Button>
              </Form.Item>

              <div className="text-center mt-4">
                <Link
                  to="/login"
                  className="inline-flex items-center text-sm font-medium text-purple-600 hover:text-purple-700"
                >
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
