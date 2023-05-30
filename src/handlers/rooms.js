/* eslint-disable linebreak-style */
/* eslint-disable import/no-cycle */
/* eslint-disable indent */
import * as Rooms from '../repositories/rooms.js';

async function removeUserFromRoom(roomId, socketId) {
    Rooms.removeUser(roomId, socketId);
}

async function getAllRooms(socket) {
    const rooms = await Rooms.getAll();
    if (rooms.length > 0) {
        console.log(rooms);
        socket.emit('updateRooms', {
            numberOfRooms: rooms.length,
            rooms: rooms.map((room) => [
                room.roomName,
                room.roomId,
                room.hasPassword,
                room.isFull,
                room.users.length,
            ]),
        });
    } else {
        socket.emit('updateRooms', {
            numberOfRooms: 0,
            rooms: null,
        });
    }
}

// const updateOwner = async (roomId, owner) => {
//     try {
//         const oldRoom = await Room.findOneAndUpdate({ roomId }, { owner });
//         if (!oldRoom) {
//             console.log('Sala não encontrada');
//             throw new Error('Sala não encontrada');
//         }
//     } catch (error) {
//         console.log(error);
//     }
// };

// const updateRoomState = async (roomId, state) => {
//     try {
//         const oldRoom = await Room.findOneAndUpdate({ roomId }, { state });
//         if (!oldRoom) {
//             console.log('Sala não encontrada');
//             throw new Error('Sala não encontrada');
//         }

//         systemMessage(roomId, state.type);
//         io.to(roomId).emit('gameStateUpdated', state);
//     } catch (error) {
//         console.log(error);
//     }
// };

export const roomHandlers = {
    create: socket => async ({ roomName, password }) => {
        try {
            const createdRoom = await Rooms.create({ roomName, password, owner: socket.id });
            socket.emit('roomId', createdRoom.roomId);
            console.log('======CREATE======');
            getAllRooms(socket);
        } catch (error) {
            console.error(error);
            socket.emit('roomCreated', error);
        }
    },

    join: socket => async ({ roomId, password, userEmail }) => {
        try {
            const room = await Rooms.find(roomId);

            if (room.state.type !== 'idle') return socket.emit('joined', false);
            if (room.isFull) return socket.emit('joined', false);
            if (room.password.length > 0 && room.password !== password) return socket.emit('joined', false);
            if (room.users.find((user) => user.userEmail === userEmail)) return socket.emit('joined', false);

            Rooms.addUser(roomId, userEmail, socket.id);
            socket.join(roomId);

            socket.emit('joined', true);
            console.log('======JOIN======');
            return getAllRooms(socket);
        } catch (error) { return console.log('Erro ao buscar sala:', error); }
    },

    getAll: socket => () => getAllRooms(socket),

    getUsers: socket => async (roomId) => {
        const room = await Rooms.find(roomId);
        socket.to(roomId).emit('returnPlayer', room?.users);
    },

    getOwner: socket => async (roomId) => {
        const room = await Rooms.find(roomId);
        socket.to(roomId).emit('returnOwner', room?.owner);
    },

    leave: socket => ({ roomId }) => {
        socket.leave(roomId);
        removeUserFromRoom(roomId, socket.id);
    },

    rollDices: socket => async ({
        roomId, value, userEmail, numberOfCells,
    }) => {
        try {
            const room = await Rooms.find(roomId);
            for (let i = 0; i < room.users.length; i += 1) {
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
            return socket.to(roomId).emit('playersStates', {
                users: room?.users,
                currentTurn: room.currentTurn,
            });
        } catch (err) {
            return console.log(err);
        }
    },
};

export const startRoomHandlers = (socket) => {
    Object.keys(roomHandlers).forEach((key) => {
        socket.on(`rooms:${key}`, roomHandlers[key](socket));
    });
};

export const roomWhenDisconnect = (roomId) => {
    //removeUserFromRoom(roomId, socket.id);
};
