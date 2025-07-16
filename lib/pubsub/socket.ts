// lib/socket.ts
import { io } from 'socket.io-client';
const socket = io(process.env.PRICE_ALERT_INTERNAL_URL || "http://localhost:3002");
export default socket;
