import { Avatar, Box, Flex, Text, useColorMode } from '@chakra-ui/react';
import React from 'react';

export default function Message({
  text,
  sender,
  position,
  showSender,
  avatar,
  time,
  showSeen,
  isRead,
}) {
  const { colorMode } = useColorMode();

  const formattedTime = time
    ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <Flex
      justifyContent={position === 'right' ? 'flex-end' : 'flex-start'}
      mb={4}
      pl={showSender ? 0 : 12}
      alignItems="flex-end"
    >
      {showSender && position === 'left' && (
        <Box mr={2} ml={2} mb={2}>
          <Avatar src={avatar} name={sender} size="sm" cursor="pointer" />
        </Box>
      )}
      <Box
        borderRadius="30px"
        bg={
          colorMode === 'dark'
            ? position === 'right'
              ? '#3797f0'
              : '#262626'
            : position === 'right'
            ? '#3797f0'
            : '#efefef'
        }
        color={colorMode === 'dark' ? 'white' : position === 'right' ? '#fff' : '#000'}
        p={3}
        maxWidth="70%"
        textAlign={position === 'right' ? 'right' : 'left'}
        whiteSpace="pre-wrap"
        wordBreak="break-word"
      >
        <Text fontSize={14}>{text}</Text>
        <Text fontSize={10} mt={1} color={colorMode === 'dark' ? 'gray.300' : 'gray.600'}>
          {formattedTime}
          {position === 'right' && showSeen && <> · {isRead ? 'Seen' : 'Sent'}</>}
        </Text>
      </Box>
    </Flex>
  );
}
