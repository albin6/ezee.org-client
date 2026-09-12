import React from 'react';
import { PageContainer } from '@/shared/components/PageContainer';
import { ChatTicketCreator } from '../components/ChatTicketCreator';

export const CreateTicketPage: React.FC = () => {
  return (
    <PageContainer className="!p-2 sm:!p-4 max-w-6xl">
      <ChatTicketCreator />
    </PageContainer>
  );
};
