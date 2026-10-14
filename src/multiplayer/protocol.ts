import type { FlightState } from '../simulation/flightModel.js';

export type ClientMessage =
  | { type: 'join'; role: 'pilot' | 'atc'; callsign: string; roomId: string }
  | { type: 'flight:update'; flight: FlightState }
  | { type: 'atc:instruction'; targetCallsign: string; instruction: string }
  | { type: 'ping'; sentAt: number };

export type ServerMessage =
  | { type: 'session:snapshot'; roomId: string; flights: Array<{ callsign: string; flight: FlightState }> }
  | { type: 'flight:updated'; callsign: string; flight: FlightState }
  | { type: 'atc:instruction'; from: string; targetCallsign: string; instruction: string; timestamp: number }
  | { type: 'presence'; roomId: string; pilots: string[]; controllers: string[] }
  | { type: 'error'; message: string }
  | { type: 'pong'; sentAt: number };
