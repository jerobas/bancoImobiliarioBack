/* eslint-disable linebreak-style */
/* eslint-disable indent */

socket.on('sendMessage', async (roomId, message, user) => {
    await Room.findOne({ roomId }).exec()
        .then((room) => {
            if (room && room.users.find((u) => u.userEmail === user && u.socketId === socket.id)) {
                io.to(roomId).emit('receiveMessage', message, user);
            }
        });
});

const systemMessage = (roomId, message) => io.to(roomId).emit('receiveMessage', message, 'Sistema');