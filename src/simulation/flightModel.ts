export type FlightState = {
  airspeed: number; // knots, deliberately simplified game model
  altitude: number; // feet
  verticalSpeed: number; // feet/minute
  heading: number; // degrees true
  pitch: number; // degrees
  bank: number; // degrees
  throttle: number; // 0..1
  elevator: number; // -1..1
  aileron: number; // -1..1
  rudder: number; // -1..1
  gearDown: boolean;
  flaps: 0 | 1 | 2 | 3;
  onGround: boolean;
  crashed: boolean;
};

export const initialFlightState = (): FlightState => ({
  airspeed: 0, altitude: 0, verticalSpeed: 0, heading: 90, pitch: 0, bank: 0,
  throttle: 0, elevator: 0, aileron: 0, rudder: 0, gearDown: true, flaps: 0,
  onGround: true, crashed: false,
});

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const normalizeHeading = (h: number) => ((h % 360) + 360) % 360;

/**
 * Deterministic arcade flight model for gameplay prototyping, not an aircraft-certified model.
 * dt is capped to prevent a suspended browser tab from causing a huge simulation jump.
 */
export function stepFlight(previous: FlightState, elapsedSeconds: number): FlightState {
  const dt = clamp(elapsedSeconds, 0, 0.05);
  if (previous.crashed || dt === 0) return { ...previous };

  const s = { ...previous };
  const speedFactor = clamp(s.airspeed / 140, 0.15, 1.25);
  const thrustAcceleration = s.throttle * 17;
  const drag = 2.2 + (s.flaps * 1.7) + (s.gearDown && !s.onGround ? 3 : 0) + s.airspeed * 0.012;
  s.airspeed = clamp(s.airspeed + (thrustAcceleration - drag) * dt, 0, 360);

  // Control authority scales with speed; pitch and bank respond smoothly rather than teleporting.
  s.pitch = clamp(s.pitch + (s.elevator * 15 * speedFactor - s.pitch * 0.24) * dt, -18, 25);
  s.bank = clamp(s.bank + (s.aileron * 32 * speedFactor - s.bank * 0.32) * dt, -60, 60);
  s.heading = normalizeHeading(s.heading + Math.sin((s.bank * Math.PI) / 180) * 35 * speedFactor * dt + s.rudder * 5 * dt);

  const stallSpeed = 90 + s.flaps * 4;
  const lift = s.airspeed < stallSpeed ? (s.airspeed / stallSpeed) * 0.65 : 1;
  const targetVs = s.onGround ? 0 : clamp((s.pitch * 115 + (s.airspeed - 145) * 1.8) * lift, -3500, 3500);
  s.verticalSpeed += (targetVs - s.verticalSpeed) * Math.min(1, dt * 1.7);
  s.altitude = Math.max(0, s.altitude + (s.verticalSpeed / 60) * dt);

  if (s.onGround && s.airspeed > 105 && s.pitch > 4 && s.throttle > 0.55) {
    s.onGround = false;
    s.gearDown = true;
    s.altitude = Math.max(1, s.altitude);
  }
  if (!s.onGround && s.altitude <= 0.5) {
    const safeLanding = s.airspeed >= 90 && s.airspeed <= 165 && Math.abs(s.verticalSpeed) < 700 && Math.abs(s.bank) < 12;
    if (safeLanding) {
      s.altitude = 0; s.verticalSpeed = 0; s.onGround = true; s.pitch = 0; s.bank = 0;
    } else if (s.airspeed > 70 || Math.abs(s.verticalSpeed) >= 700 || Math.abs(s.bank) >= 12) {
      s.altitude = 0; s.crashed = true; s.onGround = true;
    } else {
      s.altitude = 0; s.verticalSpeed = 0; s.onGround = true;
    }
  }
  return s;
}

export function setThrottle(s: FlightState, value: number): FlightState {
  return { ...s, throttle: clamp(value, 0, 1) };
}
export function setControl(s: FlightState, axis: 'elevator' | 'aileron' | 'rudder', value: number): FlightState {
  return { ...s, [axis]: clamp(value, -1, 1) };
}
