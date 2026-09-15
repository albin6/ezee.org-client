import React from 'react';
import { Avatar, Tag, Typography } from 'antd';
import { type Ticket } from '../api/ticket.service';

const { Text } = Typography;

interface TicketAssigneesSectionProps {
  ticket: Ticket;
  canAddAssignee: boolean;
}

export const TicketAssigneesSection: React.FC<TicketAssigneesSectionProps> = ({
  ticket,
  canAddAssignee,
}) => {
  return (
    <div className="space-y-4">
      {/* 1. Original Creator / Assignor Section */}
      <div>
        <Text type="secondary" className="block text-xs uppercase tracking-wider font-semibold mb-1.5 text-gray-500">
          Created By
        </Text>
        <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200/80">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar size="small" className="bg-purple-600 text-white font-semibold shrink-0">
              {ticket.createdBy?.name?.charAt(0).toUpperCase() || 'C'}
            </Avatar>
            <div className="flex flex-col min-w-0">
              <Text className="text-xs font-semibold text-gray-800 truncate leading-tight">
                {ticket.createdBy?.name || 'Unknown'}
              </Text>
              <Text type="secondary" className="text-[10px] truncate text-gray-500">
                {ticket.team?.name || 'General Team'}
              </Text>
            </div>
          </div>
          <Tag color="purple" className="text-[10px] rounded-full mr-0 shrink-0 font-medium border-purple-200">
            Assignor
          </Tag>
        </div>
      </div>

      {/* 2. Assignees List Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Text type="secondary" className="text-xs uppercase tracking-wider font-semibold text-gray-500">
            Assignees ({ticket.assignees?.length || 0})
          </Text>
        </div>

        {ticket.assignees && ticket.assignees.length > 0 ? (
          <div className="flex flex-col gap-1.5 w-full">
            {ticket.assignees.map((a: any) => {
              const uid = a.userId || a.user?.id;
              // Check if added after ticket creation (more than 60 seconds after)
              const isOriginal = a.createdAt && ticket.createdAt
                ? Math.abs(new Date(a.createdAt).getTime() - new Date(ticket.createdAt).getTime()) < 60000
                : true;

              return (
                <div
                  key={uid || Math.random()}
                  className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200/70 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar size="small" className="bg-blue-600 text-white font-semibold shrink-0">
                      {a.user?.name?.charAt(0).toUpperCase() || 'U'}
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <Text className="text-xs font-medium text-gray-800 truncate leading-tight">
                        {a.user?.name || 'User'}
                      </Text>
                      {a.user?.email && (
                        <Text type="secondary" className="text-[10px] truncate text-gray-400">
                          {a.user.email}
                        </Text>
                      )}
                    </div>
                  </div>
                  <Tag
                    color={isOriginal ? 'blue' : 'cyan'}
                    className="text-[10px] rounded-full mr-0 shrink-0 font-medium"
                  >
                    {isOriginal ? 'Assignee' : 'Added'}
                  </Tag>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3 text-center rounded-lg bg-gray-50 border border-dashed border-gray-200 text-xs text-gray-400 italic">
            No assignees assigned yet
          </div>
        )}

        {/* Subtle tip informing users that @ in chat adds assignees */}
        {canAddAssignee && ticket.status !== 'CLOSED' && (
          <div className="mt-3 p-2 rounded-lg bg-blue-50/70 border border-blue-100/80 text-center">
            <Text type="secondary" className="text-[11px] text-blue-700 flex items-center justify-center gap-1">
              <span>💬</span>
              <span>Type <code className="bg-blue-100/90 text-blue-800 font-semibold px-1 py-0.5 rounded">@name</code> in chat to mention or add assignees</span>
            </Text>
          </div>
        )}
      </div>
    </div>
  );
};
