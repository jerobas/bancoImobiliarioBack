/* eslint-disable linebreak-style */

/* eslint-disable no-console */

import * as dotenv from 'dotenv';
import { createServer } from 'http';
import { mongoose } from 'mongoose';
import { Server } from 'socket.io';

import {errorService} from './handlers/error.js';
import { chatService } from './handlers/chat.js';
import { gameService } from './handlers/game.js';
import { startRoomHandlers, roomWhenDisconnect } from './handlers/rooms.js';
import { Rooms, Users } from './models/index.js';

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
  startRoomHandlers(socket, io);
  chatService(socket, io);
  gameService(socket, io);
  errorService(socket, io)

  socket.on('disconnect', () => {
    roomWhenDisconnect(0, socket);
  });
};

await mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true });
console.log('Connected successfully to MongoDB');

Rooms.deleteMany({})
  .then(() => console.log('As rooms foram deletadas!'))
  .catch((err) => console.log(err));

Users.deleteMany({})
  .then(() => console.log('Os users foram deletados!'))
  .catch((err) => console.log(err));

io.on('connection', main);

httpServer.listen(PORT, () => {
  console.log(`Servidor Socket.IO em execução na porta ${PORT}`);
});
