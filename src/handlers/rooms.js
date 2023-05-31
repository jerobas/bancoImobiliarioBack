/* eslint-disable linebreak-style */
/* eslint-disable import/no-cycle */
/* eslint-disable indent */
import * as Rooms from '../repositories/rooms.js';
import * as User from '../repositories/users.js';
import {formatUserIp} from '../utils/users.js'


async function removeUserFromRoom(roomId, socketId) {
    Rooms.removeUser(roomId, socketId);
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
    create: socket => async ({ roomName, password }) => {
        try {
            const createdRoom = await Rooms.create({ roomName, password, owner: formatUserIp(socket.handshake.address) });
            socket.emit('roomId', createdRoom.roomId);
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

            Rooms.addUser(roomId, userEmail, socket.id, formatUserIp(socket.handshake.address), room._id);
            socket.join(roomId);

            await room.save()
            socket.emit('joined', true);
            return getAllRooms(socket);
        } catch (error) { return console.log('Erro ao buscar sala:', error); }
    },

    getAll: socket => () => getAllRooms(socket),

    getUsers: (socket,  io) => async (roomId) => {
        const room = await Rooms.find(roomId);
        io.to(roomId).emit('returnPlayer', room?.users);
    },

    getOwner: (socket, io) => async (roomId) => {
        const room = await Rooms.find(roomId);
        if(room){
            io.to(roomId).emit('returnOwner', room.owner);}
    },

    leave: socket => ({ roomId }) => {
        socket.leave(roomId);
        removeUserFromRoom(roomId, socket.id);
    },

    rollDices: (socket, io) => async ({
        roomId, value, userEmail, numberOfCells,
    }) => {
        try {
            const room = await Rooms.find(roomId);
            let sumOfDices = Number(value.d1) + Number(value.d2);
            let nextTurn = room.currentTurn + 1;

            for (let i = 0; i < room.users.length; i += 1) {
                if (room.users[i].userName === userEmail) {
                    let currentUser = await User.find(room.users[i]._id)



                    if(value.d1 === value.d2 && currentUser.numberOfEqualDices == 2){
                        await User.update(room.users[i]._id, {numberOfEqualDices: 0, position: 30})
                        break;
                    }
                    if(value.d1 === value.d2) {
                        await User.update(room.users[i]._id, {$inc : {numberOfEqualDices : 1}})
                        nextTurn = room.currentTurn;
                    }
                    if ((sumOfDices + room.users[i].position) >= numberOfCells) {
                        await User.update(
                        room.users[i]._id, 
                            {
                                position: (sumOfDices + room.users[i].position) % numberOfCells,
                                money: Number(room.users[i].money) + 200
                            }
                        )
                        
                    } else {
                        await User.update(
                            room.users[i]._id, 
                                {
                                    position: (sumOfDices + room.users[i].position) % numberOfCells
                                }
                            )
                    }  
                    break;



                }
            }
            if (room.currentTurn === room.users.length - 1) {
                room.currentTurn = 0;
            } else room.currentTurn = nextTurn;
            room.save();
            const newRoom = await Rooms.find(roomId);
            return io.to(roomId).emit('playersStates', {
                users: newRoom?.users,
                currentTurn: newRoom.currentTurn,
            });
        } catch (err) {
            return console.log(err);
        }
    },
};

export const startRoomHandlers = (socket, io) => {
    Object.keys(roomHandlers).forEach((key) => {
        socket.on(`rooms:${key}`, roomHandlers[key](socket, io));
    });
};

export const roomWhenDisconnect = (roomId) => {
    //removeUserFromRoom(roomId, socket.id);
};
