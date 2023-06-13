/* eslint-disable linebreak-style */
/* eslint-disable import/no-cycle */
/* eslint-disable indent */
import { nanoid } from 'nanoid';

import States from '../constants/rooms/states.js';
import { Rooms } from '../models/index.js';
import { isValidRoomName } from '../utils/rooms.js';
import * as Users from './users.js';
const getAll = async () => await Rooms.find().populate('users').exec();

const findIfExistsByName = async(roomName) => {
    const room = await Rooms.findOne({ roomName }).exec();
    return room;
}

const findIfExists = async (roomId) => {
    const room = await Rooms.findOne({ roomId }).populate('users').exec();
    return room;
};

const find = async (roomId) => {
    const room = await findIfExists(roomId);
    if (!room) {
        // throw new Error('Sala não encontrada')
    }
    return room;
};

const remove = async (roomId) => {
    const room = await find(roomId);
    await Rooms.deleteOne({_id: room._id});
};

const removeAll = async () => Rooms.deleteMany({});

const create = async ({ roomName, password, owner }) => {
    try {
        const roomId = nanoid(8);
        if (!isValidRoomName(roomName)) return false
        if (await findIfExistsByName(roomName)) return false

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
