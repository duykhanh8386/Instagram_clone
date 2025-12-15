import {
  Avatar as ChakraAvatar,
  Box,
  Divider,
  Flex,
  IconButton,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Skeleton,
  SkeletonCircle,
  SkeletonText,
  Spinner,
  Text,
  VStack,
  useColorMode,
  useToast
} from '@chakra-ui/react';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AiOutlinePlusCircle } from 'react-icons/ai';
import { MdDelete, MdOutlineKeyboardArrowLeft, MdOutlineKeyboardArrowRight } from 'react-icons/md';

import socket, { ensureSocketConnected } from '../../socket';
import { makeRequest } from '../../axios.js';
import fetchAvatar from '../../utils/fetchAvatar.js';
import Comments from '../Comment/Comments.jsx';
import PostFooter from '../FeedPosts/PostFooter.jsx';

function ProfilePostModal({ isOpen, onClose, imgMediaList, postId, setCountComments, onDelete }) {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  const { colorMode } = useColorMode();
  const toast = useToast();

  const [imgAvatar, setImgAvatar] = useState();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [posts, setPosts] = useState({});
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metaComments, setMetaComments] = useState();
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const knownCommentIdsRef = useRef(new Set());

  // ===== realtime: join room + listen =====
  useEffect(() => {
    if (!isOpen || !postId) return;

    const s = ensureSocketConnected(); // IMPORTANT
    const pid = Number(postId);

    s.emit('join_post', { postId: pid });

    const handleCreated = ({ postId: incomingPostId, comment, isParent }) => {
      if (Number(incomingPostId) !== pid) return;

      const parent = typeof isParent === 'boolean' ? isParent : comment?.parentComment == null;
      if (!parent) return;

      if (!comment?.id) return;
      if (knownCommentIdsRef.current.has(comment.id)) return;

      knownCommentIdsRef.current.add(comment.id);
      setComments((prev) => [...(Array.isArray(prev) ? prev : []), comment]);

      setMetaComments((prev) =>
        prev
          ? {
              ...prev,
              itemCount: typeof prev.itemCount === 'number' ? prev.itemCount + 1 : 1
            }
          : prev
      );
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
        setMetaComments((prev) =>
          prev
            ? {
                ...prev,
                itemCount: typeof prev.itemCount === 'number' ? Math.max(prev.itemCount - 1, 0) : 0
              }
            : prev
        );
      }
    };

    s.on('comment:created', handleCreated);
    s.on('comment:updated', handleUpdated);
    s.on('comment:deleted', handleDeleted);

    return () => {
      s.emit('leave_post', { postId: pid });
      s.off('comment:created', handleCreated);
      s.off('comment:updated', handleUpdated);
      s.off('comment:deleted', handleDeleted);
    };
  }, [isOpen, postId]);

  // ===== initial fetch =====
  useEffect(() => {
    const fetchInfoAboutPosts = async () => {
      if (!postId) return;

      setIsLoading(true);
      try {
        const [detailPost, detailComment] = await Promise.all([
          makeRequest.get(`/posts/${postId}`),
          makeRequest.get(`/comments?postId=${postId}&page=1&take=${6}`)
        ]);

        const detailInfoPost = detailPost.data.data;
        const detailInfoComment = detailComment.data.data;
        const detailMetaComment = detailComment.data.meta;

        setPosts(detailInfoPost);
        setComments(detailInfoComment);

        knownCommentIdsRef.current = new Set(
          (detailInfoComment || []).map((c) => c?.id).filter(Boolean)
        );

        setMetaComments(detailMetaComment);
        fetchAvatar(detailInfoPost?.User?.avatar, setImgAvatar);
      } catch (e) {
        toast({
          title: 'Failed to load post',
          description: e?.response?.data?.message || e.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'bottom'
        });
      } finally {
        setIsLoading(false);
        setPage(1);
      }
    };

    if (isOpen) fetchInfoAboutPosts();
  }, [isOpen, postId, toast]);

  const handleNextImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % imgMediaList.length);
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex - 1 + imgMediaList.length) % imgMediaList.length);
  };

  const fetchMoreComments = useCallback(async () => {
    if (loadingMore || !metaComments || page >= metaComments.pageCount) return;

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await makeRequest.get(`/comments?postId=${postId}&page=${nextPage}&take=${6}`);
      const moreComments = response.data.data;

      setComments((prevComments) => {
        const prev = Array.isArray(prevComments) ? prevComments : [];
        const add = Array.isArray(moreComments) ? moreComments : [];
        add.forEach((c) => c?.id && knownCommentIdsRef.current.add(c.id));
        return [...prev, ...add];
      });

      setMetaComments(response.data.meta);
      setPage(nextPage);
    } catch (e) {
      toast({
        title: 'Failed to load more comments',
        description: e?.response?.data?.message || e.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'bottom'
      });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, metaComments, page, postId, toast]);

  // optimistic add: modal shows immediately after POST success
  const onCommentCreatedOptimistic = useCallback((created) => {
    const parent = created?.parentComment == null;
    if (!parent || !created?.id) return;

    if (knownCommentIdsRef.current.has(created.id)) return;
    knownCommentIdsRef.current.add(created.id);

    setComments((prev) => [...(Array.isArray(prev) ? prev : []), created]);
    setMetaComments((prev) =>
      prev
        ? {
            ...prev,
            itemCount: typeof prev.itemCount === 'number' ? prev.itemCount + 1 : 1
          }
        : prev
    );
  }, []);

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size={{ base: '3xl', md: '6xl' }}>
      <ModalOverlay />
      <ModalContent>
        <ModalCloseButton />
        <ModalBody bg={colorMode === 'dark' ? 'black' : 'white'} pb={5} borderRadius={6}>
          <Flex gap="4" w={{ base: '90%', sm: '70%', md: 'full' }} mx="auto">
            <Flex borderRadius={4} overflow="hidden" flex={1.5} justifyContent="center" aspectRatio="1/1" alignItems="center">
              {isLoading ? (
                <Skeleton height="100%" width="100%" />
              ) : (
                <>
                  {imgMediaList?.length !== 0 && (
                    <Image
                      src={`http://${import.meta.env.VITE_BACKEND_HOST}:${import.meta.env.VITE_BACKEND_PORT}/${imgMediaList[currentImageIndex]}`}
                      objectFit="cover"
                      position="center"
                    />
                  )}

                  {imgMediaList?.length > 1 && (
                    <>
                      <IconButton
                        icon={<MdOutlineKeyboardArrowLeft color={colorMode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} size="md" />}
                        position="absolute"
                        left="0%"
                        top="50%"
                        transform="translateY(-50%)"
                        onClick={handlePrevImage}
                        aria-label="Previous image"
                        size="sm"
                        bg="transparent"
                        _hover={{ bg: colorMode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}
                        borderRadius="full"
                        color={colorMode === 'dark' ? 'white' : 'black'}
                      />

                      <IconButton
                        icon={<MdOutlineKeyboardArrowRight color={colorMode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} size="md" />}
                        position="absolute"
                        right="43%"
                        top="50%"
                        transform="translateY(-50%)"
                        onClick={handleNextImage}
                        aria-label="Next image"
                        size="sm"
                        bg="transparent"
                        _hover={{ bg: colorMode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}
                        borderRadius="full"
                        color={colorMode === 'dark' ? 'white' : 'black'}
                      />
                    </>
                  )}
                </>
              )}
            </Flex>

            <Flex flex={1} flexDirection="column" px={10} display={{ base: 'none', md: 'flex' }}>
              {isLoading ? (
                <>
                  <Flex justifyContent="space-between" alignItems="center">
                    <Flex alignItems="center" gap={4}>
                      <SkeletonCircle size="10" />
                      <Skeleton height="20px" width="100px" />
                    </Flex>
                  </Flex>

                  <Divider my={4} bg="gray.500" />

                  <VStack w="full" alignItems="start" maxH="400px" overflowY="auto" overflowX="visible"
                    css={{ '&::-webkit-scrollbar': { width: '0px', background: 'transparent' } }}>
                    <SkeletonText noOfLines={4} spacing="4" />
                  </VStack>

                  <Divider my={4} bg="gray.800" />
                  <Skeleton height="40px" width="100%" />
                </>
              ) : (
                <>
                  <Flex justifyContent="space-between" alignItems="center">
                    <Flex alignItems="center" gap={4}>
                      <ChakraAvatar src={imgAvatar} size="sm" name={posts?.User?.username} />
                      <Text fontWeight="bold" fontSize={12}>{posts?.User?.name_tag}</Text>
                    </Flex>

                    {currentUser?.id === posts?.User?.id && (
                      <IconButton aria-label="Delete post" icon={<MdDelete />} colorScheme="red" size="sm" onClick={onDelete} />
                    )}
                  </Flex>

                  <Divider my={4} bg="gray.500" />

                  <VStack
                    position="relative"
                    w="full"
                    alignItems="start"
                    maxH="400px"
                    minH="400px"
                    overflowY="auto"
                    css={{ '&::-webkit-scrollbar': { width: '0px', background: 'transparent' } }}
                  >
                    <Comments
                      comments={comments}
                      currentUser={currentUser}
                      onwerPostId={posts?.userId}
                      setComments={setComments}
                      setCountComments={setCountComments}
                    />

                    {metaComments?.hasNextPage && (
                      <>
                        {loadingMore ? (
                          <Spinner size="30px" />
                        ) : (
                          <Flex justifyContent="center" alignItems="center" w="100%" onClick={fetchMoreComments} cursor="pointer">
                            <AiOutlinePlusCircle size="30px" />
                          </Flex>
                        )}
                      </>
                    )}
                  </VStack>

                  <Divider my={4} bg="gray.800" />

                  <PostFooter
                    onDelete={onDelete}
                    isProfilePage
                    postId={postId}
                    isOpen={isOpen}
                    onClose={onClose}
                    imgMediaList={imgMediaList}
                    onCommentCreated={onCommentCreatedOptimistic}
                  />
                </>
              )}
            </Flex>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default ProfilePostModal;
