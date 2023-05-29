import mongoose from 'mongoose';

export const userSchema = new mongoose.Schema({
  socketId: String,
  userName: String,
  joinedAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },

  // game-related
  position: Number,
  money: Number,
  cards: [],
});

export const roomSchema = new mongoose.Schema({
  roomId: String,
  roomName: String,
  password: String,
  link: String,

  // user-related
  owner: userSchema.socketId,
  users: [userSchema],
  diceWinners: [userSchema],
  maxUsers: {
    $type: Number,
    default: 4,
  },

  // game-related
  currentTurn: Number,
  state: {
    type: String, // turn || wait || winner || rollingDices
    duration: String
  },
}, {
  virtuals: {
    isFull: {
      get() {
        return this.users.length === this.maxUsers
      }
    },
    hasPassword: {
      get() {
        return this.password.length > 0
      }
    }
  },
  typeKey: '$type'
});