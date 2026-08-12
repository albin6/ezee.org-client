import React, { useState } from 'react';
import { Card, Form, Input, Button, Alert, Typography, Tabs } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Navigate } from 'react-router-dom';
import { adminLoginSchema } from '../schemas/auth.schema';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { z } from 'zod';
import axios from 'axios';

const { Title, Text } = Typography;

type LoginFormInputs = z.infer<typeof adminLoginSchema>;

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginType, setLoginType] = useState<'user' | 'admin'>('user');
  
  const navigate = useNavigate();
  const { login, isAuthenticated, setUser } = useAuthStore();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: LoginFormInputs) => {
    try {
      setLoading(true);
      setError(null);
      let response;
      let profile;

      if (loginType === 'admin') {
        response = await authService.login(data);
        login(response.data.accessToken);
        profile = await authService.getProfile();
      } else {
        response = await authService.userLogin(data);
        login(response.data.accessToken);
        profile = await authService.getUserProfile();
      }

      setUser(profile.data);
      
      navigate('/dashboard');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || 'Invalid credentials');
      } else {
        setError('An unexpected error occurred. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md shadow-xl border-0 rounded-xl overflow-hidden">
        <div className="text-center mb-6">
          <Title level={2} className="mt-2 text-gray-900">Sign In</Title>
          <Text className="text-gray-500">Access your enterprise dashboard</Text>
        </div>

        <Tabs 
          activeKey={loginType} 
          onChange={(key) => setLoginType(key as 'user' | 'admin')} 
          centered
          className="mb-6"
          items={[
            { key: 'user', label: 'User Login' },
            { key: 'admin', label: 'Admin Login' }
          ]}
        />

        {error && (
          <Alert
            title={error}
            type="error"
            showIcon
            className="mb-6"
            closable
            onClose={() => setError(null)}
          />
        )}

        <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
          <Form.Item
            validateStatus={errors.identifier ? 'error' : ''}
            help={errors.identifier?.message}
          >
            <Controller
              name="identifier"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  size="large"
                  prefix={<UserOutlined className="text-gray-400" />}
                  placeholder="Email or Phone number"
                  autoComplete="username"
                />
              )}
            />
          </Form.Item>

          <Form.Item
            validateStatus={errors.password ? 'error' : ''}
            help={errors.password?.message}
          >
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  size="large"
                  prefix={<LockOutlined className="text-gray-400" />}
                  placeholder="Password"
                  autoComplete="current-password"
                />
              )}
            />
          </Form.Item>

          <Form.Item className="mt-8 mb-0">
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              className="text-lg font-medium"
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
