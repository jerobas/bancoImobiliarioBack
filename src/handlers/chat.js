/* eslint-disable linebreak-style */
/* eslint-disable indent */
import * as Rooms from '../repositories/rooms.js';
import {formatUserIp} from '../utils/users.js'

export const handleChat = {
    chat: (socket, io) => async (roomId, message, user) => {
        try {
            const room = await Rooms.find(roomId)
            if (room && room.users.find((u) => u.userEmail === user || u.userIP === formatUserIp(socket.handshake.address))) {
                io.to(roomId).emit('receiveMessage', message, user);
            }
        } catch (error) {
            console.error(error);
        }
    },
    systemMessage: (io) => async (roomId, message) => {
        io.to(roomId).emit('receiveMessage', message, 'Sistema');
    }
}

export const chatService = (socket, io) => {
    Object.keys(handleChat).forEach((key) => {
        socket.on(`rooms:${key}`, handleChat[key](socket, io));
    })
}