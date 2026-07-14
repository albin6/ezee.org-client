import React, { useEffect, useState } from 'react';
import { Badge, Popover, List, Typography, Button } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useNotificationStore } from '../store/notification.store';
import { useNavigate } from 'react-router-dom';
import { PushNotificationManager } from '@/shared/components/PushNotificationManager';

const { Text } = Typography;

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationClick = async (notif: any) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    setOpen(false);
    if (notif.linkUrl) {
      navigate(notif.linkUrl);
    }
  };

  const content = (
    <div style={{ width: 'clamp(280px, 90vw, 350px)', maxHeight: 400, display: 'flex', flexDirection: 'column' }}>
      <div className="flex flex-col gap-3 px-4 py-3 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <Text strong className="text-base">Notifications</Text>
          <Button
            type="link"
            size="small"
            onClick={() => markAllAsRead()}
            disabled={unreadCount === 0}
            className="px-0"
          >
            Mark all as read
          </Button>
        </div>
        <div className="bg-gray-50 p-2 rounded border border-gray-100">
          <PushNotificationManager />
        </div>
      </div>
      <div className="overflow-y-auto overflow-x-hidden flex-1">
        <List
          itemLayout="horizontal"
          dataSource={notifications}
          locale={{ emptyText: 'No notifications' }}
          renderItem={(item) => (
            <List.Item
              className={`cursor-pointer transition-colors px-4 py-3 hover:bg-gray-50 ${!item.isRead ? 'bg-blue-50/30' : ''}`}
              onClick={() => handleNotificationClick(item)}
            >
              <List.Item.Meta
                className="w-full min-w-0"
                title={
                  <div className="flex justify-between items-start gap-2 w-full min-w-0">
                    <Text strong={!item.isRead} className="text-sm flex-1 min-w-0 break-words">
                      {item.title}
                    </Text>
                    {!item.isRead && <Badge status="processing" className="mt-1 flex-shrink-0" />}
                  </div>
                }
                description={
                  <div className="flex flex-col gap-1 mt-1 w-full min-w-0">
                    <Text type="secondary" className="text-xs break-words whitespace-pre-wrap min-w-0">{item.body}</Text>
                    <Text type="secondary" className="text-[10px]">
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      title={null}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      overlayInnerStyle={{ padding: 0 }}
    >
      <Badge count={unreadCount} overflowCount={99} offset={[-2, 2]}>
        <Button type="text" shape="circle" icon={<BellOutlined className="text-lg" />} />
      </Badge>
    </Popover>
  );
};
