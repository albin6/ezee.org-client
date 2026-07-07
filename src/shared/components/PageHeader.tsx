import React from 'react';
import { Typography } from 'antd';

const { Title, Text } = Typography;

interface PageHeaderProps {
  title: string;
  description?: string;
  extra?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, extra }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <Title level={3} className="!mb-1 text-gray-900">{title}</Title>
        {description && <Text className="text-gray-500">{description}</Text>}
      </div>
      {extra && <div className="flex items-center gap-3 flex-wrap">{extra}</div>}
    </div>
  );
};
