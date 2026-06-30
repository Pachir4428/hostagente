# Changelog — Bot Hosting Platform

## [1.1.0] - 2026-06-25

### Adicionado
- Ligação por **código de emparelhamento** (alternativa ao QR Code)
- **Upload de bots via ZIP** — carregue scripts personalizados sem reiniciar o servidor
- Painel de **Integrações & APIs Externas** — gerencie chaves de OpenAI, Anthropic, Gemini, webhooks, pagamentos
- Sistema de **Atualizações** — verifique e aplique atualizações diretamente do painel
- WebSocket agora transmite códigos de emparelhamento em tempo real
- Volume `uploads-data` no docker-compose.prod.yml para persistência de scripts

### Alterado
- Sidebar agora inclui "Integrações" e "Atualizações"
- `socket.ts` suporta evento `pairing` para código de emparelhamento
- `api.ts` com novos endpoints para external-apis, updates, pairing-code, upload-script
- Schema Prisma: novos modelos `ExternalApi`, `SystemUpdate`; novos campos em `Bot`

## [1.0.0] - 2026-06-24

### Adicionado
- Backend NestJS completo (API, bot-runner, bot-engine, worker)
- Autenticação JWT com refresh tokens
- Gestão de bots WhatsApp/Telegram via Docker
- Filas BullMQ com processamento de mensagens
- Integração OpenAI GPT-4o-mini
- WebSocket real-time para QR Code e status
- Frontend Next.js 14 completo
- Sistema de faturamento com M-Pesa, e-Mola, mKesh
- CI/CD GitHub Actions
- Scripts de deploy VPS
