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

    socket.on('createRoom', async ({roomName, password, owner}) => {
      console.log(roomName, password, owner)
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
                currentTurn: 0,
                state: {
                  type: 'idle',
                  duration: 'indeterminate',
                },
              })
                .then((createdRoom) => {
                  const state = {
                    socketId: socket.id,
                    userName: owner
                  }
                  updateOwner(createdRoom.roomId, state);
                  socket.emit('roomId', createdRoom.roomId)
                  getAllRooms()
                })
                .catch((err) => console.log(err));
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
          if(room && room.state.type !== 'Game starting..'){
            if (room.users.length <= 4 && room.isFull === false) {
              if (room.password.length > 0 && room.password === password) {
                if (room.users.find((user) => user.userEmail === userEmail)) {
                  socket.emit('joined', false);
                  return;
                }
  
                socket.join(roomId);
                room.users.push({ userEmail, socketId: socket.id, position: 0, money: 12980000, cards: [] });
                if (room.users.length === 4) room.isFull = true;
                room.save();
                getAllRooms()
                socket.emit('joined', true);
              } else if (room.password.length === 0) {
                if (room.users.find((user) => user.userEmail === userEmail)) {
                  socket.emit('joined', false);
                  return;
                }
  
                socket.join(roomId);
                room.users.push({ userEmail, socketId: socket.id, position: 0, money: 12980000, cards: [] });
                if (room.users.length === 4) room.isFull = true;
                room.save();
                socket.emit('joined', true);
                getAllRooms()
              } else {
                socket.emit('joined', false);
              }
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
          io.to(roomId).emit('playersStates',{
            users: room?.users,
            currentTurn: room.currentTurn
          })
        })
    })

    socket.on('getOwner', async (roomId) => {
      await Room.findOne({ roomId: roomId }).exec()
        .then((room) => {
          io.to(roomId).emit('returnOwner', room?.owner)
        })
    })

    const rollDices = () => {
      let d1 = Math.floor(Math.random() * 6) + 1;
      let d2 = Math.floor(Math.random() * 6) + 1;
      return d1 + d2
    } 

    socket.on('startGame', async (roomId) => {
      let state = {
        type: 'Game starting...',
        duration: 'indeterminate',
      }

      await Room.findOne({ roomId: roomId }).exec()
        .then(async (room) => {
          let numberOfPLayers = room?.users.length
          const order = []
          for(let i = 0; i<numberOfPLayers; i++){
            let resp = rollDices()
            order.push({
              socketId: room?.users[i].socketId,
              orderInTurn: resp
            })
          }
          order.sort((a,b) => b.orderInTurn - a.orderInTurn)
          for(let i = 0; i < numberOfPLayers; i++){
            await room.diceWinners.push(order[i].socketId)
          }
          await room.save()

          state = {
            ...state,
            diceWinners: room.diceWinners,
            currentTurn: room.currentTurn
          }
       
        })
      updateRoomState(roomId, state);
    })


    socket.on('rollDices', async ({roomId, value, userEmail, numberOfCells}) => {
      await Room.findOne({roomId: roomId}).exec()
        .then(async (room) => {
          for(let i =0; i < room.users.length; i++){
            if(room.users[i].userEmail === userEmail){
              if((value + room.users[i].position) >= numberOfCells){
                room.users[i] = {
                  ...room.users[i],
                  position: (value + room.users[i].position) % numberOfCells,
                  money: Number(Number(room.users[i].money) + 200),
                }
              }else{
                room.users[i] = {
                  ...room.users[i],
                  position: (value + room.users[i].position) % numberOfCells,
                }
              }
              break;
            }
          }
          if(room.currentTurn === room.users.length-1){ // numero iguais joga dnv
            room.currentTurn = 0
          }else room.currentTurn += 1
          room.save()
          io.to(roomId).emit('playersStates', {
            users: room?.users,
            currentTurn: room.currentTurn
          })
        
        })
        .catch((err) => console.log(err))
    
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
    const updateOwner = async (roomId, owner) => {
      try {
        const oldRoom = await Room.findOneAndUpdate({ roomId: roomId }, { owner })
        if (!oldRoom) {
          console.log('Sala não encontrada')
          throw new Error('Sala não encontrada')
        }
      } catch (error) {
        console.log(error)
      }
    }
    const updateRoomState = async (roomId, state) => {
      try {
        const oldRoom = await Room.findOneAndUpdate({ roomId: roomId }, { state })
        if (!oldRoom) {
          console.log('Sala não encontrada')
          throw new Error('Sala não encontrada')
        }

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
