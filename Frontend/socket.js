import { io } from 'socket.io-client';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = Platform.OS === 'android' 
  ? 'http://10.0.2.2:3000' 
  : 'http://localhost:3000';

const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  transports: ['websocket']
});

// Connection lifecycle
socket
  .on('connect', () => console.log('🟢 Socket connected'))
  .on('disconnect', () => console.log('🟠 Socket disconnected'))
  .on('connect_error', (err) => console.log('🔴 Connection error:', err));

// Authentication helper
export const authenticateSocket = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) throw new Error('No token found');
    
    socket.auth = { token };
    socket.connect();
    
    return new Promise((resolve) => {
      socket.once('connect', () => resolve(true));
      socket.once('connect_error', () => resolve(false));
    });
  } catch (error) {
    console.error('Auth failed:', error);
    return false;
  }
};

export default socket;