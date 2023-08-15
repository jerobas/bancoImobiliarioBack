import cellValues from '../constants/cellValues.js';

export const calculateRentWithProps = (rent, buildLevel) => rent * cellValues[buildLevel];
