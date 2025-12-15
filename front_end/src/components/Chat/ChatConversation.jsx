import { Box, Button } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import Message from "./Message";
import { FiChevronDown } from "react-icons/fi";
import { IconButton } from "@chakra-ui/react";
export default function ChatConversation({
  activeUser,
  messages,
  currentUserId,
  peerSeen,
  onLoadMore, // ⬆️ load tin cũ
}) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);

  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showNewMsgBtn, setShowNewMsgBtn] = useState(false);

  // detect scroll
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;

    const threshold = 500;
    const distanceToBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;

    const nearBottom = distanceToBottom < threshold;
    setIsNearBottom(nearBottom);

    if (nearBottom) {
      setShowNewMsgBtn(false);
    }

    // ⬆️ load more when scroll to top
    if (el.scrollTop === 0) {
      onLoadMore?.();
    }
  };

  // auto scroll
  useEffect(() => {
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      setShowNewMsgBtn(true);
    }
  }, [messages, isNearBottom]);

  if (!activeUser) {
    return <Box w="100%" h="100%" />;
  }

  const lastIndexFromMe = [...messages]
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.sourceId === currentUserId)
    .map(({ i }) => i)
    .pop();

  return (
    <Box position="relative" h="100%">
      <Box
        ref={containerRef}
        h="100%"
        p={4}
        overflowY="auto"
        onScroll={handleScroll}
      >
        {messages.map((message, index) => {
          const isMe = message.sourceId === currentUserId;
          const prev = messages[index - 1];
          const showSender =
            !isMe && (!prev || prev.sourceId !== message.sourceId);
          const isLastFromMe = isMe && index === lastIndexFromMe;

          return (
            <Message
              key={message.id || message.tempId || index}
              text={message.message}
              sender={isMe ? "You" : activeUser.username}
              position={isMe ? "right" : "left"}
              showSender={showSender}
              avatar={activeUser.avatar}
              time={message.createdAt}
              showSeen={isLastFromMe}
              isRead={peerSeen}
            />
          );
        })}

        <div ref={bottomRef} />
      </Box>

      {/* 🔔 NEW MESSAGE BUTTON */}
      {showNewMsgBtn && (
        <IconButton
          icon={<FiChevronDown size={20} />}
          aria-label="Scroll to bottom"
          position="absolute"
          bottom="24px"
          right="50%"
          borderRadius="full"
          colorScheme="blue"
          boxShadow="lg"
          onClick={() =>
            bottomRef.current?.scrollIntoView({ behavior: "smooth" })
          }
        />
      )}

    </Box>
  );
}
