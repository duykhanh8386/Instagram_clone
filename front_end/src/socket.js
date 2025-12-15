import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5001";

const socket = io(SOCKET_URL, {
  path: "/api/v1/message",
  transports: ["websocket"],
  autoConnect: false,
  withCredentials: true,
});

export const ensureSocketConnected = () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (user?.id) socket.io.opts.query = { userId: user.id };

  if (!socket.connected) socket.connect();

  console.log("socket connected?", socket.connected, socket.id, "userId:", user?.id);

  socket.on("connect", () => {
    console.log("socket CONNECT event:", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.log("socket CONNECT ERROR:", err?.message || err);
  });

  return socket;
};

export default socket;
