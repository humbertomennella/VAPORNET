# SkyControl — protótipo técnico 0.1

Base inicial para um jogo web de simulação recreativa de voo e controle de tráfego aéreo, com interface pixel art, cliente React + TypeScript, modelo de voo arcade, servidor WebSocket e esquema Supabase.

> **Limite importante:** esta entrega é uma base nova e modular. O HTML original do cockpit não foi integrado porque não está disponível como arquivo de projeto acessível nesta execução. O cockpit atual é um substituto demonstrativo; o próximo passo de integração é portar os desenhos e recursos do HTML original para `src/cockpit/Cockpit.tsx`, mantendo `FlightState` como fonte única de dados. O modelo de voo é arcade e não é adequado para treinamento ou uso aeronáutico real.

## Requisitos

- Node.js 20 ou superior
- npm
- Projeto Supabase separado, apenas quando for habilitar autenticação e persistência

## Instalar e executar

```bash
npm install
cp .env.example .env.local
npm run dev
```

A interface abre no endereço informado pelo Vite. Sem `.env.local`, o cockpit e o radar de demonstração funcionam localmente, mas não há autenticação nem persistência.

### Servidor multiplayer

Em outro terminal:

```bash
npm run server
```

O servidor WebSocket fica em `ws://localhost:8787`; `http://localhost:8787` responde com um JSON de saúde. Configure `VITE_MULTIPLAYER_URL=ws://localhost:8787` no `.env.local` se necessário e recarregue o cliente. Para testar duas funções, abra duas janelas e use callsigns diferentes, na mesma sala. Uma entra como piloto e outra como ATC.

O servidor atual mantém estado apenas em memória. Reiniciar o processo apaga as salas e os tracks. Ainda não há persistência de voos, reconexão transparente, voz, rate limiting, autenticação de sockets ou implantação pública endurecida.

## Supabase

1. Crie um projeto Supabase **exclusivo do SkyControl**.
2. Em SQL Editor, aplique `supabase/migrations/0001_skycontrol_core.sql`.
3. Copie a Project URL e a chave pública/anon para `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
VITE_MULTIPLAYER_URL=ws://localhost:8787
```

Não use a chave `service_role` no navegador. O schema define perfis, registros de voo e eventos com RLS, mas o fluxo de cadastro/login ainda precisa ser conectado à interface antes de ser considerado entregue.

## Controles do protótipo

- `W` / `S`: aumentar / reduzir potência
- Setas: ajustar comandos de arfagem e rolagem
- Espaço: centralizar os comandos
- Sliders na interface: controle manual de potência, elevator e aileron

A ação “Preparar demonstração de decolagem” aplica uma configuração inicial; não garante decolagem automática. Use os controles e observe o comportamento do modelo arcade.

## Scripts

```bash
npm run dev       # interface
npm run server    # WebSocket
npm run build     # verificação TypeScript + build de produção
npm test          # testes do modelo de voo
```

## Estado do trabalho

- [x] Estrutura React + TypeScript / Vite
- [x] Interface inicial pixel art para piloto e ATC
- [x] Estado de voo central e modelo arcade determinístico
- [x] Radar local de demonstração
- [x] Protocolo WebSocket e servidor com salas, tracks e validação básica de mensagens
- [x] Schema Supabase inicial com RLS
- [x] Testes unitários do modelo de voo
- [ ] Portar o cockpit original fornecido pelo usuário
- [ ] Login e cadastro funcionais via Supabase Auth
- [ ] Persistência real de voos e eventos
- [ ] Autorização de instruções ATC aplicada à aeronave-alvo
- [ ] Autenticação do WebSocket, rate limits, reconexão e testes e2e
- [ ] Implantação, monitoramento e teste multiplayer em ambiente remoto

Este checklist evita chamar de “100% pronto” o que ainda é um protótipo. A integração original, autenticação e validação remota precisam ser executadas antes de um lançamento público.
