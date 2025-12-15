import { Container, Flex, Box, Text, Button } from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import ChatBar from '../../components/Chat/ChatBar';
import ChatHeader from '../../components/Chat/ChatHeader';
import ChatConversation from '../../components/Chat/ChatConversation';
import ChatFooter from '../../components/Chat/ChatFooter';
import ModalFindUser from '../../components/Chat/ModalFindUser';
import { makeRequest } from '../../axios';
import socket from '../../socket';

const ChatPage = () => {
  const [activeUser, setActiveUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [peerSeen, setPeerSeen] = useState(false); // tin nhắn cuối cùng của mình đã được xem chưa

  const currentUser = JSON.parse(localStorage.getItem('user'));

  // Kết nối socket và lắng nghe new_message + conversation_seen
  useEffect(() => {
    if (!currentUser?.id) return;

    if (!socket.connected) {
      socket.io.opts.query = { userId: currentUser.id };
      socket.connect();
    }

    const handleNewMessage = (message) => {
      if (message.sourceId === currentUser.id) return;// tin nhắn của mình gửi lên thì ko cần xử lý
      if (
        activeUser &&
        ((message.sourceId === currentUser.id && message.targetId === activeUser.id) ||
          (message.sourceId === activeUser.id && message.targetId === currentUser.id))
      ) {
        setMessages((prev) => [...prev, message]);
      }

      // nếu mình đang mở cuộc chat với thằng kia và nó gửi lại => coi như mình đã đọc luôn
      if (
        activeUser &&
        message.sourceId === activeUser.id &&
        message.targetId === currentUser.id
      ) {
        socket.emit('mark_seen', { userId: currentUser.id, peerId: activeUser.id });
      }
    };

    const handleConversationSeen = ({ userId, peerId }) => {
      // userId: nó, peerId: mình
      if (activeUser && userId === activeUser.id && peerId === currentUser.id) {
        setPeerSeen(true);
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('conversation_seen', handleConversationSeen);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('conversation_seen', handleConversationSeen);
    };
  }, [currentUser?.id, activeUser?.id]);

  // load lịch sử chat khi chọn user
  useEffect(() => {
    const fetchConversation = async () => {
      if (!activeUser || !currentUser) {
        setMessages([]);
        setPeerSeen(false);
        return;
      }

      try {
        const res = await makeRequest.get(
          `/messages?userId=${currentUser.id}&peerId=${activeUser.id}`
        );
        setMessages(res.data.data || []);
        setPeerSeen(false);

        // mình mở chat => mark tất cả tin nhắn của nó là đã xem
        if (socket.connected) {
          socket.emit('mark_seen', { userId: currentUser.id, peerId: activeUser.id });
        }
      } catch (error) {
        console.error('Cannot fetch messages', error);
      }
    };

    fetchConversation();
  }, [activeUser, currentUser?.id]);

  const handleUserClick = (user) => {
    setActiveUser(user);
  };

  const handleSelectUserFromModal = (user) => {
    setActiveUser(user);
    setIsModalOpen(false);
  };

  const handleSendMessage = (text) => {
    if (!text.trim() || !activeUser || !currentUser) return;

    const payload = {
      senderId: currentUser.id,
      receiverId: activeUser.id,
      content: text.trim(),
    };

    // cập nhật UI trước
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sourceId: currentUser.id,
        targetId: activeUser.id,
        message: text.trim(),
        createdAt: new Date().toISOString(),
        optimistic: true,
      },
    ]);
    setPeerSeen(false); // gửi tin mới => chưa được xem

    socket.emit('send_message', payload);
  };

  return (
    <Container maxW="100%" p={0} height="100vh">
      <Flex direction="row" height="100%">
        <Flex w="28%" borderRight="1px solid #262626">
          <ChatBar onUserClick={handleUserClick} />
        </Flex>

        {activeUser ? (
          <Flex w="72%" direction="column" h="100%">
            <Box borderBottom="1px solid #262626">
              <ChatHeader activeUser={activeUser} />
            </Box>
            <Box flex="1" overflowY="auto">
              <ChatConversation
                activeUser={activeUser}
                messages={messages}
                currentUserId={currentUser?.id}
                peerSeen={peerSeen}
              />
            </Box>
            <Box h="70px" mb="2" p={4}>
              <ChatFooter onSendMessage={handleSendMessage} disabled={!activeUser} />
            </Box>
          </Flex>
        ) : (
          <Flex w="72%" h="100%" alignItems="center" justifyContent="center">
            <Flex direction="column" alignItems="center">
              <Text fontSize={20} mt={2}>
                Your messages
              </Text>
              <Text fontSize={16} mt={2} color="#a2a2a2">
                Send a message to start a chat.
              </Text>
              <Button mt={4} fontSize={16} colorScheme="blue" onClick={() => setIsModalOpen(true)}>
                Send message
              </Button>
            </Flex>
          </Flex>
        )}
      </Flex>

      <ModalFindUser
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectUser={handleSelectUserFromModal}
      />
    </Container>
  );
};

export default ChatPage;
