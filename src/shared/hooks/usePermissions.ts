import { useAuthStore } from '@/features/auth/store/auth.store';

export const usePermissions = () => {
  const user = useAuthStore((state) => state.user);

  const hasPermission = (permission: string) => {
    // Super admins have all permissions
    if (
      user?.type === 'super_admin' ||
      (user as any)?.role === 'Super Admin' ||
      (user as any)?.role?.name === 'Super Admin'
    ) {
      return true;
    }
    // Check against a user.permissions array
    return (user as any)?.permissions?.includes(permission) || false;
  };

  return { hasPermission };
};
