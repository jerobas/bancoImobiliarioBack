/* eslint-disable linebreak-style */

/* eslint-disable indent */
import * as Rooms from '../repositories/rooms.js';
import * as User from '../repositories/users.js';
import * as Cells from '../repositories/cell.js';
import { formatUserIp } from '../utils/users.js';
import cellPrices from '../constants/cells.js'

async function removeUserFromRoom(roomId, userIP) {
    const currentRoom = await Rooms.find(roomId)
    if(currentRoom && currentRoom.owner === userIP){
      await Rooms.remove(roomId)
    }
    await Rooms.removeUser(roomId, userIP);
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
    create: (socket, io, handleError) => async ({ roomName, password }) => {
        try {
            const createdRoom = await Rooms.create({ roomName, password, owner: formatUserIp(socket.handshake.address) });
            if(createdRoom){
              socket.emit('created', createdRoom);
              getAllRooms(socket);
            }else{
              handleError.sendGlobalError(`A sala ${roomName} já existe!`)
            }
        } catch (error) {
            console.error(error);
            socket.emit('roomCreated', error);
        }
    },

    join: (socket, io, handleError) => async ({ roomId, password, userEmail }) => {
        try {
            const room = await Rooms.find(roomId);
            if(room){
              if (room.state.type !== 'idle') {
                handleError.sendGlobalError(`Esse jogo já começou!`)
                return socket.emit('joined', false);
              }
              if (room.isFull) {
                handleError.sendGlobalError(`Essa sala está cheia!`)
                return socket.emit('joined', false);
              }
              if (room.password.length > 0 && room.password !== password){
                handleError.sendGlobalError(`A senha esta incorreta!`)
                return socket.emit('joined', false)
                
              }
              if (room.users.find((user) => user.userName === userEmail)) {
                handleError.sendGlobalError('Você ja está nessa sala!')
                return socket.emit('joined', false)
              }
  
              await Rooms.addUser(roomId, userEmail, socket.id, formatUserIp(socket.handshake.address), room._id);
              socket.join(roomId);
  
              await room.save();
              socket.emit('joined', roomId);
              return getAllRooms(socket);
            }           
        } catch (error) { return console.log('Erro ao buscar sala:', error); }
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

    rollDices: (socket, io, handleError) => async ({
        roomId, value, userEmail, numberOfCells,
    }) => {
        try {
            let currentUser = null
            let userId = null
            const room = await Rooms.find(roomId);
            // const sumOfDices = Number(value.d1) + Number(value.d2);
            const sumOfDices = 2
            let nextTurn = room.currentTurn + 1;
            const promises = [];

            const userPromises = room.users.map(async (user) => {
              if (user.userName === userEmail) {
                userId = user._id
                currentUser = await User.find(user._id);

                if (currentUser.state != 0) {
                    if (value.d1 === value.d2) {
                      promises.push(User.update(user._id, { state: 0 }));
                      nextTurn = room.currentTurn;
                    } else {
                      promises.push(User.update(user._id, { $inc: { state: -1 } }));
                    }
                } else if (value.d1 === value.d2 && currentUser.numberOfEqualDices === 2) {
                  promises.push(User.update(user._id, { numberOfEqualDices: 0, position: 30, state: 3 }));
                  io.to(roomId).emit('eventMessage', 'Você foi preso meu amigo!')
                } else if (value.d1 === value.d2) {
                  promises.push(User.update(user._id, { $inc: { numberOfEqualDices: 1 }, position: (sumOfDices + user.position) % numberOfCells }));
                  nextTurn = room.currentTurn;
                } else if (sumOfDices + user.position >= numberOfCells) {
                  promises.push(
                    User.update(user._id, {
                      numberOfEqualDices: 0, // reseta valor de dados iguais
                      position: (sumOfDices + user.position) % numberOfCells,
                      money: Number(user.money) + 200,
                    }),
                  );
                } else {
                  promises.push(
                    User.update(user._id, {
                      position: (sumOfDices + user.position) % numberOfCells,
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

            let newRoom = await Rooms.find(roomId);
            

            await io.to(roomId).emit('playersStates', {
              users: newRoom?.users,
              currentTurn: newRoom.currentTurn,
            });

            room.currentTurn = nextTurn;
            await room.save();

            await Cells.createCell(room._id, userId)
            
            currentUser = await User.find(userId);

            const cell = await Cells.getById(currentUser.position, room._id);
            const currentCell = cellPrices.find(element => element.id === currentUser.position)

            // se tiver casa ele tem q pagar o aluguel
            if(cell && currentUser.money >= currentCell.rent) {
              await User.update(currentUser._id, {
                money: currentUser.money - currentCell.rent,
              })
            }

            currentUser = await User.find(userId);

            //vai comprar se tiver dinheiro e não for hotel, praia, evento
            if(currentCell && currentUser.money >= currentCell.priceToBuyAndSell){
              await io.to(roomId).emit('willBuy',  {
                canBuy: true,
                price: currentCell.priceToBuyAndSell
              })
              return
            }
            // currentUser = await User.find(userId);
            // //paga o aluguel e muda turno
              

              newRoom = await Rooms.find(roomId);
              await io.to(roomId).emit('playersStates', {
                users: newRoom?.users,
                currentTurn: newRoom.currentTurn,
              });

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
