export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface Entity {
  id: string;
  position: Vector3D;
  width: number;
  height: number;
  color: string;
}

export interface PlayerCar extends Entity {
  speed: number;
  lane: number;
  targetX: number;
  rotation: number;
  turbo: number; // 0 to 1
  isTurboActive: boolean;
  acceleration: number;
}

export interface TrafficCar extends Entity {
  speed: number;
  type: 'sedan' | 'truck' | 'sport';
}

export interface Particle {
  id: string;
  position: Vector3D;
  velocity: Vector3D;
  radius: number;
  color: string;
  life: number;
  decay: number;
}

export enum GameState {
  START,
  DIFFICULTY_SELECT,
  PLAYING,
  GAMEOVER
}
