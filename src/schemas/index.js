import mongoose from 'mongoose';

export const roomSchema = new mongoose.Schema({
  roomId: String,
  roomName: String,
  password: String,
  link: String,
  owner: {
    socketId: String,
    userName: String,
  },
  users: [],
  isFull: Boolean,
  hasPassword: Boolean,
  diceWinners: [],
  state: {
    type: String, // turn || wait || winner || rollingDices
    duration: String
  },
}, {
  typeKey: '$type'
});
