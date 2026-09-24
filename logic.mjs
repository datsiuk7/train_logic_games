/**
 * Logic facade for Lamplighter game.
 * Re-exports world simulation, validation, and program execution modules
 * ensuring backward compatibility.
 */

import {
  commands,
  key,
  categories,
  getCategory,
  isLightTarget,
  allLamps,
  collectBulbs,
  collectKits,
  collectBoxes,
  sparkLamps,
  litLamps,
  initialState,
  lampCount,
  dayLampsToUnscrew,
  won,
  getCommandInfo,
  getLevelDescription,
  ElectricShockError,
  step,
  sensors,
  comparisons,
  defaultCondition,
  conditionValue as rawConditionValue
} from './logic-world.mjs';

import {
  childLists,
  blockCount,
  validateLevel,
  validateProgram as rawValidateProgram
} from './logic-validate.mjs';

import {
  compile,
  createMemory,
  valueOf,
  executeProgram as rawExecuteProgram
} from './logic-run.mjs';

export function conditionValue(condition, l, s, memory = {}) {
  return rawConditionValue(condition, l, s, memory, valueOf);
}

export function validateProgram(l, program, functions = []) {
  return rawValidateProgram(l, program, functions);
}

export function executeProgram(l, program, functions, readState, memory = {}) {
  return rawExecuteProgram(l, program, functions, readState, memory, conditionValue);
}

export {
  commands,
  key,
  categories,
  getCategory,
  isLightTarget,
  allLamps,
  collectBulbs,
  collectKits,
  collectBoxes,
  sparkLamps,
  litLamps,
  initialState,
  lampCount,
  dayLampsToUnscrew,
  won,
  getCommandInfo,
  getLevelDescription,
  step,
  sensors,
  comparisons,
  defaultCondition,
  ElectricShockError,
  childLists,
  blockCount,
  validateLevel,
  compile,
  createMemory,
  valueOf
};
