import {Cells} from '../models/index.js';
import * as Users from './users.js';

const getAll = async () => await Cells.find().exec()

const getById = async (cellId, roomId) => await Cells.findOne({cellId: cellId, currentRoom: roomId}).exec()

const createCell = async (roomId, userId, cellId) => {
    return new Cells({
        owner: userId,
        cellId: cellId,
        currentRoom: roomId
    }).save();
}

export {
    getAll,
    getById,
    createCell
};


// buy / sell/ addProps/ event