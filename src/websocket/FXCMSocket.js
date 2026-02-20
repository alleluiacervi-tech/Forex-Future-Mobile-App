import { io } from 'socket.io-client';
import axios from 'axios';

const BASE_URL = 'https://api-demo.fxcm.com';

let socket = null;
let accessToken = null;

export const authenticate = async (login, password) => {
  const response = await axios.post(`${BASE_URL}/authenticate`, {
    login,
    password,
    type: 'Demo',
  });

  accessToken = response.data.access_token;
  console.log('Authenticated. Token:', accessToken);
  return accessToken;
};

export const connectSocket = () => {
  socket = io(BASE_URL, {
    query: { access_token: accessToken },
    secure: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => console.log('FXCM Socket Connected'));
  socket.on('disconnect', () => console.log('FXCM Socket Disconnected'));
  socket.on('connect_error', (err) => console.error('Connection error:', err.message));

  return socket;
};

export const subscribeToPair = (pair, callback) => {
  if (!socket) return;
  socket.emit('subscribe', { pairs: [pair] });
  socket.on(pair, callback);
};

export const unsubscribeFromPair = (pair) => {
  if (!socket) return;
  socket.emit('unsubscribe', { pairs: [pair] });
};

export const disconnectSocket = () => {
  socket?.disconnect();
};
