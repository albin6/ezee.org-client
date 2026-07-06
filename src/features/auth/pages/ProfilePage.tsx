import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Spin, Alert, Tag, message } from 'antd';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';

export const ProfilePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, setUser } = useAuthStore();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        let response;
        // Check local storage or existing user state to know which profile endpoint to hit
        // If the user state already exists and it's a standard user (has email or type is user), hit the user endpoint.
        if (user?.type === 'user' || (user as any)?.email) {
          response = await authService.getUserProfile();
        } else {
          try {
            response = await authService.getProfile();
          } catch (e: any) {
            // Fallback if we guessed wrong (e.g., missing user state but has a user token)
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
    <PageContainer className="max-w-4xl">
      <PageHeader 
        title="Admin Profile"
        description="View your current administrative session details."
      />

      <Card>
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
            <Tag color="purple" className="px-3 py-1 text-sm rounded-full">
              {user?.type ? user.type.toUpperCase().replace('_', ' ') : ((user as any)?.email ? 'USER' : 'SUPER ADMIN')}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </PageContainer>
  );
};
