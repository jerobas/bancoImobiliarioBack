/* eslint-disable linebreak-style */
/* eslint-disable indent */
/* eslint-disable import/no-cycle */

import { mongoose } from 'mongoose';

import { userSchema } from '../schemas/index.js';
import * as Rooms from './rooms.js';

const Users = mongoose.model('Users', userSchema);

const findIfExists = async (socketId) => {
    const user = await Users.findOne({ socketId }).exec();
    return user;
};

const find = async (socketId) => {
    const user = await findIfExists(socketId);
    if (!user) {
        throw new Error('User not found');
    }
    return user;
};

const remove = async (socketId) => {
    const user = await find(socketId);
    const currentRoom = await Rooms.findIfExists({ roomId: user.currentRoom }).exec();
    if (currentRoom) {
        await Rooms.removeUser(currentRoom.roomId, socketId);
    }
    await user.remove();
};

const removeAll = async () => Users.deleteMany({});

const createIfDontExist = async ({ socketId, roomId, username }) => new Users({
    socketId,
    currentRoom: roomId,
    userName: username,
}).save();

const create = async ({ socketId, roomId, username }) => {
    const user = await findIfExists(socketId);
    if (user) {
        Rooms.removeUser(user.currentRoom, socketId);
        return user;
    }

    return createIfDontExist({ socketId, roomId, username });
};

export {
    Users as mongooseModel,
    find,
    findIfExists,
    remove,
    removeAll,
    create,
    createIfDontExist,
};
