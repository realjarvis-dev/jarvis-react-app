'use client'

import { usePrivy } from '@privy-io/react-auth'
import { createContext, ReactNode, useContext, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import socket from '@/lib/pubsub/socket'

interface SocketContextType {
    socket: typeof socket
  }
  
const SocketContext = createContext<SocketContextType>({ socket })
export const useSocket = () => useContext(SocketContext)

export const SocketProvider = ({ children }: { children: ReactNode }) => {
    const { ready, authenticated, user } = usePrivy()
  
    useEffect(() => {
        console.log("Socket provider use effect")
        console.log(typeof window === "undefined")
        console.log(!ready)
        console.log(!authenticated)
      if (!ready || !authenticated) return
        console.log("Socket provider use effect 2")

      const room = user?.id.split(':').at(-1)
      const onConnect = () => {
        console.log('socket connected, subscribing to room', room)
        
      }
      const onPriceAlert = (data: { message: string }) => {
        console.log('receive price alert', data.message)
        toast.info(data.message)
      }
      const onDisconnect = () => {
        console.log('socket disconnected')
        
      }

  
      socket.on('connect', onConnect)
      socket.on('priceAlert', onPriceAlert)
      socket.on('disconnect', onDisconnect)
      socket.onAny((event, ...args) => {
        console.log('[onAny] got event', event, args)
      })
      
      socket.emit('ping', 'hello', (response: any) => {
        console.log('ack response:', response);
      });
      room && socket.emit('subscribe', room)


      if (!socket.connected && !socket.io.opts.autoConnect) {
        console.log("Socket. connect")
        socket.connect()
      }
      return () => {
        socket.off('connect', onConnect)
        socket.off('priceAlert', onPriceAlert)
        socket.off('disconnect', onDisconnect)
        room && socket.emit('unsubscribe', room)
        socket.disconnect()
      }
    }, [ready, authenticated, user])
  
    return (
      <SocketContext.Provider value={{ socket }}>
        {children}
      </SocketContext.Provider>
    )
  }