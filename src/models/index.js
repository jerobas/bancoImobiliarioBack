import { mongoose } from 'mongoose';

import { roomSchema, userSchema, cellSchema } from '../schemas/index.js';

export const Rooms = mongoose.model('Room', roomSchema);
export const Users = mongoose.model('User', userSchema);
export const Cells = mongoose.model('Cell', cellSchema);
