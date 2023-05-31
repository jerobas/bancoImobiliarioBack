/* eslint-disable linebreak-style */

/* eslint-disable indent */
import * as Rooms from '../repositories/rooms.js';
import * as User from '../repositories/users.js';
import { formatUserIp } from '../utils/users.js';

async function removeUserFromRoom(roomId, userIP) {
    await Rooms.removeUser(roomId, userIP);
}

async function getAllRooms(socket) {
    const rooms = await Rooms.getAll();
    if (rooms && rooms.length > 0) {
        socket.emit('updateRooms', {
            numberOfRooms: rooms.length,
            rooms: rooms.map((room) => [
                room.roomName,
                room.roomId,
                room.hasPassword,
                room.isFull,
                room.users?.length,
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

export const roomHandlers = {
    create: (socket) => async ({ roomName, password }) => {
        try {
            console.log('criando')
            const createdRoom = await Rooms.create({ roomName, password, owner: formatUserIp(socket.handshake.address) });
            console.log('createdRoom')
            socket.emit('roomId', createdRoom.roomId);
            getAllRooms(socket);
        } catch (error) {
            console.error(error);
            socket.emit('roomCreated', error);
        }
    },

    join: (socket) => async ({ roomId, password, userEmail }) => {
        try {
            const room = await Rooms.find(roomId);

            if (room.state.type !== 'idle') return socket.emit('joined', false);
            if (room.isFull) return socket.emit('joined', false);
            if (room.password.length > 0 && room.password !== password) return socket.emit('joined', false);
            if (room.users.find((user) => user.userEmail === userEmail)) return socket.emit('joined', false);

            await Rooms.addUser(roomId, userEmail, socket.id, formatUserIp(socket.handshake.address), room._id);
            socket.join(roomId);

            await room.save();
            socket.emit('joined', true);
            return getAllRooms(socket);
        } catch (error) { return console.log('Erro ao buscar sala:', error); }
    },

    getAll: (socket) => () => getAllRooms(socket),

    getUsers: (socket, io) => async (roomId) => {
        const room = await Rooms.find(roomId);
        io.to(roomId).emit('returnPlayer', room?.users);
    },

    getOwner: (socket, io) => async (roomId) => {
        const room = await Rooms.find(roomId);
        if (room) {
            io.to(roomId).emit('returnOwner', room.owner);
}
    },

    leave: (socket) => async (roomId) => {
        socket.leave(roomId);
        await removeUserFromRoom(roomId, formatUserIp(socket.handshake.address));
        getAllRooms(socket);
    },

    rollDices: (socket, io) => async ({
        roomId, value, userEmail, numberOfCells,
    }) => {
        try {
            const room = await Rooms.find(roomId);
            const sumOfDices = Number(value.d1) + Number(value.d2);
            let nextTurn = room.currentTurn + 1;
            const promises = [];

            const userPromises = room.users.map(async (user) => {
              if (user.userName === userEmail) {
                const currentUser = await User.find(user._id);

                if (currentUser.state != 0) {
                    if (value.d1 === value.d2) {
                      promises.push(User.update(user._id, { state: 0 }));
                      nextTurn = room.currentTurn;
                    } else {
                      promises.push(User.update(user._id, { $inc: { state: -1 } }));
                    }
                } else if (value.d1 === value.d2 && currentUser.numberOfEqualDices === 2) {
                  promises.push(User.update(user._id, { numberOfEqualDices: 0, position: 30, state: 3 }));
                } else if (value.d1 === value.d2) {
                  promises.push(User.update(user._id, { $inc: { numberOfEqualDices: 1 }, position: (sumOfDices + user.position) % numberOfCells }));
                  nextTurn = room.currentTurn;
                } else if (sumOfDices + user.position >= numberOfCells) {
                  promises.push(
                    User.update(user._id, {
                      position: (sumOfDices + user.position) % numberOfCells,
                      money: Number(user.money) + 200,
                    }),
                  );
                } else {
                  promises.push(
                    User.update(user._id, {
                      position: (sumOfDices + user.position) % numberOfCells,
                    }),
                  );
                }
              }
            });

            await Promise.all(userPromises);

            if (nextTurn === room.users.length) {
                nextTurn = 0;
            }

            room.currentTurn = nextTurn;

            console.log(`nextTurn: ${nextTurn}`);
            await room.save();

            const newRoom = await Rooms.find(roomId);
            console.log(`newRoom.currentTurn: ${newRoom.currentTurn}`);
            await io.to(roomId).emit('playersStates', {
              users: newRoom?.users,
              currentTurn: newRoom.currentTurn,
            });
          } catch (err) {
            console.log(err);
          }
    },
};

export const startRoomHandlers = (socket, io) => {
    Object.keys(roomHandlers).forEach((key) => {
        socket.on(`rooms:${key}`, roomHandlers[key](socket, io));
    });
};

export const roomWhenDisconnect = (roomId) => {
    // removeUserFromRoom(roomId, socket.id);
};
