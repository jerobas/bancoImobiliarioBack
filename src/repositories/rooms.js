/* eslint-disable linebreak-style */
/* eslint-disable indent */

import { mongoose } from 'mongoose';

import { roomSchema } from '../schemas';
import { isValidRoomName } from '../utils/rooms';

const Room = mongoose.model('Room', roomSchema);

const findRoom = async (roomId) => {
    const room = await findRoomIfExist(roomId);
    if (!room) {
        throw new Error('Room not found');
    }
    return room;
};

const findRoomIfExist = async (roomId) => {
    const room = await Room.findOne({ roomId }).exec();
    return room;
};

const deleteRoom = async (roomId) => {
    const room = await findRoom(roomId);
    await room.remove();
};

const deleteAllRooms = async () => Room.deleteMany({});

const createRoom = async ({ roomName, password, owner }) => {
    if (!isValidRoomName(roomName)) throw new Error('Você precisa dar um nome para a sala!');
    if (findRoomIfExist(roomName)) throw new Error(`A sala: ${roomName} já existe`);

    const roomId = nanoid(8);

    return await new Room({
        roomId,
        roomName,
        password,
        currentTurn: 0,
        owner,
        state: States.idle(),
    }).save();
};

const removePlayer = async (roomId, socketId) => {
    const room = await findRoom(roomId);
    const user = await room.users.find((user) => user.socketId === socketId);
    if (!user) {
        throw new Error('User not in room');
    }
    await user.remove();
};

const addPlayer = async (roomId, socketId, username) => {
    const room = await findRoom(roomId);
    const user = await room.users.find((user) => user.socketId === socketId);
    if (user) {
        throw new Error('User already in room');
    }
    await room.users.push({ socketId, username });
    await room.save();
};

export {
    Room,
    findRoomIfExist,
    deleteRoom,
    deleteAllRooms,
    createRoom,
    removePlayer,
    addPlayer,
};
