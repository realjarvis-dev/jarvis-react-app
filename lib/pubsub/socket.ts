// lib/socket.ts
import { io } from 'socket.io-client';
const socket = io(process.env.PRICE_ALERT_INTERNAL_URL || "http://localhost:3002");

console.log("socket url", process.env.PRICE_ALERT_INTERNAL_URL)
export default socket;
