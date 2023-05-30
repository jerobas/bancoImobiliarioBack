/* eslint-disable linebreak-style */
/* eslint-disable indent */

const rollDices = () => {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    return d1 + d2;
};

socket.on('startGame', async (roomId) => {
    let state = {
        type: 'Game starting...',
        duration: 'indeterminate',
    };

    await Room.findOne({ roomId }).exec()
        .then(async (room) => {
            const numberOfPLayers = room?.users.length;
            const order = [];
            for (let i = 0; i < numberOfPLayers; i++) {
                const resp = rollDices();
                order.push({
                    socketId: room?.users[i].socketId,
                    orderInTurn: resp,
                });
            }
            order.sort((a, b) => b.orderInTurn - a.orderInTurn);
            for (let i = 0; i < numberOfPLayers; i++) {
                await room.diceWinners.push(order[i].socketId);
            }
            await room.save();

            state = {
                ...state,
                diceWinners: room.diceWinners,
                currentTurn: room.currentTurn,
            };
        });
    updateRoomState(roomId, state);
});
