/* eslint-disable linebreak-style */

/* eslint-disable indent */
// pra pagar pra sair da cadeia é 10% do seu money

import cellPrices from '../constants/cells.js';
import cellValues from '../constants/cellValues.js';
import * as Cells from '../repositories/cell.js';
import * as Rooms from '../repositories/rooms.js';
import * as User from '../repositories/users.js';
import { calculateRentWithProps } from '../utils/rentCalculation.js';
import { formatUserIp } from '../utils/users.js';

async function removeUserFromRoom(roomId, userIP) {
  const currentRoom = await Rooms.find(roomId);
  if (currentRoom && currentRoom.owner === userIP) {
    const removePromise = [];
    currentRoom.users.map((user) => {
      removePromise.push(Rooms.removeUser(roomId, user.userIP));
    });
    await Promise.all(removePromise);
    await Rooms.remove(roomId);
  } else {
    await Rooms.removeUser(roomId, userIP);
  }
}

async function updateTurn(roomId, io) {
  const newRoom = await Rooms.find(roomId);
  if (newRoom) {
 await io.to(roomId).emit('playersStates', {
      users: newRoom?.users,
      currentTurn: newRoom.currentTurn,
    });
}
}

async function getAllRooms(socket) {
  const rooms = await Rooms.getAll();
  if (rooms && rooms.length > 0) {
    socket.emit('updateRooms', {
      numberOfRooms: rooms.length,
      rooms: rooms.map((room) => [
        room.roomName,
        room.roomId,
        room.hasPassword,
        room.isFull,
        room.users?.length,
      ]),
    });
  } else {
    socket.emit('updateRooms', {
      numberOfRooms: 0,
      rooms: null,
    });
  }
}

export const roomHandlers = {
  create:
    (socket, io, handleError) => async ({ roomName, password }) => {
      try {
        const createdRoom = await Rooms.create({
          roomName,
          password,
          owner: formatUserIp(socket.handshake.address),
        });
        if (createdRoom) {
          socket.emit('created', createdRoom);
          getAllRooms(socket);
        } else {
          handleError.sendGlobalError(`A sala ${roomName} já existe!`);
        }
      } catch (error) {
        console.error(error);
        socket.emit('roomCreated', error);
      }
    },

  join:
    (socket, io, handleError) => async ({ roomId, password, userEmail }) => {
      try {
        const room = await Rooms.find(roomId);
        if (room) {
          if (room.state.type !== 'idle') {
            handleError.sendGlobalError('Esse jogo já começou!');
            return socket.emit('joined', false);
          }
          if (room.isFull) {
            handleError.sendGlobalError('Essa sala está cheia!');
            return socket.emit('joined', false);
          }
          if (room.password.length > 0 && room.password !== password) {
            handleError.sendGlobalError('A senha esta incorreta!');
            return socket.emit('joined', false);
          }
          if (room.users.find((user) => user.userName === userEmail)) {
            handleError.sendGlobalError('Você ja está nessa sala!');
            return socket.emit('joined', false);
          }

          await Rooms.addUser(
            roomId,
            userEmail,
            socket.id,
            formatUserIp(socket.handshake.address),
            room._id,
          );
          socket.join(roomId);

          await room.save();
          socket.emit('joined', roomId);
          return getAllRooms(socket);
        }
      } catch (error) {
        return console.log('Erro ao buscar sala:', error);
      }
    },

  getAll: (socket, io, handleError) => () => getAllRooms(socket),

  getUsers: (socket, io, handleError) => async (roomId) => {
    const room = await Rooms.find(roomId);
    io.to(roomId).emit('returnPlayer', room?.users);
  },

  getOwner: (socket, io, handleError) => async (roomId) => {
    const room = await Rooms.find(roomId);
    if (room) {
      io.to(roomId).emit('returnOwner', room.owner);
    }
  },

  leave: (socket, io, handleError) => async (roomId) => {
    socket.leave(roomId);
    await removeUserFromRoom(roomId, formatUserIp(socket.handshake.address));
    getAllRooms(socket);
  },

  payToLeave: (socket, io, handleError) => async (user) => {
    try {
      if (user) {
        let currentUser = null;
        currentUser = await User.find(user._id);
        if (currentUser.state === 3 && currentUser.money >= 50) {
          await User.update(user._id, {
            numberOfEqualDices: 0,
            money: Number(user.money) - 50,
          });
        } else {
          handleError.sendGlobalError('Você não tem dinheiro suficiente!');
        }
      }
    } catch (error) {
      console.log(error);
    }
  },

  rollDices:
    (socket, io, handleError) => async ({
 roomId, value, userEmail, numberOfCells,
}) => {
      try {
        let currentUser = null;
        let userId = null;
        const room = await Rooms.find(roomId);
        const sumOfDices = Number(value.d1) + Number(value.d2);
        let nextTurn = room.currentTurn + 1;
        const promises = [];

        const userPromises = room.users.map(async (user) => {
          if (user.userName === userEmail) {
            userId = user._id;
            currentUser = await User.find(user._id);

            // O player esta preso
            if (currentUser.state != 0) {
              if (value.d1 === value.d2) {
                promises.push(User.update(user._id, { state: 0 }));
                io.to(currentUser.socketId).emit(
                  'eventMessage',
                  'Você foi solto meu amigo!',
                );
                nextTurn = room.currentTurn;
              } else {
                promises.push(User.update(user._id, { $inc: { state: -1 } }));
                io.to(currentUser.socketId).emit(
                  'eventMessage',
                  'Não foi dessa vez!',
                );
              }
            } else if (
              value.d1 === value.d2
              && currentUser.numberOfEqualDices === 2
            ) {
              // ele vai ser preso, pq tirou igual e ja tinha 2 no contador de iguais
              promises.push(
                User.update(user._id, {
                  numberOfEqualDices: 0,
                  position: 30,
                  state: 3,
                }),
              );
              io.to(currentUser.socketId).emit(
                'eventMessage',
                'Você foi preso meu amigo!',
              );
            } else {
              if (value.d1 === value.d2) {
                nextTurn = room.currentTurn;
              }
              const isEqual = value.d1 === value.d2
                  ? {
                      $inc: { numberOfEqualDices: 1 },
                    }
                  : { numberOfEqualDices: 0 };

              promises.push(
                User.update(user._id, {
                  ...isEqual,
                  position: (sumOfDices + user.position) % numberOfCells,
                  money:
                    sumOfDices + user.position >= numberOfCells
                      ? Number(user.money) + 200
                      : Number(user.money),
                }),
              );
            }
          }
        });
        await Promise.all(userPromises);

        if (nextTurn === room.users.length) {
          nextTurn = 0;
        }
        await room.save();

        const newRoom = await Rooms.find(roomId);

        await io.to(roomId).emit('playersStates', {
          users: newRoom?.users,
          currentTurn: newRoom.currentTurn,
        });

        room.currentTurn = nextTurn;
        await room.save();

        currentUser = await User.find(userId);

        const cell = await Cells.getById(currentUser.position, room._id);
        const currentCell = cellPrices.find(
          (element) => element.id === currentUser.position,
        );

        // se tiver casa ele tem q pagar o aluguel
        // &&
        //   currentUser.money >=
        //     calculateRentWithProps(currentCell.rent, cell.buildLevel)
        if (cell) {
          await User.update(currentUser._id, {
            money:
              currentUser.money
              - calculateRentWithProps(currentCell.rent, cell.buildLevel),
          });
          await User.update(cell.owner, {
            $inc: {
              money: calculateRentWithProps(currentCell.rent, cell.buildLevel),
            },
          });
        }

        currentUser = await User.find(userId);

        // vai comprar se tiver dinheiro e não for hotel, praia, evento
        if (
          cell
          && cell.owner.equals(currentUser._id)
          && cell.buildLevel < 5
        ) {
          if (currentUser.money >= currentCell.rent * cellValues.addProps) {
            await io.to(currentUser.socketId).emit('willBuy', {
              canBuy: true,
              price: currentCell.rent * cellValues.addProps,
            });
            let check = false;
            setTimeout(() => {
              if (check) return;
              check = true;
              io.to(currentUser.socketId).emit(
                'eventMessage',
                'Você demorou muito!',
              );
              updateTurn(roomId, io);
            }, 5000);
            socket.once('buyResponse', async (data) => {
              if (check) return;
              check = true;
              if (data) {
                await User.update(currentUser._id, {
                  money:
                    Number(currentUser.money)
                    - currentCell.rent * cellValues.addProps,
                });
                await Cells.update(cell._id, {
                  $inc: { buildLevel: +1 },
                });
                updateTurn(roomId, io);
              }
            });
          }
        } else if (
          currentCell
          && currentCell.canBuy
          && currentUser.money >= currentCell.priceToBuyAndSell
        ) {
          await io.to(currentUser.socketId).emit('willBuy', {
            canBuy: true,
            price: currentCell.priceToBuyAndSell,
          });
          let check = false;
          setTimeout(() => {
            if (check) return;
            check = true;
            io.to(currentUser.socketId).emit(
              'eventMessage',
              'Você demorou muito!',
            );
            updateTurn(roomId, io);
          }, 5000);
          socket.once('buyResponse', async (data) => {
            if (check) return;
            check = true;
            if (data) {
              await User.update(currentUser._id, {
                money:
                  Number(currentUser.money) - currentCell.priceToBuyAndSell,
              });
              if (cell) {
                const resPromises = [];

                resPromises.push(
                  User.update(cell.owner, {
                    $inc: { money: Number(currentCell.priceToBuyAndSell) },
                  }),
                );
                resPromises.push(
                  Cells.update(cell._id, { owner: currentUser._id }),
                );

                await Promise.all(resPromises);

                io.to(roomId).emit('buyedCell', {
                  newRoom,
                  currentUser,
                  currentCell,
                });
              } else {
                const _cell = await Cells.createCell(
                  room._id,
                  userId,
                  currentCell.id,
                );
                if (_cell) {
                  io.to(roomId).emit('buyedCell', {
                    newRoom,
                    currentUser,
                    currentCell,
                  });
                }
              }
              updateTurn(roomId, io);
            }
          });
        } else {
          updateTurn(roomId, io);
        }
      } catch (err) {
        console.log(err);
      }
    },
};

export const startRoomHandlers = (socket, io, handleError) => {
  Object.keys(roomHandlers).forEach((key) => {
    socket.on(`rooms:${key}`, roomHandlers[key](socket, io, handleError));
  });
};

export const roomWhenDisconnect = (roomId) => {
  // removeUserFromRoom(roomId, socket.id);
};
