import cellValues from "../constants/cellValues.js"

export const calculateRentWithProps = (rent, buildLevel) => {
    return rent * cellValues[buildLevel]
}