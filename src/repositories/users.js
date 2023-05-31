/* eslint-disable linebreak-style */
/* eslint-disable indent */
/* eslint-disable import/no-cycle */
import { Users, Rooms as Room } from '../models/index.js';
import * as Rooms from './rooms.js';

const findIfExists = async (socketId) => {
    const user = await Users.findOne({ _id: socketId }).exec();
    return user;
};

const find = async (socketId) => {
    const user = await findIfExists(socketId);
    if (!user) {
        throw new Error('User not found');
    }
    return user;
};

const remove = async (ObjectId) => {
    const user = await find(ObjectId);
    const currentRoom = await Room.findOne({ _id: user.currentRoom }).exec();
    await Users.deleteOne({ _id: ObjectId });
    if (currentRoom && currentRoom.users.includes(user)) {
        console.log('ds');
        await Rooms.removeUser(currentRoom.roomId, user.userIP);
    }
};

const update = async (_id, newState) => await Users.findOneAndUpdate({ _id }, { ...newState });

const removeAll = async () => Users.deleteMany({});

const createIfDontExist = async ({
 socketId, roomId, username, userIP, objectId,
}) => new Users({
    socketId: username,
    currentRoom: objectId,
    userName: socketId,
    userIP,
    position: 0,
    money: 0,
    cards: [],
}).save();

const create = async ({
 socketId, roomId, username, userIP, objectId,
}) => {
    const user = await findIfExists(objectId);
    if (user) {
        Rooms.removeUser(user.currentRoom, socketId);
        return user;
    }
    return createIfDontExist({
 username, roomId, socketId, userIP, objectId,
});
};

export {
    Users as mongooseModel,
    find,
    findIfExists,
    remove,
    removeAll,
    create,
    createIfDontExist,
    update,
};
