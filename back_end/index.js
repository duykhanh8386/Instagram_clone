const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
var express = require("express");
var cors = require("cors");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
const helmet = require("helmet");
var morgan = require("morgan");
var dotenv = require("dotenv");
const { createClient } = require("redis");
const { Server } = require("socket.io");
const { createServer } = require("node:http");
const app = express();
const server = createServer(app);
dotenv.config();

const db = require("./src/models");             // <-- thêm
const io = new Server(server, {
  cors: {
    origin: "*",
    credentials: true,
  },
  path: "/api/v1/message",
});

app.set("io", io); // cho controller lấy io qua req.app.get("io")

const onlineUsers = new Map();

io.on("connection", (socket) => {
  const { userId } = socket.handshake.query || {};
  console.log("socket connected:", userId, socket.id);

  if (userId) {
    onlineUsers.set(String(userId), socket.id);
    socket.join(`user:${userId}`); // room riêng cho mỗi user
  }

  socket.on("disconnect", () => {
    if (userId) {
      onlineUsers.delete(String(userId));
    }
    console.log("socket disconnected:", userId, socket.id);
  });

  // gửi tin nhắn 1–1
  socket.on("send_message", async ({ senderId, receiverId, content }) => {
    try {
      if (!senderId || !receiverId || !content?.trim()) return;

      const message = await db.User_message.create({
        sourceId: senderId,
        targetId: receiverId,
        message: content.trim(),
      });

      const payload = {
        id: message.id,
        sourceId: message.sourceId,
        targetId: message.targetId,
        message: message.message,
        createdAt: message.createdAt,
      };

      // gửi cho cả 2 user
      io.to(`user:${senderId}`).emit("new_message", payload);
      io.to(`user:${receiverId}`).emit("new_message", payload);
    } catch (err) {
      console.error("send_message error:", err);
    }
  });

  // user mở cuộc chat → mark đã xem (read receipt đơn giản)
  socket.on("mark_seen", ({ userId, peerId }) => {
    if (!userId || !peerId) return;
    io.to(`user:${peerId}`).emit("conversation_seen", {
      userId,  // người vừa xem
      peerId,  // người bị xem tin nhắn
    });
  });

  // join/leave room theo post để comment realtime
  socket.on("join_post", ({ postId }) => {
    const pid = Number(postId);
    if (!pid) return;
    socket.join(`post:${pid}`);
    console.log("[socket] join_post =>", `post:${pid}`, "socket:", socket.id);
  });

  socket.on("leave_post", ({ postId }) => {
    const pid = Number(postId);
    if (!pid) return;
    socket.leave(`post:${pid}`);
    console.log("[socket] leave_post =>", `post:${pid}`, "socket:", socket.id);
  });

});
const routerRegister = require("./src/routes/register.js");
const routerAuthen = require("./src/routes/authentication_route.js");
const routerPost = require("./src/routes/post_route.js");
const oauth2Route = require("./src/routes/oauth2_route.js");
const userRoute = require("./src/routes/user_route.js");
const likeRouter = require("./src/routes/like_route.js");
const commentRouter = require("./src/routes/comment_route.js");
const storyRouter = require("./src/routes/story_route.js");
const routerRelationship = require("./src/routes/relationship.route.js");
const messageRoute = require("./src/routes/message_route.js");

const client = createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
});

client.on("error", (err) => console.log("Redis Client Error", err));
client.on("connect", () => {
  console.log("Connected to Redis server");
});

const corOptions = {
  // use origin * for development purpose
  origin: true,
  // methods: ["GET", "POST", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS", "CONNECT", "TRACE"],
  methods: ["GET", "POST", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS", "CONNECT"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  credentials: true,
};

/**
 * Config middleware for all path (API provided)
 - config cors ==> handle cross-origin resource sharing
 - config body-parser ==> Parse incoming request bodies ==> xu li cho nhieu kieu du lieu, thong thuong
    hay xu li cho du lieu tu form gui len hoac du lieu dang json, ngoai ra con co ho tro nhieu kieu du 
    lieu khac
 - 
 */
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Instagram API Back-end",
      version: "1.0.0",
      description: "API Instagram",
      license: {
        name: "MIT",
        url: "https://spdx.org/licenses/MIT.html",
      },
    },
    servers: [
      {
        url: "http://localhost:5001",
        description: "Development server",
      },
    ],
  },
  apis: ["./src/routes/*.js"],
};

const specs = swaggerJsdoc(options);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// config cors for all path of application  => default path: "/", doc co ghi : ))
app.use(cors(corOptions));

app.use(express.static("public"));

// Setup for secure api
app.use(helmet({ crossOriginResourcePolicy: false }));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.use(morgan("dev"));

// parse cookie header to data and assign it to req.cookies
app.use(cookieParser());

// oauth2 router
app.use("/api/v1", oauth2Route);

// use middleware authentication
app.use("/api/v1", routerAuthen);

// register router
app.use("/api/v1", routerRegister);

app.use("/api/v1", routerPost);

app.use("/api/v1", likeRouter);

app.use("/api/v1", commentRouter);

app.use("/api/v1", storyRouter);

app.use("/api/v1", routerRelationship);

app.use("/api/v1", userRoute);
app.use("/api/v1", messageRoute);

// Catch 404 error (if user find some path not found on my app, it will generate status 404 for that)
app.use((req, res, next) => {
  const err = new Error("Not found");
  err.status = 404;
  next(err);
});

// handle for error path : ) but actually it should only handle for 404
app.use((err, req, res, next) => {
  const error = err;
  const status = error.status || 500;

  return res.status(status).json({
    error: {
      message: error.message,
    },
  });
});

server.listen(process.env.BACKEND_PORT, () => {
  console.log("CORS-enabled web server");
  console.log(`Backend is listening on port ${process.env.BACKEND_PORT}`);
});
