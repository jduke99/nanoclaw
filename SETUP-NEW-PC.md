# NanoClaw — Setup em novo PC (Windows + WSL2)

## Pré-requisitos

- Windows 10/11 com WSL2
- Ubuntu 24.04 no WSL2
- Claude Code CLI instalado no Windows

## 1. WSL2 + Podman

```bash
# No PowerShell (admin):
wsl --install -d Ubuntu-24.04

# Dentro do WSL2:
sudo apt update && sudo apt install -y podman nodejs npm git sqlite3
```

## 2. Node.js via nvm

```bash
# Dentro do WSL2:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 20
```

## 3. Copiar o projeto

Copiar a pasta `nanoclaw/` inteira para o novo PC. Pode ser via USB, rsync, git, etc.

No Windows, colocar em: `C:\Users\<USER>\Desktop\NanoClawWindows\nanoclaw\`

## 4. Copiar para o WSL2

```bash
# Dentro do WSL2:
mkdir -p /root/nanoclaw
cp -r /mnt/c/Users/<USER>/Desktop/NanoClawWindows/nanoclaw/* /root/nanoclaw/
cd /root/nanoclaw
npm install
npx tsc
```

## 5. Configurar o .env

Criar `/root/nanoclaw/.env`:

```
TELEGRAM_BOT_TOKEN=<token do @nanotelclaw_bot>
TELEGRAM_ONLY=true
ASSISTANT_NAME=Andy
CLAUDE_CODE_OAUTH_TOKEN=<token do Claude Code>
```

Para obter o `CLAUDE_CODE_OAUTH_TOKEN`:
- No Windows, abrir: `C:\Users\<USER>\.claude\.credentials.json`
- Copiar o valor de `claudeAiOauth.accessToken`

## 6. Build da imagem Docker

```bash
# Dentro do WSL2:
cd /root/nanoclaw/container
docker build -t nanoclaw-agent:latest .
# Demora ~5 min (baixa Chromium + deps)
```

## 7. Registrar o grupo Telegram (se banco novo)

Se copiou o `store/messages.db` do PC anterior, pular este passo.

Se banco novo:

```bash
cd /root/nanoclaw
node -e "
const Database = require('better-sqlite3');
const db = new Database('store/messages.db');
db.prepare(\`INSERT OR REPLACE INTO registered_groups
  (jid, name, folder, trigger_pattern, added_at, requires_trigger)
  VALUES (?, ?, ?, ?, ?, ?)\`).run(
  'tg:6096574866', 'Alex', 'main', '@Andy', new Date().toISOString(), 0
);
console.log(db.prepare('SELECT * FROM registered_groups').all());
db.close();
"
```

## 8. Fix de permissões

```bash
# Dentro do WSL2:
mkdir -p /root/nanoclaw/groups/main/logs
mkdir -p /root/nanoclaw/data/sessions/main/.claude
mkdir -p /root/nanoclaw/data/ipc/main/{messages,tasks,input,host-tasks,host-task-results}
chown -R 1000:1000 /root/nanoclaw/data/sessions/
chown -R 1000:1000 /root/nanoclaw/data/ipc/
chown -R 1000:1000 /root/nanoclaw/groups/main/
```

## 9. Iniciar o NanoClaw

```bash
# Dentro do WSL2:
cd /root/nanoclaw
source ~/.nvm/nvm.sh
set -a && source .env && set +a
node dist/index.js
```

Deve aparecer:
```
Telegram bot: @nanotelclaw_bot
INFO: Docker/Podman container system available
INFO: State loaded (groupCount: 1)
INFO: Telegram bot connected
INFO: NanoClaw running (trigger: @Andy)
```

## 10. Host Task Watcher (Bridge para Claude Code)

No Windows (CMD/PowerShell separado):

```bash
node C:\Users\<USER>\Desktop\NanoClawWindows\nanoclaw\scripts\host-task-watcher.mjs
```

Isso permite que o Andy (Telegram) delegue tarefas para o Claude Code local (desktop, browser, etc).

## 11. Testar

Manda uma mensagem pro @nanotelclaw_bot no Telegram. Deve responder.

## Importante

- **Não rodar o bot em dois PCs ao mesmo tempo** — o Telegram só permite uma instância por token
- Desligar no PC antigo antes de ligar no novo
- O `CLAUDE_CODE_OAUTH_TOKEN` expira — se der erro de auth, gerar novo token
- O `store/messages.db` contém o histórico e grupos registrados — copiar se quiser manter

## Arquivos essenciais para copiar

| Arquivo | Obrigatório | Contém |
|---------|-------------|--------|
| `nanoclaw/` (projeto inteiro) | Sim | Código fonte |
| `store/messages.db` | Recomendado | Histórico + grupos registrados |
| `.env` | Sim (recriar) | Tokens e config |
| `groups/main/CLAUDE.md` | Sim (incluído no projeto) | Instruções do agente |
