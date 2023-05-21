import mongoose from 'mongoose';

export const roomSchema = new mongoose.Schema({
  roomId: String,
  roomName: String,
  password: String,
  link: String,
  users: [],
  isFull: Boolean,
  hasPassword: Boolean,
  diceWinners: [],
  states: {
    type: String, // turn || wait || winner || rollingDices
    duration: String
  }
});
