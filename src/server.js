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

  // const usersInRooms = {};

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
                roomId, roomName, password, link, isFull: false, hasPassword: !!(password && password.length > 0),
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
      Room.findOne({ roomId }).exec()
        .then((room) => {
          if (room && room.users.length <= 4 && room.isFull === false) {
            if (room.password.length > 0 && room.password === password) {
              if (room.users.includes(socket.id)) {
                console.log('Usuário já está na sala:', roomId);
                socket.emit('joined', false);
                return;
              }

              socket.join(roomId);
              room.users.push(socket.id);
              if (room.users.length === 4) room.isFull = true;
              room.save();
              console.log('Usuário', socket.id, 'entrou na sala:', room.roomName);
              socket.emit('joined', true);
            } else if (room.password.length === 0) {
              if (room.users.includes(socket.id)) {
                console.log('Usuário já está na sala:', roomId);
                socket.emit('joined', false);
                return;
              }

              socket.join(roomId);
              room.users.push(socket.id);
              if (room.users.length === 4) room.isFull = true;
              room.save();
              console.log('Usuário', socket.id, 'entrou na sala:', room.roomName);
              socket.emit('joined', true);
            } else {
              console.log('Senha incorreta!');
              socket.emit('joined', false);
            }
          }
        });
    });

    socket.on('leaveRoom', (roomId) => {
      socket.leave(roomId);

      Room.findOne({ roomId }).exec()
        .then((room) => {
          if (room) {
            const index = room.users.indexOf(socket.id);
            if (index !== -1) {
              room.users.splice(index, 1);
              room.save();
            }
            console.log('Usuário', socket.id, 'saiu da sala:', roomId);
          }
        });
    });

    socket.on('sendMessage', (roomId, message) => {
      io.to(roomId).emit('receiveMessage', socket.id, message);
    });

    socket.on('getRooms', async () => {
      await Room.find({}).exec()
        .then((rooms) => {
          let response = [];
          if (rooms.length > 0) {
            socket.emit('updateRooms', {
              numberOfRooms: rooms.length,
              rooms: rooms.map((room) => [room.roomName, room.roomId, room.hasPassword, room.isFull, room.users.length])
            })
          } else socket.emit('updateRooms', 'Não existem salas criadas!');
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
