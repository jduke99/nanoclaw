# Andy Agent — Plano de Implementação

## Conceito

Bot pessoal inteligente que monitora canais (Telegram, Teams, Email, Asana), analisa situações, e age sob confirmação. Roda direto no Windows com Node.js — sem WSL, sem Docker, sem containers.

## Requisitos do Usuário

1. **ON/OFF** — botão para ligar/desligar o bot
2. **Etapa 1 (read-only)** — só análise, sem ações destrutivas
3. **Etapa 2 (actions)** — execução de ações (restart, scale, etc.)
4. **Pasta de contexto** — diretório onde o usuário coloca arquivos, tarefas, runbooks
5. **Monitorar Asana** — tasks, comentários, mudanças
6. **Pedir confirmação** — antes de executar qualquer ação
7. **Coletar logs antes de agir** — ex: `kubectl logs` antes de `kubectl rollout restart`
8. **OAuth do Claude (plano)** — não API key

---

## Arquitetura

```
┌─────────────────────────────────────────────────┐
│                  Andy Agent                      │
│              (Node.js no Windows)                │
│                                                  │
│  ┌───────────┐ ┌───────┐ ┌───────┐ ┌─────────┐ │
│  │ Telegram   │ │ Teams │ │ Email │ │  Asana  │ │
│  │ (grammy)   │ │ (bot) │ │(Graph)│ │(polling)│ │
│  └─────┬─────┘ └───┬───┘ └───┬───┘ └────┬────┘ │
│        └────────────┴────────┴───────────┘      │
│                      ↓                           │
│            ┌─────────────────┐                   │
│            │   Orchestrator  │                   │
│            │   (index.ts)    │                   │
│            └────────┬────────┘                   │
│                     ↓                            │
│         ┌──────────────────────┐                 │
│         │  Claude SDK V1       │                 │
│         │  query() + resume    │                 │
│         │  canUseTool() guard  │                 │
│         └──────────┬───────────┘                 │
│                    ↓                             │
│     ┌──────────────────────────────┐             │
│     │        Tool Execution        │             │
│     │  Read: kubectl get/logs      │             │
│     │  Read: ssh + cat/tail        │             │
│     │  Read: oci cli status        │             │
│     │  Action: kubectl restart     │ → confirm   │
│     │  Blocked: delete/drop        │ → DENY      │
│     └──────────────────────────────┘             │
│                                                  │
│  ┌──────────────────────┐  ┌──────────────────┐ │
│  │  context/             │  │  SQLite DB       │ │
│  │  ├── runbooks/        │  │  - messages      │ │
│  │  ├── tasks/           │  │  - sessions      │ │
│  │  ├── infra/           │  │  - audit_log     │ │
│  │  └── CLAUDE.md        │  │  - config        │ │
│  └──────────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Estrutura de Arquivos

```
andy-agent/
├── src/
│   ├── index.ts              # Orchestrator: startup, message loop, ON/OFF
│   ├── config.ts             # Config, env vars, mode (readonly/actions)
│   ├── agent.ts              # Claude SDK V1 query() wrapper
│   ├── guard.ts              # canUseTool() — security layer
│   ├── db.ts                 # SQLite: messages, sessions, audit log
│   ├── channels/
│   │   ├── telegram.ts       # grammy — primary control channel
│   │   ├── asana.ts          # Asana Events API polling
│   │   ├── teams.ts          # Teams (fase 2)
│   │   └── email.ts          # Outlook via Graph API (fase 2)
│   └── tools/
│       ├── confirmation.ts   # Ask confirmation via Telegram before action
│       └── audit.ts          # Log every tool execution to SQLite
├── context/                  # Pasta do usuário — runbooks, docs, infra info
│   ├── CLAUDE.md             # Memória/instruções persistentes do agente
│   ├── runbooks/             # Procedimentos: "se X caiu, faça Y"
│   ├── infra/                # Configs, IPs, topologia
│   └── tasks/                # Tarefas manuais colocadas pelo usuário
├── store/
│   └── andy.db               # SQLite database
├── .env                      # Tokens e configs
├── package.json
└── tsconfig.json
```

---

## Fases de Implementação

### Fase 1: Core + Telegram + Asana (read-only)

**O que faz:**
- Bot no Telegram recebe mensagens
- Claude analisa e responde
- Monitora Asana (poll a cada 30s)
- Lê arquivos da pasta `context/`
- Pode executar comandos READ-ONLY: `kubectl get`, `kubectl logs`, `ssh ... cat`, `oci ... list`
- NÃO pode executar ações (restart, delete, scale, etc.)

**Dependências:**
```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "latest",
    "grammy": "^1.x",
    "better-sqlite3": "^11.x",
    "dotenv": "^16.x"
  }
}
```

**Config (.env):**
```
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
TELEGRAM_BOT_TOKEN=8578562819:AAF...
ASANA_PAT=1/1234567890:abcdef...
ASANA_PROJECT_GID=1234567890
AGENT_MODE=readonly
ASSISTANT_NAME=Andy
```

### Fase 2: Actions + Teams + Email

- `config.mode = 'actions'` — permite executar kubectl restart, ssh service restart, etc.
- Confirmação via Telegram antes de cada ação
- Teams bot (Microsoft Bot Framework)
- Email monitoring (Microsoft Graph API)
- Coleta automática de logs/status ANTES de agir

### Fase 3: Autonomia inteligente

- Regras de severidade (auto, confirma, bloqueia)
- Scheduler para tarefas recorrentes
- Auto-refresh do OAuth token
- Dashboard de audit log

---

## Estimativas

| Fase | LOC | Resultado |
|------|-----|-----------|
| Fase 1 | ~400-500 | Bot funcional: Telegram + Asana + read-only |
| Fase 2 | +200-300 | Actions + Teams + Email |
| Fase 3 | +200 | Scheduler + autonomia |
| **Total** | **~900** | Sistema completo |

---

## Segurança

| Mecanismo | Implementação |
|-----------|---------------|
| ON/OFF | `/on`, `/off` no Telegram |
| Mode switch | `/mode readonly` vs `/mode actions` |
| canUseTool | Regex blocklist + confirmation flow |
| Budget | `maxBudgetUsd: 1.0` por invocação |
| Audit | Cada tool call logado no SQLite |
| Allowed tools | Whitelist: Bash, Read, WebSearch, MCP |
| OAuth refresh | Auto-read de `~/.claude/.credentials.json` |
| kubectl RBAC | Service account com permissões limitadas (recomendado) |
| SSH | Via bastion host, sem acesso root direto (recomendado) |
