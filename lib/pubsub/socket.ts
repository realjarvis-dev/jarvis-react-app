// lib/socket.ts
import { io } from 'socket.io-client';
const socket = io(process.env.NEXT_PUBLIC_TEST_NET_ENV === 'development' ? "http://localhost:3002" : "https://jarvis-alert.onrender.com");
export default socket;
