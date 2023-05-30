/* eslint-disable linebreak-style */
/* eslint-disable indent */
const types = ['idle', 'action', 'system'];

class States {
    type;

    duration;

    static checkType(type) {
        return types.includes(type);
    }

    static checkDuration(duration) {
        return duration === 'indeterminate' || typeof duration === 'number';
    }

    // static checkTurn(turn) {
    //     if (turn === null)
    //         return (false, 'Turn cannot be null')
    //     if (typeof turn !== 'number')
    //         return (false, 'Turn must be a number')
    //     if (turn < 0)
    //         return (false, 'Turn must be a positive number')
    //     return (true, null)
    // }

    constructor(type, duration) {
        if (this.constructor.checkType(type) === false) {
            throw new Error('Invalid type');
        }
        if (this.constructor.checkDuration(duration) === false) {
            throw new Error('Invalid duration');
        }
        this.type = type;
        this.duration = duration;
    }

    static idle(duration) {
        return new States('idle', duration);
    }

    // static action(duration, type, target) {
    static action(duration) {
        return new States('action', duration);
    }

    static system(duration) {
        return new States('system', duration);
    }
}

export default States;
