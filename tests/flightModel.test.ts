import { describe, expect, it } from 'vitest';
import { initialFlightState, setControl, setThrottle, stepFlight } from '../src/simulation/flightModel';

describe('flight model', () => {
  it('starts on ground with zero speed and safe defaults', () => {
    const s = initialFlightState();
    expect(s.onGround).toBe(true);
    expect(s.airspeed).toBe(0);
    expect(s.altitude).toBe(0);
  });
  it('clamps control inputs and throttle', () => {
    const s = setControl(setThrottle(initialFlightState(), 2), 'aileron', -4);
    expect(s.throttle).toBe(1);
    expect(s.aileron).toBe(-1);
  });
  it('does not allow negative altitude or speed', () => {
    const s = stepFlight({ ...initialFlightState(), airspeed: 0, altitude: 0, throttle: 0 }, 0.05);
    expect(s.airspeed).toBeGreaterThanOrEqual(0);
    expect(s.altitude).toBeGreaterThanOrEqual(0);
  });
  it('caps a large elapsed time to avoid simulation jumps', () => {
    const initial = { ...initialFlightState(), throttle: 1 };
    expect(stepFlight(initial, 100)).toEqual(stepFlight(initial, 0.05));
  });
  it('does not change a crashed aircraft', () => {
    const crashed = { ...initialFlightState(), crashed: true, airspeed: 123 };
    expect(stepFlight(crashed, 0.05)).toEqual(crashed);
  });
});
