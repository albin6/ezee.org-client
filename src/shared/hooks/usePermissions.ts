import { useAuthStore } from '@/features/auth/store/auth.store';

export const usePermissions = () => {
  const user = useAuthStore((state) => state.user);

  const hasPermission = (permission: string) => {
    // Super admins have all permissions
    if (user?.type === 'super_admin') {
      return true;
    }
    // Future proofing: Check against a user.permissions array if added later
    return (user as any)?.permissions?.includes(permission) || false;
  };

  return { hasPermission };
};
