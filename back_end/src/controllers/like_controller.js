const db = require("../models/index.js");

const getLike = async (req, res) => {
  try {
    const postId = req.query.postId;
    if (!postId) return res.status(400).json({ message: "postId is required" });

    const { count, rows } = await db.Like.findAndCountAll({
      where: { postId },
    });

    return res.status(200).json({ likes: count, data: rows });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const addLike = async (req, res) => {
  try {
    const postId = parseInt(req.query.postId, 10);
    const userId = parseInt(req.query.userId, 10);

    if (!postId || !userId) {
      return res.status(400).json({ message: "postId and userId is required" });
    }

    await db.Like.create({ userId, postId });

    const likesCount = await db.Like.count({ where: { postId } });

    // realtime broadcast to room post:<postId>
    const io = req.app.get("io");
    if (io) {
      io.to(`post:${postId}`).emit("like:updated", {
        postId,
        likesCount,
        actorId: userId,
        action: "like",
      });
    }

    return res.status(200).json({ likesCount });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const deleteLike = async (req, res) => {
  try {
    const postId = parseInt(req.query.postId, 10);
    const userId = parseInt(req.query.userId, 10);

    if (!postId || !userId) {
      return res.status(400).json({ message: "postId and userId is required" });
    }

    const deletedCount = await db.Like.destroy({
      where: { postId, userId },
    });

    if (deletedCount === 0) {
      return res.status(404).json({ message: "Like not found" });
    }

    const likesCount = await db.Like.count({ where: { postId } });

    const io = req.app.get("io");
    if (io) {
      io.to(`post:${postId}`).emit("like:updated", {
        postId,
        likesCount,
        actorId: userId,
        action: "unlike",
      });
    }

    return res.status(200).json({ likesCount });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

module.exports = {
  getLike,
  addLike,
  deleteLike,
};
