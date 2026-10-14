import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Drawer, Avatar, Empty, Spin, Button, Tooltip } from 'antd';
import { CloseOutlined, UserOutlined, DeleteOutlined } from '@ant-design/icons';
import type { MessageReactionMember } from '../api/ticket.service';

export interface MessageReactionDetailsModalProps {
  open: boolean;
  onClose: () => void;
  messageId: string | null;
  ticketId: string;
  initialEmoji?: string | null;
  reactions: MessageReactionMember[];
  currentUserId?: string;
  onToggleReaction?: (emoji: string) => void;
  loading?: boolean;
}

export const MessageReactionDetailsModal: React.FC<MessageReactionDetailsModalProps> = ({
  open,
  onClose,
  messageId: _messageId,
  initialEmoji,
  reactions = [],
  currentUserId,
  onToggleReaction,
  loading = false,
}) => {
  const [selectedEmoji, setSelectedEmoji] = useState<string>('ALL');
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute available emoji groupings
  const emojiGroups = useMemo(() => {
    const map = new Map<string, MessageReactionMember[]>();
    for (const r of reactions) {
      const list = map.get(r.reaction) || [];
      list.push(r);
      map.set(r.reaction, list);
    }
    return map;
  }, [reactions]);

  const uniqueEmojis = useMemo(() => {
    return Array.from(emojiGroups.keys()).sort((a, b) => {
      const countA = emojiGroups.get(a)?.length || 0;
      const countB = emojiGroups.get(b)?.length || 0;
      return countB - countA;
    });
  }, [emojiGroups]);

  // Set initial selected emoji when opened or when initialEmoji changes
  useEffect(() => {
    if (open) {
      if (initialEmoji && emojiGroups.has(initialEmoji)) {
        setSelectedEmoji(initialEmoji);
      } else {
        setSelectedEmoji('ALL');
      }
    }
  }, [open, initialEmoji, emojiGroups]);

  // Filter reactions based on active tab
  const displayedReactions = useMemo(() => {
    if (selectedEmoji === 'ALL') {
      return reactions;
    }
    return emojiGroups.get(selectedEmoji) || [];
  }, [selectedEmoji, reactions, emojiGroups]);

  // If all reactions disappear while open (e.g. from real-time socket events), handle gracefully
  const hasNoReactions = reactions.length === 0 && !loading;

  const content = (
    <div className="flex flex-col max-h-[70vh] sm:max-h-[380px]" data-testid="reaction-details-content">
      {/* Emoji Tabs Header */}
      {reactions.length > 0 && (
        <div
          className="flex items-center gap-1.5 pb-2.5 mb-2 border-b border-gray-100 overflow-x-auto no-scrollbar shrink-0"
          data-testid="reaction-emoji-tabs"
        >
          {uniqueEmojis.length > 1 && (
            <button
              type="button"
              data-testid="reaction-tab-ALL"
              onClick={() => setSelectedEmoji('ALL')}
              className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors border ${
                selectedEmoji === 'ALL'
                  ? 'bg-gray-900 text-white border-gray-900 shadow-2xs'
                  : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200/70'
              }`}
            >
              All {reactions.length}
            </button>
          )}

          {uniqueEmojis.map((emoji) => {
            const count = emojiGroups.get(emoji)?.length || 0;
            const isSelected = selectedEmoji === emoji || (uniqueEmojis.length === 1 && selectedEmoji === 'ALL');
            return (
              <button
                key={emoji}
                type="button"
                data-testid={`reaction-tab-${emoji}`}
                onClick={() => setSelectedEmoji(emoji)}
                className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-gray-900 text-white border-gray-900 shadow-2xs'
                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200/70'
                }`}
              >
                <span>{emoji}</span>
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Member List */}
      <div className="flex-1 overflow-y-auto py-1 space-y-2 pr-0.5" data-testid="reaction-members-list">
        {loading ? (
          <div className="flex justify-center items-center py-8" data-testid="reaction-details-loading">
            <Spin />
          </div>
        ) : hasNoReactions ? (
          <div className="py-8 text-center" data-testid="reaction-details-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No reactions on this message"
            />
          </div>
        ) : displayedReactions.length === 0 ? (
          <div className="py-6 text-center" data-testid="reaction-tab-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No members found for this reaction"
            />
          </div>
        ) : (
          displayedReactions.map((item, idx) => {
            const uid = item.userId || item.user?.id || `anon-${idx}`;
            const userName = item.user?.name || (item.userId === currentUserId ? 'You' : 'Member');
            const isMe = Boolean(currentUserId && (item.userId === currentUserId || item.user?.id === currentUserId));
            const initial = (userName || 'U').charAt(0).toUpperCase();

            return (
              <div
                key={`${uid}-${item.reaction}-${idx}`}
                data-testid={`reaction-member-row-${uid}`}
                className="flex items-center justify-between p-2 sm:p-2.5 rounded-lg hover:bg-gray-50/80 transition-colors border border-gray-100/70 bg-white"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar
                    size={36}
                    className="bg-emerald-50 text-emerald-700 font-semibold text-xs shrink-0 border border-emerald-200"
                    icon={!userName ? <UserOutlined /> : undefined}
                  >
                    {userName ? initial : undefined}
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-900 text-xs sm:text-sm truncate">
                        {userName}
                      </span>
                      {isMe && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          You
                        </span>
                      )}
                    </div>
                    {(item.user?.designation || item.user?.email) && (
                      <div className="text-[11px] text-gray-500 truncate mt-0.5">
                        {item.user.designation || item.user.email}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-lg leading-none"
                    title={`Reacted with ${item.reaction}`}
                    data-testid={`reaction-emoji-badge-${uid}`}
                  >
                    {item.reaction}
                  </span>

                  {isMe && onToggleReaction && (
                    <Tooltip title="Click to remove your reaction">
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined className="text-gray-400 hover:text-red-500 text-xs" />}
                        onClick={() => onToggleReaction(item.reaction)}
                        data-testid={`remove-my-reaction-btn-${item.reaction}`}
                        className="text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded h-6 w-6 flex items-center justify-center"
                        aria-label="Remove reaction"
                      />
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const titleNode = (
    <div className="flex items-center justify-between w-full pr-1">
      <span className="font-semibold text-gray-900 text-sm sm:text-base">
        {reactions.length > 0
          ? `${reactions.length} ${reactions.length === 1 ? 'reaction' : 'reactions'}`
          : 'Reactions'}
      </span>
      {isMobile && (
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-full cursor-pointer"
          data-testid="close-reaction-details-btn-mobile"
          aria-label="Close"
        >
          <CloseOutlined className="text-sm" />
        </button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onClose={onClose}
        placement="bottom"
        height="auto"
        closable={false}
        title={titleNode}
        styles={{
          wrapper: { maxHeight: '80vh' },
          content: { borderTopLeftRadius: '16px', borderTopRightRadius: '16px' },
          header: { borderBottom: '1px solid #f0f0f0', padding: '14px 16px' },
          body: { padding: '12px 16px 20px', maxHeight: 'calc(80vh - 60px)', overflowY: 'auto' },
        }}
        data-testid="reaction-details-drawer"
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={titleNode}
      width={380}
      centered
      destroyOnClose
      closeIcon={<CloseOutlined data-testid="close-reaction-details-btn" />}
      styles={{
        header: { borderBottom: '1px solid #f3f4f6', paddingBottom: '10px', marginBottom: '12px' },
        body: { padding: '0px' },
      }}
      data-testid="reaction-details-modal"
    >
      {content}
    </Modal>
  );
};
