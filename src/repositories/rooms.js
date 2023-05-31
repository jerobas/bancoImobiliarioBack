/* eslint-disable linebreak-style */
/* eslint-disable import/no-cycle */
/* eslint-disable indent */
import { nanoid } from 'nanoid';

import States from '../constants/rooms/states.js';
import { Rooms } from '../models/index.js';
import { isValidRoomName } from '../utils/rooms.js';
import * as Users from './users.js';

const getAll = async () => await Rooms.find().populate('users').exec();

const findIfExists = async (roomId) => {
    const room = await Rooms.findOne({ roomId }).populate('users').exec();
    return room;
};

const find = async (roomId) => {
    const room = await findIfExists(roomId);
    if (!room) {
        console.log('erro: sala n encontrada');
        // throw new Error('Room not found');
    }
    return room;
};

const remove = async (roomId) => {
    const room = await find(roomId);
    await room.remove();
};

const removeAll = async () => Rooms.deleteMany({});

const create = async ({ roomName, password, owner }) => {
    try {
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
    }).save();
    } catch (error) {
        console.log(error)
    }
};

const removeUser = async (roomId, userIP) => {
    const room = await find(roomId);
    let userIndex = 0;
    if (room) {
        const user = await room?.users.find((u, i) => {
            if (u.userIP === userIP) {
                userIndex = i;
                return true;
            }
        });
        room.users.splice(userIndex, 1);
        await room.save();
        if (user) {
            await Users.remove(user._id);
        }
    }
};

const addUser = async (roomId, socketId, username, userIP, objectId) => {
    const room = await find(roomId);
    // let user = await room.users.find((u) => u.socketId === socketId);
    // console.log(user)
    // if (user) throw new Error('User already in room');
    const user = await Users.create({
 socketId, roomId, username, userIP, objectId,
});
    await room.users.push(user);
    await room.save();
};

const update = async (roomId, newState) => await Rooms.findOneAndUpdate({ roomId }, { ...newState });

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
    update,
};
