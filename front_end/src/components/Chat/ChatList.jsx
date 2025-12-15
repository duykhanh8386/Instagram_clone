import { Box, Flex, Text, VStack, useToast } from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import User from './User';
import { makeRequest } from '../../axios';

export default function ChatList({ onUserClick }) {
  const [activeUserId, setActiveUserId] = useState(null);
  const [users, setUsers] = useState([]);
  const toast = useToast();
  const currentUser = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await makeRequest.post('/users/search', {
          search: '',
          userId: currentUser.id,
        });
        setUsers(res.data || []);
      } catch (error) {
        console.error(error);
        toast({
          title: 'Cannot load users',
          description: error.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'bottom',
        });
      }
    };

    if (currentUser?.id) fetchUsers();
  }, [currentUser?.id, toast]);

  const handleUserClickInternal = (user) => {
    setActiveUserId(user.id);
    onUserClick(user);
  };

  return (
    <Box w="full">
      <Flex alignItems="center" justifyContent="space-between" px={4} mb={3}>
        <Text cursor="pointer" fontSize={16} fontWeight={700}>
          Messages
        </Text>
        <Text cursor="pointer" fontSize={16} color="#a2a2a2" fontWeight={700}>
          Requests
        </Text>
      </Flex>
      <VStack spacing={0} align="stretch" overflowY="auto" maxHeight="calc(100vh - 120px)">
        {users.map((user) => (
          <User
            key={user.id}
            user={user}
            isActive={activeUserId === user.id}
            onClick={() => handleUserClickInternal(user)}
          />
        ))}
      </VStack>
    </Box>
  );
}
