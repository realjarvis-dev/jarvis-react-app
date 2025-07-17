// lib/socket.ts
import { io } from 'socket.io-client';
const socket = io(process.env.NEXT_PUBLIC_PRICE_ALERT_INTERNAL_URL);

console.log("socket url", process.env.NEXT_PUBLIC_PRICE_ALERT_INTERNAL_URL)
export default socket;
