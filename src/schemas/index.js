import mongoose from 'mongoose';

export const userSchema = new mongoose.Schema({
  socketId: String,
  userIP: String,
  userName: String,
  currentRoom: { type: mongoose.Schema.Types.String, ref: 'Room' },
  joinedAt: {
    type: Date,
    default: Date.now,
    immutable: true,
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

  // user-related
  owner: String,
  users: [{ $type: mongoose.Schema.Types.String, ref: 'User' }],
  diceWinners: [Number],
  maxUsers: {
    $type: Number,
    default: 4,
  },

  // game-related
  currentTurn: Number,
  state: {
    type: String,
    duration: String,
  },
}, {
  virtuals: {
    isFull: {
      get() {
        return this.users?.length === this.maxUsers;
      },
    },
    hasPassword: {
      get() {
        return this.password.length > 0;
      },
    },
  },
  typeKey: '$type',
});
