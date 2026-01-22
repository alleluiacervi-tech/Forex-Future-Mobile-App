import { WebSocketServer } from "ws";
import { getLiveRates } from "./rates.js";

const initializeSocket = ({ server, heartbeatMs }) => {
  const wss = new WebSocketServer({ server, path: "/ws/market" });

  const broadcastRates = () => {
    const payload = JSON.stringify({ type: "rates", data: getLiveRates() });
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    });
  };

  const interval = setInterval(broadcastRates, heartbeatMs);

  wss.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "welcome", message: "Connected to live rates." }));
    socket.send(JSON.stringify({ type: "rates", data: getLiveRates() }));
  });

  wss.on("close", () => {
    clearInterval(interval);
  });

  return wss;
};

export default initializeSocket;
