import * as dotenv from 'dotenv';
import { createServer } from 'http';
import { mongoose } from 'mongoose';
import { nanoid } from 'nanoid';
import { Server } from 'socket.io';

import { roomSchema } from './schemas/index.js';

const httpServer = createServer();
dotenv.config();

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
  },
});

const mongoURL = process.env.MONGOURL;
const { PORT } = process.env;

mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true }).then(() => {
  console.log('Connected successfully to MongoDB');

  const Room = mongoose.model('Room', roomSchema);

  const usersInRooms = {};

  io.on('connection', (socket) => {
    console.log('Novo usuário conectado:', socket.id);

    socket.on('createRoom', async (roomName, password) => {
      if (roomName && roomName.length > 0) {
        const roomId = nanoid(8);
        const link = `http://localhost:3000/room/${roomId}`;

        await Room.find({ roomName }).exec()
          .then((room) => {
            if (room.length === 0) {
              Room.create({
                roomId, roomName, password, link, isFull: false,
              })
                .then(() => {
                  console.log('Sala criada com sucesso:', roomName);
                  socket.emit('roomCreated', link);
                });
            } else {
              socket.emit('roomCreated', `A sala: ${roomName} já existe`);
            }
          })
          .catch((error) => console.log(error));
      } else {
        socket.emit('roomCreated', 'Você precisa dar um nome para a sala!');
      }
    });

    socket.on('joinRoom', (roomId, password) => {
      if (usersInRooms[roomId] && usersInRooms[roomId].includes(socket.id)) {
        console.log('Usuário já está na sala:', roomId);
        return;
      }
      Room.findOne({ roomId }).exec()
        .then((room) => {
          if (room) {
            if (room.password && room.password === password) {
              socket.join(roomId);
              if (!usersInRooms[roomId]) {
                usersInRooms[roomId] = [];
              }
              usersInRooms[roomId].push(socket.id);
              console.log('Usuário', socket.id, 'entrou na sala:', room.roomName);
            } else {
              console.log('Senha incorreta!');
            }
          }
        });
    });

    socket.on('leaveRoom', (roomId) => {
      socket.leave(roomId);

      if (usersInRooms[roomId]) {
        const index = usersInRooms[roomId].indexOf(socket.id);
        if (index !== -1) {
          usersInRooms[roomId].splice(index, 1);
        }
      }
      console.log('Usuário', socket.id, 'saiu da sala:', roomId);
    });
    socket.on('sendMessage', (roomId, message) => {
      io.to(roomId).emit('receiveMessage', socket.id, message);
    });

    socket.on('getRooms', async () => {
      await Room.find({}).exec()
        .then((rooms) => {
          if (rooms.length > 0) socket.emit('updateRooms', rooms.map((room) => room.roomName), rooms.map((room) => room.users.length));
          else socket.emit('updateRooms', 'Não existem salas criadas!');
        });
    });

    socket.on('disconnect', () => {
      console.log('Usuário desconectado:', socket.id);
    });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor Socket.IO em execução na porta ${PORT}`);
});
