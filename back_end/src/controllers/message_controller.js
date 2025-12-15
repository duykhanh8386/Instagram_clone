const { Op } = require("sequelize");
const db = require("../models");

const getConversation = async (req, res) => {
    const userId = parseInt(req.query.userId, 10);
    const peerId = parseInt(req.query.peerId, 10);

    if (!userId || !peerId) {
        return res
            .status(400)
            .json({ message: "Required userId and peerId in query string" });
    }

    try {
        const messages = await db.User_message.findAll({
            where: {
                [Op.or]: [
                    { sourceId: userId, targetId: peerId },
                    { sourceId: peerId, targetId: userId },
                ],
            },
            order: [["createdAt", "ASC"]],
        });

        return res.status(200).json({ data: messages });
    } catch (err) {
        console.error("getConversation error:", err);
        return res.status(500).json({ message: "Cannot get conversation" });
    }
};

module.exports = {
    getConversation,
};
