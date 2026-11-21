# TPanel

A self-hosted web panel for managing a Minecraft server running on Termux, or on any
small Linux device that is not suited to a full control panel. One Node.js process runs
on the same machine as the server: no agent, no external database, no build step.

## Features

- **Dashboard** — server state, uptime and live CPU / memory / disk meters
- **Console** — live server output plus command input with history
- **File manager** — browse, edit, upload, download and delete server files
- **JAR manager** — upload a JAR, or download Paper, Purpur, Vanilla or Fabric
- **Server config** — grouped editor for `server.properties` with field descriptions
- **Backups** — create, restore, upload and download server snapshots
- **Scheduler** — cron jobs that start, stop, restart, back up or run commands
- **Authentication** — one panel password, hashed with bcrypt, JWT sessions
- **Phone-first UI** — bottom tab bar, large touch targets, no external assets

## Requirements

- Termux, or another Linux environment
- Node.js 18 or newer
- Java 17 or newer (Java 21 for recent Minecraft releases)

On Termux:

```bash
pkg update
pkg install nodejs-lts openjdk-17
```

## Install

```bash
git clone https://github.com/o-synapse/tpanel.git
cd tpanel
npm install
node server.js
```

`npm start` does the same thing.

## First run

1. Open `http://localhost:8080`.
2. The panel asks you to create a password. **There is no default password.** Only the
   bcrypt hash is stored, in `config.json` on the device.
3. Add a server JAR, either through **JAR manager** or by copying a `.jar` file into
   `minecraft/`.
4. Press **Start** on the dashboard.

The panel binds to `0.0.0.0`, so it is reachable from other devices on the same network
at `http://<device-ip>:8080`.

> The traffic is plain HTTP and the panel can control the machine it runs on. Keep it on
> a trusted network, or put it behind a reverse proxy with TLS if you need access from
> outside.

## Configuration

Settings are edited on the **Settings** page and stored in `config.json`.

| Key | Default | Description |
| --- | --- | --- |
| `serverName` | `My Minecraft Server` | Name shown in the panel |
| `port` | `8080` | Port the panel listens on |
| `javaPath` | `java` | Java binary used to start the server |
| `minMemory` | `1024M` | JVM minimum heap (`-Xms`) |
| `maxMemory` | `2048M` | JVM maximum heap (`-Xmx`) |
| `jvmFlags` | G1GC flags | Extra JVM arguments |
| `selectedJar` | `server.jar` | JAR used by **Start** |
| `maxBackups` | `10` | Backups kept before the oldest is removed |
| `autoStart` | `false` | Start Minecraft when the panel starts |
| `maxConsoleLines` | `1000` | Console lines kept in memory |

`config.json` is created on first start. It also holds the password hash and the JWT
signing secret, so keep it out of version control.

## Project layout

```
tpanel/
├── server.js          # Express + Socket.IO backend
├── config.json        # Generated configuration (not in version control)
├── public/
│   ├── index.html     # SPA shell
│   ├── css/style.css  # Design system
│   └── js/app.js      # Frontend application
├── minecraft/         # Minecraft server files
└── backups/           # Backup archives
```

## HTTP API

Every route except `/api/auth/status`, `/api/auth/setup` and `/api/auth/login` needs an
`Authorization: Bearer <token>` header. Tokens are valid for seven days.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/auth/status` | Whether first-time setup is needed |
| POST | `/api/auth/setup` | Create the first password |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/change-password` | Change the password |
| GET | `/api/server/status` | Server state, uptime and selected JAR |
| POST | `/api/server/start` | Start the server |
| POST | `/api/server/stop` | Stop the server |
| POST | `/api/server/restart` | Restart the server |
| POST | `/api/server/kill` | Force-stop the server |
| POST | `/api/server/command` | Send a console command |
| GET | `/api/server/console` | Buffered console output |
| GET | `/api/stats` | CPU, memory and disk usage |
| GET | `/api/config` | Read panel settings |
| PUT | `/api/config` | Update panel settings |
| GET | `/api/properties` | Read `server.properties` |
| PUT | `/api/properties` | Write `server.properties` |
| GET | `/api/files` | List a directory |
| GET | `/api/files/read` | Read one file |
| PUT | `/api/files/write` | Write one file |
| POST | `/api/files/upload` | Upload files |
| GET | `/api/files/download` | Download a file |
| POST | `/api/files/mkdir` | Create a directory |
| POST | `/api/files/rename` | Rename a file |
| DELETE | `/api/files/delete` | Delete a file |
| DELETE | `/api/files/delete-all` | Delete everything in the server folder |
| GET | `/api/jars` | List server JARs |
| POST | `/api/jars/upload` | Upload a JAR |
| POST | `/api/jars/select` | Choose the active JAR |
| POST | `/api/jars/download` | Download a server JAR |
| GET | `/api/jars/versions/:type` | Available versions for a server type |
| DELETE | `/api/jars/:name` | Delete a JAR |
| GET | `/api/backups` | List backups |
| POST | `/api/backups/create` | Create a backup |
| POST | `/api/backups/restore/:name` | Restore a backup |
| POST | `/api/backups/upload` | Upload a backup |
| GET | `/api/backups/download/:name` | Download a backup |
| DELETE | `/api/backups/:name` | Delete a backup |
| GET | `/api/schedules` | List scheduled tasks |
| POST | `/api/schedules` | Create a scheduled task |
| PUT | `/api/schedules/:id` | Update a scheduled task |
| DELETE | `/api/schedules/:id` | Delete a scheduled task |

## Development

The frontend is plain HTML, CSS and JavaScript — there is no build step and no runtime
dependencies beyond the ones in `package.json`. Edit `public/` and reload the page.

## License

ISC
