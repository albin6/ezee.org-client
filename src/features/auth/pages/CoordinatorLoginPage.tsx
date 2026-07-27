import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { authService } from '../services/auth.service';
import { PhoneOutlined, LockOutlined } from '@ant-design/icons';

export const CoordinatorLoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state: any) => state.login);
  const setUser = useAuthStore((state: any) => state.setUser);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const response = await authService.coordinatorLogin({
        identifier: values.phone,
        password: values.password,
      });

      login(response.data.accessToken);
      const profile = await authService.getUserProfile();
      setUser(profile.data as any);
      message.success('Login successful');
      navigate('/foundation/threads');
    } catch (error: any) {
      console.error("LOGIN ERROR:", error);
      message.error(error.message || error.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-xl rounded-2xl border-0 overflow-hidden">
        <div className="text-center mb-8">
          <Typography.Title level={2} className="mb-2!">
            Coordinator Portal
          </Typography.Title>
          <Typography.Text type="secondary">
            Sign in to access your exam threads
          </Typography.Text>
        </div>

        <Form
          name="coordinator_login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
          requiredMark={false}
        >
          <Form.Item
            name="phone"
            rules={[{ required: true, message: 'Please input your phone number!' }]}
          >
            <Input 
              prefix={<PhoneOutlined className="text-gray-400" />} 
              placeholder="Phone Number" 
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your Password!' }]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="Password"
            />
          </Form.Item>

          <Form.Item className="mb-0 mt-8">
            <Button 
              type="primary" 
              htmlType="submit" 
              className="w-full h-12 text-base font-semibold"
              loading={loading}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
