import { Cells } from '../models/index.js';
import * as Users from './users.js';

const getAll = async () => await Cells.find().exec();

const getById = async (cellId, roomId) => await Cells.findOne({ cellId, currentRoom: roomId }).exec();

const createCell = async (roomId, userId, cellId) => new Cells({
  owner: userId,
  cellId,
  currentRoom: roomId,
}).save();

const update = async (cellId, newState) => {
  await Cells.findOneAndUpdate({ _id: cellId }, { ...newState });
};

export {
  getAll, getById, createCell, update,
};

// buy / sell/ addProps/ event
