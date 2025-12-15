import {
  Box,
  Button,
  Flex,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  useColorMode,
  useToast
} from '@chakra-ui/react';

import { useEffect, useRef, useState } from 'react';

import { CommentLogo, NotificationsLogo, UnlikeLogo } from '../../assets/constants.jsx';
import { makeRequest } from '../../axios.js';
import ProfilePostModal from '../Profile/ProfilePostModal.jsx';
import socket, { ensureSocketConnected } from '../../socket';

function PostFooter({
  isProfilePage,
  postId,
  imgMediaList,
  isOpen,
  onClose,
  onOpen,
  onDelete,
  onCommentCreated
}) {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  const { colorMode } = useColorMode();
  const toast = useToast();

  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  const [comments, setComments] = useState([]);
  const [countComments, setCountComments] = useState(0);
  const [newComment, setNewComment] = useState('');

  const knownCommentIdsRef = useRef(new Set());

  useEffect(() => {
    let isMounted = true;
    const pid = Number(postId);

    const fetchLikes = async () => {
      try {
        const response = await makeRequest.get(`likes?postId=${pid}`);
        const { likes, data } = response.data;

        let isLiked = false;
        for (let i = 0; i < (data?.length || 0); i++) {
          if (Number(data[i].userId) === Number(currentUser.id)) {
            isLiked = true;
            break;
          }
        }

        if (!isMounted) return;
        setLikesCount(typeof likes === 'number' ? likes : 0);
        setLiked(isLiked);
      } catch (error) {
        if (!isMounted) return;
        toast({
          title: 'Cannot load like of posts',
          description: error.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'bottom'
        });
      }
    };

    const fetchComments = async () => {
      try {
        const response = await makeRequest.get(`comments?postId=${pid}`);
        const { data, meta } = response.data;

        if (!isMounted) return;
        const arr = Array.isArray(data) ? data : [];
        setComments(arr);
        setCountComments(meta?.itemCount || 0);
        knownCommentIdsRef.current = new Set(arr.map((c) => c?.id).filter(Boolean));
      } catch (error) {
        if (!isMounted) return;
        toast({
          title: 'Cannot load comment of posts',
          description: error.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'bottom'
        });
      }
    };

    fetchLikes();
    fetchComments();

    // IMPORTANT: must connect because autoConnect=false
    const s = ensureSocketConnected();

    s.emit('join_post', { postId: pid });

    const handleCreated = ({ postId: incomingPostId, comment, isParent }) => {
      if (Number(incomingPostId) !== pid) return;

      const parent = typeof isParent === 'boolean' ? isParent : comment?.parentComment == null;
      if (!parent) return;

      if (!comment?.id) return;
      if (knownCommentIdsRef.current.has(comment.id)) return;

      knownCommentIdsRef.current.add(comment.id);
      setComments((prev) => [...(Array.isArray(prev) ? prev : []), comment]);
      setCountComments((prev) => (typeof prev === 'number' ? prev + 1 : 1));
    };

    const handleUpdated = ({ postId: incomingPostId, comment: updated }) => {
      if (Number(incomingPostId) !== pid) return;
      if (!updated?.id) return;
      if (!knownCommentIdsRef.current.has(updated.id)) return;

      setComments((prev) =>
        (Array.isArray(prev) ? prev : []).map((c) => {
          if (!c || c.id !== updated.id) return c;
          return { ...c, ...updated, User: updated?.User || c?.User };
        })
      );
    };

    const handleDeleted = ({ postId: incomingPostId, commentId, isParent }) => {
      if (Number(incomingPostId) !== pid) return;
      if (!commentId) return;

      const parent = typeof isParent === 'boolean' ? isParent : true;

      if (knownCommentIdsRef.current.has(commentId)) {
        knownCommentIdsRef.current.delete(commentId);
        setComments((prev) => (Array.isArray(prev) ? prev : []).filter((c) => c?.id !== commentId));
      }

      if (parent) {
        setCountComments((prev) => (typeof prev === 'number' ? Math.max(prev - 1, 0) : prev));
      }
    };

    const handleLikeUpdated = ({ postId: incomingPostId, likesCount: nextLikesCount }) => {
      if (Number(incomingPostId) !== pid) return;
      if (typeof nextLikesCount !== 'number') return;
      setLikesCount(nextLikesCount);
    };

    s.on('comment:created', handleCreated);
    s.on('comment:updated', handleUpdated);
    s.on('comment:deleted', handleDeleted);
    s.on('like:updated', handleLikeUpdated);

    return () => {
      isMounted = false;
      s.emit('leave_post', { postId: pid });
      s.off('comment:created', handleCreated);
      s.off('comment:updated', handleUpdated);
      s.off('comment:deleted', handleDeleted);
      s.off('like:updated', handleLikeUpdated);
    };
  }, [postId, toast, currentUser.id]);

  const handleCommentChange = (e) => setNewComment(e.target.value);

  const handleCommentPost = async (e) => {
    e.preventDefault();

    const content = newComment.trim();
    if (!content) {
      toast({
        title: 'Comment cannot be empty',
        status: 'warning',
        duration: 3000,
        isClosable: true,
        position: 'bottom'
      });
      return;
    }

    try {
      const pid = Number(postId);
      const res = await makeRequest(`/comments?postId=${pid}&userId=${currentUser.id}`, {
        method: 'POST',
        data: { content }
      });

      const created = res.data;

      // optimistic UI
      if (created?.id) {
        const parent = created?.parentComment == null;
        if (parent && !knownCommentIdsRef.current.has(created.id)) {
          knownCommentIdsRef.current.add(created.id);
          setComments((prev) => [...(Array.isArray(prev) ? prev : []), created]);
          setCountComments((prev) => (typeof prev === 'number' ? prev + 1 : 1));
        }
        onCommentCreated?.(created);
      }

      setNewComment('');

      toast({
        title: 'Post comment',
        description: 'Comment successfully!',
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'bottom'
      });
    } catch (error) {
      toast({
        title: 'Cannot post comment',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'bottom'
      });
    }
  };

  const handleLike = async () => {
    const pid = Number(postId);

    try {
      if (liked) {
        // optimistic
        setLiked(false);
        setLikesCount((prev) => Math.max((typeof prev === 'number' ? prev : 0) - 1, 0));

        const res = await makeRequest(`/likes?userId=${currentUser.id}&postId=${pid}`, {
          method: 'DELETE'
        });
        if (res?.data?.likesCount != null) setLikesCount(res.data.likesCount);
      } else {
        setLiked(true);
        setLikesCount((prev) => (typeof prev === 'number' ? prev + 1 : 1));

        const res = await makeRequest(`/likes?userId=${currentUser.id}&postId=${pid}`, {
          method: 'POST'
        });
        if (res?.data?.likesCount != null) setLikesCount(res.data.likesCount);
      }
    } catch (error) {
      toast({
        title: 'Cannot like or unlike',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'bottom'
      });
    }
  };

  const handleOpenModal = (e) => {
    e.preventDefault();
    if (isProfilePage) return;
    onOpen?.();
  };

  return (
    <>
      <Box mb={10} mt="auto">
        <Flex alignItems="center" gap={4} w="full" pt={0} mb={2} mt="4">
          <Box onClick={handleLike} cursor="pointer" fontSize={18}>
            {!liked ? <NotificationsLogo colorMode={colorMode} /> : <UnlikeLogo />}
          </Box>

          <Box cursor="pointer" fontSize={18} onClick={handleOpenModal}>
            <CommentLogo colorMode={colorMode} />
          </Box>
        </Flex>

        <Text fontWeight={600} fontSize="sm">
          {likesCount} likes
        </Text>

        {!isProfilePage && (
          <>
            <Text fontSize="sm" fontWeight={700}>
              {comments[0] && (
                <>
                  {comments[0]?.User?.name_tag}{' '}
                  <Text as="span" fontWeight={400}>
                    {comments[0]?.content}
                  </Text>
                </>
              )}
            </Text>

            {countComments > 0 && (
              <Text fontSize="sm" color="gray" onClick={handleOpenModal} cursor="pointer">
                View all {countComments} comments
              </Text>
            )}
          </>
        )}

        <Flex alignItems="center" gap={2} justifyContent="space-between" w="full">
          <InputGroup>
            <Input
              onChange={handleCommentChange}
              variant="flushed"
              value={newComment}
              placeholder="Add a comment..."
              fontSize={14}
            />
            <InputRightElement>
              <Button
                fontSize={14}
                color="blue.500"
                fontWeight={600}
                cursor="pointer"
                _hover={{ color: colorMode === 'dark' ? 'blue.400' : 'blue.800' }}
                onClick={handleCommentPost}
                bg="transparent"
              >
                Post
              </Button>
            </InputRightElement>
          </InputGroup>
        </Flex>
      </Box>

      {isOpen && !isProfilePage && (
        <ProfilePostModal
          onDelete={onDelete}
          postId={postId}
          isOpen={isOpen}
          onClose={onClose}
          imgMediaList={imgMediaList}
          setCountComments={setCountComments}
        />
      )}
    </>
  );
}

export default PostFooter;
