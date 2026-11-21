// ═══════════════════════════════════════════════════════════
// TermuxPanel v2.2 — Frontend Application
// Single-Page Application with hash-based routing
// ═══════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── State ────────────────────────────────────────────────
    let token = localStorage.getItem('tp_token');
    let socket = null;
    let currentPage = 'dashboard';
    let serverStatus = 'stopped';
    let systemStats = {};
    let consoleLines = [];
    let commandHistory = [];
    let commandHistoryIndex = -1;
    let currentFilePath = '.';
    let editorMode = false;
    let editorFilePath = '';

    // ─── API Helper ───────────────────────────────────────────
    async function api(url, options = {}) {
        const headers = { ...options.headers };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (options.body && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }
        try {
            const res = await fetch(url, { ...options, headers });
            if (res.status === 401) {
                token = null;
                localStorage.removeItem('tp_token');
                showLogin();
                throw new Error('Unauthorized');
            }
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Request failed');
            return data;
        } catch (e) {
            if (e.message !== 'Unauthorized') toast(e.message, 'error');
            throw e;
        }
    }

    // ─── Toast Notifications ──────────────────────────────────
    function toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.setAttribute('role', type === 'error' ? 'alert' : 'status');
        el.innerHTML = `<span class="toast-mark" aria-hidden="true"></span><span class="toast-text">${escapeHtml(message)}</span>`;
        container.appendChild(el);
        setTimeout(() => {
            el.classList.add('removing');
            setTimeout(() => el.remove(), 300);
        }, 4000);
    }

    // ─── Modal ────────────────────────────────────────────────
    let modalReturnFocus = null;

    function showModal(title, bodyHtml, footerHtml = '') {
        modalReturnFocus = document.activeElement;
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHtml;
        document.getElementById('modal-footer').innerHTML = footerHtml;
        document.getElementById('modal-overlay').classList.remove('hidden');
        requestAnimationFrame(() => {
            const target = document.querySelector(
                '#modal-body input:not([disabled]), #modal-body select, #modal-body textarea, #modal-footer .btn-primary, #modal-close'
            );
            if (target) target.focus();
        });
    }

    function closeModal() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay.classList.contains('hidden')) return;
        overlay.classList.add('hidden');
        if (modalReturnFocus && document.contains(modalReturnFocus) && typeof modalReturnFocus.focus === 'function') {
            modalReturnFocus.focus();
        }
        modalReturnFocus = null;
    }

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal-overlay')) closeModal();
    });

    // ─── Utility ──────────────────────────────────────────────
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    }

    function formatDate(date) {
        if (!date) return '—';
        const d = new Date(date);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatUptime(seconds) {
        if (!seconds || seconds <= 0) return '—';
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);
        if (parts.length === 0) parts.push(`${s}s`);
        return parts.join(' ');
    }

    function getFileIcon(name, isDir) {
        const symbol = isDir ? 'i-folder' : 'i-file';
        return `<svg class="icon file-icon" aria-hidden="true"><use href="#${symbol}"></use></svg>`;
    }

    function getFileExtension(name) {
        if (!name || !name.includes('.')) return '';
        const ext = name.split('.').pop();
        return ext && ext !== name ? ext.slice(0, 8) : '';
    }

    // ─── Shell: viewport sizing, password reveal ──────────────
    function syncAppHeight() {
        const vv = window.visualViewport;
        const height = vv ? vv.height : window.innerHeight;
        document.documentElement.style.setProperty('--app-h', `${Math.round(height)}px`);

        // A collapsing URL bar also shrinks the visual viewport, so only treat the
        // difference as a keyboard once it is far larger than the browser chrome.
        const diff = vv ? window.innerHeight - vv.height : 0;
        const keyboardOpen = diff > 180;
        document.body.classList.toggle('keyboard-open', keyboardOpen);
    }

    syncAppHeight();
    window.addEventListener('resize', syncAppHeight);
    window.addEventListener('orientationchange', () => setTimeout(syncAppHeight, 120));
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncAppHeight);
        window.visualViewport.addEventListener('scroll', syncAppHeight);
    }

    // Password reveal is delegated so dynamically rendered fields work too.
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-reveal]');
        if (!btn) return;
        const input = document.getElementById(btn.dataset.reveal);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-pressed', String(show));
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        btn.setAttribute('title', show ? 'Hide password' : 'Show password');
        const use = btn.querySelector('use');
        if (use) use.setAttribute('href', show ? '#i-eye-off' : '#i-eye');
    });

    // Fill connection facts with the current address.
    const panelHost = location.host || 'localhost';
    const panelProtocol = location.protocol === 'https:' ? 'HTTPS' : 'HTTP';
    document.querySelectorAll('[data-panel-host]').forEach(el => { el.textContent = panelHost; });
    document.querySelectorAll('[data-panel-protocol]').forEach(el => { el.textContent = panelProtocol; });

    // Escape closes the topmost layer.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const overlayEl = document.getElementById('modal-overlay');
        if (overlayEl && !overlayEl.classList.contains('hidden')) {
            closeModal();
            return;
        }
        if (sidebar.classList.contains('open')) closeSidebar();
    });

    // ─── Auth Flow ────────────────────────────────────────────
    async function checkAuth() {
        try {
            const status = await fetch('/api/auth/status').then(r => r.json());
            if (status.needsSetup) {
                showSetup();
            } else if (!token) {
                showLogin();
            } else {
                // Validate token
                try {
                    await api('/api/server/status');
                    showApp();
                } catch (e) {
                    showLogin();
                }
            }
        } catch (e) {
            toast('Cannot connect to server', 'error');
        }
    }

    function showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('setup-screen').classList.add('hidden');
        document.getElementById('app').classList.add('hidden');
    }

    function showSetup() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('setup-screen').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    }

    function showApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('setup-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        initSocket();
        navigate(location.hash.slice(1) || 'dashboard');
    }

    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        try {
            const data = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            }).then(r => r.json());

            if (data.token) {
                token = data.token;
                localStorage.setItem('tp_token', token);
                errorEl.classList.add('hidden');
                showApp();
            } else {
                errorEl.textContent = data.error || 'Login failed';
                errorEl.classList.remove('hidden');
            }
        } catch (e) {
            errorEl.textContent = 'Connection failed';
            errorEl.classList.remove('hidden');
        }
    });

    // Setup form
    document.getElementById('setup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('setup-password').value;
        const confirm = document.getElementById('setup-confirm').value;
        const errorEl = document.getElementById('setup-error');

        if (password.length < 8) {
            errorEl.textContent = 'Use at least 8 characters';
            errorEl.classList.remove('hidden');
            return;
        }

        if (password !== confirm) {
            errorEl.textContent = 'Passwords do not match';
            errorEl.classList.remove('hidden');
            return;
        }

        try {
            const data = await fetch('/api/auth/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            }).then(r => r.json());

            if (data.token) {
                token = data.token;
                localStorage.setItem('tp_token', token);
                errorEl.classList.add('hidden');
                showApp();
                toast('Password saved. Welcome to TPanel.', 'success');
            } else {
                errorEl.textContent = data.error || 'Setup failed';
                errorEl.classList.remove('hidden');
            }
        } catch (e) {
            errorEl.textContent = 'Connection failed';
            errorEl.classList.remove('hidden');
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        token = null;
        localStorage.removeItem('tp_token');
        if (socket) socket.disconnect();
        showLogin();
    });

    // ─── Socket.IO ────────────────────────────────────────────
    function initSocket() {
        if (socket) socket.disconnect();
        socket = io();

        socket.on('server:status', (status) => {
            serverStatus = status;
            updateStatusIndicators();
            if (currentPage === 'dashboard') renderDashboard();
        });

        socket.on('console:history', (lines) => {
            consoleLines = lines;
            if (currentPage === 'console') renderConsoleLines();
        });

        socket.on('console:line', (line) => {
            consoleLines.push(line);
            if (consoleLines.length > 1000) consoleLines = consoleLines.slice(-1000);
            if (currentPage === 'console') appendConsoleLine(line);
        });

        socket.on('stats:update', (stats) => {
            systemStats = stats;
            serverStatus = stats.serverStatus;
            updateStatusIndicators();
            if (currentPage === 'dashboard') updateDashboardStats();
        });

        socket.on('jar:downloading', ({ name }) => toast(`Downloading ${name}...`, 'info'));
        socket.on('jar:downloaded', ({ name }) => {
            toast(`Downloaded ${name}`, 'success');
            if (currentPage === 'jars') renderJarsPage();
        });
        socket.on('backup:creating', () => toast('Creating backup...', 'info'));
        socket.on('backup:created', ({ name }) => {
            toast(`Backup created: ${name}`, 'success');
            if (currentPage === 'backups') renderBackupsPage();
        });
    }

    const STATUS_LABELS = {
        running: 'Running',
        starting: 'Starting',
        stopping: 'Stopping',
        stopped: 'Stopped'
    };

    function updateStatusIndicators() {
        const state = STATUS_LABELS[serverStatus] ? serverStatus : 'stopped';
        const label = STATUS_LABELS[state];

        document.querySelectorAll('[data-status-chip]').forEach(chip => {
            chip.dataset.state = state;
        });
        document.querySelectorAll('[data-status-label]').forEach(el => {
            el.textContent = label;
        });
    }

    // ─── Sidebar & Navigation ─────────────────────────────────
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const moreBtn = document.getElementById('more-btn');
    let drawerReturnFocus = null;

    function openSidebar() {
        if (sidebar.classList.contains('open')) return;
        drawerReturnFocus = document.activeElement;
        sidebar.classList.add('open');
        overlay.classList.add('active');
        document.body.classList.add('drawer-open');
        sidebar.removeAttribute('inert');
        if (moreBtn) moreBtn.setAttribute('aria-expanded', 'true');
        const closeBtn = document.getElementById('sidebar-close');
        if (closeBtn) requestAnimationFrame(() => closeBtn.focus());
    }

    function closeSidebar({ restoreFocus = true } = {}) {
        if (!sidebar.classList.contains('open')) return;
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        document.body.classList.remove('drawer-open');
        if (moreBtn) moreBtn.setAttribute('aria-expanded', 'false');
        if (restoreFocus && drawerReturnFocus && document.contains(drawerReturnFocus)) {
            drawerReturnFocus.focus();
        }
        drawerReturnFocus = null;
    }

    document.getElementById('sidebar-close').addEventListener('click', () => closeSidebar());
    overlay.addEventListener('click', () => closeSidebar());
    if (moreBtn) {
        moreBtn.addEventListener('click', () => {
            if (sidebar.classList.contains('open')) closeSidebar();
            else openSidebar();
        });
    }

    document.querySelectorAll('.nav-item[data-page], .mobile-nav-item[data-page]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigate(page);
            closeSidebar({ restoreFocus: false });
        });
    });

    window.addEventListener('hashchange', () => {
        const page = location.hash.slice(1) || 'dashboard';
        if (page !== currentPage) navigate(page);
    });

    function updateNavState(page) {
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            const active = item.dataset.page === page;
            item.classList.toggle('active', active);
            if (active) item.setAttribute('aria-current', 'page');
            else item.removeAttribute('aria-current');
        });

        document.querySelectorAll('.mobile-nav-item[data-page]').forEach(item => {
            const active = item.dataset.page === page;
            item.classList.toggle('active', active);
            if (active) item.setAttribute('aria-current', 'page');
            else item.removeAttribute('aria-current');
        });

        // Highlight "More" when the page only exists in the full nav.
        if (moreBtn) {
            const inTabs = document.querySelector(`.mobile-nav-item[data-page="${page}"]`);
            moreBtn.classList.toggle('active', !inTabs);
            if (!inTabs && page !== 'dashboard') moreBtn.setAttribute('aria-current', 'page');
            else moreBtn.removeAttribute('aria-current');
        }
    }

    function navigate(page) {
        const known = ['dashboard', 'console', 'files', 'jars', 'properties', 'backups', 'scheduler', 'settings'];
        currentPage = known.includes(page) ? page : 'dashboard';
        if (location.hash.slice(1) !== currentPage) location.hash = currentPage;

        updateNavState(currentPage);

        const title = currentPage.charAt(0).toUpperCase() + currentPage.slice(1);
        document.title = `${title} · TPanel`;
        const mobileTitle = document.getElementById('mobile-title');
        if (mobileTitle) mobileTitle.textContent = title;

        editorMode = false;
        renderPage(currentPage);
    }

    // ─── Page Router ──────────────────────────────────────────
    function renderPage(page) {
        const main = document.getElementById('main-content');
        switch (page) {
            case 'dashboard': renderDashboard(); break;
            case 'console': renderConsolePage(); break;
            case 'files': renderFilesPage(); break;
            case 'jars': renderJarsPage(); break;
            case 'properties': renderPropertiesPage(); break;
            case 'backups': renderBackupsPage(); break;
            case 'scheduler': renderSchedulerPage(); break;
            case 'settings': renderSettingsPage(); break;
            default: renderDashboard();
        }
    }

    // ─── Dashboard ────────────────────────────────────────────
    async function renderDashboard() {
        const main = document.getElementById('main-content');
        try {
            const status = await api('/api/server/status');
            const stats = systemStats;
            const cpuPercent = stats.cpu?.usage || 0;
            const memPercent = stats.memory?.percent || 0;
            const diskPercent = stats.disk?.percent || 0;
            const cpuModel = stats.cpu?.model || '—';
            const cores = stats.cpu?.cores ? `${stats.cpu.cores} cores` : '';

            main.innerHTML = `
                <div class="page">
                    <div class="page-header flex justify-between items-center">
                        <div class="min-w-0">
                            <p class="eyebrow">Server</p>
                            <h1 class="page-title">${escapeHtml(status.serverName || 'Minecraft Server')}</h1>
                        </div>
                        <span class="status-chip" data-status-chip data-state="${STATUS_LABELS[serverStatus] ? serverStatus : 'stopped'}">
                            <span class="status-dot" data-status-dot></span>
                            <span data-status-label>${STATUS_LABELS[serverStatus] || 'Stopped'}</span>
                        </span>
                    </div>

                    <section class="card dashboard-control">
                        <div class="control-metrics">
                            <div class="control-metric">
                                <span class="control-label">Uptime</span>
                                <span class="control-value" id="dash-uptime">${formatUptime(status.uptime)}</span>
                            </div>
                            <div class="control-metric">
                                <span class="control-label">Active JAR</span>
                                <span class="control-value truncate" id="dash-jar">${escapeHtml(status.jar || 'None selected')}</span>
                            </div>
                            <div class="control-metric">
                                <span class="control-label">Server size</span>
                                <span class="control-value" id="dash-disk">${formatBytes(stats.mcDirSize || 0)}</span>
                            </div>
                        </div>
                        <div class="control-actions">
                            <button class="btn btn-primary" onclick="window.TP.serverAction('start')" ${serverStatus !== 'stopped' ? 'disabled' : ''}>Start</button>
                            <button class="btn btn-secondary" onclick="window.TP.serverAction('stop')" ${serverStatus !== 'running' ? 'disabled' : ''}>Stop</button>
                            <button class="btn btn-secondary" onclick="window.TP.serverAction('restart')" ${serverStatus !== 'running' ? 'disabled' : ''}>Restart</button>
                            <button class="btn btn-ghost btn-danger-text" onclick="window.TP.serverAction('kill')" ${!['running', 'starting', 'stopping'].includes(serverStatus) ? 'disabled' : ''}>Kill</button>
                        </div>
                    </section>

                    <section class="card mt-6">
                        <div class="card-header">
                            <span class="card-title">Resources</span>
                            <span class="card-note">live</span>
                        </div>
                        <div class="meters">
                            ${renderMeter('cpu-gauge', 'cpu-value', 'CPU', cpuPercent, cpuModel + (cores ? ` · ${cores}` : ''))}
                            ${renderMeter('mem-gauge', 'mem-value', 'Memory', memPercent, `${formatBytes(stats.memory?.used || 0)} of ${formatBytes(stats.memory?.total || 0)}`)}
                            ${renderMeter('disk-gauge', 'disk-value', 'Disk', diskPercent, `${formatBytes(stats.disk?.used || 0)} of ${formatBytes(stats.disk?.total || 0)}`)}
                        </div>
                    </section>

                    <section class="card mt-6">
                        <div class="card-header">
                            <span class="card-title">System</span>
                        </div>
                        <dl class="spec-list">
                            <div class="spec-row">
                                <dt>Platform</dt>
                                <dd>${escapeHtml([stats.platform, stats.arch].filter(Boolean).join(' · ') || '—')}</dd>
                            </div>
                            <div class="spec-row">
                                <dt>Hostname</dt>
                                <dd>${escapeHtml(stats.hostname || '—')}</dd>
                            </div>
                            <div class="spec-row">
                                <dt>CPU</dt>
                                <dd>${escapeHtml(cpuModel)}${cores ? ` · ${cores}` : ''}</dd>
                            </div>
                            <div class="spec-row">
                                <dt>Device uptime</dt>
                                <dd>${formatUptime(stats.uptime || 0)}</dd>
                            </div>
                        </dl>
                    </section>
                </div>
            `;
        } catch (e) { /* handled by api() */ }
    }

    function updateDashboardStats() {
        const s = systemStats;
        const el = (id) => document.getElementById(id);
        if (!el('dash-uptime')) return;

        el('dash-uptime').textContent = formatUptime(s.serverUptime || 0);
        el('dash-disk').textContent = formatBytes(s.mcDirSize || 0);

        updateMeter('cpu-gauge', 'cpu-value', s.cpu?.usage || 0);
        updateMeter('mem-gauge', 'mem-value', s.memory?.percent || 0);
        updateMeter('disk-gauge', 'disk-value', s.disk?.percent || 0);

        const memNote = el('mem-note');
        if (memNote) memNote.textContent = `${formatBytes(s.memory?.used || 0)} of ${formatBytes(s.memory?.total || 0)}`;
        const diskNote = el('disk-note');
        if (diskNote) diskNote.textContent = `${formatBytes(s.disk?.used || 0)} of ${formatBytes(s.disk?.total || 0)}`;
    }

    function renderMeter(id, valueId, name, percent, note) {
        const pct = Math.max(0, Math.min(100, Math.round(percent || 0)));
        const tone = pct > 90 ? 'danger' : pct > 70 ? 'warning' : '';
        return `
            <div class="meter">
                <div class="meter-head">
                    <span class="meter-name">${escapeHtml(name)}</span>
                    <span class="meter-value" id="${valueId}">${pct}%</span>
                </div>
                <div class="meter-track"><div class="meter-fill ${tone}" id="${id}" style="width: ${pct}%"></div></div>
                <div class="meter-note" id="${id}-note">${escapeHtml(note || '')}</div>
            </div>
        `;
    }

    function updateMeter(id, valueId, percent) {
        const fill = document.getElementById(id);
        if (!fill) return;
        const pct = Math.max(0, Math.min(100, Math.round(percent || 0)));
        fill.style.width = `${pct}%`;
        fill.className = `meter-fill ${pct > 90 ? 'danger' : pct > 70 ? 'warning' : ''}`;
        const valueEl = document.getElementById(valueId);
        if (valueEl) valueEl.textContent = `${pct}%`;
    }

    // ─── Console ──────────────────────────────────────────────
    function renderConsolePage() {
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="page page-fill">
                <div class="page-header flex justify-between items-center">
                    <div>
                        <h1 class="page-title">Console</h1>
                        <p class="page-subtitle">Real-time server output</p>
                    </div>
                    <div class="flex gap-3">
                        <button class="btn btn-secondary btn-sm" onclick="window.TP.clearConsole()"><svg class="icon" aria-hidden="true"><use href="#i-eraser"></use></svg>Clear</button>
                    </div>
                </div>
                <div class="console-container">
                    <div class="console-output" id="console-output"></div>
                    <div class="console-input-row">
                        <input type="text" id="console-input" placeholder="${serverStatus === 'running' ? 'Type a command...' : 'Server is not running'}" 
                               ${serverStatus !== 'running' ? 'disabled' : ''} autocomplete="off" spellcheck="false">
                        <button onclick="window.TP.sendConsoleCommand()">Send</button>
                    </div>
                </div>
            </div>
        `;

        const input = document.getElementById('console-input');
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                window.TP.sendConsoleCommand();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (commandHistory.length > 0) {
                    commandHistoryIndex = Math.min(commandHistoryIndex + 1, commandHistory.length - 1);
                    input.value = commandHistory[commandHistory.length - 1 - commandHistoryIndex];
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                commandHistoryIndex = Math.max(commandHistoryIndex - 1, -1);
                input.value = commandHistoryIndex >= 0 ? commandHistory[commandHistory.length - 1 - commandHistoryIndex] : '';
            }
        });

        renderConsoleLines();
    }

    function renderConsoleLines() {
        const output = document.getElementById('console-output');
        if (!output) return;

        output.innerHTML = consoleLines.map(line => formatConsoleLine(line)).join('');
        output.scrollTop = output.scrollHeight;
    }

    function appendConsoleLine(line) {
        const output = document.getElementById('console-output');
        if (!output) return;

        const wasAtBottom = output.scrollHeight - output.clientHeight <= output.scrollTop + 50;
        output.innerHTML += formatConsoleLine(line);
        if (wasAtBottom) output.scrollTop = output.scrollHeight;
    }

    function formatConsoleLine(line) {
        const time = new Date(line.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `<span class="console-line ${line.type}"><span class="console-time">${time}</span>${escapeHtml(line.text)}</span>\n`;
    }

    // ─── File Manager ─────────────────────────────────────────
    async function renderFilesPage() {
        const main = document.getElementById('main-content');

        if (editorMode) {
            return renderFileEditor();
        }

        main.innerHTML = `
            <div class="page">
                <div class="page-header">
                    <h1 class="page-title">File Manager</h1>
                    <p class="page-subtitle">Manage your server files</p>
                </div>
                <div class="loading-overlay"><div class="spinner"></div> Loading files...</div>
            </div>
        `;

        try {
            const data = await api(`/api/files?path=${encodeURIComponent(currentFilePath)}`);
            renderFileList(data);
        } catch (e) { /* handled by api() */ }
    }

    function renderFileList(data) {
        const main = document.getElementById('main-content');
        const pathParts = data.path === '.' ? [] : data.path.split('/');

        const breadcrumbs = [
            `<button type="button" class="breadcrumb-item ${pathParts.length === 0 ? 'active' : ''}" onclick="window.TP.navigateFiles('.')">
                <svg class="icon" aria-hidden="true"><use href="#i-folder"></use></svg><span>minecraft</span>
            </button>`
        ];
        let accumulated = '';
        pathParts.forEach((part, i) => {
            accumulated += (accumulated ? '/' : '') + part;
            const p = accumulated;
            breadcrumbs.push(`<span class="breadcrumb-sep" aria-hidden="true"><svg class="icon"><use href="#i-chevron-right"></use></svg></span>`);
            breadcrumbs.push(`<button type="button" class="breadcrumb-item ${i === pathParts.length - 1 ? 'active' : ''}" onclick="window.TP.navigateFiles('${escapeHtml(p)}')">${escapeHtml(part)}</button>`);
        });

        const fileRows = data.items.map(item => {
            const itemPath = data.path === '.' ? item.name : `${data.path}/${item.name}`;
            const ext = item.isDirectory ? '' : getFileExtension(item.name);
            return `
                <div class="file-item" role="button" tabindex="0"
                     onclick="window.TP.${item.isDirectory ? `navigateFiles('${escapeHtml(itemPath)}')` : `openFile('${escapeHtml(itemPath)}')`}"
                     onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.TP.${item.isDirectory ? `navigateFiles('${escapeHtml(itemPath)}')` : `openFile('${escapeHtml(itemPath)}')`}}">
                    <div class="file-name">
                        ${getFileIcon(item.name, item.isDirectory)}
                        <span class="file-label">${escapeHtml(item.name)}</span>
                        ${ext ? `<span class="file-ext">${escapeHtml(ext)}</span>` : ''}
                    </div>
                    <div class="file-meta">
                        <span class="file-size">${item.isDirectory ? '—' : formatBytes(item.size)}</span>
                        <span class="file-modified">${formatDate(item.modified)}</span>
                    </div>
                    <div class="file-actions-col">
                        ${!item.isDirectory ? `<button type="button" class="btn btn-ghost btn-icon btn-xs" title="Download" aria-label="Download ${escapeHtml(item.name)}" onclick="event.stopPropagation(); window.TP.downloadFile('${escapeHtml(itemPath)}')"><svg class="icon" aria-hidden="true"><use href="#i-download"></use></svg></button>` : ''}
                        <button type="button" class="btn btn-ghost btn-icon btn-xs btn-danger-text" title="Delete" aria-label="Delete ${escapeHtml(item.name)}" onclick="event.stopPropagation(); window.TP.deleteFile('${escapeHtml(itemPath)}', '${escapeHtml(item.name)}')"><svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg></button>
                    </div>
                </div>
            `;
        }).join('');

        main.innerHTML = `
            <div class="page">
                <div class="page-header">
                    <h1 class="page-title">File Manager</h1>
                    <p class="page-subtitle">Files in the server directory</p>
                </div>
                <div class="file-toolbar">
                    <div class="file-breadcrumb">${breadcrumbs.join('')}</div>
                    <div class="file-toolbar-actions">
                        <button type="button" class="btn btn-danger btn-sm" onclick="window.TP.deleteAll()"><svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg>Delete all</button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="window.TP.createFolder()"><svg class="icon" aria-hidden="true"><use href="#i-folder-plus"></use></svg>New folder</button>
                        <button type="button" class="btn btn-primary btn-sm" onclick="window.TP.uploadFiles()"><svg class="icon" aria-hidden="true"><use href="#i-upload"></use></svg>Upload</button>
                    </div>
                </div>
                <div class="file-list">
                    <div class="file-list-header">
                        <span>Name</span>
                        <span>Size</span>
                        <span>Modified</span>
                        <span></span>
                    </div>
                    ${data.path !== '.' ? `
                        <div class="file-item" role="button" tabindex="0" onclick="window.TP.navigateFiles('${escapeHtml(data.path.split('/').slice(0, -1).join('/') || '.')}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.TP.navigateFiles('${escapeHtml(data.path.split('/').slice(0, -1).join('/') || '.')}')}">
                            <div class="file-name">
                                <svg class="icon file-icon" aria-hidden="true"><use href="#i-arrow-up"></use></svg>
                                <span class="file-label">Parent directory</span>
                            </div>
                            <div class="file-meta"></div>
                            <div class="file-actions-col"></div>
                        </div>
                    ` : ''}
                    ${fileRows || '<div class="empty-state"><svg class="icon empty-state-icon" aria-hidden="true"><use href="#i-folder"></use></svg><div class="empty-state-title">Empty directory</div><div class="empty-state-desc">Upload a file or create a folder to get started.</div></div>'}
                </div>
            </div>
        `;
    }

    async function renderFileEditor() {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="page"><div class="loading-overlay"><div class="spinner"></div> Loading file...</div></div>`;

        try {
            const data = await api(`/api/files/read?path=${encodeURIComponent(editorFilePath)}`);
            const fileName = editorFilePath.split('/').pop();

            main.innerHTML = `
                <div class="page page-fill">
                    <div class="page-header flex justify-between items-center">
                        <div>
                            <h1 class="page-title">File Editor</h1>
                            <p class="page-subtitle">${escapeHtml(editorFilePath)}</p>
                        </div>
                        <div class="flex gap-3">
                            <button class="btn btn-secondary btn-sm" onclick="window.TP.closeEditor()"><svg class="icon" aria-hidden="true"><use href="#i-arrow-left"></use></svg>Back</button>
                            <button class="btn btn-primary btn-sm" onclick="window.TP.saveFile()"><svg class="icon" aria-hidden="true"><use href="#i-save"></use></svg>Save</button>
                        </div>
                    </div>
                    <div class="editor-container">
                        <div class="editor-header">
                            <span class="editor-filename">${escapeHtml(fileName)}</span>
                            <span class="text-muted text-sm">${formatBytes(data.size)}</span>
                        </div>
                        <textarea class="editor-textarea" id="editor-content" spellcheck="false">${escapeHtml(data.content)}</textarea>
                    </div>
                </div>
            `;

            // Tab key support
            const textarea = document.getElementById('editor-content');
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + 4;
                }
                if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    window.TP.saveFile();
                }
            });
        } catch (e) {
            main.innerHTML = `<div class="page"><div class="empty-state"><svg class="icon empty-state-icon" aria-hidden="true"><use href="#i-alert"></use></svg><div class="empty-state-title">Cannot open file</div><div class="empty-state-desc">This file may be binary or too large to edit.</div><button class="btn btn-secondary mt-4" onclick="window.TP.closeEditor()">Back</button></div></div>`;
        }
    }

    // ─── JAR Manager ──────────────────────────────────────────
    async function renderJarsPage() {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="page"><div class="loading-overlay"><div class="spinner"></div> Loading JARs...</div></div>`;

        try {
            const jars = await api('/api/jars');

            const jarCards = jars.map(jar => `
                <div class="jar-card ${jar.selected ? 'selected' : ''}">
                    <div class="jar-icon"><svg class="icon" aria-hidden="true"><use href="#i-box"></use></svg></div>
                    <div class="jar-info">
                        <div class="jar-name">${escapeHtml(jar.name)}</div>
                        <div class="jar-meta">${formatBytes(jar.size)} · ${formatDate(jar.modified)}</div>
                    </div>
                    <div class="jar-actions">
                        ${jar.selected
                            ? '<span class="badge badge-success">Active</span>'
                            : `<button class="btn btn-secondary btn-sm" onclick="window.TP.selectJar('${escapeHtml(jar.name)}')">Select</button>
                               <button class="btn btn-ghost btn-icon btn-xs btn-danger-text" title="Delete" aria-label="Delete ${escapeHtml(jar.name)}" onclick="window.TP.deleteJar('${escapeHtml(jar.name)}')"><svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg></button>`}
                    </div>
                </div>
            `).join('');

            const downloads = [
                { id: 'paper', mark: 'P', name: 'Paper', desc: 'High-performance Spigot fork' },
                { id: 'purpur', mark: 'Pu', name: 'Purpur', desc: 'Paper fork with extra features' },
                { id: 'vanilla', mark: 'V', name: 'Vanilla', desc: 'Official Mojang server' },
                { id: 'fabric', mark: 'F', name: 'Fabric', desc: 'Lightweight modding framework' }
            ].map(d => `
                <button type="button" class="download-card" onclick="window.TP.downloadJar('${d.id}')">
                    <span class="download-card-mark" aria-hidden="true">${d.mark}</span>
                    <span class="download-card-name">${d.name}</span>
                    <span class="download-card-desc">${d.desc}</span>
                </button>
            `).join('');

            main.innerHTML = `
                <div class="page">
                    <div class="page-header">
                        <h1 class="page-title">JAR Manager</h1>
                        <p class="page-subtitle">Server software on this device</p>
                    </div>

                    <section class="card mb-6">
                        <div class="card-header">
                            <span class="card-title">Installed</span>
                            <button class="btn btn-secondary btn-sm" onclick="window.TP.uploadJar()"><svg class="icon" aria-hidden="true"><use href="#i-upload"></use></svg>Upload JAR</button>
                        </div>
                        ${jars.length > 0 ? `<div class="flex flex-col gap-3">${jarCards}</div>` :
                    '<div class="empty-state"><svg class="icon empty-state-icon" aria-hidden="true"><use href="#i-box"></use></svg><div class="empty-state-title">No JARs found</div><div class="empty-state-desc">Upload a JAR file or download one below.</div></div>'}
                    </section>

                    <section class="card">
                        <div class="card-header">
                            <span class="card-title">Download server software</span>
                        </div>
                        <div class="download-grid">
                            ${downloads}
                        </div>
                    </section>
                </div>
            `;
        } catch (e) { /* handled */ }
    }

    // ─── Server Properties ────────────────────────────────────
    async function renderPropertiesPage() {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="page"><div class="loading-overlay"><div class="spinner"></div> Loading properties...</div></div>`;

        try {
            const data = await api('/api/properties');

            if (!data.exists) {
                main.innerHTML = `
                    <div class="page">
                        <div class="page-header">
                            <h1 class="page-title">Server Config</h1>
                            <p class="page-subtitle">server.properties editor</p>
                        </div>
                        <div class="card">
                            <div class="empty-state">
                                <svg class="icon empty-state-icon" aria-hidden="true"><use href="#i-config"></use></svg>
                                <div class="empty-state-title">No server.properties found</div>
                                <div class="empty-state-desc">Start your server once to generate the file, or create it manually in the file manager.</div>
                            </div>
                        </div>
                    </div>
                `;
                return;
            }

            const props = data.properties;
            const descs = data.descriptions;

            // Group properties
            const groups = {
                'Network': ['server-port', 'server-ip', 'online-mode', 'enable-query', 'query.port', 'enable-rcon', 'rcon.port', 'rcon.password'],
                'Gameplay': ['gamemode', 'difficulty', 'hardcore', 'pvp', 'max-players', 'allow-flight', 'allow-nether', 'spawn-protection'],
                'World': ['level-name', 'level-seed', 'level-type', 'generate-structures', 'max-world-size', 'spawn-monsters', 'spawn-animals', 'spawn-npcs', 'view-distance', 'simulation-distance'],
                'Display': ['motd'],
                'Other': []
            };

            // Assign ungrouped properties to "Other"
            const grouped = new Set(Object.values(groups).flat());
            Object.keys(props).forEach(key => {
                if (!grouped.has(key)) groups['Other'].push(key);
            });

            let groupsHtml = '';
            for (const [groupName, keys] of Object.entries(groups)) {
                const validKeys = keys.filter(k => props[k] !== undefined);
                if (validKeys.length === 0) continue;

                const rows = validKeys.map(key => {
                    const val = props[key];
                    const desc = descs[key] || '';
                    let inputHtml = '';

                    // Boolean fields
                    if (val === 'true' || val === 'false') {
                        inputHtml = `<select data-key="${escapeHtml(key)}"><option value="true" ${val === 'true' ? 'selected' : ''}>true</option><option value="false" ${val === 'false' ? 'selected' : ''}>false</option></select>`;
                    }
                    // Gamemode
                    else if (key === 'gamemode') {
                        inputHtml = `<select data-key="${escapeHtml(key)}">
                            ${['survival', 'creative', 'adventure', 'spectator'].map(m => `<option value="${m}" ${val === m ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>`;
                    }
                    // Difficulty
                    else if (key === 'difficulty') {
                        inputHtml = `<select data-key="${escapeHtml(key)}">
                            ${['peaceful', 'easy', 'normal', 'hard'].map(m => `<option value="${m}" ${val === m ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>`;
                    }
                    else {
                        inputHtml = `<input type="text" data-key="${escapeHtml(key)}" value="${escapeHtml(val)}">`;
                    }

                    return `
                        <div class="property-row">
                            <div class="property-key">
                                ${escapeHtml(key)}
                                ${desc ? `<div class="property-desc">${escapeHtml(desc)}</div>` : ''}
                            </div>
                            <div class="property-value">${inputHtml}</div>
                        </div>
                    `;
                }).join('');

                groupsHtml += `
                    <div class="property-group">
                        <div class="property-group-title">${groupName}</div>
                        ${rows}
                    </div>
                `;
            }

            main.innerHTML = `
                <div class="page">
                    <div class="page-header flex justify-between items-center">
                        <div>
                            <h1 class="page-title">Server Config</h1>
                            <p class="page-subtitle">Edit server.properties</p>
                        </div>
                        <button class="btn btn-primary" onclick="window.TP.saveProperties()"><svg class="icon" aria-hidden="true"><use href="#i-save"></use></svg>Save changes</button>
                    </div>
                    <div class="card">
                        ${groupsHtml}
                    </div>
                </div>
            `;
        } catch (e) { /* handled */ }
    }

    // ─── Backups ──────────────────────────────────────────────
    async function renderBackupsPage() {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="page"><div class="loading-overlay"><div class="spinner"></div> Loading backups...</div></div>`;

        try {
            const backups = await api('/api/backups');

            const backupItems = backups.map(b => `
                <div class="backup-item">
                    <div class="backup-info">
                        <div class="backup-name">${escapeHtml(b.name)}</div>
                        <div class="backup-meta">
                            <span>${formatBytes(b.size)}</span>
                            <span>${formatDate(b.created)}</span>
                        </div>
                    </div>
                    <div class="backup-actions">
                        <button class="btn btn-secondary btn-sm" onclick="window.TP.downloadBackup('${escapeHtml(b.name)}')"><svg class="icon" aria-hidden="true"><use href="#i-download"></use></svg>Download</button>
                        <button class="btn btn-warning btn-sm" onclick="window.TP.restoreBackup('${escapeHtml(b.name)}')"><svg class="icon" aria-hidden="true"><use href="#i-refresh"></use></svg>Restore</button>
                        <button class="btn btn-ghost btn-icon btn-sm btn-danger-text" title="Delete" aria-label="Delete ${escapeHtml(b.name)}" onclick="window.TP.deleteBackup('${escapeHtml(b.name)}')"><svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg></button>
                    </div>
                </div>
            `).join('');

            main.innerHTML = `
                <div class="page">
                    <div class="page-header flex justify-between items-center">
                        <div>
                            <h1 class="page-title">Backups</h1>
                            <p class="page-subtitle">Server snapshots</p>
                        </div>
                        <div class="flex gap-3">
                            <button class="btn btn-secondary" onclick="window.TP.uploadBackup()"><svg class="icon" aria-hidden="true"><use href="#i-upload"></use></svg>Upload</button>
                            <button class="btn btn-primary" onclick="window.TP.createBackup()"><svg class="icon" aria-hidden="true"><use href="#i-box"></use></svg>Create backup</button>
                        </div>
                    </div>
                    <div class="card">
                        ${backups.length > 0 ? backupItems :
                    '<div class="empty-state"><svg class="icon empty-state-icon" aria-hidden="true"><use href="#i-box"></use></svg><div class="empty-state-title">No backups yet</div><div class="empty-state-desc">Create your first backup to protect your server data.</div></div>'}
                    </div>
                </div>
            `;
        } catch (e) { /* handled */ }
    }

    // ─── Scheduler ────────────────────────────────────────────
    async function renderSchedulerPage() {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="page"><div class="loading-overlay"><div class="spinner"></div> Loading schedules...</div></div>`;

        try {
            const schedules = await api('/api/schedules');

            const scheduleItems = schedules.map(s => `
                <div class="schedule-item">
                    <label class="schedule-toggle">
                        <input type="checkbox" ${s.enabled ? 'checked' : ''} aria-label="Enable ${escapeHtml(s.name)}" onchange="window.TP.toggleSchedule('${escapeHtml(s.id)}', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                    <div class="schedule-info">
                        <div class="schedule-name">${escapeHtml(s.name)}</div>
                        <div class="schedule-meta">
                            <span class="schedule-cron">${escapeHtml(s.cron)}</span>
                            <span>${escapeHtml(s.action)}${s.payload ? ` · ${escapeHtml(s.payload)}` : ''}</span>
                        </div>
                    </div>
                    <button class="btn btn-ghost btn-icon btn-xs btn-danger-text" title="Delete" aria-label="Delete ${escapeHtml(s.name)}" onclick="window.TP.deleteSchedule('${escapeHtml(s.id)}')"><svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg></button>
                </div>
            `).join('');

            const cronFields = [
                ['minute', '0–59'],
                ['hour', '0–23'],
                ['day of month', '1–31'],
                ['month', '1–12'],
                ['day of week', '0–7 (Sun = 0 or 7)']
            ].map(([name, range]) => `
                <div class="cron-row">
                    <span class="cron-field">${name}</span>
                    <span class="cron-range">${range}</span>
                </div>
            `).join('');

            const cronExamples = [
                ['0 */6 * * *', 'Every 6 hours'],
                ['0 4 * * *', 'Daily at 04:00'],
                ['*/30 * * * *', 'Every 30 minutes'],
                ['0 0 * * 0', 'Weekly on Sunday at midnight']
            ].map(([expr, desc]) => `
                <div class="cron-row cron-row--example">
                    <code>${expr}</code>
                    <span class="cron-range">${desc}</span>
                </div>
            `).join('');

            main.innerHTML = `
                <div class="page">
                    <div class="page-header flex justify-between items-center">
                        <div>
                            <h1 class="page-title">Scheduler</h1>
                            <p class="page-subtitle">Automated server tasks</p>
                        </div>
                        <button class="btn btn-primary" onclick="window.TP.createSchedule()"><svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg>New task</button>
                    </div>
                    <div class="card">
                        ${schedules.length > 0 ? scheduleItems :
                    '<div class="empty-state"><svg class="icon empty-state-icon" aria-hidden="true"><use href="#i-clock"></use></svg><div class="empty-state-title">No scheduled tasks</div><div class="empty-state-desc">Create automated tasks to manage your server.</div></div>'}
                    </div>

                    <section class="card mt-6">
                        <div class="card-header">
                            <span class="card-title">Cron reference</span>
                        </div>
                        <div class="cron-ref">
                            <div class="cron-row cron-row--head">
                                <span class="cron-field">Field</span>
                                <span class="cron-range">Range</span>
                            </div>
                            ${cronFields}
                            <div class="cron-row cron-row--head">
                                <span class="cron-field">Expression</span>
                                <span class="cron-range">Meaning</span>
                            </div>
                            ${cronExamples}
                        </div>
                    </section>
                </div>
            `;
        } catch (e) { /* handled */ }
    }

    // ─── Settings ─────────────────────────────────────────────
    async function renderSettingsPage() {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="page"><div class="loading-overlay"><div class="spinner"></div> Loading settings...</div></div>`;

        try {
            const cfg = await api('/api/config');

            main.innerHTML = `
                <div class="page">
                    <div class="page-header">
                        <h1 class="page-title">Settings</h1>
                        <p class="page-subtitle">Panel and server configuration</p>
                    </div>

                    <div class="card mb-6">
                        <div class="settings-section">
                            <div class="settings-section-title">Server Settings</div>
                            <div class="settings-row">
                                <div><div class="settings-label">Server Name</div></div>
                                <input type="text" id="cfg-serverName" value="${escapeHtml(cfg.serverName || '')}">
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-label">Java Path</div><div class="settings-hint">e.g., java or /usr/bin/java</div></div>
                                <input type="text" id="cfg-javaPath" value="${escapeHtml(cfg.javaPath || 'java')}">
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-label">Min Memory</div><div class="settings-hint">-Xms value</div></div>
                                <input type="text" id="cfg-minMemory" value="${escapeHtml(cfg.minMemory || '1024M')}">
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-label">Max Memory</div><div class="settings-hint">-Xmx value</div></div>
                                <input type="text" id="cfg-maxMemory" value="${escapeHtml(cfg.maxMemory || '2048M')}">
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-label">JVM Flags</div><div class="settings-hint">Additional Java arguments</div></div>
                                <input type="text" id="cfg-jvmFlags" value="${escapeHtml(cfg.jvmFlags || '')}">
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-label">Max Backups</div><div class="settings-hint">Auto-delete oldest when exceeded</div></div>
                                <input type="number" id="cfg-maxBackups" value="${cfg.maxBackups || 10}" min="1" max="100">
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-label">Console Buffer</div><div class="settings-hint">Max console lines to keep</div></div>
                                <input type="number" id="cfg-maxConsoleLines" value="${cfg.maxConsoleLines || 1000}" min="100" max="10000">
                            </div>
                        </div>
                        <button class="btn btn-primary" onclick="window.TP.saveSettings()"><svg class="icon" aria-hidden="true"><use href="#i-save"></use></svg>Save settings</button>
                    </div>

                    <section class="card">
                        <div class="settings-section">
                            <div class="settings-section-title">Security</div>
                            <div class="settings-row">
                                <div class="settings-label">Current password</div>
                                <div class="field-wrap">
                                    <input type="password" id="cfg-currentPassword" placeholder="Current password" autocomplete="current-password">
                                    <button type="button" class="field-reveal" data-reveal="cfg-currentPassword" aria-label="Show password" aria-pressed="false" title="Show password">
                                        <svg class="icon" aria-hidden="true"><use href="#i-eye"></use></svg>
                                    </button>
                                </div>
                            </div>
                            <div class="settings-row">
                                <div class="settings-label">New password</div>
                                <div class="field-wrap">
                                    <input type="password" id="cfg-newPassword" placeholder="New password" autocomplete="new-password" minlength="8">
                                    <button type="button" class="field-reveal" data-reveal="cfg-newPassword" aria-label="Show password" aria-pressed="false" title="Show password">
                                        <svg class="icon" aria-hidden="true"><use href="#i-eye"></use></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button class="btn btn-warning" onclick="window.TP.changePassword()"><svg class="icon" aria-hidden="true"><use href="#i-lock"></use></svg>Change password</button>
                    </div>

                    <section class="card mt-6">
                        <div class="settings-section">
                            <div class="settings-section-title">This panel</div>
                            <div class="settings-row">
                                <div><div class="settings-label">Address</div><div class="settings-hint">Use this address on your phone</div></div>
                                <div class="settings-value">${escapeHtml(location.protocol)}//${escapeHtml(location.host)}</div>
                            </div>
                        </div>
                    </section>
                </div>
            `;
        } catch (e) { /* handled */ }
    }

    // ─── Global Action Handlers ───────────────────────────────
    window.TP = {
        // Server actions
        async serverAction(action) {
            try {
                const result = await api(`/api/server/${action}`, { method: 'POST' });
                toast(result.message, result.success ? 'success' : 'error');
            } catch (e) { /* handled */ }
        },

        // Console
        sendConsoleCommand() {
            const input = document.getElementById('console-input');
            if (!input || !input.value.trim()) return;
            const cmd = input.value.trim();

            if (socket) socket.emit('console:command', cmd);
            commandHistory.push(cmd);
            commandHistoryIndex = -1;
            input.value = '';
        },

        clearConsole() {
            consoleLines = [];
            const output = document.getElementById('console-output');
            if (output) output.innerHTML = '';
        },

        // File Manager
        navigateFiles(path) {
            currentFilePath = path;
            editorMode = false;
            renderFilesPage();
        },

        async openFile(path) {
            editorFilePath = path;
            editorMode = true;
            renderFilesPage();
        },

        closeEditor() {
            editorMode = false;
            renderFilesPage();
        },

        async saveFile() {
            const content = document.getElementById('editor-content')?.value;
            if (content === undefined) return;
            try {
                await api('/api/files/write', { method: 'PUT', body: { path: editorFilePath, content } });
                toast('File saved successfully', 'success');
            } catch (e) { /* handled */ }
        },

        async downloadFile(path) {
            window.open(`/api/files/download?path=${encodeURIComponent(path)}&token=${token}`, '_blank');
        },

        async deleteFile(path, name) {
            showModal('Delete file', `<p>Are you sure you want to delete <strong>${escapeHtml(name)}</strong>?</p><p class="text-muted text-sm mt-4">This action cannot be undone.</p>`,
                `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                 <button class="btn btn-danger" onclick="window.TP.confirmDeleteFile('${escapeHtml(path)}')"><svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg>Delete</button>`
            );
        },

        async confirmDeleteFile(path) {
            try {
                await api('/api/files/delete', { method: 'DELETE', body: { path } });
                toast('Deleted successfully', 'success');
                closeModal();
                renderFilesPage();
            } catch (e) { closeModal(); }
        },

        async createFolder() {
            showModal('New folder',
                `<div class="form-group"><label for="new-folder-name">Folder name</label><input type="text" id="new-folder-name" placeholder="my-folder"></div>`,
                `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                 <button class="btn btn-primary" onclick="window.TP.confirmCreateFolder()"><svg class="icon" aria-hidden="true"><use href="#i-folder-plus"></use></svg>Create</button>`
            );
            setTimeout(() => document.getElementById('new-folder-name')?.focus(), 100);
        },

        async confirmCreateFolder() {
            const name = document.getElementById('new-folder-name')?.value?.trim();
            if (!name) return toast('Enter a folder name', 'warning');
            const folderPath = currentFilePath === '.' ? name : `${currentFilePath}/${name}`;
            try {
                await api('/api/files/mkdir', { method: 'POST', body: { path: folderPath } });
                toast('Folder created', 'success');
                closeModal();
                renderFilesPage();
            } catch (e) { /* handled */ }
        },

        uploadFiles() {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.onchange = async () => {
                const formData = new FormData();
                formData.append('path', currentFilePath);
                for (const file of input.files) formData.append('files', file);
                try {
                    await api('/api/files/upload', { method: 'POST', body: formData });
                    toast(`Uploaded ${input.files.length} file(s)`, 'success');
                    renderFilesPage();
                } catch (e) { /* handled */ }
            };
            input.click();
        },

        deleteAll() {
            showModal('Delete all server files',
                `<div class="modal-warning">
                    <svg class="icon modal-warning-icon" aria-hidden="true"><use href="#i-alert"></use></svg>
                    <p class="modal-warning-title">This permanently deletes every file in your server folder.</p>
                    <p class="text-muted text-sm">Your world, plugins, configs and JAR files — everything — will be wiped. This cannot be undone.</p>
                    <p class="text-muted text-sm mt-4">Consider creating a <strong>backup</strong> first.</p>
                    <div class="form-group mt-6">
                        <label for="delete-all-confirm">Type <strong>DELETE</strong> to confirm</label>
                        <input type="text" id="delete-all-confirm" placeholder="DELETE" autocomplete="off">
                    </div>
                </div>`,
                `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                 <button class="btn btn-danger" id="delete-all-btn" disabled onclick="window.TP.confirmDeleteAll()"><svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg>Wipe server</button>`
            );
            setTimeout(() => {
                const input = document.getElementById('delete-all-confirm');
                const btn = document.getElementById('delete-all-btn');
                if (input && btn) {
                    input.addEventListener('input', () => {
                        btn.disabled = input.value.trim() !== 'DELETE';
                    });
                    input.focus();
                }
            }, 100);
        },

        async confirmDeleteAll() {
            const input = document.getElementById('delete-all-confirm');
            if (!input || input.value.trim() !== 'DELETE') return;
            closeModal();
            try {
                const result = await api('/api/files/delete-all', { method: 'DELETE' });
                toast(`Deleted ${result.deleted} items from server folder`, 'success');
                currentFilePath = '.';
                renderFilesPage();
            } catch (e) { /* handled */ }
        },

        // JAR Manager
        async selectJar(name) {
            try {
                await api('/api/jars/select', { method: 'POST', body: { jar: name } });
                toast(`Selected ${name}`, 'success');
                renderJarsPage();
            } catch (e) { /* handled */ }
        },

        async deleteJar(name) {
            showModal('Delete JAR', `<p>Are you sure you want to delete <strong>${escapeHtml(name)}</strong>?</p>`,
                `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                 <button class="btn btn-danger" onclick="window.TP.confirmDeleteJar('${escapeHtml(name)}')">Delete</button>`
            );
        },

        async confirmDeleteJar(name) {
            try {
                await api(`/api/jars/${encodeURIComponent(name)}`, { method: 'DELETE' });
                toast('JAR deleted', 'success');
                closeModal();
                renderJarsPage();
            } catch (e) { closeModal(); }
        },

        uploadJar() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.jar';
            input.onchange = async () => {
                if (!input.files[0]) return;
                const formData = new FormData();
                formData.append('jar', input.files[0]);
                try {
                    await api('/api/jars/upload', { method: 'POST', body: formData });
                    toast(`Uploaded ${input.files[0].name}`, 'success');
                    renderJarsPage();
                } catch (e) { /* handled */ }
            };
            input.click();
        },

        async downloadJar(type) {
            // Show version picker modal
            showModal(`Download ${type.charAt(0).toUpperCase() + type.slice(1)}`,
                `<div class="form-group"><label for="jar-version">Version</label><div class="loading-overlay"><div class="spinner"></div> Loading versions...</div><select id="jar-version" class="hidden"></select></div>`,
                `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                 <button class="btn btn-primary" id="jar-download-btn" disabled onclick="window.TP.confirmDownloadJar('${type}')"><svg class="icon" aria-hidden="true"><use href="#i-download"></use></svg>Download</button>`
            );

            try {
                const versions = await api(`/api/jars/versions/${type}`);
                const select = document.getElementById('jar-version');
                const loadingEl = select?.previousElementSibling;
                if (loadingEl) loadingEl.remove();
                if (select) {
                    select.classList.remove('hidden');
                    select.innerHTML = versions.slice(0, 30).map(v => `<option value="${v}">${v}</option>`).join('');
                    document.getElementById('jar-download-btn').disabled = false;
                }
            } catch (e) { /* handled */ }
        },

        async confirmDownloadJar(type) {
            const version = document.getElementById('jar-version')?.value;
            if (!version) return;
            closeModal();
            toast(`Downloading ${type} ${version}... This may take a moment.`, 'info');
            try {
                await api('/api/jars/download', { method: 'POST', body: { type, version } });
                renderJarsPage();
            } catch (e) { /* handled */ }
        },

        // Properties
        async saveProperties() {
            const inputs = document.querySelectorAll('[data-key]');
            const properties = {};
            inputs.forEach(input => {
                properties[input.dataset.key] = input.value;
            });
            try {
                await api('/api/properties', { method: 'PUT', body: { properties } });
                toast('Properties saved! Restart the server to apply changes.', 'success');
            } catch (e) { /* handled */ }
        },

        // Backups
        async createBackup() {
            showModal('Create backup',
                `<div class="form-group"><label for="backup-name">Backup name (optional)</label><input type="text" id="backup-name" placeholder="Leave blank for an automatic name"></div>`,
                `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                 <button class="btn btn-primary" onclick="window.TP.confirmCreateBackup()"><svg class="icon" aria-hidden="true"><use href="#i-box"></use></svg>Create</button>`
            );
        },

        async confirmCreateBackup() {
            const name = document.getElementById('backup-name')?.value?.trim();
            closeModal();
            toast('Creating backup...', 'info');
            try {
                await api('/api/backups/create', { method: 'POST', body: { name: name || undefined } });
                renderBackupsPage();
            } catch (e) { /* handled */ }
        },

        async restoreBackup(name) {
            showModal('Restore backup',
                `<p>Are you sure you want to restore <strong>${escapeHtml(name)}</strong>?</p>
                 <div class="modal-note"><svg class="icon" aria-hidden="true"><use href="#i-alert"></use></svg><span>This replaces all current server files. The server must be stopped first.</span></div>`,
                `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                 <button class="btn btn-warning" onclick="window.TP.confirmRestoreBackup('${escapeHtml(name)}')"><svg class="icon" aria-hidden="true"><use href="#i-refresh"></use></svg>Restore</button>`
            );
        },

        async confirmRestoreBackup(name) {
            closeModal();
            try {
                await api(`/api/backups/restore/${encodeURIComponent(name)}`, { method: 'POST' });
                toast('Backup restored successfully!', 'success');
            } catch (e) { /* handled */ }
        },

        async deleteBackup(name) {
            try {
                await api(`/api/backups/${encodeURIComponent(name)}`, { method: 'DELETE' });
                toast('Backup deleted', 'success');
                renderBackupsPage();
            } catch (e) { /* handled */ }
        },

        downloadBackup(name) {
            window.open(`/api/backups/download/${encodeURIComponent(name)}?token=${token}`, '_blank');
        },

        uploadBackup() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.tar.gz';
            input.onchange = async () => {
                if (!input.files[0]) return;
                const file = input.files[0];
                if (!file.name.endsWith('.tar.gz')) {
                    return toast('Only .tar.gz files are allowed', 'warning');
                }
                const formData = new FormData();
                formData.append('backup', file);
                toast(`Uploading ${file.name}...`, 'info');
                try {
                    const result = await api('/api/backups/upload', { method: 'POST', body: formData });
                    toast(`Uploaded ${result.name} (${formatBytes(result.size)})`, 'success');
                    renderBackupsPage();
                } catch (e) { /* handled */ }
            };
            input.click();
        },

        // Scheduler
        createSchedule() {
            showModal('New scheduled task',
                `<div class="form-group"><label for="sched-name">Task name</label><input type="text" id="sched-name" placeholder="Daily restart"></div>
                 <div class="form-group mt-4"><label for="sched-cron">Cron expression</label><input type="text" id="sched-cron" placeholder="0 4 * * *"></div>
                 <div class="form-group mt-4"><label for="sched-action">Action</label>
                     <select id="sched-action">
                         <option value="restart">Restart server</option>
                         <option value="start">Start server</option>
                         <option value="stop">Stop server</option>
                         <option value="backup">Create backup</option>
                         <option value="command">Run command</option>
                     </select>
                 </div>
                 <div class="form-group mt-4 hidden" id="sched-payload-group">
                     <label for="sched-payload">Command</label>
                     <input type="text" id="sched-payload" placeholder="say Server restarting in 5 minutes!">
                 </div>`,
                `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                 <button class="btn btn-primary" onclick="window.TP.confirmCreateSchedule()"><svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg>Create task</button>`
            );

            // Show/hide payload field based on action
            setTimeout(() => {
                const actionSelect = document.getElementById('sched-action');
                const payloadGroup = document.getElementById('sched-payload-group');
                if (actionSelect && payloadGroup) {
                    actionSelect.addEventListener('change', () => {
                        payloadGroup.classList.toggle('hidden', actionSelect.value !== 'command');
                    });
                }
            }, 100);
        },

        async confirmCreateSchedule() {
            const name = document.getElementById('sched-name')?.value?.trim();
            const cronExpr = document.getElementById('sched-cron')?.value?.trim();
            const action = document.getElementById('sched-action')?.value;
            const payload = document.getElementById('sched-payload')?.value?.trim();

            if (!name || !cronExpr || !action) return toast('All fields are required', 'warning');

            closeModal();
            try {
                await api('/api/schedules', { method: 'POST', body: { name, cron: cronExpr, action, payload } });
                toast('Schedule created', 'success');
                renderSchedulerPage();
            } catch (e) { /* handled */ }
        },

        async toggleSchedule(id, enabled) {
            try {
                await api(`/api/schedules/${id}`, { method: 'PUT', body: { enabled } });
                toast(enabled ? 'Task enabled' : 'Task disabled', 'info');
            } catch (e) { /* handled */ }
        },

        async deleteSchedule(id) {
            try {
                await api(`/api/schedules/${id}`, { method: 'DELETE' });
                toast('Schedule deleted', 'success');
                renderSchedulerPage();
            } catch (e) { /* handled */ }
        },

        // Settings
        async saveSettings() {
            const settings = {
                serverName: document.getElementById('cfg-serverName')?.value,
                javaPath: document.getElementById('cfg-javaPath')?.value,
                minMemory: document.getElementById('cfg-minMemory')?.value,
                maxMemory: document.getElementById('cfg-maxMemory')?.value,
                jvmFlags: document.getElementById('cfg-jvmFlags')?.value,
                maxBackups: parseInt(document.getElementById('cfg-maxBackups')?.value) || 10,
                maxConsoleLines: parseInt(document.getElementById('cfg-maxConsoleLines')?.value) || 1000,
            };

            try {
                await api('/api/config', { method: 'PUT', body: settings });
                toast('Settings saved!', 'success');
            } catch (e) { /* handled */ }
        },

        async changePassword() {
            const currentPassword = document.getElementById('cfg-currentPassword')?.value;
            const newPassword = document.getElementById('cfg-newPassword')?.value;
            if (!newPassword) return toast('Enter a new password', 'warning');

            try {
                await api('/api/auth/change-password', {
                    method: 'POST',
                    body: { currentPassword, newPassword }
                });
                toast('Password changed successfully', 'success');
                document.getElementById('cfg-currentPassword').value = '';
                document.getElementById('cfg-newPassword').value = '';
            } catch (e) { /* handled */ }
        }
    };

    // Make closeModal global for inline onclick handlers
    window.closeModal = closeModal;

    // ─── Initialize ───────────────────────────────────────────
    checkAuth();
})();
