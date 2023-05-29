/* eslint-disable linebreak-style */
/* eslint-disable indent */
/* eslint-disable no-console */

import * as dotenv from 'dotenv';
import { createServer } from 'http';
import { mongoose } from 'mongoose';
import { Server } from 'socket.io';

import { roomHandlers, roomWhenDisconnect } from './handlers/rooms';
import { roomSchema } from './schemas/index';

dotenv.config();
const mongoURL = process.env.MONGOURL_ATLAS;
const { PORT } = process.env;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

try {
  await mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected successfully to MongoDB');

  const Room = mongoose.model('Room', roomSchema);
  Room.deleteMany({})
    .then(() => console.log('As rooms foram deletadas!'))
    .catch((err) => console.log(err));

  const socket = await io.on('connection');
  console.log('Novo usuário conectado:', socket.id);

  roomHandlers(socket);

  socket.on('disconnect', () => {
    roomWhenDisconnect(socket);
  });
} catch (error) { console.log(error); }

httpServer.listen(PORT, () => {
  console.log(`Servidor Socket.IO em execução na porta ${PORT}`);
});
