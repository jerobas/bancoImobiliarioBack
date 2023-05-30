/* eslint-disable linebreak-style */
/* eslint-disable import/no-cycle */
/* eslint-disable indent */

import { mongoose } from 'mongoose';
import { nanoid } from 'nanoid';

import States from '../constants/rooms/states.js';
import { roomSchema } from '../schemas/index.js';
import { isValidRoomName } from '../utils/rooms.js';
import * as Users from './users.js';

const Rooms = mongoose.model('Rooms', roomSchema);

const getAll = async () => Rooms.find({}).exec();

const findIfExists = async (roomId) => {
    const room = await Rooms.findOne({ roomId }).exec();
    return room;
};

const find = async (roomId) => {
    const room = await findIfExists(roomId);
    if (!room) {
        throw new Error('Room not found');
    }
    return room;
};

const remove = async (roomId) => {
    const room = await find(roomId);
    await room.remove();
};

const removeAll = async () => Rooms.deleteMany({});

const create = async ({ roomName, password, owner }) => {
    console.log('room being recreated???');
    if (!isValidRoomName(roomName)) throw new Error('Você precisa dar um nome para a sala!');
    if (await findIfExists(roomName)) throw new Error(`A sala: ${roomName} já existe`);

    const roomId = nanoid(8);

    return new Rooms({
        roomId,
        roomName,
        password,
        currentTurn: 0,
        owner,
        state: States.idle('indeterminate'),
        // users: [],
    }).save();
};

const removeUser = async (roomId, socketId) => {
    const room = await find(roomId);
    const user = await room.users.find((u) => u.socketId === socketId);
    if (!user) {
        throw new Error('User not in room');
    }
    await user.remove();
};

const addUser = async (roomId, socketId, username, userIP) => {
    const room = await find(roomId);
    let user = await room.users.find((u) => u.socketId === socketId);
    if (user) throw new Error('User already in room');
    user = await Users.create({ socketId, roomId, username, userIP});
    room.users.push(user);
    await room.save();
};

export {
    getAll,
    Rooms as mongooseModel,
    find,
    findIfExists,
    remove,
    removeAll,
    create,
    removeUser,
    addUser,
};
