const express = require("express");
const router = express.Router();
const authorization = require("../middleware/authorization");
const { getConversation } = require("../controllers/message_controller");

router.get("/messages", authorization, getConversation);

module.exports = router;
