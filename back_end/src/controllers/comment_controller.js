 const db = require("../models");
const sequelize = require("sequelize");
const moment = require("moment");

// NOTE:
// - UI currently renders only parent comments (parentComment = null).
// - We still emit realtime events for all comments, but include `isParent` so the client can decide.
const fetchFullCommentById = async (commentId) => {
  if (!commentId) return null;
  return db.Comment.findOne({
    where: { id: commentId },
    include: [
      {
        model: db.User,
        as: "User",
        attributes: { exclude: ["passwordHash"] },
      },
    ],
    attributes: {
      include: [
        [
          db.sequelize.literal(`(
            SELECT COUNT(*)
            FROM comments AS childrenComments
            WHERE childrenComments.parentComment = Comment.id
          )`),
          "childrenCommentCount",
        ],
      ],
    },
  });
};

const fetchFullCommentFallback = async ({ postId, userId, content }) => {
  return db.Comment.findOne({
    where: { postId, userId, content },
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: db.User,
        as: "User",
        attributes: { exclude: ["passwordHash"] },
      },
    ],
    attributes: {
      include: [
        [
          db.sequelize.literal(`(
            SELECT COUNT(*)
            FROM comments AS childrenComments
            WHERE childrenComments.parentComment = Comment.id
          )`),
          "childrenCommentCount",
        ],
      ],
    },
  });
};

const addComment = async (req, res) => {
  const postId = parseInt(req.query.postId, 10);
  const userId = parseInt(req.query.userId, 10);
  const parentComment = req.body?.parentComment ? parseInt(req.body.parentComment, 10) : null;
  const content = (req.body?.content || "").trim();

  if (!postId || !userId || !content) {
    return res.status(400).json({ message: "Required postId, userId and non-empty content" });
  }

  try {
    const [user, post] = await Promise.all([
      db.User.findOne({ where: { id: userId } }),
      db.User_post.findOne({ where: { id: postId } }),
    ]);

    if (!user || !post) {
      return res.status(400).json({ message: "Data is not valid, please try again" });
    }

    if (parentComment) {
      const parent = await db.Comment.findOne({ where: { id: parentComment } });
      if (!parent) return res.status(400).json({ message: "Parent comment not found" });
    }

    const created = await db.Comment.create({
      userId,
      postId,
      content,
      parentComment,
    });

    // IMPORTANT: lấy id chắc chắn
    const insertedId = created?.id ?? created?.dataValues?.id ?? null;

    let fullComment = await fetchFullCommentById(insertedId);
    if (!fullComment) {
      fullComment = await fetchFullCommentFallback({ postId, userId, content });// vì khi so sánh danh sách cmt cũ khác số lượng mới(khi thêm cmt) nên sẽ chạy vào hàm fallback để lấy ra cái mới thêm rồi up lên realtime luôn
    }

    if (!fullComment) {
      // Nếu vẫn null thì trả về tối thiểu (để FE không crash)
      return res.status(201).json({
        id: insertedId,
        userId,
        postId,
        content,
        parentComment,
        User: user,
      });
    }

    const io = req.app.get("io");
    if (io) {
      console.log("emit comment:created", postId, fullComment.id);
      io.to(`post:${postId}`).emit("comment:created", {
        postId,
        comment: fullComment,
        isParent: fullComment.parentComment == null,
      });
    }

    return res.status(201).json(fullComment);
  } catch (e) {
    console.error("addComment error:", e);
    return res.status(500).json({ message: "Cannot create new comment" });
  }
};

const removeComment = async (req, res) => {
  const userId = parseInt(req.query.userId, 10);
  const postId = req.query.postId ? parseInt(req.query.postId, 10) : null;
  const commentId = parseInt(req.params.comment_id, 10);

  if (!userId || !commentId) {
    return res
      .status(400)
      .json({ message: "Required userId in query and comment_id in path" });
  }

  try {
    const comment = await db.Comment.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Permission:
    // - comment owner can delete
    // - OR post owner can delete (UI already allows this)
    if (comment.userId !== userId) {
      // If postId is provided, allow post owner to delete.
      if (!postId) {
        return res.status(403).json({ message: "Permission denied" });
      }
      const post = await db.User_post.findByPk(postId);
      if (!post || post.userId !== userId) {
        return res.status(403).json({ message: "Permission denied" });
      }
    }

    const roomPostId = comment.postId;
    const isParent = comment.parentComment == null;

    await comment.destroy();

    // emit realtime delete
    const io = req.app.get("io");
    if (io) {
      io.to(`post:${roomPostId}`).emit("comment:deleted", {
        postId: roomPostId,
        commentId,
        isParent,
      });
    }

    return res.status(200).json({ message: "Deleted" });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const editComment = async (req, res) => {
  const userId = parseInt(req.query.userId, 10);
  const commentId = parseInt(req.params.comment_id, 10);
  const content = req.body?.content;

  if (!userId || !commentId || !content?.trim()) {
    return res.status(400).json({
      message: "Required userId, comment_id and non-empty content",
    });
  }

  try {
    const comment = await db.Comment.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({ message: "Permission denied" });
    }

    comment.content = content.trim();
    comment.updatedAt = moment().toDate();
    await comment.save();

    // Return full comment (with User) so frontend doesn't crash
    const fullComment = await fetchFullCommentById(commentId);

    // emit realtime update
    const io = req.app.get("io");
    if (io) {
      io.to(`post:${comment.postId}`).emit("comment:updated", {
        postId: comment.postId,
        comment: fullComment,
        isParent: fullComment?.parentComment == null,
      });
    }

    return res.status(200).json(fullComment);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const getComment = async (req, res) => {
  const postId = parseInt(req.query.postId, 10);
  const page = parseInt(req.query.page, 10) || 1;
  const take = parseInt(req.query.take, 10) || 6;

  if (!postId) {
    return res.status(400).json({ message: "Required postId in query" });
  }

  const offset = (page - 1) * take;

  try {
    const { count, rows } = await db.Comment.findAndCountAll({
      where: {
        postId,
        parentComment: null,
      },
      include: [
        {
          model: db.User,
          as: "User",
          attributes: { exclude: ["passwordHash"] },
        },
      ],
      attributes: {
        include: [
          [
            db.sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM comments AS children
                            WHERE children.parentComment = Comment.id
                        )`),
            "childrenCommentCount",
          ],
        ],
      },
      order: [["createdAt", "ASC"]],
      limit: take,
      offset,
    });

    const pageCount = Math.ceil(count / take);

    return res.status(200).json({
      data: rows,
      meta: {
        itemCount: count,
        take,
        page,
        pageCount,
        hasNextPage: page < pageCount,
      },
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

module.exports = {
  addComment,
  removeComment,
  editComment,
  getComment,
};