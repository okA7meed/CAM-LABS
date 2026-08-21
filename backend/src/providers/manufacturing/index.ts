import { IManufacturingEngine } from './IManufacturingProvider';
import { CAMLabsManufacturingEngine } from './CAMLabsManufacturingEngine';

let engine: IManufacturingEngine | null = null;

export const getManufacturingEngine = (): IManufacturingEngine => {
  if (!engine) engine = new CAMLabsManufacturingEngine();
  return engine;
};

export { IManufacturingEngine } from './IManufacturingProvider';
export { CAMLabsManufacturingEngine } from './CAMLabsManufacturingEngine';
