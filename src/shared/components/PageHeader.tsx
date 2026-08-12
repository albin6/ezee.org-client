import React from 'react';
import { Typography, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface PageHeaderProps {
  title: string;
  description?: string;
  extra?: React.ReactNode;
  onBack?: () => void | Promise<void>;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, extra, onBack }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={onBack} 
            className="flex items-center justify-center -ml-3 text-gray-500 hover:text-gray-900"
          />
        )}
        <div>
          <Title level={3} className="mb-1! text-gray-900">{title}</Title>
          {description && <Text className="text-gray-500">{description}</Text>}
        </div>
      </div>
      {extra && <div className="flex items-center gap-3 flex-wrap">{extra}</div>}
    </div>
  );
};
