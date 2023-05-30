/* eslint-disable linebreak-style */
/* eslint-disable indent */
import * as Rooms from '../repositories/rooms.js';

export const handleChat = {
    chat: (socket, io) => async (roomId, message, user) => {
        try {
            const room = await Rooms.find(roomId)
            console.log(socket.handshake.address)
            if(room)
                io.to(roomId).emit('receiveMessage', message, user);
            // if (room && room.users.find((u) => u.userEmail === user && u.socketId === socket.id)) {
            //     
            // }
        } catch (error) {
            console.error(error);
        }
    },
    systemMessage: (socket, io) => async (roomId, message) => {
        io.to(roomId).emit('receiveMessage', message, 'Sistema');
    }
}

export const chatService = (socket, io) => {
    Object.keys(handleChat).forEach((key) => {
        socket.on(`rooms:${key}`, handleChat[key](socket, io));
    })
}