import React, { useEffect, useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  useColorMode,
  Flex,
  Text,
  Box,
  Avatar,
  useToast,
} from '@chakra-ui/react';
import { makeRequest } from '../../axios';

const ModalFindUser = ({ isOpen, onClose, onSelectUser }) => {
  const { colorMode } = useColorMode();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const toast = useToast();
  const currentUser = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setUsers([]);
      setSelectedUserId(null);
      return;
    }
    const fetchInitial = async () => {
      try {
        const res = await makeRequest.post('/users/search', {
          search: '',
          userId: currentUser.id,
        });
        setUsers(res.data || []);
      } catch (error) {
        console.error(error);
      }
    };
    if (currentUser?.id) fetchInitial();
  }, [isOpen, currentUser?.id]);

  const handleSearch = async (value) => {
    setSearch(value);
    try {
      const res = await makeRequest.post('/users/search', {
        search: value,
        userId: currentUser.id,
      });
      setUsers(res.data || []);
    } catch (error) {
      toast({
        title: 'Cannot search users',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'bottom',
      });
    }
  };

  const handleConfirm = () => {
    const user = users.find((u) => u.id === selectedUserId);
    if (!user) {
      toast({
        title: 'Please select a user',
        status: 'warning',
        duration: 2000,
        isClosable: true,
        position: 'bottom',
      });
      return;
    }

    if (onSelectUser) {
      onSelectUser(user);   // báo cho ChatPage biết user được chọn
    }
    onClose();              // đảm bảo modal đóng
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent bg={colorMode === 'dark' ? '#000' : '#fff'}>
        <ModalHeader textAlign="center">New message</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Flex mb={4} alignItems="center">
            <Text mr={2} fontWeight="bold">
              To:
            </Text>
            <Input
              placeholder="Search for a user..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              variant="unstyled"
            />
          </Flex>
          <Box maxH="300px" overflowY="auto">
            {users.map((user) => (
              <Flex
                key={user.id}
                alignItems="center"
                px={2}
                py={2}
                cursor="pointer"
                bg={
                  selectedUserId === user.id
                    ? colorMode === 'dark'
                      ? '#262626'
                      : '#efefef'
                    : 'transparent'
                }
                _hover={{
                  bg: colorMode === 'dark' ? '#262626' : '#efefef',
                }}
                onClick={() => setSelectedUserId(user.id)}
              >
                <Avatar src={user.avatar} name={user.username} size="sm" mr={3} />
                <Box>
                  <Text fontWeight="bold" fontSize={14}>
                    {user.username}
                  </Text>
                  <Text fontSize={12} color="gray.400">
                    {user.name_tag}
                  </Text>
                </Box>
              </Flex>
            ))}
          </Box>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" width="100%" onClick={handleConfirm}>
            Chat
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ModalFindUser;
