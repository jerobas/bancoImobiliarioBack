import mongoose from 'mongoose';

export const roomSchema = new mongoose.Schema({
  roomId: String,
  roomName: String,
  password: String,
  owner: {
    socketId: String,
    userIP: String,
    userName: String,
  },
  users: [],
  currentTurn: Number,
  isFull: Boolean,
  hasPassword: Boolean,
  diceWinners: [],
  state: {
    type: String,
    duration: String
  },
}, {
  typeKey: '$type'
});
