export default class handlerError {
  constructor(socket, io) {
    this.socket = socket;
    this.io = io;
  }

  async sendGlobalError(message) {
    this.io.emit('errorMessage', message);
  }
}
