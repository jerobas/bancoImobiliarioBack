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
    origin: '*',
  },
});

const mongoURL = process.env.MONGOURL_ATLAS;
const { PORT } = process.env;

mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true }).then(() => {
  console.log('Connected successfully to MongoDB');

  const Room = mongoose.model('Room', roomSchema);

  Room.deleteMany({})
    .then(() => console.log('As rooms foram deletadas!'))
    .catch(err => console.log(err))

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
                roomId,
                roomName,
                password,
                link,
                isFull: false,
                hasPassword: !!(password && password.length > 0),
                state: {
                  type: 'idle',
                  duration: 'indeterminate',
                },
              })
                .then(() => {
                  console.log('Sala criada com sucesso:', roomName);
                  getAllRooms()
                });
            } else {
              socket.emit('roomCreated', `A sala: ${roomName} já existe`);
            }
          })
          .catch((error) => {
            console.log('Erro ao buscar sala:', error);
          });
      } else {
        socket.emit('roomCreated', 'Você precisa dar um nome para a sala!');
      }
    });

    socket.on('joinRoom', async ({ roomId, password, userEmail }) => {
      await Room.findOne({ roomId }).exec()
        .then((room) => {
          if (room && room.users.length <= 4 && room.isFull === false) {
            if (room.password.length > 0 && room.password === password) {
              if (room.users.find((user) => user.userEmail === userEmail)) {
                console.log('Usuário já está na sala:', room.roomName);
                socket.emit('joined', false);
                return;
              }

              socket.join(roomId);
              room.users.push({ userEmail, socketId: socket.id, position: 0, money: 0, cards: [] });
              if (room.users.length === 4) room.isFull = true;
              room.save();
              getAllRooms()
              socket.emit('joined', true);
            } else if (room.password.length === 0) {
              if (room.users.find((user) => user.userEmail === userEmail)) {
                console.log('Usuário já está na sala:', room.roomName);
                socket.emit('joined', false);
                return;
              }

              socket.join(roomId);
              room.users.push({ userEmail, socketId: socket.id, position: 0, money: 0, cards: [] });
              if (room.users.length === 4) room.isFull = true;
              room.save();
              console.log('Usuário', userEmail, 'entrou na sala:', room.roomName);
              socket.emit('joined', true);
              getAllRooms()
            } else {
              console.log('Senha incorreta!');
              socket.emit('joined', false);
            }
          }
        })
        .catch((error) => {
          console.log('Erro ao buscar sala:', error);
        });
    });

    socket.on('getPlayersStates', async (roomId) => {
      await Room.findOne({ roomId: roomId }).exec()
        .then((room) => {
          io.to(roomId).emit('playersStates', room?.users)
        })
    })

    socket.on('startGame', async (roomId) => {
      const state = {
        type: 'game starting',
        duration: 'indeterminate',
      }

      updateRoomState(roomId, state);
    })

    socket.on('leaveRoom', ({ roomId, userEmail }) => {
      socket.leave(roomId);
      removeUserFromRoom(socket.id);
    });

    socket.on('sendMessage', async (roomId, message, user) => {
      await Room.findOne({ roomId }).exec()
        .then((room) => {
          if (room && room.users.find((u) => u.userEmail === user && u.socketId === socket.id)) {
            io.to(roomId).emit('receiveMessage', message, user);
          }
        });
    });

    socket.on('getPlayers', async (roomId) => {
      await Room.findOne({ roomId: roomId }).exec()
        .then((room) => {
          io.to(roomId).emit('returnPlayer', room?.users.length)
        })
    })

    socket.on('getRooms', () => {
      getAllRooms()
    });

    socket.on('disconnect', () => {
      console.log('Usuário desconectado:', socket.id);
      removeUserFromRoom(socket.id);
    });

    async function removeUserFromRoom(socketId) {
      await Room.findOne({ 'users.socketId': socketId }).exec()
        .then((room) => {
          if (room) {
            const index = room.users.findIndex((user) => user.socketId === socketId);
            if (index !== -1) {
              const user = room.users[index];
              room.users.splice(index, 1);
              room.save();
              console.log('Usuário', user.userEmail, 'removido da sala:', room.roomId);
            }
          }
        });
    }
    async function getAllRooms() {
      await Room.find({}).exec()
        .then((rooms) => {
          if (rooms.length > 0) {
            io.emit('updateRooms', {
              numberOfRooms: rooms.length,
              rooms: rooms.map((room) => [room.roomName, room.roomId, room.hasPassword, room.isFull, room.users.length]),
            });
          } else {
            io.emit('updateRooms', {
              numberOfRooms: 0,
              rooms: null
            });
          }
        })
    }
    const systemMessage = (roomId, message) => io.to(roomId).emit('receiveMessage', message, 'Sistema');
    const updateRoomState = async (roomId, state) => {
      try {
        await Room.findOneAndUpdate({ roomId: roomId }, { state })
        systemMessage(roomId, state.type)
        io.to(roomId).emit('gameStateUpdated', state)
      } catch (error) {
        console.log(error)
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor Socket.IO em execução na porta ${PORT}`);
});
