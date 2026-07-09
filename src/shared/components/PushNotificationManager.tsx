import React, { useState, useEffect } from 'react';
import { Button, Tooltip, message } from 'antd';
import { BellOutlined, BellFilled } from '@ant-design/icons';
import { pushNotificationsApi } from '@/features/notifications/api/pushNotifications';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const PushNotificationManager: React.FC = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking push subscription:', error);
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        message.warning('Notification permission denied');
        setLoading(false);
        return;
      }

      const { data } = await pushNotificationsApi.getVapidPublicKey();
      const convertedVapidKey = urlBase64ToUint8Array(data.publicKey);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      await pushNotificationsApi.subscribe(subscription);
      setIsSubscribed(true);
      message.success('Push notifications enabled!');
    } catch (error: any) {
      console.error('Failed to subscribe:', error);
      message.error(error?.response?.data?.message || 'Failed to enable notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await pushNotificationsApi.unsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
        setIsSubscribed(false);
        message.success('Push notifications disabled');
      }
    } catch (error: any) {
      console.error('Failed to unsubscribe:', error);
      message.error(error?.response?.data?.message || 'Failed to disable notifications');
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported) return null;

  return (
    <Tooltip title={isSubscribed ? "Disable Notifications" : "Enable Notifications"}>
      <Button
        type="text"
        icon={isSubscribed ? <BellFilled className="text-purple-600 text-lg" /> : <BellOutlined className="text-gray-500 text-lg" />}
        onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
        loading={loading}
        className="flex items-center justify-center"
      />
    </Tooltip>
  );
};
