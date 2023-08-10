/* eslint-disable linebreak-style */

/* eslint-disable no-console */

import * as dotenv from 'dotenv';
import { createServer } from 'http';
import { mongoose } from 'mongoose';
import { Server } from 'socket.io';

// import {errorService} from './handlers/error.js';
import { chatService } from './handlers/chat.js';
import { gameService } from './handlers/game.js';
import { startRoomHandlers, roomWhenDisconnect } from './handlers/rooms.js';
import { Rooms, Users } from './models/index.js';
import errorService from './handlers/error.js'
import { formatUserIp } from './utils/users.js';

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
  const handleError = new errorService(socket, io)
  
  socket.emit('myIP', formatUserIp(socket.handshake.address))

  startRoomHandlers(socket, io, handleError);
  chatService(socket, io, handleError);
  gameService(socket, io, handleError);
  

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
