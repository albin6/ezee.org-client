import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/features/auth/store/auth.store';

class SocketService {
  private socket: Socket | null = null;
  private currentToken: string | null = null;

  private getSocketUrl() {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
    // Remove '/api/v1' from the base URL to get the root server URL for websocket
    return apiBase.replace(/\/api\/v\d+$/, '');
  }

  public connect(): Socket {
    const token = useAuthStore.getState().accessToken;

    if (!token) {
      throw new Error('Cannot connect to socket without an access token');
    }

    if (!this.socket || this.currentToken !== token) {
      if (this.socket) {
        this.socket.disconnect();
      }

      this.currentToken = token;
      
      this.socket = io(this.getSocketUrl(), {
        auth: { token },
        reconnection: true, // socket.io handles this out of the box
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
      });

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket?.id);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message);
      });
    }

    return this.socket;
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentToken = null;
    }
  }

  public getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
