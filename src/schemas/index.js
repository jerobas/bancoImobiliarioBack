import mongoose from 'mongoose';

export const cellSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, name: 'User' },
  cellId: Number,
  buildLevel: {
    type: Number,
    default: 0,
  },
  canHaveEvent: {
    type: Boolean,
    default: false,
  },
  // hasEvent: {
  //   type: Boolean,
  //   default: false,
  //   set: (value) => !(!this.canHaveEvent(value) || !value),
  // },
  currentRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
});

export const userSchema = new mongoose.Schema({
  socketId: String,
  userIP: String,
  userName: String,
  numberOfEqualDices: {
    type: Number,
    default: 0,
  },
  currentRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  joinedAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },

  state: {
    type: Number,
    default: 0,
  },
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
  users: [{ $type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  diceWinners: [mongoose.Schema.Types.ObjectId],
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
