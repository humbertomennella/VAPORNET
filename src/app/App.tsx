import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Antenna, ArrowUp, CheckCircle2, CircleDot, Cloud, Gauge, Plane, Radio, RotateCcw, ShieldAlert, TowerControl, Users, Wifi, WifiOff } from 'lucide-react';
import Cockpit from '../cockpit/Cockpit';
import Radar from '../atc/Radar';
import { initialFlightState, setControl, setThrottle, stepFlight, type FlightState } from '../simulation/flightModel';
import { MultiplayerClient } from '../multiplayer/client';
import type { ServerMessage } from '../multiplayer/protocol';
import { supabase } from '../auth/supabase';

type Role = 'pilot' | 'atc';
type RemoteFlight = { callsign: string; flight: FlightState };
const initial = initialFlightState();

export default function App() {
  const [role, setRole] = useState<Role>('pilot');
  const [flight, setFlight] = useState<FlightState>(initial);
  const [callsign, setCallsign] = useState('SKY102');
  const [roomId, setRoomId] = useState('CURITIBA-01');
  const [connection, setConnection] = useState<'disconnected'|'connecting'|'connected'|'error'>('disconnected');
  const [targets, setTargets] = useState<RemoteFlight[]>([]);
  const [selected, setSelected] = useState('SKY102');
  const [messages, setMessages] = useState<string[]>(['SYS // SkyControl inicializado.', 'ATC // Frequência de demonstração 121.800.', 'SIM // Modelo de voo arcade ativo.']);
  const [instruction, setInstruction] = useState('Mantenha rumo e altitude atuais.');
  const [notice, setNotice] = useState('Modo local: servidor multiplayer ainda não conectado.');
  const client = useRef<MultiplayerClient | null>(null);
  const loop = useRef<number | undefined>(undefined);
  const lastTime = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const tick = (time: number) => {
      if (!alive) return;
      if (lastTime.current !== undefined) {
        const dt = Math.min((time - lastTime.current) / 1000, 0.05);
        setFlight(current => stepFlight(current, dt));
      }
      lastTime.current = time;
      loop.current = requestAnimationFrame(tick);
    };
    loop.current = requestAnimationFrame(tick);
    return () => { alive = false; if (loop.current) cancelAnimationFrame(loop.current); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const amount = 0.08;
      if (e.key === 'ArrowUp') setFlight(s => setControl(s, 'elevator', Math.min(1, s.elevator + amount)));
      if (e.key === 'ArrowDown') setFlight(s => setControl(s, 'elevator', Math.max(-1, s.elevator - amount)));
      if (e.key === 'ArrowLeft') setFlight(s => setControl(s, 'aileron', Math.max(-1, s.aileron - amount)));
      if (e.key === 'ArrowRight') setFlight(s => setControl(s, 'aileron', Math.min(1, s.aileron + amount)));
      if (e.key.toLowerCase() === 'w') setFlight(s => setThrottle(s, s.throttle + 0.05));
      if (e.key.toLowerCase() === 's') setFlight(s => setThrottle(s, s.throttle - 0.05));
      if (e.key === ' ') { e.preventDefault(); setFlight(s => ({ ...s, elevator: 0, aileron: 0, rudder: 0 })); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (connection !== 'connected' || !client.current || role !== 'pilot') return;
    const id = window.setInterval(() => {
      try { client.current?.send({ type: 'flight:update', flight }); } catch { /* Connection status updates separately. */ }
    }, 250);
    return () => window.clearInterval(id);
  }, [flight, connection, role]);

  const ownTarget = useMemo(() => ({ callsign, flight }), [callsign, flight]);
  const allTargets = useMemo(() => [ownTarget, ...targets.filter(t => t.callsign !== callsign)], [ownTarget, targets, callsign]);

  const connect = () => {
    client.current?.disconnect();
    const c = new MultiplayerClient(); client.current = c;
    c.subscribe((message: ServerMessage) => {
      if (message.type === 'session:snapshot') setTargets(message.flights.filter(f => f.callsign !== callsign));
      if (message.type === 'flight:updated' && message.callsign !== callsign) setTargets(prev => [...prev.filter(f => f.callsign !== message.callsign), { callsign: message.callsign, flight: message.flight }]);
      if (message.type === 'atc:instruction') setMessages(prev => [`ATC // ${message.from} → ${message.targetCallsign}: ${message.instruction}`, ...prev].slice(0, 12));
      if (message.type === 'presence') setNotice(`Sala ${message.roomId}: ${message.pilots.length} piloto(s), ${message.controllers.length} controlador(es).`);
      if (message.type === 'error') { setNotice(message.message); setConnection('error'); }
    });
    const url = import.meta.env.VITE_MULTIPLAYER_URL || 'ws://localhost:8787';
    c.connect(url, status => setConnection(status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : status === 'error' ? 'error' : 'disconnected'));
    const wait = window.setTimeout(() => {
      try { c.send({ type: 'join', role, callsign: callsign.trim().toUpperCase(), roomId: roomId.trim().toUpperCase() }); setNotice('Solicitação de entrada enviada ao servidor.'); }
      catch { setNotice('Servidor indisponível. O modo local continua funcionando.'); }
    }, 250);
    return () => window.clearTimeout(wait);
  };

  const sendInstruction = () => {
    const target = selected || targets[0]?.callsign;
    if (!target) { setNotice('Nenhuma aeronave selecionada.'); return; }
    if (connection !== 'connected' || !client.current) { setNotice('Conecte ao servidor para enviar instruções reais.'); setMessages(prev => [`LOCAL // Instrução não enviada: ${target} — ${instruction}`, ...prev].slice(0,12)); return; }
    try { client.current.send({ type: 'atc:instruction', targetCallsign: target, instruction }); setMessages(prev => [`TX // ${target}: ${instruction}`, ...prev].slice(0,12)); }
    catch { setNotice('Falha ao enviar instrução.'); }
  };

  const reset = () => { setFlight(initialFlightState()); setMessages(prev => ['SIM // Estado de voo reiniciado.', ...prev].slice(0,12)); };
  const startDemo = () => setFlight(s => ({ ...s, throttle: 0.78, elevator: 0.55, aileron: 0, gearDown: true, flaps: 1 }));

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Plane size={22}/></div><div><strong>SKYCONTROL<span> // OPS</span></strong><small>FLIGHT & AIR TRAFFIC SIMULATION</small></div></div>
      <div className="top-status"><span className="live-dot"/><span>SIMULATION BUILD 0.1</span><span className="status-divider"/><span className={`connection ${connection}`}><span className="status-dot"/>{connection.toUpperCase()}</span></div>
    </header>
    <section className="workspace">
      <aside className="sidebar">
        <div className="side-label">OPERAÇÃO</div>
        <button className={`nav-item ${role==='pilot'?'active':''}`} onClick={() => setRole('pilot')}><Plane size={17}/> Pilot cockpit</button>
        <button className={`nav-item ${role==='atc'?'active':''}`} onClick={() => setRole('atc')}><TowerControl size={17}/> ATC tower</button>
        <div className="side-label spaced">SESSÃO</div>
        <label className="field-label">CALLSIGN<input value={callsign} onChange={e=>setCallsign(e.target.value.toUpperCase().slice(0,8))} maxLength={8}/></label>
        <label className="field-label">ROOM ID<input value={roomId} onChange={e=>setRoomId(e.target.value.toUpperCase().slice(0,24))} maxLength={24}/></label>
        <button className="connect-button" onClick={connect}><Wifi size={16}/>{connection==='connected'?'Reconectar sala':'Conectar multiplayer'}</button>
        <div className="side-note"><ShieldAlert size={15}/><span>Protótipo de simulação recreativa. Não use para treinamento ou decisões aeronáuticas reais.</span></div>
        <div className="sidebar-bottom"><div className="mini-avatar">SC</div><div><strong>FLIGHT OPS</strong><small>{supabase ? 'Supabase configurado' : 'Supabase não configurado'}</small></div><CircleDot size={15} className="account-dot"/></div>
      </aside>
      <section className="main-panel">
        <div className="page-heading"><div><div className="eyebrow">{role==='pilot'?'FLIGHT DECK / 01':'AIR TRAFFIC CONTROL / 02'}</div><h1>{role==='pilot'?'Cockpit de voo':'Controle de tráfego aéreo'}</h1><p>{role==='pilot'?'Painel de voo em pixel art. Os instrumentos acompanham o estado da simulação.':'Visualização de tráfego e envio de instruções para aeronaves conectadas.'}</p></div><div className="heading-actions"><span className="chip"><Activity size={14}/> LOCAL SIM</span><button className="icon-button" title="Reiniciar simulação" onClick={reset}><RotateCcw size={16}/></button></div></div>
        {role==='pilot' ? <>
          <div className="metrics-grid">
            <Metric label="AIRSPEED" value={String(Math.round(flight.airspeed)).padStart(3,'0')} unit="KTS"/>
            <Metric label="ALTITUDE" value={String(Math.round(flight.altitude)).padStart(5,'0')} unit="FT"/>
            <Metric label="HEADING" value={String(Math.round(flight.heading)).padStart(3,'0')} unit="DEG"/>
            <Metric label="VERTICAL SPEED" value={`${flight.verticalSpeed>=0?'+':''}${Math.round(flight.verticalSpeed)}`} unit="FPM"/>
          </div>
          <div className="cockpit-frame"><div className="frame-top"><span><CircleDot size={13}/> FLIGHT DECK / 737 CLASS</span><span>PIXEL RENDER // 1X</span></div><Cockpit flight={flight}/><div className="frame-bottom"><span><span className="live-dot"/> INSTRUMENTS LIVE</span><span>{flight.crashed?'FLIGHT EVENT: IMPACT':flight.onGround?'ON GROUND':'AIRBORNE'}</span></div></div>
          <div className="control-grid">
            <section className="control-card"><div className="card-title"><Gauge size={16}/> FLIGHT CONTROLS <span>INPUT</span></div><div className="slider-row"><label>THROTTLE <b>{Math.round(flight.throttle*100)}%</b></label><input aria-label="Potência" type="range" min="0" max="100" value={flight.throttle*100} onChange={e=>setFlight(s=>setThrottle(s,Number(e.target.value)/100))}/></div><div className="slider-row"><label>ELEVATOR <b>{flight.elevator.toFixed(2)}</b></label><input aria-label="Arfagem" type="range" min="-100" max="100" value={flight.elevator*100} onChange={e=>setFlight(s=>setControl(s,'elevator',Number(e.target.value)/100))}/></div><div className="slider-row"><label>AILERON <b>{flight.aileron.toFixed(2)}</b></label><input aria-label="Rolagem" type="range" min="-100" max="100" value={flight.aileron*100} onChange={e=>setFlight(s=>setControl(s,'aileron',Number(e.target.value)/100))}/></div><div className="button-row"><button className={`toggle ${flight.gearDown?'selected':''}`} onClick={()=>setFlight(s=>({...s,gearDown:!s.gearDown}))}>GEAR {flight.gearDown?'DOWN':'UP'}</button><button className="toggle" onClick={()=>setFlight(s=>({...s,flaps:(s.flaps===3?0:(s.flaps+1) as FlightState['flaps'])}))}>FLAPS {flight.flaps}</button></div><div className="hint">Teclas: W/S potência · setas controlam arfagem e rolagem · espaço centraliza comandos.</div></section>
            <section className="control-card"><div className="card-title"><Radio size={16}/> FLIGHT MANAGEMENT <span>TOOLS</span></div><button className="wide-action" onClick={startDemo}><ArrowUp size={16}/> Preparar demonstração de decolagem</button><button className="wide-action secondary" onClick={reset}><RotateCcw size={16}/> Reiniciar voo</button><div className="status-list"><div><span>ENGINES</span><b className={flight.throttle>.05?'good':'warn'}>{flight.throttle>.05?'RUNNING':'IDLE'}</b></div><div><span>LANDING GEAR</span><b>{flight.gearDown?'EXTENDED':'RETRACTED'}</b></div><div><span>FLIGHT STATE</span><b>{flight.crashed?'IMPACT':flight.onGround?'GROUND':'AIRBORNE'}</b></div></div></section>
          </div>
        </> : <>
          <div className="atc-metrics"><Metric label="TRACKS" value={String(allTargets.length).padStart(2,'0')} unit="AC"/><Metric label="CONNECTED PILOTS" value={String(targets.length).padStart(2,'0')} unit="PILOTS"/><Metric label="FREQUENCY" value="121.800" unit="MHZ"/></div>
          <div className="atc-layout"><section className="control-card radar-card"><div className="card-title"><Antenna size={16}/> SURVEILLANCE RADAR <span>LIVE / DEMO</span></div><Radar targets={allTargets} selected={selected} onSelect={setSelected}/><div className="radar-legend"><span><i/> ACTIVE TRACK</span><span><i className="yellow"/> SELECTED</span><span>RANGE: SIMULATED</span></div></section><section className="control-card atc-tools"><div className="card-title"><Radio size={16}/> ATC CLEARANCE <span>TX</span></div><label className="field-label">TARGET AIRCRAFT<select value={selected} onChange={e=>setSelected(e.target.value)}>{allTargets.map(t=><option key={t.callsign} value={t.callsign}>{t.callsign}</option>)}</select></label><label className="field-label">INSTRUCTION<textarea value={instruction} onChange={e=>setInstruction(e.target.value)} rows={4}/></label><button className="connect-button" onClick={sendInstruction}><Radio size={16}/>Transmitir instrução</button><div className="hint">As instruções só chegam a outros clientes quando a sessão WebSocket está conectada. No modo local, elas são registradas apenas na tela.</div><div className="section-mini-title">TRACK DATA</div>{(allTargets.find(t=>t.callsign===selected) ? [allTargets.find(t=>t.callsign===selected)!] : []).map(t=><div className="track-data" key={t.callsign}><div><span>CALLSIGN</span><b>{t.callsign}</b></div><div><span>ALTITUDE</span><b>{Math.round(t.flight.altitude)} FT</b></div><div><span>HEADING</span><b>{Math.round(t.flight.heading)}°</b></div><div><span>AIRSPEED</span><b>{Math.round(t.flight.airspeed)} KT</b></div><div><span>VERT. SPEED</span><b>{Math.round(t.flight.verticalSpeed)} FPM</b></div></div>)}</section></div>
        </>}
        <div className="lower-grid"><section className="control-card"><div className="card-title"><Radio size={16}/> COMMUNICATIONS LOG <span>LAST 12</span></div><div className="log-list">{messages.map((m,i)=><div className="log-line" key={`${m}-${i}`}><span>{String(messages.length-i).padStart(2,'0')}</span><p>{m}</p></div>)}</div></section><section className="control-card session-card"><div className="card-title"><Users size={16}/> SESSION STATUS</div><div className="session-status"><span className="status-icon">{connection==='connected'?<Wifi size={18}/>:<WifiOff size={18}/>}</span><div><b>{connection==='connected'?'MULTIPLAYER ONLINE':connection==='connecting'?'CONNECTING TO SERVER':'LOCAL SESSION'}</b><p>{notice}</p></div></div><div className="status-list"><div><span>AUTH PROVIDER</span><b>{supabase?'SUPABASE READY':'NOT CONFIGURED'}</b></div><div><span>ROOM</span><b>{roomId || '—'}</b></div><div><span>ROLE</span><b>{role.toUpperCase()}</b></div></div><p className="small-disclaimer"><Cloud size={13}/> Nenhuma conta ou voo é persistido até configurar o Supabase.</p></section></div>
        <footer className="footer"><span>SKYCONTROL © PROTOTYPE</span><span><CheckCircle2 size={13}/> CLIENT BUILD // {new Date().getFullYear()}</span><span><ShieldAlert size={13}/> NOT FOR REAL-WORLD AVIATION</span></footer>
      </section>
    </section>
  </main>;
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return <div className="metric"><div className="metric-label">{label}</div><div className="metric-value">{value}<small>{unit}</small></div><div className="metric-bar"><i/></div></div>;
}
