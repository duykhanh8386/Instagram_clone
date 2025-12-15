import {
  Flex,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Text,
  useColorMode,
} from '@chakra-ui/react';
import { useState } from 'react';
import { FaSmile, FaMicrophone, FaImage, FaRegHeart } from 'react-icons/fa';
import Picker from 'emoji-picker-react';

const ChatFooter = ({ onSendMessage, disabled }) => {
  const [inputValue, setInputValue] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const { colorMode } = useColorMode();

  const handleEmojiClick = (emojiObject) => {
    setInputValue((prevInput) => prevInput + emojiObject.emoji);
    setShowPicker(false);
  };

  const handleSend = () => {
    if (!inputValue.trim() || disabled) return;
    onSendMessage?.(inputValue.trim());
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Flex w="100%" position="relative">
      <InputGroup>
        <InputLeftElement h="100%" pl={4}>
          <FaSmile
            cursor="pointer"
            onClick={() => setShowPicker((prev) => !prev)}
            style={{ fontSize: 20 }}
          />
        </InputLeftElement>
        <Input
          isDisabled={disabled}
          borderRadius="40px"
          size="md"
          p={6}
          fontSize={16}
          pl={12}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select a user to start chatting' : 'Message...'}
        />
        <InputRightElement
          w={'8rem'}
          alignItems="center"
          h="100%"
          display="flex"
          fontSize={20}
          mr={4}
        >
          {inputValue.trim().length > 0 ? (
            <Text
              mr={-16}
              cursor="pointer"
              fontSize={14}
              fontWeight="bold"
              onClick={handleSend}
              style={{ color: colorMode === 'dark' ? '#fff' : '#00376b' }}
            >
              Send
            </Text>
          ) : (
            <Flex justifyContent="space-between" width="100%">
              <FaMicrophone cursor="pointer" />
              <FaImage cursor="pointer" />
              <FaRegHeart cursor="pointer" />
            </Flex>
          )}
        </InputRightElement>
      </InputGroup>

      {showPicker && (
        <Picker
          onEmojiClick={(emojiObject) => handleEmojiClick(emojiObject)}
          disableAutoFocus
          native
          style={{ position: 'absolute', bottom: '60px', left: '20px', zIndex: 10 }}
        />
      )}
    </Flex>
  );
};

export default ChatFooter;
