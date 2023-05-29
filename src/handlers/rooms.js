/* eslint-disable linebreak-style */
/* eslint-disable indent */
import { createRoom } from '../repositories/rooms';

async function removeUserFromRoom(socketId) {
    await Room.findOne({ 'users.socketId': socketId }).exec()
        .then((room) => {
            if (room) {
                const index = room.users.findIndex((user) => user.socketId === socketId);
                if (index !== -1) {
                    const user = room.users[index];
                    room.users.splice(index, 1);
                    room.save();
                }
            }
        });
}

async function getAllRooms() {
    await Room.find({}).exec()
        .then((rooms) => {
            if (rooms.length > 0) {
                io.emit('updateRooms', {
                    numberOfRooms: rooms.length,
                    rooms: rooms.map((room) => [room.roomName, room.roomId, room.hasPassword, room.isFull, room.users.length]),
                });
            } else {
                io.emit('updateRooms', {
                    numberOfRooms: 0,
                    rooms: null,
                });
            }
        });
}

const updateOwner = async (roomId, owner) => {
    try {
        const oldRoom = await Room.findOneAndUpdate({ roomId }, { owner });
        if (!oldRoom) {
            console.log('Sala não encontrada');
            throw new Error('Sala não encontrada');
        }
    } catch (error) {
        console.log(error);
    }
};

const updateRoomState = async (roomId, state) => {
    try {
        const oldRoom = await Room.findOneAndUpdate({ roomId }, { state });
        if (!oldRoom) {
            console.log('Sala não encontrada');
            throw new Error('Sala não encontrada');
        }

        systemMessage(roomId, state.type);
        io.to(roomId).emit('gameStateUpdated', state);
    } catch (error) {
        console.log(error);
    }
};

export const roomHandlers = (socket) => {
    socket.on('createRoom', async ({ roomName, password }) => {
        try {
            const createdRoom = await createRoom({ roomName, password, owner: socket.id });
            socket.emit('roomId', createdRoom.roomId);
            getAllRooms();
        } catch (error) { socket.emit('roomCreated', error); }
    });

    socket.on('joinRoom', async ({ roomId, password, userEmail }) => {
        try {
            const room = await Room.findOne({ roomId }).exec();
            if (!room) return socket.emit('joined', false);

            if (room.state.type !== 'idle') return socket.emit('joined', false);
            if (room.isFull) return socket.emit('joined', false);
            if (room.password.length > 0 && room.password !== password) return socket.emit('joined', false);
            if (room.users.find((user) => user.userEmail === userEmail)) return socket.emit('joined', false);

            socket.join(roomId);
            room.users.push({
                userEmail, socketId: socket.id, position: 0, money: 12980000, cards: [],
            });
            room.save();

            socket.emit('joined', true);
            getAllRooms();
        } catch (error) { console.log('Erro ao buscar sala:', error); }
    });

    socket.on('getRooms', getAllRooms);

    socket.on('getPlayers', async (roomId) => {
        await Room.findOne({ roomId }).exec()
            .then((room) => {
                io.to(roomId).emit('returnPlayer', room?.users);
            });
    });

    socket.on('getOwner', async (roomId) => {
        await Room.findOne({ roomId }).exec()
            .then((room) => {
                io.to(roomId).emit('returnOwner', room?.owner);
            });
    });

    socket.on('leaveRoom', ({ roomId }) => {
        socket.leave(roomId);
        removeUserFromRoom(socket.id);
    });

    socket.on('rollDices', async ({
        roomId, value, userEmail, numberOfCells,
    }) => {
        await Room.findOne({ roomId }).exec()
            .then(async (room) => {
                for (let i = 0; i < room.users.length; i++) {
                    if (room.users[i].userEmail === userEmail) {
                        if ((value + room.users[i].position) >= numberOfCells) {
                            room.users[i] = {
                                ...room.users[i],
                                position: (value + room.users[i].position) % numberOfCells,
                                money: Number(Number(room.users[i].money) + 200),
                            };
                        } else {
                            room.users[i] = {
                                ...room.users[i],
                                position: (value + room.users[i].position) % numberOfCells,
                            };
                        }
                        break;
                    }
                }
                if (room.currentTurn === room.users.length - 1) { // numero iguais joga dnv
                    room.currentTurn = 0;
                } else room.currentTurn += 1;
                room.save();
                io.to(roomId).emit('playersStates', {
                    users: room?.users,
                    currentTurn: room.currentTurn,
                });
            })
            .catch((err) => console.log(err));
    });
};

export const roomWhenDisconnect = (socket) => {
    removeUserFromRoom(socket.id);
};
