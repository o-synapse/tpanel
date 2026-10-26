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
            if (!res.ok) throw new Error(I18N.tm(data.error) || t('err.requestFailed'));
            return data;
        } catch (e) {
            if (e.message !== 'Unauthorized') toast(e.message, 'error');
            throw e;
        }
    }

    // ─── Toast Notifications ──────────────────────────────────
    function toast(message, type = 'info') {
        // 后端返回的英文消息在此统一翻译（中文文案经 tm 后原样返回）
        message = I18N.tm(message);
        const container = document.getElementById('toast-container');
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${escapeHtml(message)}</span>`;
        container.appendChild(el);
        setTimeout(() => {
            el.classList.add('removing');
            setTimeout(() => el.remove(), 300);
        }, 4000);
    }

    // ─── Modal ────────────────────────────────────────────────
    function showModal(title, bodyHtml, footerHtml = '') {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHtml;
        document.getElementById('modal-footer').innerHTML = footerHtml;
        document.getElementById('modal-overlay').classList.remove('hidden');
    }

    function closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
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
        const u = I18N.timeUnits();
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const parts = [];
        if (d > 0) parts.push(`${d}${u.d}`);
        if (h > 0) parts.push(`${h}${u.h}`);
        if (m > 0) parts.push(`${m}${u.m}`);
        if (parts.length === 0) parts.push(`${s}${u.s}`);
        return parts.join(' ');
    }

    function getFileIcon(name, isDir) {
        if (isDir) return '📁';
        const ext = name.split('.').pop().toLowerCase();
        const icons = {
            jar: '☕', json: '📋', yml: '📋', yaml: '📋', properties: '⚙️',
            txt: '📄', log: '📜', md: '📝', cfg: '⚙️', conf: '⚙️',
            png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️',
            zip: '📦', tar: '📦', gz: '📦', rar: '📦',
            sh: '💻', bat: '💻', cmd: '💻',
            js: '📜', java: '☕', py: '🐍',
            dat: '💿', mca: '🗺️', nbt: '🏷️'
        };
        return icons[ext] || '📄';
    }

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
            toast(t('err.cannotConnect'), 'error');
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
                errorEl.textContent = I18N.tm(data.error) || t('err.loginFailed');
                errorEl.classList.remove('hidden');
            }
        } catch (e) {
            errorEl.textContent = t('err.connectionFailed');
            errorEl.classList.remove('hidden');
        }
    });

    // Setup form
    document.getElementById('setup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('setup-password').value;
        const confirm = document.getElementById('setup-confirm').value;
        const errorEl = document.getElementById('setup-error');

        if (password !== confirm) {
            errorEl.textContent = t('err.passwordMismatch');
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
                toast(t('msg.accountCreated'), 'success');
            } else {
                errorEl.textContent = I18N.tm(data.error) || t('err.setupFailed');
                errorEl.classList.remove('hidden');
            }
        } catch (e) {
            errorEl.textContent = t('err.connectionFailed');
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

        socket.on('jar:downloading', ({ name }) => toast(t('jars.downloading', { name }), 'info'));
        socket.on('jar:downloaded', ({ name }) => {
            toast(t('jars.downloaded', { name }), 'success');
            if (currentPage === 'jars') renderJarsPage();
        });
        socket.on('backup:creating', () => toast(t('backups.creating'), 'info'));
        socket.on('backup:created', ({ name }) => {
            toast(t('backups.created', { name }), 'success');
            if (currentPage === 'backups') renderBackupsPage();
        });
    }

    function updateStatusIndicators() {
        // Sidebar status
        const sidebarDot = document.querySelector('#sidebar-status-indicator .status-dot');
        const sidebarText = document.querySelector('#sidebar-status-indicator .status-text');
        if (sidebarDot) {
            sidebarDot.className = `status-dot ${serverStatus}`;
            sidebarText.textContent = t(`status.${serverStatus}`);
        }

        // Mobile status dot
        const mobileDot = document.getElementById('mobile-status-dot');
        if (mobileDot) {
            mobileDot.className = `mobile-status`;
            mobileDot.style.background = serverStatus === 'running' ? 'var(--success)' :
                serverStatus === 'starting' || serverStatus === 'stopping' ? 'var(--warning)' : 'var(--text-muted)';
        }
    }

    // ─── Sidebar & Navigation ─────────────────────────────────
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    document.getElementById('hamburger').addEventListener('click', () => {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    });

    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }

    document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);

    document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigate(page);
            closeSidebar();
        });
    });

    window.addEventListener('hashchange', () => {
        const page = location.hash.slice(1) || 'dashboard';
        if (page !== currentPage) navigate(page);
    });

    function navigate(page) {
        currentPage = page;
        location.hash = page;

        // Update nav active state (Sidebar)
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Update nav active state (Mobile Bottom Bar)
        document.querySelectorAll('.mobile-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        editorMode = false;
        renderPage(page);
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

            main.innerHTML = `
                <div class="page">
                    <div class="page-header">
                        <h1 class="page-title">${t('dash.title')}</h1>
                        <p class="page-subtitle">${escapeHtml(status.serverName || t('dash.defaultServerName'))}</p>
                    </div>

                    <!-- Quick Actions -->
                    <div class="card mb-6">
                        <div class="card-header">
                            <span class="card-title">⚡ ${t('dash.quickActions')}</span>
                            <span class="badge badge-${serverStatus === 'running' ? 'success' : serverStatus === 'starting' || serverStatus === 'stopping' ? 'warning' : 'error'}">${t(`status.${serverStatus}`)}</span>
                        </div>
                        <div class="quick-actions">
                            <button class="quick-action-btn start" onclick="window.TP.serverAction('start')" ${serverStatus !== 'stopped' ? 'disabled' : ''}>
                                ▶ ${t('dash.start')}
                            </button>
                            <button class="quick-action-btn stop" onclick="window.TP.serverAction('stop')" ${serverStatus !== 'running' ? 'disabled' : ''}>
                                ⏹ ${t('dash.stop')}
                            </button>
                            <button class="quick-action-btn restart" onclick="window.TP.serverAction('restart')" ${serverStatus !== 'running' ? 'disabled' : ''}>
                                🔄 ${t('dash.restart')}
                            </button>
                            <button class="quick-action-btn kill" onclick="window.TP.serverAction('kill')" ${!['running','starting','stopping'].includes(serverStatus) ? 'disabled' : ''}>
                                💀 ${t('dash.kill')}
                            </button>
                        </div>
                    </div>

                    <!-- Stats Cards -->
                    <div class="grid-4 mb-6" id="dashboard-stats">
                        <div class="stat-card">
                            <div class="stat-icon green">📡</div>
                            <div class="stat-info">
                                <div class="stat-value" id="dash-status">${serverStatus === 'running' ? t('status.online') : t('status.offline')}</div>
                                <div class="stat-label">${t('dash.serverStatus')}</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon blue">⏱</div>
                            <div class="stat-info">
                                <div class="stat-value" id="dash-uptime">${formatUptime(status.uptime)}</div>
                                <div class="stat-label">${t('dash.uptime')}</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon yellow">☕</div>
                            <div class="stat-info">
                                <div class="stat-value truncate" id="dash-jar">${escapeHtml(status.jar || t('dash.jarNone'))}</div>
                                <div class="stat-label">${t('dash.activeJar')}</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon red">💾</div>
                            <div class="stat-info">
                                <div class="stat-value" id="dash-disk">${formatBytes(stats.mcDirSize || 0)}</div>
                                <div class="stat-label">${t('dash.serverSize')}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Resource Gauges -->
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">📊 ${t('dash.systemResources')}</span>
                        </div>
                        <div class="grid-3" id="dashboard-gauges">
                            <div class="gauge-container">
                                ${renderGauge('cpu-gauge', cpuPercent, 'CPU')}
                                <div class="gauge-label">${t('dash.cpuUsage')}</div>
                            </div>
                            <div class="gauge-container">
                                ${renderGauge('mem-gauge', memPercent, 'RAM')}
                                <div class="gauge-label">${t('dash.memory', { used: formatBytes(stats.memory?.used || 0), total: formatBytes(stats.memory?.total || 0) })}</div>
                            </div>
                            <div class="gauge-container">
                                ${renderGauge('disk-gauge', diskPercent, 'Disk')}
                                <div class="gauge-label">${t('dash.disk', { used: formatBytes(stats.disk?.used || 0), total: formatBytes(stats.disk?.total || 0) })}</div>
                            </div>
                        </div>
                    </div>

                    <!-- System Info -->
                    <div class="card mt-6">
                        <div class="card-header">
                            <span class="card-title">🖥️ ${t('dash.systemInfo')}</span>
                        </div>
                        <div class="grid-2">
                            <div><span class="text-muted text-sm">${t('dash.platform')}</span> <span class="text-sm">${stats.platform || '—'} ${stats.arch || ''}</span></div>
                            <div><span class="text-muted text-sm">${t('dash.hostname')}</span> <span class="text-sm">${stats.hostname || '—'}</span></div>
                            <div><span class="text-muted text-sm">${t('dash.cpu')}</span> <span class="text-sm">${stats.cpu?.model || '—'} (${t('dash.cores', { n: stats.cpu?.cores || '?' })})</span></div>
                            <div><span class="text-muted text-sm">${t('dash.systemUptime')}</span> <span class="text-sm">${formatUptime(stats.uptime || 0)}</span></div>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) { /* handled by api() */ }
    }

    function updateDashboardStats() {
        const s = systemStats;
        const el = (id) => document.getElementById(id);
        if (!el('dash-status')) return;

        el('dash-status').textContent = serverStatus === 'running' ? t('status.online') : t('status.offline');
        el('dash-uptime').textContent = formatUptime(s.serverUptime || 0);
        el('dash-disk').textContent = formatBytes(s.mcDirSize || 0);

        // Update gauges
        updateGauge('cpu-gauge', s.cpu?.usage || 0);
        updateGauge('mem-gauge', s.memory?.percent || 0);
        updateGauge('disk-gauge', s.disk?.percent || 0);
    }

    function renderGauge(id, percent, label) {
        const offset = 283 - (283 * Math.min(percent, 100)) / 100;
        const colorClass = percent > 90 ? 'danger' : percent > 70 ? 'warning' : '';
        return `
            <div class="gauge">
                <svg viewBox="0 0 100 100">
                    <circle class="gauge-bg" cx="50" cy="50" r="45"/>
                    <circle class="gauge-fill ${colorClass}" id="${id}" cx="50" cy="50" r="45" style="stroke-dashoffset: ${offset}"/>
                </svg>
                <div class="gauge-value">${Math.round(percent)}%</div>
            </div>
        `;
    }

    function updateGauge(id, percent) {
        const el = document.getElementById(id);
        if (!el) return;
        const offset = 283 - (283 * Math.min(percent, 100)) / 100;
        el.style.strokeDashoffset = offset;
        // SVGElement.className 是只读的 SVGAnimatedString，必须用 setAttribute
        el.setAttribute('class', `gauge-fill ${percent > 90 ? 'danger' : percent > 70 ? 'warning' : ''}`);
        const valueEl = el.closest('.gauge')?.querySelector('.gauge-value');
        if (valueEl) valueEl.textContent = `${Math.round(percent)}%`;
    }

    // ─── Console ──────────────────────────────────────────────
    function renderConsolePage() {
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="page">
                <div class="page-header flex justify-between items-center">
                    <div>
                        <h1 class="page-title">${t('console.title')}</h1>
                        <p class="page-subtitle">${t('console.subtitle')}</p>
                    </div>
                    <div class="flex gap-3">
                        <button class="btn btn-secondary btn-sm" onclick="window.TP.clearConsole()">🗑️ ${t('console.clear')}</button>
                    </div>
                </div>
                <div class="console-container">
                    <div class="console-output" id="console-output"></div>
                    <div class="console-input-row">
                        <input type="text" id="console-input" placeholder="${serverStatus === 'running' ? t('console.placeholderRunning') : t('console.placeholderStopped')}" 
                               ${serverStatus !== 'running' ? 'disabled' : ''} autocomplete="off" spellcheck="false">
                        <button onclick="window.TP.sendConsoleCommand()">${t('console.send')}</button>
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
                    <h1 class="page-title">${t('files.title')}</h1>
                    <p class="page-subtitle">${t('files.subtitle')}</p>
                </div>
                <div class="loading-overlay"><div class="spinner"></div> ${t('files.loading')}</div>
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

        const breadcrumbs = [`<span class="breadcrumb-item ${pathParts.length === 0 ? 'active' : ''}" onclick="window.TP.navigateFiles('.')">📁 minecraft</span>`];
        let accumulated = '';
        pathParts.forEach((part, i) => {
            accumulated += (accumulated ? '/' : '') + part;
            const p = accumulated;
            breadcrumbs.push(`<span class="breadcrumb-sep">/</span>`);
            breadcrumbs.push(`<span class="breadcrumb-item ${i === pathParts.length - 1 ? 'active' : ''}" onclick="window.TP.navigateFiles('${escapeHtml(p)}')">${escapeHtml(part)}</span>`);
        });

        const fileRows = data.items.map(item => {
            const itemPath = data.path === '.' ? item.name : `${data.path}/${item.name}`;
            return `
                <div class="file-item" ondblclick="window.TP.${item.isDirectory ? `navigateFiles('${escapeHtml(itemPath)}')` : `openFile('${escapeHtml(itemPath)}')`}">
                    <div class="file-name">
                        <span class="file-icon">${getFileIcon(item.name, item.isDirectory)}</span>
                        <span>${escapeHtml(item.name)}</span>
                    </div>
                    <span class="file-size" data-label="${t('files.colSize')}">${item.isDirectory ? '—' : formatBytes(item.size)}</span>
                    <span class="file-modified">${formatDate(item.modified)}</span>
                    <div class="file-actions-col">
                        ${!item.isDirectory ? `<button class="btn btn-ghost btn-xs" title="${t('files.tipDownload')}" onclick="event.stopPropagation(); window.TP.downloadFile('${escapeHtml(itemPath)}')">⬇</button>` : ''}
                        <button class="btn btn-ghost btn-xs" title="${t('files.tipDelete')}" onclick="event.stopPropagation(); window.TP.deleteFile('${escapeHtml(itemPath)}', '${escapeHtml(item.name)}')">🗑</button>
                    </div>
                </div>
            `;
        }).join('');

        main.innerHTML = `
            <div class="page">
                <div class="page-header">
                    <h1 class="page-title">${t('files.title')}</h1>
                    <p class="page-subtitle">${t('files.subtitle')}</p>
                </div>
                <div class="file-toolbar">
                    <div class="file-breadcrumb">${breadcrumbs.join('')}</div>
                    <button class="btn btn-danger btn-sm" onclick="window.TP.deleteAll()">🗑 ${t('files.deleteAll')}</button>
                    <button class="btn btn-secondary btn-sm" onclick="window.TP.createFolder()">📁 ${t('files.newFolder')}</button>
                    <button class="btn btn-primary btn-sm" onclick="window.TP.uploadFiles()">⬆ ${t('files.upload')}</button>
                </div>
                <div class="file-list">
                    <div class="file-list-header">
                        <span>${t('files.colName')}</span>
                        <span>${t('files.colSize')}</span>
                        <span>${t('files.colModified')}</span>
                        <span></span>
                    </div>
                    ${data.path !== '.' ? `
                        <div class="file-item" ondblclick="window.TP.navigateFiles('${escapeHtml(data.path.split('/').slice(0, -1).join('/') || '.')}')">
                            <div class="file-name"><span class="file-icon">⬆️</span><span>..</span></div>
                            <span></span><span></span><span></span>
                        </div>
                    ` : ''}
                    ${fileRows || `<div class="empty-state"><div class="empty-state-icon">📁</div><div class="empty-state-title">${t('files.emptyDir')}</div></div>`}
                </div>
            </div>
        `;
    }

    async function renderFileEditor() {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="page"><div class="loading-overlay"><div class="spinner"></div> ${t('files.loadingFile')}</div></div>`;

        try {
            const data = await api(`/api/files/read?path=${encodeURIComponent(editorFilePath)}`);
            const fileName = editorFilePath.split('/').pop();

            main.innerHTML = `
                <div class="page">
                    <div class="page-header flex justify-between items-center">
                        <div>
                            <h1 class="page-title">${t('files.editorTitle')}</h1>
                            <p class="page-subtitle">${escapeHtml(editorFilePath)}</p>
                        </div>
                        <div class="flex gap-3">
                            <button class="btn btn-secondary btn-sm" onclick="window.TP.closeEditor()">← ${t('files.back')}</button>
                            <button class="btn btn-primary btn-sm" onclick="window.TP.saveFile()">💾 ${t('files.save')}</button>
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
            main.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">${t('files.cannotOpen')}</div><div class="empty-state-desc">${t('files.cannotOpenDesc')}</div><button class="btn btn-secondary mt-4" onclick="window.TP.closeEditor()">← ${t('files.back')}</button></div></div>`;
        }
    }

    // ─── JAR Manager ──────────────────────────────────────────
    async function renderJarsPage() {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="page"><div class="loading-overlay"><div class="spinner"></div> ${t('jars.loading')}</div></div>`;

        try {
            const jars = await api('/api/jars');

            const jarCards = jars.map(jar => `
                <div class="jar-card ${jar.selected ? 'selected' : ''}">
                    <div class="jar-icon">☕</div>
                    <div class="jar-info">
                        <div class="jar-name">${escapeHtml(jar.name)}</div>
                        <div class="jar-meta">${formatBytes(jar.size)} • ${formatDate(jar.modified)}${jar.selected ? ` • <strong style="color: var(--accent)">${t('jars.active')}</strong>` : ''}</div>
                    </div>
                    <div class="jar-actions">
                        ${!jar.selected ? `<button class="btn btn-primary btn-sm" onclick="window.TP.selectJar('${escapeHtml(jar.name)}')">${t('jars.select')}</button>` : `<span class="badge badge-success">${t('jars.active')}</span>`}
                        ${!jar.selected ? `<button class="btn btn-danger btn-xs" onclick="window.TP.deleteJar('${escapeHtml(jar.name)}')">🗑</button>` : ''}
                    </div>
                </div>
            `).join('');

            main.innerHTML = `
                <div class="page">
                    <div class="page-header">
                        <h1 class="page-title">${t('jars.title')}</h1>
                        <p class="page-subtitle">${t('jars.subtitle')}</p>
                    </div>

                    <!-- Installed JARs -->
                    <div class="card mb-6">
                        <div class="card-header">
                            <span class="card-title">☕ ${t('jars.installed')}</span>
                            <button class="btn btn-secondary btn-sm" onclick="window.TP.uploadJar()">⬆ ${t('jars.uploadJar')}</button>
                        </div>
                        ${jars.length > 0 ? `<div class="flex flex-col gap-3">${jarCards}</div>` :
                    `<div class="empty-state"><div class="empty-state-icon">☕</div><div class="empty-state-title">${t('jars.noJars')}</div><div class="empty-state-desc">${t('jars.noJarsDesc')}</div></div>`}
                    </div>

                    <!-- Download JARs -->
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">⬇️ ${t('jars.downloadSoftware')}</span>
                        </div>
                        <div class="download-grid">
                            <div class="download-card" onclick="window.TP.downloadJar('paper')">
                                <div class="download-card-icon">📄</div>
                                <div class="download-card-name">${t('jars.paper')}</div>
                                <div class="download-card-desc">${t('jars.paperDesc')}</div>
                            </div>
                            <div class="download-card" onclick="window.TP.downloadJar('purpur')">
                                <div class="download-card-icon">🟣</div>
                                <div class="download-card-name">Purpur</div>
                                <div class="download-card-desc">${t('jars.purpurDesc')}</div>
                            </div>
                            <div class="download-card" onclick="window.TP.downloadJar('vanilla')">
                                <div class="download-card-icon">🟩</div>
                                <div class="download-card-name">Vanilla</div>
                                <div class="download-card-desc">${t('jars.vanillaDesc')}</div>
                            </div>
                            <div class="download-card" onclick="window.TP.downloadJar('fabric')">
                                <div class="download-card-icon">🧵</div>
                                <div class="download-card-name">Fabric</div>
                                <div class="download-card-desc">${t('jars.fabricDesc')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) { /* handled */ }
    }

    // ─── Server Properties ────────────────────────────────────
    async function renderPropertiesPage() {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="page"><div class="loading-overlay"><div class="spinner"></div> ${t('props.loading')}</div></div>`;

        try {
            const data = await api('/api/properties');

            if (!data.exists) {
                main.innerHTML = `
                    <div class="page">
                        <div class="page-header">
                            <h1 class="page-title">${t('props.title')}</h1>
                            <p class="page-subtitle">${t('props.subtitle')}</p>
                        </div>
                        <div class="card">
                            <div class="empty-state">
                                <div class="empty-state-icon">⚙️</div>
                                <div class="empty-state-title">${t('props.notFound')}</div>
                                <div class="empty-state-desc">${t('props.notFoundDesc')}</div>
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
                    // 优先使用前端翻译；后端新增属性无对应 key 时回退到接口返回的英文说明
                    const descKey = 'props.desc.' + key;
                    const translatedDesc = t(descKey);
                    const desc = translatedDesc === descKey ? (descs[key] || '') : translatedDesc;
                    let inputHtml = '';

                    // Boolean fields
                    if (val === 'true' || val === 'false') {
                        inputHtml = `<select data-key="${escapeHtml(key)}"><option value="true" ${val === 'true' ? 'selected' : ''}>true</option><option value="false" ${val === 'false' ? 'selected' : ''}>false</option></select>`;
                    }
                    // Gamemode
                    else if (key === 'gamemode') {
                        inputHtml = `<select data-key="${escapeHtml(key)}">
                            ${['survival', 'creative', 'adventure', 'spectator'].map(m => `<option value="${m}" ${val === m ? 'selected' : ''}>${t('gm.' + m)} (${m})</option>`).join('')}
                        </select>`;
                    }
                    // Difficulty
                    else if (key === 'difficulty') {
                        inputHtml = `<select data-key="${escapeHtml(key)}">
                            ${['peaceful', 'easy', 'normal', 'hard'].map(m => `<option value="${m}" ${val === m ? 'selected' : ''}>${t('df.' + m)} (${m})</option>`).join('')}
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
                        <div class="property-group-title">${t('props.group.' + groupName)}</div>
                        ${rows}
                    </div>
                `;
            }

            main.innerHTML = `
                <div class="page">
                    <div class="page-header flex justify-between items-center">
                        <div>
                            <h1 class="page-title">${t('props.title')}</h1>
                            <p class="page-subtitle">${t('props.subtitle')}</p>
                        </div>
                        <button class="btn btn-primary" onclick="window.TP.saveProperties()">💾 ${t('props.saveChanges')}</button>
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
        main.innerHTML = `<div class="page"><div class="loading-overlay"><div class="spinner"></div> ${t('backups.loading')}</div></div>`;

        try {
            const backups = await api('/api/backups');

            const backupItems = backups.map(b => `
                <div class="backup-item">
                    <div class="backup-info">
                        <div class="backup-name">${escapeHtml(b.name)}</div>
                        <div class="backup-meta">
                            <span>💾 ${formatBytes(b.size)}</span>
                            <span>📅 ${formatDate(b.created)}</span>
                        </div>
                    </div>
                    <div class="backup-actions">
                        <button class="btn btn-secondary btn-sm" onclick="window.TP.downloadBackup('${escapeHtml(b.name)}')">⬇ ${t('backups.download')}</button>
                        <button class="btn btn-warning btn-sm" onclick="window.TP.restoreBackup('${escapeHtml(b.name)}')">♻ ${t('backups.restore')}</button>
                        <button class="btn btn-danger btn-sm" onclick="window.TP.deleteBackup('${escapeHtml(b.name)}')">🗑</button>
                    </div>
                </div>
            `).join('');

            main.innerHTML = `
                <div class="page">
                    <div class="page-header flex justify-between items-center">
                        <div>
                            <h1 class="page-title">${t('backups.title')}</h1>
                            <p class="page-subtitle">${t('backups.subtitle')}</p>
                        </div>
                        <button class="btn btn-secondary" onclick="window.TP.uploadBackup()">⬆ ${t('backups.uploadBackup')}</button>
                        <button class="btn btn-primary" onclick="window.TP.createBackup()">📦 ${t('backups.createBackup')}</button>
                    </div>
                    <div class="card">
                        ${backups.length > 0 ? backupItems :
                    `<div class="empty-state"><div class="empty-state-icon">💾</div><div class="empty-state-title">${t('backups.noBackups')}</div><div class="empty-state-desc">${t('backups.noBackupsDesc')}</div></div>`}
                    </div>
                </div>
            `;
        } catch (e) { /* handled */ }
    }

    // ─── Scheduler ────────────────────────────────────────────
    async function renderSchedulerPage() {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="page"><div class="loading-overlay"><div class="spinner"></div> ${t('sched.loading')}</div></div>`;

        try {
            const schedules = await api('/api/schedules');

            const scheduleItems = schedules.map(s => `
                <div class="schedule-item">
                    <label class="schedule-toggle">
                        <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="window.TP.toggleSchedule('${s.id}', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                    <div class="schedule-info">
                        <div class="schedule-name">${escapeHtml(s.name)}</div>
                        <div class="schedule-meta">
                            <span class="schedule-cron">${escapeHtml(s.cron)}</span>
                            <span>${t('sched.actionLabel2', { action: escapeHtml(s.action) })}${s.payload ? ` (${escapeHtml(s.payload)})` : ''}</span>
                        </div>
                    </div>
                    <button class="btn btn-danger btn-xs" onclick="window.TP.deleteSchedule('${s.id}')">🗑</button>
                </div>
            `).join('');

            main.innerHTML = `
                <div class="page">
                    <div class="page-header flex justify-between items-center">
                        <div>
                            <h1 class="page-title">${t('sched.title')}</h1>
                            <p class="page-subtitle">${t('sched.subtitle')}</p>
                        </div>
                        <button class="btn btn-primary" onclick="window.TP.createSchedule()">➕ ${t('sched.newTask')}</button>
                    </div>
                    <div class="card">
                        ${schedules.length > 0 ? scheduleItems :
                    `<div class="empty-state"><div class="empty-state-icon">⏰</div><div class="empty-state-title">${t('sched.noTasks')}</div><div class="empty-state-desc">${t('sched.noTasksDesc')}</div></div>`}
                    </div>

                    <!-- Cron Reference -->
                    <div class="card mt-6">
                        <div class="card-header">
                            <span class="card-title">📖 ${t('sched.cronRef')}</span>
                        </div>
                        <div class="text-sm text-muted" style="font-family: var(--font-mono); line-height: 2;">
                            <div>┌──── ${t('cron.minute')}</div>
                            <div>│ ┌──── ${t('cron.hour')}</div>
                            <div>│ │ ┌──── ${t('cron.dayOfMonth')}</div>
                            <div>│ │ │ ┌──── ${t('cron.month')}</div>
                            <div>│ │ │ │ ┌──── ${t('cron.dayOfWeek')}</div>
                            <div>* * * * *</div>
                            <div class="mt-4">${t('sched.examples')}</div>
                            <div><code>0 */6 * * *</code> — ${t('sched.every6h')}</div>
                            <div><code>0 4 * * *</code> — ${t('sched.daily4am')}</div>
                            <div><code>*/30 * * * *</code> — ${t('sched.every30m')}</div>
                            <div><code>0 0 * * 0</code> — ${t('sched.weeklySunday')}</div>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) { /* handled */ }
    }

    // ─── Settings ─────────────────────────────────────────────
    async function renderSettingsPage() {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="page"><div class="loading-overlay"><div class="spinner"></div> ${t('settings.loading')}</div></div>`;

        try {
            const cfg = await api('/api/config');

            main.innerHTML = `
                <div class="page">
                    <div class="page-header">
                        <h1 class="page-title">${t('settings.title')}</h1>
                        <p class="page-subtitle">${t('settings.subtitle')}</p>
                    </div>

                    <div class="card mb-6">
                        <div class="settings-section">
                            <div class="settings-section-title">${t('settings.serverSettings')}</div>
                            <div class="settings-row">
                                <div><div class="settings-label">${t('settings.serverName')}</div></div>
                                <input type="text" id="cfg-serverName" value="${escapeHtml(cfg.serverName || '')}">
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-label">${t('settings.javaPath')}</div><div class="settings-hint">${t('settings.javaPathHint')}</div></div>
                                <input type="text" id="cfg-javaPath" value="${escapeHtml(cfg.javaPath || 'java')}">
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-label">${t('settings.minMemory')}</div><div class="settings-hint">${t('settings.minMemoryHint')}</div></div>
                                <input type="text" id="cfg-minMemory" value="${escapeHtml(cfg.minMemory || '1024M')}">
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-label">${t('settings.maxMemory')}</div><div class="settings-hint">${t('settings.maxMemoryHint')}</div></div>
                                <input type="text" id="cfg-maxMemory" value="${escapeHtml(cfg.maxMemory || '2048M')}">
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-label">${t('settings.jvmFlags')}</div><div class="settings-hint">${t('settings.jvmFlagsHint')}</div></div>
                                <input type="text" id="cfg-jvmFlags" value="${escapeHtml(cfg.jvmFlags || '')}">
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-label">${t('settings.maxBackups')}</div><div class="settings-hint">${t('settings.maxBackupsHint')}</div></div>
                                <input type="number" id="cfg-maxBackups" value="${cfg.maxBackups || 10}" min="1" max="100">
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-label">${t('settings.consoleBuffer')}</div><div class="settings-hint">${t('settings.consoleBufferHint')}</div></div>
                                <input type="number" id="cfg-maxConsoleLines" value="${cfg.maxConsoleLines || 1000}" min="100" max="10000">
                            </div>
                        </div>
                        <button class="btn btn-primary" onclick="window.TP.saveSettings()">💾 ${t('settings.saveSettings')}</button>
                    </div>

                    <!-- Change Password -->
                    <div class="card">
                        <div class="settings-section">
                            <div class="settings-section-title">${t('settings.security')}</div>
                            <div class="settings-row">
                                <div class="settings-label">${t('settings.currentPassword')}</div>
                                <input type="password" id="cfg-currentPassword" placeholder="${t('settings.currentPasswordPlaceholder')}">
                            </div>
                            <div class="settings-row">
                                <div class="settings-label">${t('settings.newPassword')}</div>
                                <input type="password" id="cfg-newPassword" placeholder="${t('settings.newPasswordPlaceholder')}">
                            </div>
                        </div>
                        <button class="btn btn-warning" onclick="window.TP.changePassword()">🔒 ${t('settings.changePassword')}</button>
                    </div>
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
                toast(t('files.saved'), 'success');
            } catch (e) { /* handled */ }
        },

        async downloadFile(path) {
            window.open(`/api/files/download?path=${encodeURIComponent(path)}&token=${token}`, '_blank');
        },

        async deleteFile(path, name) {
            showModal(t('files.deleteTitle'), `<p>${t('files.deleteConfirm', { name: escapeHtml(name) })}</p><p class="text-muted text-sm mt-4">${t('files.undoWarning')}</p>`,
                `<button class="btn btn-secondary" onclick="closeModal()">${t('btn.cancel')}</button>
                 <button class="btn btn-danger" onclick="window.TP.confirmDeleteFile('${escapeHtml(path)}')">${t('btn.delete')}</button>`
            );
        },

        async confirmDeleteFile(path) {
            try {
                await api('/api/files/delete', { method: 'DELETE', body: { path } });
                toast(t('files.deleted'), 'success');
                closeModal();
                renderFilesPage();
            } catch (e) { closeModal(); }
        },

        async createFolder() {
            showModal(t('files.newFolderTitle'),
                `<div class="form-group"><label>${t('files.folderName')}</label><input type="text" id="new-folder-name" placeholder="${t('files.folderPlaceholder')}"></div>`,
                `<button class="btn btn-secondary" onclick="closeModal()">${t('btn.cancel')}</button>
                 <button class="btn btn-primary" onclick="window.TP.confirmCreateFolder()">${t('btn.create')}</button>`
            );
            setTimeout(() => document.getElementById('new-folder-name')?.focus(), 100);
        },

        async confirmCreateFolder() {
            const name = document.getElementById('new-folder-name')?.value?.trim();
            if (!name) return toast(t('files.enterFolderName'), 'warning');
            const folderPath = currentFilePath === '.' ? name : `${currentFilePath}/${name}`;
            try {
                await api('/api/files/mkdir', { method: 'POST', body: { path: folderPath } });
                toast(t('files.folderCreated'), 'success');
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
                    toast(t('files.uploadedCount', { n: input.files.length }), 'success');
                    renderFilesPage();
                } catch (e) { /* handled */ }
            };
            input.click();
        },

        deleteAll() {
            showModal(`⚠️ ${t('files.deleteAllTitle')}`,
                `<div style="text-align:center">
                    <div style="font-size:3rem;margin-bottom:12px">⚠️</div>
                    <p style="font-size:1.05rem;font-weight:600;color:var(--error);margin-bottom:12px">${t('files.deleteAllWarn')}</p>
                    <p class="text-muted text-sm">${t('files.deleteAllDesc')}</p>
                    <p class="text-muted text-sm mt-4">${t('files.deleteAllBackupTip')}</p>
                    <div class="form-group mt-6">
                        <label>${t('files.deleteAllConfirmLabel')}</label>
                        <input type="text" id="delete-all-confirm" placeholder="${t('files.deleteAllConfirmPlaceholder')}" autocomplete="off">
                    </div>
                </div>`,
                `<button class="btn btn-secondary" onclick="closeModal()">${t('btn.cancel')}</button>
                 <button class="btn btn-danger" id="delete-all-btn" disabled onclick="window.TP.confirmDeleteAll()">🗑 ${t('files.wipeServer')}</button>`
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
                toast(t('files.deletedItems', { n: result.deleted }), 'success');
                currentFilePath = '.';
                renderFilesPage();
            } catch (e) { /* handled */ }
        },

        // JAR Manager
        async selectJar(name) {
            try {
                await api('/api/jars/select', { method: 'POST', body: { jar: name } });
                toast(t('jars.selected', { name }), 'success');
                renderJarsPage();
            } catch (e) { /* handled */ }
        },

        async deleteJar(name) {
            showModal(t('jars.deleteTitle'), `<p>${t('jars.deleteConfirm', { name: escapeHtml(name) })}</p>`,
                `<button class="btn btn-secondary" onclick="closeModal()">${t('btn.cancel')}</button>
                 <button class="btn btn-danger" onclick="window.TP.confirmDeleteJar('${escapeHtml(name)}')">${t('btn.delete')}</button>`
            );
        },

        async confirmDeleteJar(name) {
            try {
                await api(`/api/jars/${encodeURIComponent(name)}`, { method: 'DELETE' });
                toast(t('jars.deleted'), 'success');
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
                    toast(t('jars.uploaded', { name: input.files[0].name }), 'success');
                    renderJarsPage();
                } catch (e) { /* handled */ }
            };
            input.click();
        },

        async downloadJar(type) {
            // Show version picker modal
            showModal(t('jars.downloadTitle', { type: t('jars.' + type) || type.charAt(0).toUpperCase() + type.slice(1) }),
                `<div class="form-group"><label>${t('jars.selectVersion')}</label><div class="loading-overlay"><div class="spinner"></div> ${t('jars.loadingVersions')}</div><select id="jar-version" class="hidden"></select></div>`,
                `<button class="btn btn-secondary" onclick="closeModal()">${t('btn.cancel')}</button>
                 <button class="btn btn-primary" id="jar-download-btn" disabled onclick="window.TP.confirmDownloadJar('${type}')">⬇ ${t('jars.downloadBtn')}</button>`
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
            toast(t('jars.downloadingVersion', { type, version }), 'info');
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
                toast(t('props.saved'), 'success');
            } catch (e) { /* handled */ }
        },

        // Backups
        async createBackup() {
            showModal(t('backups.createTitle'),
                `<div class="form-group"><label>${t('backups.nameOptional')}</label><input type="text" id="backup-name" placeholder="${t('backups.namePlaceholder')}"></div>`,
                `<button class="btn btn-secondary" onclick="closeModal()">${t('btn.cancel')}</button>
                 <button class="btn btn-primary" onclick="window.TP.confirmCreateBackup()">📦 ${t('btn.create')}</button>`
            );
        },

        async confirmCreateBackup() {
            const name = document.getElementById('backup-name')?.value?.trim();
            closeModal();
            toast(t('backups.creating'), 'info');
            try {
                await api('/api/backups/create', { method: 'POST', body: { name: name || undefined } });
                renderBackupsPage();
            } catch (e) { /* handled */ }
        },

        async restoreBackup(name) {
            showModal(t('backups.restoreTitle'),
                `<p>${t('backups.restoreConfirm', { name: escapeHtml(name) })}</p>
                 <p class="text-muted text-sm mt-4">${t('backups.restoreWarning')}</p>`,
                `<button class="btn btn-secondary" onclick="closeModal()">${t('btn.cancel')}</button>
                 <button class="btn btn-warning" onclick="window.TP.confirmRestoreBackup('${escapeHtml(name)}')">♻ ${t('backups.restore')}</button>`
            );
        },

        async confirmRestoreBackup(name) {
            closeModal();
            try {
                await api(`/api/backups/restore/${encodeURIComponent(name)}`, { method: 'POST' });
                toast(t('backups.restored'), 'success');
            } catch (e) { /* handled */ }
        },

        async deleteBackup(name) {
            try {
                await api(`/api/backups/${encodeURIComponent(name)}`, { method: 'DELETE' });
                toast(t('backups.deleted'), 'success');
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
                    return toast(t('backups.onlyTarGz'), 'warning');
                }
                const formData = new FormData();
                formData.append('backup', file);
                toast(t('backups.uploading', { name: file.name }), 'info');
                try {
                    const result = await api('/api/backups/upload', { method: 'POST', body: formData });
                    toast(t('backups.uploaded', { name: result.name, size: formatBytes(result.size) }), 'success');
                    renderBackupsPage();
                } catch (e) { /* handled */ }
            };
            input.click();
        },

        // Scheduler
        createSchedule() {
            showModal(t('sched.createTitle'),
                `<div class="form-group"><label>${t('sched.taskName')}</label><input type="text" id="sched-name" placeholder="${t('sched.taskNamePlaceholder')}"></div>
                 <div class="form-group mt-4"><label>${t('sched.cronExpr')}</label><input type="text" id="sched-cron" placeholder="${t('sched.cronPlaceholder')}"></div>
                 <div class="form-group mt-4"><label>${t('sched.action')}</label>
                     <select id="sched-action">
                         <option value="restart">${t('sched.action.restart')}</option>
                         <option value="start">${t('sched.action.start')}</option>
                         <option value="stop">${t('sched.action.stop')}</option>
                         <option value="backup">${t('sched.action.backup')}</option>
                         <option value="command">${t('sched.action.command')}</option>
                     </select>
                 </div>
                 <div class="form-group mt-4" id="sched-payload-group" style="display:none">
                     <label>${t('sched.command')}</label>
                     <input type="text" id="sched-payload" placeholder="${t('sched.commandPlaceholder')}">
                 </div>`,
                `<button class="btn btn-secondary" onclick="closeModal()">${t('btn.cancel')}</button>
                 <button class="btn btn-primary" onclick="window.TP.confirmCreateSchedule()">${t('btn.create')}</button>`
            );

            // Show/hide payload field based on action
            setTimeout(() => {
                const actionSelect = document.getElementById('sched-action');
                const payloadGroup = document.getElementById('sched-payload-group');
                if (actionSelect && payloadGroup) {
                    actionSelect.addEventListener('change', () => {
                        payloadGroup.style.display = actionSelect.value === 'command' ? '' : 'none';
                    });
                }
            }, 100);
        },

        async confirmCreateSchedule() {
            const name = document.getElementById('sched-name')?.value?.trim();
            const cronExpr = document.getElementById('sched-cron')?.value?.trim();
            const action = document.getElementById('sched-action')?.value;
            const payload = document.getElementById('sched-payload')?.value?.trim();

            if (!name || !cronExpr || !action) return toast(t('sched.allRequired'), 'warning');

            closeModal();
            try {
                await api('/api/schedules', { method: 'POST', body: { name, cron: cronExpr, action, payload } });
                toast(t('sched.created'), 'success');
                renderSchedulerPage();
            } catch (e) { /* handled */ }
        },

        async toggleSchedule(id, enabled) {
            try {
                await api(`/api/schedules/${id}`, { method: 'PUT', body: { enabled } });
                toast(enabled ? t('sched.enabled') : t('sched.disabled'), 'info');
            } catch (e) { /* handled */ }
        },

        async deleteSchedule(id) {
            try {
                await api(`/api/schedules/${id}`, { method: 'DELETE' });
                toast(t('sched.deleted'), 'success');
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
                toast(t('settings.saved'), 'success');
            } catch (e) { /* handled */ }
        },

        async changePassword() {
            const currentPassword = document.getElementById('cfg-currentPassword')?.value;
            const newPassword = document.getElementById('cfg-newPassword')?.value;
            if (!newPassword) return toast(t('settings.enterNewPassword'), 'warning');

            try {
                await api('/api/auth/change-password', {
                    method: 'POST',
                    body: { currentPassword, newPassword }
                });
                toast(t('settings.passwordChanged'), 'success');
                document.getElementById('cfg-currentPassword').value = '';
                document.getElementById('cfg-newPassword').value = '';
            } catch (e) { /* handled */ }
        },

        // 语言切换后重渲染当前页面（由 i18n 的 onChange 驱动）
        refresh() {
            updateStatusIndicators();
            if (document.getElementById('app').classList.contains('hidden')) return;
            renderPage(currentPage);
        }
    };

    // Make closeModal global for inline onclick handlers
    window.closeModal = closeModal;

    // 语言变化时重渲染动态页面（静态文案由 i18n 自行处理）
    if (window.I18N) {
        I18N.onChange(() => {
            if (window.TP && typeof window.TP.refresh === 'function') window.TP.refresh();
        });
    }

    // ─── Initialize ───────────────────────────────────────────
    checkAuth();
})();
