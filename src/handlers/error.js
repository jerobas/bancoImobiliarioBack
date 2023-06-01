export const handleError = {
    sendGlobalError: (socket, io) => async (message) => {
        io.emit('errorMessage', message);
    }
}

export const errorService = (socket, io) => {
    Object.keys(handleError).forEach((key) => {
        handleError[key](socket,io);
    });
}