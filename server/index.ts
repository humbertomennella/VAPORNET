import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import type { FlightState } from '../src/simulation/flightModel.js';
import type { ClientMessage, ServerMessage } from '../src/multiplayer/protocol.js';

type Role = 'pilot' | 'atc';
type Peer = { socket: WebSocket; role: Role; callsign: string; roomId: string; joined: boolean };
type Track = { callsign: string; flight: FlightState };
const PORT = Number(process.env.PORT || 8787);
const http = createServer((_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ service: 'skycontrol-multiplayer', status: 'ok', protocol: 'websocket', version: 1 })); });
const wss = new WebSocketServer({ server: http, maxPayload: 32 * 1024 });
const peers = new Map<WebSocket, Peer>();
const flights = new Map<string, Map<string, FlightState>>();
const safeText = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const send = (socket: WebSocket, message: ServerMessage) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };
function broadcast(roomId: string, message: ServerMessage, exclude?: WebSocket) {
  for (const [socket, peer] of peers) if (peer.joined && peer.roomId === roomId && socket !== exclude) send(socket, message);
}
function presence(roomId: string) {
  const roomPeers = [...peers.values()].filter(p => p.joined && p.roomId === roomId);
  broadcast(roomId, { type: 'presence', roomId, pilots: roomPeers.filter(p => p.role === 'pilot').map(p => p.callsign), controllers: roomPeers.filter(p => p.role === 'atc').map(p => p.callsign) });
}
function validFlight(input: unknown): input is FlightState {
  if (!input || typeof input !== 'object') return false;
  const f = input as Record<string, unknown>;
  const nums = ['airspeed','altitude','verticalSpeed','heading','pitch','bank','throttle','elevator','aileron','rudder'];
  return nums.every(k => typeof f[k] === 'number' && Number.isFinite(f[k])) &&
    (f.airspeed as number) >= 0 && (f.airspeed as number) <= 500 && (f.altitude as number) >= 0 && (f.altitude as number) <= 60000 &&
    (f.heading as number) >= 0 && (f.heading as number) < 360 && (f.throttle as number) >= 0 && (f.throttle as number) <= 1 &&
    typeof f.gearDown === 'boolean' && typeof f.onGround === 'boolean' && typeof f.crashed === 'boolean' && [0,1,2,3].includes(f.flaps as number);
}
wss.on('connection', socket => {
  const peer: Peer = { socket, role: 'pilot', callsign: '', roomId: '', joined: false };
  peers.set(socket, peer);
  socket.on('message', raw => {
    let message: ClientMessage;
    try { message = JSON.parse(raw.toString()) as ClientMessage; }
    catch { send(socket, { type: 'error', message: 'Mensagem JSON inválida.' }); return; }
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') { send(socket, { type: 'error', message: 'Formato de mensagem inválido.' }); return; }
    if (message.type === 'ping') { send(socket, { type: 'pong', sentAt: Number.isFinite(message.sentAt) ? message.sentAt : Date.now() }); return; }
    if (message.type === 'join') {
      const role = message.role;
      const callsign = safeText(message.callsign, 8).toUpperCase();
      const roomId = safeText(message.roomId, 24).toUpperCase();
      if (!['pilot','atc'].includes(role) || !/^[A-Z0-9-]{2,8}$/.test(callsign) || !/^[A-Z0-9-]{2,24}$/.test(roomId)) { send(socket, { type: 'error', message: 'Role, callsign ou sala inválidos.' }); return; }
      const duplicate = [...peers.values()].some(p => p !== peer && p.joined && p.roomId === roomId && p.callsign === callsign);
      if (duplicate) { send(socket, { type: 'error', message: 'Callsign já está em uso nesta sala.' }); return; }
      peer.role = role; peer.callsign = callsign; peer.roomId = roomId; peer.joined = true;
      if (!flights.has(roomId)) flights.set(roomId, new Map());
      const snapshot: Track[] = [...(flights.get(roomId) ?? new Map()).entries()].map(([cs, flight]) => ({ callsign: cs, flight }));
      send(socket, { type: 'session:snapshot', roomId, flights: snapshot }); presence(roomId); return;
    }
    if (!peer.joined) { send(socket, { type: 'error', message: 'Entre em uma sala antes de enviar dados.' }); return; }
    if (message.type === 'flight:update') {
      if (peer.role !== 'pilot' || !validFlight(message.flight)) { send(socket, { type: 'error', message: 'Atualização de voo inválida ou papel sem permissão.' }); return; }
      flights.get(peer.roomId)!.set(peer.callsign, message.flight);
      broadcast(peer.roomId, { type: 'flight:updated', callsign: peer.callsign, flight: message.flight }, socket); return;
    }
    if (message.type === 'atc:instruction') {
      if (peer.role !== 'atc') { send(socket, { type: 'error', message: 'Somente controladores podem emitir instruções.' }); return; }
      const targetCallsign = safeText(message.targetCallsign, 8).toUpperCase();
      const instruction = safeText(message.instruction, 300);
      if (!targetCallsign || !instruction) { send(socket, { type: 'error', message: 'Destino e instrução são obrigatórios.' }); return; }
      const targetExists = [...peers.values()].some(p => p.joined && p.roomId === peer.roomId && p.role === 'pilot' && p.callsign === targetCallsign);
      if (!targetExists) { send(socket, { type: 'error', message: 'Aeronave alvo não está conectada como piloto nesta sala.' }); return; }
      broadcast(peer.roomId, { type: 'atc:instruction', from: peer.callsign, targetCallsign, instruction, timestamp: Date.now() }); return;
    }
    send(socket, { type: 'error', message: 'Tipo de mensagem não suportado.' });
  });
  socket.on('close', () => {
    const old = peers.get(socket); peers.delete(socket);
    if (old?.joined) { const room = flights.get(old.roomId); if (old.role === 'pilot') room?.delete(old.callsign); if (room?.size === 0) flights.delete(old.roomId); presence(old.roomId); }
  });
  socket.on('error', () => socket.close());
});
http.listen(PORT, '0.0.0.0', () => console.log(`SkyControl WebSocket server listening on :${PORT}`));
