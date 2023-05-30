/* eslint-disable linebreak-style */
/* eslint-disable import/no-cycle */
/* eslint-disable indent */
/* eslint-disable no-console */

import * as dotenv from 'dotenv';
import { createServer } from 'http';
import { mongoose } from 'mongoose';
import { Server } from 'socket.io';

import { startRoomHandlers, roomWhenDisconnect } from './handlers/rooms.js';
import { roomSchema, userSchema } from './schemas/index.js';

dotenv.config();
const mongoURL = process.env.MONGOURL_ATLAS;
const { PORT } = process.env;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const main = (socket) => {
  console.log('Novo usuário conectado:', socket.id);

  startRoomHandlers(socket);

  socket.on('disconnect', () => {
    roomWhenDisconnect(0, socket);
  });
};

await mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true });
console.log('Connected successfully to MongoDB');

const Rooms = mongoose.model('Room', roomSchema);
Rooms.deleteMany({})
  .then(() => console.log('As rooms foram deletadas!'))
  .catch((err) => console.log(err));

const Users = mongoose.model('Users', userSchema);
Users.deleteMany({})
  .then(() => console.log('Os users foram deletados!'))
  .catch((err) => console.log(err));

io.on('connection', main);

httpServer.listen(PORT, () => {
  console.log(`Servidor Socket.IO em execução na porta ${PORT}`);
});