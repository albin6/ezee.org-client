import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Avatar, Tag, Typography, Input, Button, Spin, message } from 'antd';
import { PlusOutlined, CloseOutlined, SearchOutlined, UserAddOutlined } from '@ant-design/icons';
import { ticketService, type Ticket, type MentionUser } from '../api/ticket.service';
import { useTicketStore } from '../store/ticket.store';

const { Text } = Typography;

interface TicketAssigneesSectionProps {
  ticket: Ticket;
  canAddAssignee: boolean;
}

export const TicketAssigneesSection: React.FC<TicketAssigneesSectionProps> = ({
  ticket,
  canAddAssignee,
}) => {
  const { addAssignee } = useTicketStore();
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all mentionable users across teams
  useEffect(() => {
    let isMounted = true;
    setIsLoadingUsers(true);
    ticketService.getUsersMentionLookup()
      .then((users) => {
        if (isMounted) {
          setMentionUsers(users || []);
          setIsLoadingUsers(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load mention users', err);
        if (isMounted) setIsLoadingUsers(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isInputOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
      setHighlightedIndex(0);
    }
  }, [isInputOpen]);

  // Set of already assigned user IDs
  const assignedUserIds = useMemo(() => {
    const ids = new Set<string>();
    ticket.assignees?.forEach((a: any) => {
      const uid = a.userId || a.user?.id;
      if (uid) ids.add(uid);
    });
    return ids;
  }, [ticket.assignees]);

  // Filter users based on query
  const filteredUsers = useMemo(() => {
    const rawQuery = searchQuery.startsWith('@') ? searchQuery.slice(1) : searchQuery;
    const cleanQuery = rawQuery.trim().toLowerCase();

    if (!cleanQuery) return mentionUsers;

    return mentionUsers.filter((u) =>
      u.name.toLowerCase().includes(cleanQuery) ||
      u.email.toLowerCase().includes(cleanQuery) ||
      (u.teamName && u.teamName.toLowerCase().includes(cleanQuery)) ||
      (u.designation && u.designation.toLowerCase().includes(cleanQuery))
    );
  }, [mentionUsers, searchQuery]);

  // Handle adding an assignee
  const handleSelectUser = async (selectedUser: MentionUser) => {
    if (assignedUserIds.has(selectedUser.id)) {
      message.warning(`${selectedUser.name} is already assigned to this ticket`);
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addAssignee(ticket.id, selectedUser.id);
      message.success(`Added ${selectedUser.name} as an assignee`);
      setIsInputOpen(false);
      setSearchQuery('');
    } catch (err: any) {
      message.error(err.message || 'Failed to add assignee');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsInputOpen(false);
      return;
    }

    if (filteredUsers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filteredUsers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredUsers[highlightedIndex];
      if (target) {
        handleSelectUser(target);
      }
    }
  };

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
          {canAddAssignee && ticket.status !== 'CLOSED' && !isInputOpen && (
            <Button
              type="link"
              size="small"
              icon={<UserAddOutlined />}
              onClick={() => {
                setIsInputOpen(true);
                setSearchQuery('@');
              }}
              className="!p-0 !h-auto text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Add (@)
            </Button>
          )}
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
      </div>

      {/* 3. Add Assignee Input & Mention Autocomplete Dropdown */}
      {canAddAssignee && ticket.status !== 'CLOSED' && (
        <div className="relative">
          {isInputOpen ? (
            <div className="space-y-2 pt-1 animate-fadeIn">
              <div className="flex items-center gap-1.5">
                <Input
                  ref={inputRef}
                  placeholder="Type @ or user name to assign..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isSubmitting}
                  prefix={<SearchOutlined className="text-gray-400 text-xs" />}
                  size="middle"
                  className="rounded-lg text-xs"
                />
                <Button
                  size="middle"
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={() => setIsInputOpen(false)}
                  className="text-gray-400 hover:text-gray-600 shrink-0"
                />
              </div>

              {/* Mention Suggestions Popover Dropdown */}
              <div
                ref={dropdownRef}
                className="w-full bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 max-h-56 overflow-y-auto"
              >
                <div className="px-3 py-1.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-medium">
                  <span>Mention user to assign (cross-team)</span>
                  {isLoadingUsers && <Spin size="small" />}
                </div>

                {filteredUsers.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {filteredUsers.map((user, idx) => {
                      const isAlreadyAssigned = assignedUserIds.has(user.id);
                      const isHighlighted = idx === highlightedIndex;

                      return (
                        <div
                          key={user.id}
                          onClick={() => !isAlreadyAssigned && handleSelectUser(user)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          className={`px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                            isAlreadyAssigned
                              ? 'opacity-50 cursor-not-allowed bg-gray-50/50'
                              : isHighlighted
                              ? 'bg-blue-50 text-blue-900 cursor-pointer'
                              : 'hover:bg-gray-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden min-w-0">
                            <Avatar size="small" className="bg-blue-500 text-white shrink-0 text-xs">
                              {user.name.charAt(0).toUpperCase()}
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold text-gray-800 truncate">
                                {user.name}
                              </span>
                              <span className="text-[10px] text-gray-400 truncate">
                                {user.designation || user.email}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {user.teamName && (
                              <Tag color="geekblue" className="text-[9px] rounded-full mr-0 px-1.5 py-0">
                                {user.teamName}
                              </Tag>
                            )}
                            {isAlreadyAssigned && (
                              <Tag color="default" className="text-[9px] rounded-full mr-0 px-1.5 py-0 text-gray-400">
                                Assigned
                              </Tag>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-gray-400">
                    No matching users found
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                setIsInputOpen(true);
                setSearchQuery('@');
              }}
              className="w-full text-xs text-blue-600 border-blue-200 hover:border-blue-400 hover:text-blue-700 rounded-lg flex items-center justify-center gap-1 h-8"
            >
              Add Assignee (@)
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
