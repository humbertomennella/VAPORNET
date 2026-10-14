import type { FlightState } from '../simulation/flightModel';
type Target = { callsign: string; flight: FlightState };
export default function Radar({ targets, selected, onSelect }: { targets: Target[]; selected: string; onSelect: (callsign: string) => void }) {
  return <div className="radar-wrap"><svg viewBox="0 0 520 520" className="radar" role="img" aria-label="Radar de tráfego aéreo">
    <defs><pattern id="radarGrid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M 26 0 L 0 0 0 26" fill="none" stroke="#123f40" strokeWidth="1" /></pattern></defs>
    <rect width="520" height="520" fill="#061514"/><rect width="520" height="520" fill="url(#radarGrid)"/>
    {[80,145,210].map(r=><circle key={r} cx="260" cy="260" r={r} fill="none" stroke="#1d6657" strokeWidth="1" strokeDasharray="3 5"/>)}
    <path d="M260 20V500 M20 260H500 M90 90L430 430 M430 90L90 430" stroke="#174a43" strokeWidth="1"/>
    <path d="M260 260 L260 48 A212 212 0 0 1 404 104 Z" fill="#2bbf87" opacity=".09"/>
    <rect x="232" y="242" width="56" height="36" fill="#243f39" stroke="#8ad9a8"/><path d="M242 260h36m-18 -10v20" stroke="#d7f8c6" strokeWidth="2"/>
    {targets.map((t, i) => {
      const angle = (t.flight.heading - 90) * Math.PI / 180;
      const radius = 48 + (i * 51) % 150;
      const x = 260 + Math.cos(angle) * radius;
      const y = 260 + Math.sin(angle) * radius;
      const active = selected === t.callsign;
      return <g key={t.callsign} onClick={() => onSelect(t.callsign)} role="button" tabIndex={0} aria-label={`Selecionar ${t.callsign}`} style={{ cursor: 'pointer' }}>
        <rect x={x-5} y={y-5} width="10" height="10" fill={active ? '#f7d36b' : '#75f0b0'} stroke="#061514" strokeWidth="2"/>
        <path d={`M${x} ${y} l${Math.cos(angle)*17} ${Math.sin(angle)*17}`} stroke={active ? '#f7d36b' : '#75f0b0'} strokeWidth="2"/>
        <text x={x+10} y={y-8} fill={active ? '#f7d36b' : '#a8edca'} fontSize="11" fontFamily="monospace">{t.callsign}</text>
        <text x={x+10} y={y+5} fill="#70aaa0" fontSize="9" fontFamily="monospace">{Math.round(t.flight.altitude/100)} / {Math.round(t.flight.airspeed)}KT</text>
      </g>;
    })}
  </svg></div>;
}
