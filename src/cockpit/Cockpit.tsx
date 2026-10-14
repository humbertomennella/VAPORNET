import { useEffect, useRef } from 'react';
import type { FlightState } from '../simulation/flightModel';

type Props = { flight: FlightState };
const pixel = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

export default function Cockpit({ flight }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = 960, H = 560;
    canvas.width = W; canvas.height = H;
    ctx.imageSmoothingEnabled = false;
    // Exterior scene: deliberately stylized, low-resolution pixel art.
    const sky = ctx.createLinearGradient(0, 0, 0, 330);
    sky.addColorStop(0, '#112f4d'); sky.addColorStop(1, '#78b5c4');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 340);
    pixel(ctx, 90, 72, 90, 10, '#d2e6df'); pixel(ctx, 125, 62, 40, 10, '#d2e6df'); pixel(ctx, 540, 105, 120, 8, '#d2e6df'); pixel(ctx, 575, 95, 44, 10, '#d2e6df');
    // Distant terrain and airport.
    pixel(ctx, 0, 260, W, 80, '#284b42'); pixel(ctx, 0, 285, W, 55, '#1e3a35');
    pixel(ctx, 300, 270, 360, 8, '#c1c9b8'); pixel(ctx, 350, 278, 270, 14, '#6a7772');
    for (let x = 370; x < 610; x += 38) pixel(ctx, x, 283, 18, 3, '#e7e4c7');
    // Cockpit framing.
    pixel(ctx, 0, 0, 20, 355, '#071018'); pixel(ctx, 940, 0, 20, 355, '#071018');
    pixel(ctx, 0, 0, W, 18, '#071018'); pixel(ctx, 0, 328, W, 22, '#071018');
    pixel(ctx, 20, 18, 8, 320, '#28404a'); pixel(ctx, 932, 18, 8, 320, '#28404a');
    // Panel and glare shield.
    pixel(ctx, 0, 350, W, 210, '#0b151e'); pixel(ctx, 0, 350, W, 12, '#24333c'); pixel(ctx, 0, 362, W, 7, '#111f29');
    const drawScreen = (x: number, y: number, w: number, h: number, label: string) => {
      pixel(ctx, x - 6, y - 6, w + 12, h + 12, '#02070a'); pixel(ctx, x - 3, y - 3, w + 6, h + 6, '#33434b');
      pixel(ctx, x, y, w, h, '#061722');
      ctx.fillStyle = '#a6d5d4'; ctx.font = 'bold 13px monospace'; ctx.fillText(label, x + 8, y + 16);
    };
    drawScreen(35, 385, 190, 132, 'PFD  /  FLIGHT');
    // Artificial horizon.
    ctx.save(); ctx.beginPath(); ctx.rect(48, 405, 164, 84); ctx.clip();
    ctx.translate(130, 447); ctx.rotate((-flight.bank * Math.PI) / 180);
    pixel(ctx, -120, -120 + flight.pitch * 2, 240, 120, '#23638a'); pixel(ctx, -120, flight.pitch * 2, 240, 120, '#725b3d');
    pixel(ctx, -85, flight.pitch * 2 - 2, 170, 4, '#e9e6c9');
    ctx.restore();
    pixel(ctx, 118, 443, 24, 4, '#f5d45c'); pixel(ctx, 128, 434, 4, 22, '#f5d45c');
    ctx.fillStyle = '#bce5d9'; ctx.font = '12px monospace'; ctx.fillText(`${Math.round(flight.airspeed)} KT`, 52, 507); ctx.fillText(`${Math.round(flight.altitude)} FT`, 148, 507);
    drawScreen(258, 385, 190, 132, 'ND  /  NAV');
    pixel(ctx, 347, 421, 12, 56, '#113f51'); pixel(ctx, 325, 443, 56, 12, '#113f51'); pixel(ctx, 352, 430, 4, 35, '#f5d45c'); pixel(ctx, 337, 445, 35, 4, '#f5d45c');
    ctx.fillStyle = '#79c9d0'; ctx.font = '12px monospace'; ctx.fillText(`HDG ${String(Math.round(flight.heading)).padStart(3, '0')}°`, 270, 505);
    drawScreen(483, 385, 190, 132, 'ENGINE / STATUS');
    ctx.fillStyle = '#81dbab'; ctx.font = '13px monospace'; ctx.fillText(`N1   ${Math.round(flight.throttle * 100)}%`, 496, 423); ctx.fillText(`FLAP ${flight.flaps}`, 496, 447); ctx.fillText(`GEAR ${flight.gearDown ? 'DOWN' : 'UP'}`, 496, 471);
    ctx.fillStyle = flight.crashed ? '#ff6464' : flight.onGround ? '#eacb66' : '#81dbab'; ctx.fillText(flight.crashed ? 'FLIGHT EVENT: IMPACT' : flight.onGround ? 'GROUND MODE' : 'AIRBORNE', 496, 500);
    drawScreen(708, 385, 217, 132, 'SYSTEMS / RADIO');
    ctx.fillStyle = '#91c9d5'; ctx.font = '12px monospace'; ctx.fillText('COM  121.800', 720, 422); ctx.fillText('XPDR  1200', 720, 446); ctx.fillText(`V/S  ${Math.round(flight.verticalSpeed)} FPM`, 720, 470); ctx.fillText('SKYCONTROL SIM', 720, 500);
    // Switches and knobs.
    for (let i = 0; i < 12; i++) { pixel(ctx, 45 + i * 70, 530, 24, 10, '#1e303a'); pixel(ctx, 51 + i * 70, 523, 12, 8, i < 3 ? '#7bba9b' : '#46555b'); }
    // Crisp border.
    pixel(ctx, 0, 0, W, 3, '#3a6874');
  }, [flight]);
  return <canvas ref={ref} className="cockpit-canvas" aria-label="Cockpit pixel art com instrumentos da aeronave" />;
}
