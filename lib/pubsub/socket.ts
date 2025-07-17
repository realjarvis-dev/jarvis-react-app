// lib/socket.ts
import { io } from 'socket.io-client';
const socket = io(
    process.env.NEXT_PUBLIC_TEST_NET_ENV === 'development' ? "http://localhost:3002" : "https://jarvis-alert.onrender.com",
    {
        transports: ['websocket'],   // 强制 WS
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        withCredentials: true,
        timeout: 20000,  
    }   
);
export default socket;
