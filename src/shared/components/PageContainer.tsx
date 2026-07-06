import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, className = '' }) => {
  return (
    <div className={`max-w-7xl mx-auto w-full ${className}`}>
      {children}
    </div>
  );
};
