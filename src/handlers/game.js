/* eslint-disable linebreak-style */
/* eslint-disable indent */
import * as Rooms from '../repositories/rooms.js';
import { handleChat } from './chat.js';
import {Users} from '../models/index.js';

const rollDices = () => {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    return d1 + d2;
};

const updateRoomState = async (roomId, state) => {
    try {
        const oldRoom = await Rooms.update(roomId, {state})
        if (!oldRoom) {
            console.log('Sala não encontrada');
            throw new Error('Sala não encontrada');
        }

        handleChat.systemMessage(roomId, state.type)
    } catch (error) {
        console.log(error);
    }
};

export const handleGame = {
    start: io => async (roomId) => {
    let state = {
        type: 'Game starting...',
        duration: 'indeterminate',
    };
    let room = await Rooms.findIfExists(roomId);
    if(room){
        const numberOfPLayers = room?.users.length
        const order = [];
        for (let i = 0; i < numberOfPLayers; i++) {
            const resp = rollDices();
            order.push({
                objectId: room?.users[i]._id,
                orderInTurn: resp,
            });
        }
        order.map((data) => console.log(data))
        order.sort((a, b) => b.orderInTurn - a.orderInTurn);
        await Promise.all(numberOfPLayers.map(async (number) => {
            await room.diceWinners.push(number.objectId)
        }))
        // for (let i = 0; i < numberOfPLayers; i++) {
        //     await room.diceWinners.push(order[i].objectId);
        // }
        await room.save();
        let newRoom = await Rooms.findIfExists(roomId); 
        state = {
            ...state,
            currentTurn: newRoom.currentTurn,
        };
        updateRoomState(roomId, state);
        const usersIPS = []
        await Promise.all(newRoom.diceWinners.map(async (winner) => {
            const user = await Users.findOne({ _id: winner})
            if(user)
                usersIPS.push(user.userIP)
        }))
        // for (let i = 0; i < newRoom.diceWinners.length; i++) {
        //     let user = await Users.findOne({ _id: newRoom.diceWinners[i]})
        //     if(user)
        //         usersIPS.push(user.userIP)
        // }
        state = {
            ...state,
            diceWinners: usersIPS,
        }
        io.to(roomId).emit('gameStateUpdated', state);
    }
    }
}

export const gameService = (socket, io) => {
     Object.keys(handleGame).forEach((key) => {
        socket.on(`rooms:${key}`, handleGame[key](io));
    })
}