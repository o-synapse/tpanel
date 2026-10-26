// ═══════════════════════════════════════════════════════════
// TPanel — i18n / 国际化语言包
// 提供 t(key, params) 与后端消息翻译 tm(msg)
// 语言选择持久化在 localStorage['tp_lang']，默认简体中文
// ═══════════════════════════════════════════════════════════

(function () {
    'use strict';

    var STORAGE_KEY = 'tp_lang';
    var DEFAULT_LOCALE = 'zh-CN';

    var LOCALES = {
        'zh-CN': {
            name: '简体中文',
            short: '中文',
            htmlLang: 'zh-CN',
            dict: {
                'app.title': 'TermuxPanel — Minecraft 服务端管理器',

                // ─── 导航 ───
                'nav.dashboard': '仪表盘',
                'nav.console': '控制台',
                'nav.files': '文件管理',
                'nav.jars': 'JAR 管理',
                'nav.properties': '服务端配置',
                'nav.backups': '备份',
                'nav.scheduler': '定时任务',
                'nav.settings': '设置',
                'nav.statusShort': '状态',
                'nav.filesShort': '文件',
                'nav.logout': '退出登录',
                'nav.language': '语言',

                // ─── 登录 / 初始化 ───
                'login.subtitle': 'Minecraft 服务端管理器',
                'login.password': '密码',
                'login.passwordPlaceholder': '请输入密码',
                'login.signIn': '登录',
                'setup.welcome': '欢迎使用 TermuxPanel',
                'setup.subtitle': '请设置管理员密码',
                'setup.createPassword': '创建密码',
                'setup.choosePlaceholder': '请设置一个密码',
                'setup.confirmPassword': '确认密码',
                'setup.confirmPlaceholder': '再次输入密码',
                'setup.createAccount': '创建账号',
                'err.passwordMismatch': '两次输入的密码不一致',
                'err.loginFailed': '登录失败',
                'err.setupFailed': '初始化失败',
                'err.connectionFailed': '连接失败',
                'err.cannotConnect': '无法连接到服务器',
                'err.unauthorized': '未授权',
                'err.requestFailed': '请求失败',
                'msg.accountCreated': '账号创建成功！',

                // ─── 运行状态 ───
                'status.running': '运行中',
                'status.stopped': '已停止',
                'status.starting': '启动中',
                'status.stopping': '停止中',
                'status.online': '在线',
                'status.offline': '离线',

                // ─── 仪表盘 ───
                'dash.title': '仪表盘',
                'dash.defaultServerName': 'Minecraft 服务器',
                'dash.quickActions': '快速操作',
                'dash.start': '启动',
                'dash.stop': '停止',
                'dash.restart': '重启',
                'dash.kill': '强制结束',
                'dash.serverStatus': '服务端状态',
                'dash.uptime': '运行时长',
                'dash.activeJar': '当前 JAR',
                'dash.jarNone': '无',
                'dash.serverSize': '服务端大小',
                'dash.systemResources': '系统资源',
                'dash.cpuUsage': 'CPU 使用率',
                'dash.memory': '内存（{used} / {total}）',
                'dash.disk': '磁盘（{used} / {total}）',
                'dash.systemInfo': '系统信息',
                'dash.platform': '平台：',
                'dash.hostname': '主机名：',
                'dash.cpu': 'CPU：',
                'dash.cores': '{n} 核',
                'dash.systemUptime': '系统运行时长：',

                // ─── 控制台 ───
                'console.title': '控制台',
                'console.subtitle': '实时服务端输出',
                'console.clear': '清空',
                'console.placeholderRunning': '输入命令…',
                'console.placeholderStopped': '服务端未运行',
                'console.send': '发送',

                // ─── 文件管理 ───
                'files.title': '文件管理',
                'files.subtitle': '管理服务端文件',
                'files.loading': '正在加载文件…',
                'files.deleteAll': '删除全部',
                'files.newFolder': '新建文件夹',
                'files.upload': '上传',
                'files.colName': '名称',
                'files.colSize': '大小',
                'files.colModified': '修改时间',
                'files.emptyDir': '空目录',
                'files.loadingFile': '正在加载文件…',
                'files.editorTitle': '文件编辑器',
                'files.back': '返回',
                'files.save': '保存',
                'files.cannotOpen': '无法打开文件',
                'files.cannotOpenDesc': '该文件可能是二进制文件，或体积过大无法编辑。',
                'files.tipDownload': '下载',
                'files.tipDelete': '删除',
                'files.saved': '文件保存成功',
                'files.deleted': '删除成功',
                'files.deleteTitle': '删除文件',
                'files.deleteConfirm': '确定要删除 <strong>{name}</strong> 吗？',
                'files.undoWarning': '此操作无法撤销。',
                'files.newFolderTitle': '新建文件夹',
                'files.folderName': '文件夹名称',
                'files.folderPlaceholder': 'my-folder',
                'files.uploadedCount': '已上传 {n} 个文件',
                'files.deleteAllTitle': '删除所有服务端文件',
                'files.deleteAllWarn': '此操作将永久删除 Minecraft 服务端文件夹内的全部文件。',
                'files.deleteAllDesc': '你的存档、插件、配置文件、JAR 文件——<strong>全部</strong>都将被清空，且无法撤销。',
                'files.deleteAllBackupTip': '建议先创建一个<strong>备份</strong>。',
                'files.deleteAllConfirmLabel': '输入 <strong>DELETE</strong> 以确认',
                'files.deleteAllConfirmPlaceholder': '在此输入 DELETE',
                'files.wipeServer': '清空服务端',
                'files.deletedItems': '已从服务端文件夹删除 {n} 项',
                'files.enterFolderName': '请输入文件夹名称',
                'files.folderCreated': '文件夹已创建',

                // ─── 通用按钮 ───
                'btn.cancel': '取消',
                'btn.delete': '删除',
                'btn.create': '创建',

                // ─── JAR 管理 ───
                'jars.title': 'JAR 管理',
                'jars.subtitle': '管理和下载服务端 JAR',
                'jars.loading': '正在加载 JAR…',
                'jars.installed': '已安装的 JAR',
                'jars.uploadJar': '上传 JAR',
                'jars.active': '已启用',
                'jars.select': '选用',
                'jars.noJars': '未找到 JAR',
                'jars.noJarsDesc': '上传一个 JAR 文件，或从下方下载',
                'jars.downloadSoftware': '下载服务端软件',
                'jars.paper': 'Paper',
                'jars.paperDesc': '高性能 Spigot 分支',
                'jars.purpurDesc': '带有额外功能的 Paper 分支',
                'jars.vanillaDesc': 'Mojang 官方服务端',
                'jars.fabricDesc': '轻量级模组加载框架',
                'jars.selected': '已选用 {name}',
                'jars.deleteTitle': '删除 JAR',
                'jars.deleteConfirm': '确定要删除 <strong>{name}</strong> 吗？',
                'jars.deleted': 'JAR 已删除',
                'jars.uploaded': '已上传 {name}',
                'jars.downloadTitle': '下载 {type}',
                'jars.selectVersion': '选择版本',
                'jars.loadingVersions': '正在加载版本…',
                'jars.downloadBtn': '下载',
                'jars.downloadingVersion': '正在下载 {type} {version}… 可能需要一些时间。',
                'jars.downloading': '正在下载 {name}…',
                'jars.downloaded': '{name} 下载完成',

                // ─── 服务端配置 ───
                'props.title': '服务端配置',
                'props.subtitle': '编辑 server.properties',
                'props.loading': '正在加载配置…',
                'props.saveChanges': '保存更改',
                'props.notFound': '未找到 server.properties',
                'props.notFoundDesc': '先启动一次服务端以生成该文件，或在文件管理中手动创建。',
                'props.saved': '配置已保存！重启服务端后生效。',
                'props.group.Network': '网络',
                'props.group.Gameplay': '玩法',
                'props.group.World': '世界',
                'props.group.Display': '显示',
                'props.group.Other': '其他',
                // 属性说明（键名与后端 PROPERTY_DESCRIPTIONS 保持一致）
                'props.desc.server-port': '服务端监听的端口',
                'props.desc.gamemode': '默认游戏模式（生存、创造、冒险、旁观）',
                'props.desc.difficulty': '服务端难度（和平、简单、普通、困难）',
                'props.desc.max-players': '最大玩家数',
                'props.desc.motd': '服务器列表中显示的消息',
                'props.desc.level-name': '世界文件夹名称',
                'props.desc.level-seed': '世界生成种子',
                'props.desc.pvp': '启用 PvP 战斗',
                'props.desc.spawn-protection': '出生点保护半径',
                'props.desc.view-distance': '视距（区块）',
                'props.desc.simulation-distance': '模拟距离（区块）',
                'props.desc.online-mode': '启用 Mojang 正版验证',
                'props.desc.white-list': '启用白名单',
                'props.desc.spawn-monsters': '启用怪物生成',
                'props.desc.spawn-animals': '启用动物生成',
                'props.desc.spawn-npcs': '启用 NPC 生成',
                'props.desc.allow-flight': '允许飞行',
                'props.desc.allow-nether': '启用下界',
                'props.desc.generate-structures': '生成结构（村庄等）',
                'props.desc.max-world-size': '最大世界半径',
                'props.desc.enable-command-block': '启用命令方块',
                'props.desc.hardcore': '启用极限模式',
                'props.desc.server-ip': '绑定指定 IP（留空表示全部）',
                'props.desc.resource-pack': '资源包 URL',
                'props.desc.enable-query': '启用 GameSpy4 协议查询监听',
                'props.desc.enable-rcon': '启用远程控制台',
                'props.desc.rcon.password': 'RCON 密码',
                'props.desc.rcon.port': 'RCON 端口',
                'props.desc.level-type': '世界类型（normal、flat 等）',

                // ─── 备份 ───
                'backups.title': '备份',
                'backups.subtitle': '管理服务端备份',
                'backups.loading': '正在加载备份…',
                'backups.download': '下载',
                'backups.restore': '还原',
                'backups.uploadBackup': '上传备份',
                'backups.createBackup': '创建备份',
                'backups.noBackups': '暂无备份',
                'backups.noBackupsDesc': '创建你的第一个备份，保护服务端数据。',
                'backups.createTitle': '创建备份',
                'backups.nameOptional': '备份名称（可选）',
                'backups.namePlaceholder': '留空则自动生成名称',
                'backups.creating': '正在创建备份…',
                'backups.created': '备份已创建：{name}',
                'backups.restoreTitle': '还原备份',
                'backups.restoreConfirm': '确定要还原 <strong>{name}</strong> 吗？',
                'backups.restoreWarning': '⚠️ 这将替换当前所有服务端文件，且必须先停止服务端。',
                'backups.restored': '备份还原成功！',
                'backups.deleted': '备份已删除',
                'backups.onlyTarGz': '仅支持 .tar.gz 文件',
                'backups.uploading': '正在上传 {name}…',
                'backups.uploaded': '已上传 {name}（{size}）',

                // ─── 定时任务 ───
                'sched.title': '定时任务',
                'sched.subtitle': '自动化服务端任务',
                'sched.loading': '正在加载任务…',
                'sched.newTask': '新建任务',
                'sched.noTasks': '暂无定时任务',
                'sched.noTasksDesc': '创建自动化任务来管理你的服务端。',
                'sched.cronRef': 'Cron 表达式参考',
                'cron.minute': '分钟 (0-59)',
                'cron.hour': '小时 (0-23)',
                'cron.dayOfMonth': '日 (1-31)',
                'cron.month': '月 (1-12)',
                'cron.dayOfWeek': '星期 (0-7，周日=0 或 7)',
                'sched.actionLabel2': '动作：{action}',
                'sched.examples': '示例：',
                'sched.every6h': '每 6 小时',
                'sched.daily4am': '每天凌晨 4:00',
                'sched.every30m': '每 30 分钟',
                'sched.weeklySunday': '每周日 0 点',
                'sched.createTitle': '新建定时任务',
                'sched.taskName': '任务名称',
                'sched.taskNamePlaceholder': '例如：每日重启',
                'sched.cronExpr': 'Cron 表达式',
                'sched.cronPlaceholder': '例如：0 4 * * *',
                'sched.action': '动作',
                'sched.action.restart': '重启服务端',
                'sched.action.start': '启动服务端',
                'sched.action.stop': '停止服务端',
                'sched.action.backup': '创建备份',
                'sched.action.command': '执行命令',
                'sched.command': '命令',
                'sched.commandPlaceholder': '例如：say 服务器将在 5 分钟后重启！',
                'sched.allRequired': '请填写所有必填字段',
                'sched.created': '任务已创建',
                'sched.enabled': '任务已启用',
                'sched.disabled': '任务已禁用',
                'sched.deleted': '任务已删除',

                // ─── 设置 ───
                'settings.title': '设置',
                'settings.subtitle': '面板与服务端配置',
                'settings.loading': '正在加载设置…',
                'settings.serverSettings': '服务端设置',
                'settings.serverName': '服务端名称',
                'settings.javaPath': 'Java 路径',
                'settings.javaPathHint': '例如：java 或 /usr/bin/java',
                'settings.minMemory': '最小内存',
                'settings.minMemoryHint': '-Xms 值',
                'settings.maxMemory': '最大内存',
                'settings.maxMemoryHint': '-Xmx 值',
                'settings.jvmFlags': 'JVM 参数',
                'settings.jvmFlagsHint': '额外的 Java 启动参数',
                'settings.maxBackups': '最大备份数',
                'settings.maxBackupsHint': '超出时自动删除最旧的备份',
                'settings.consoleBuffer': '控制台缓冲',
                'settings.consoleBufferHint': '保留的最大控制台行数',
                'settings.saveSettings': '保存设置',
                'settings.security': '安全',
                'settings.currentPassword': '当前密码',
                'settings.currentPasswordPlaceholder': '当前密码',
                'settings.newPassword': '新密码',
                'settings.newPasswordPlaceholder': '新密码',
                'settings.changePassword': '修改密码',
                'settings.saved': '设置已保存！',
                'settings.enterNewPassword': '请输入新密码',
                'settings.passwordChanged': '密码修改成功',

                // ─── 游戏模式 / 难度 ───
                'gm.survival': '生存模式',
                'gm.creative': '创造模式',
                'gm.adventure': '冒险模式',
                'gm.spectator': '旁观模式',
                'df.peaceful': '和平',
                'df.easy': '简单',
                'df.normal': '普通',
                'df.hard': '困难'
            },
            // 后端英文消息 → 中文（精确匹配）
            serverMsg: {
                'Server is already running.': '服务端已在运行中。',
                'Server starting...': '服务端正在启动…',
                'Server is not running.': '服务端未运行。',
                'Server force killed.': '服务端已被强制结束。',
                'Server stopping...': '服务端正在停止…',
                'Server restarting...': '服务端正在重启…',
                'No token provided': '未提供登录令牌',
                'Invalid token': '登录令牌无效',
                'Password already set': '密码已设置',
                'Password must be at least 4 characters': '密码至少需要 4 个字符',
                'Password required': '请输入密码',
                'No password set, please run setup': '尚未设置密码，请先完成初始化',
                'Invalid password': '密码错误',
                'New password must be at least 4 characters': '新密码至少需要 4 个字符',
                'Current password is incorrect': '当前密码不正确',
                'Command required': '请输入命令',
                'JAR name required': '请指定 JAR 名称',
                'JAR not found': '找不到该 JAR',
                'No file uploaded': '未上传文件',
                'Only .jar files allowed': '仅支持 .jar 文件',
                'Invalid file': '无效的文件',
                'Cannot delete the currently selected JAR': '无法删除当前正在使用的 JAR',
                'Server type required': '请指定服务端类型',
                'Unknown server type. Supported: paper, purpur, vanilla, fabric': '未知的服务端类型。支持：paper、purpur、vanilla、fabric',
                'Access denied': '拒绝访问',
                'Directory not found': '找不到该目录',
                'Not a directory': '不是目录',
                'File not found': '找不到该文件',
                'Cannot read a directory': '无法读取目录',
                'File too large to read (>5MB)': '文件过大无法读取（>5MB）',
                'Cannot read binary file': '无法读取二进制文件',
                'Cannot delete root directory': '无法删除根目录',
                'Stop the server before deleting all files.': '请先停止服务端，再删除所有文件。',
                'Properties required': '请填写配置项',
                'Backup not found': '找不到该备份',
                'Stop the server before restoring a backup': '请先停止服务端，再还原备份',
                'Name, cron, and action are required': '名称、Cron 表达式和动作为必填项',
                'Invalid cron expression': 'Cron 表达式无效',
                'Schedule not found': '找不到该任务',
                'Only .tar.gz files are allowed': '仅支持 .tar.gz 文件',
                'Unauthorized': '未授权',
                'Request failed': '请求失败'
            },
            // 后端消息（含变量）正则规则
            serverMsgRules: [
                [/^JAR file not found: (.+)$/, '找不到 JAR 文件：$1'],
                [/^Command sent: (.+)$/, '命令已发送：$1']
            ],
            timeUnits: { d: '天', h: '小时', m: '分钟', s: '秒' }
        },

        'en': {
            name: 'English',
            short: 'EN',
            htmlLang: 'en',
            dict: {
                'app.title': 'TermuxPanel — Minecraft Server Manager',

                'nav.dashboard': 'Dashboard',
                'nav.console': 'Console',
                'nav.files': 'File Manager',
                'nav.jars': 'JAR Manager',
                'nav.properties': 'Server Config',
                'nav.backups': 'Backups',
                'nav.scheduler': 'Scheduler',
                'nav.settings': 'Settings',
                'nav.statusShort': 'Status',
                'nav.filesShort': 'Files',
                'nav.logout': 'Logout',
                'nav.language': 'Language',

                'login.subtitle': 'Minecraft Server Manager',
                'login.password': 'Password',
                'login.passwordPlaceholder': 'Enter your password',
                'login.signIn': 'Sign In',
                'setup.welcome': 'Welcome to TermuxPanel',
                'setup.subtitle': 'Set up your admin password',
                'setup.createPassword': 'Create Password',
                'setup.choosePlaceholder': 'Choose a password',
                'setup.confirmPassword': 'Confirm Password',
                'setup.confirmPlaceholder': 'Confirm your password',
                'setup.createAccount': 'Create Account',
                'err.passwordMismatch': 'Passwords do not match',
                'err.loginFailed': 'Login failed',
                'err.setupFailed': 'Setup failed',
                'err.connectionFailed': 'Connection failed',
                'err.cannotConnect': 'Cannot connect to server',
                'err.unauthorized': 'Unauthorized',
                'err.requestFailed': 'Request failed',
                'msg.accountCreated': 'Account created successfully!',

                'status.running': 'Running',
                'status.stopped': 'Stopped',
                'status.starting': 'Starting',
                'status.stopping': 'Stopping',
                'status.online': 'Online',
                'status.offline': 'Offline',

                'dash.title': 'Dashboard',
                'dash.defaultServerName': 'Minecraft Server',
                'dash.quickActions': 'Quick Actions',
                'dash.start': 'Start',
                'dash.stop': 'Stop',
                'dash.restart': 'Restart',
                'dash.kill': 'Kill',
                'dash.serverStatus': 'Server Status',
                'dash.uptime': 'Uptime',
                'dash.activeJar': 'Active JAR',
                'dash.jarNone': 'None',
                'dash.serverSize': 'Server Size',
                'dash.systemResources': 'System Resources',
                'dash.cpuUsage': 'CPU Usage',
                'dash.memory': 'Memory ({used} / {total})',
                'dash.disk': 'Disk ({used} / {total})',
                'dash.systemInfo': 'System Info',
                'dash.platform': 'Platform:',
                'dash.hostname': 'Hostname:',
                'dash.cpu': 'CPU:',
                'dash.cores': '{n} cores',
                'dash.systemUptime': 'System Uptime:',

                'console.title': 'Console',
                'console.subtitle': 'Real-time server output',
                'console.clear': 'Clear',
                'console.placeholderRunning': 'Type a command...',
                'console.placeholderStopped': 'Server is not running',
                'console.send': 'Send',

                'files.title': 'File Manager',
                'files.subtitle': 'Manage your server files',
                'files.loading': 'Loading files...',
                'files.deleteAll': 'Delete All',
                'files.newFolder': 'New Folder',
                'files.upload': 'Upload',
                'files.colName': 'Name',
                'files.colSize': 'Size',
                'files.colModified': 'Modified',
                'files.emptyDir': 'Empty directory',
                'files.loadingFile': 'Loading file...',
                'files.editorTitle': 'File Editor',
                'files.back': 'Back',
                'files.save': 'Save',
                'files.cannotOpen': 'Cannot open file',
                'files.cannotOpenDesc': 'This file may be binary or too large to edit.',
                'files.tipDownload': 'Download',
                'files.tipDelete': 'Delete',
                'files.saved': 'File saved successfully',
                'files.deleted': 'Deleted successfully',
                'files.deleteTitle': 'Delete File',
                'files.deleteConfirm': 'Are you sure you want to delete <strong>{name}</strong>?',
                'files.undoWarning': 'This action cannot be undone.',
                'files.newFolderTitle': 'New Folder',
                'files.folderName': 'Folder Name',
                'files.folderPlaceholder': 'my-folder',
                'files.uploadedCount': 'Uploaded {n} file(s)',
                'files.deleteAllTitle': 'Delete All Server Files',
                'files.deleteAllWarn': 'This will permanently delete ALL files inside your Minecraft server folder.',
                'files.deleteAllDesc': 'Your world, plugins, configs, JAR files — <strong>everything</strong> will be wiped. This cannot be undone.',
                'files.deleteAllBackupTip': 'Consider creating a <strong>backup</strong> first.',
                'files.deleteAllConfirmLabel': 'Type <strong>DELETE</strong> to confirm',
                'files.deleteAllConfirmPlaceholder': 'Type DELETE here',
                'files.wipeServer': 'Wipe Server',
                'files.deletedItems': 'Deleted {n} items from server folder',
                'files.enterFolderName': 'Enter a folder name',
                'files.folderCreated': 'Folder created',

                'btn.cancel': 'Cancel',
                'btn.delete': 'Delete',
                'btn.create': 'Create',

                'jars.title': 'JAR Manager',
                'jars.subtitle': 'Manage and download server JARs',
                'jars.loading': 'Loading JARs...',
                'jars.installed': 'Installed JARs',
                'jars.uploadJar': 'Upload JAR',
                'jars.active': 'Active',
                'jars.select': 'Select',
                'jars.noJars': 'No JARs found',
                'jars.noJarsDesc': 'Upload a JAR file or download one below',
                'jars.downloadSoftware': 'Download Server Software',
                'jars.paper': 'Paper',
                'jars.paperDesc': 'High-performance Spigot fork',
                'jars.purpurDesc': 'Paper fork with extra features',
                'jars.vanillaDesc': 'Official Mojang server',
                'jars.fabricDesc': 'Lightweight modding framework',
                'jars.selected': 'Selected {name}',
                'jars.deleteTitle': 'Delete JAR',
                'jars.deleteConfirm': 'Are you sure you want to delete <strong>{name}</strong>?',
                'jars.deleted': 'JAR deleted',
                'jars.uploaded': 'Uploaded {name}',
                'jars.downloadTitle': 'Download {type}',
                'jars.selectVersion': 'Select Version',
                'jars.loadingVersions': 'Loading versions...',
                'jars.downloadBtn': 'Download',
                'jars.downloadingVersion': 'Downloading {type} {version}... This may take a moment.',
                'jars.downloading': 'Downloading {name}...',
                'jars.downloaded': 'Downloaded {name}',

                'props.title': 'Server Config',
                'props.subtitle': 'Edit server.properties',
                'props.loading': 'Loading properties...',
                'props.saveChanges': 'Save Changes',
                'props.notFound': 'No server.properties found',
                'props.notFoundDesc': 'Start your server once to generate the file, or create it manually in the file manager.',
                'props.saved': 'Properties saved! Restart the server to apply changes.',
                'props.group.Network': 'Network',
                'props.group.Gameplay': 'Gameplay',
                'props.group.World': 'World',
                'props.group.Display': 'Display',
                'props.group.Other': 'Other',
                'props.desc.server-port': 'Port the server runs on',
                'props.desc.gamemode': 'Default game mode (survival, creative, adventure, spectator)',
                'props.desc.difficulty': 'Server difficulty (peaceful, easy, normal, hard)',
                'props.desc.max-players': 'Maximum number of players',
                'props.desc.motd': 'Message shown in server list',
                'props.desc.level-name': 'Name of the world folder',
                'props.desc.level-seed': 'World generation seed',
                'props.desc.pvp': 'Enable PvP combat',
                'props.desc.spawn-protection': 'Radius of spawn protection',
                'props.desc.view-distance': 'View distance in chunks',
                'props.desc.simulation-distance': 'Simulation distance in chunks',
                'props.desc.online-mode': 'Enable Mojang authentication',
                'props.desc.white-list': 'Enable whitelist',
                'props.desc.spawn-monsters': 'Enable monster spawning',
                'props.desc.spawn-animals': 'Enable animal spawning',
                'props.desc.spawn-npcs': 'Enable NPC spawning',
                'props.desc.allow-flight': 'Allow flying',
                'props.desc.allow-nether': 'Enable the Nether',
                'props.desc.generate-structures': 'Generate structures (villages, etc.)',
                'props.desc.max-world-size': 'Maximum world radius',
                'props.desc.enable-command-block': 'Enable command blocks',
                'props.desc.hardcore': 'Enable hardcore mode',
                'props.desc.server-ip': 'Bind to specific IP (leave blank for all)',
                'props.desc.resource-pack': 'URL to resource pack',
                'props.desc.enable-query': 'Enable GameSpy4 protocol server listener',
                'props.desc.enable-rcon': 'Enable remote console',
                'props.desc.rcon.password': 'RCON password',
                'props.desc.rcon.port': 'RCON port',
                'props.desc.level-type': 'World type (normal, flat, etc.)',

                'backups.title': 'Backups',
                'backups.subtitle': 'Manage server backups',
                'backups.loading': 'Loading backups...',
                'backups.download': 'Download',
                'backups.restore': 'Restore',
                'backups.uploadBackup': 'Upload Backup',
                'backups.createBackup': 'Create Backup',
                'backups.noBackups': 'No backups yet',
                'backups.noBackupsDesc': 'Create your first backup to protect your server data.',
                'backups.createTitle': 'Create Backup',
                'backups.nameOptional': 'Backup Name (optional)',
                'backups.namePlaceholder': 'Leave blank for auto-generated name',
                'backups.creating': 'Creating backup...',
                'backups.created': 'Backup created: {name}',
                'backups.restoreTitle': 'Restore Backup',
                'backups.restoreConfirm': 'Are you sure you want to restore <strong>{name}</strong>?',
                'backups.restoreWarning': '⚠️ This will replace ALL current server files. The server must be stopped first.',
                'backups.restored': 'Backup restored successfully!',
                'backups.deleted': 'Backup deleted',
                'backups.onlyTarGz': 'Only .tar.gz files are allowed',
                'backups.uploading': 'Uploading {name}...',
                'backups.uploaded': 'Uploaded {name} ({size})',

                'sched.title': 'Scheduler',
                'sched.subtitle': 'Automate server tasks',
                'sched.loading': 'Loading schedules...',
                'sched.newTask': 'New Task',
                'sched.noTasks': 'No scheduled tasks',
                'sched.noTasksDesc': 'Create automated tasks to manage your server.',
                'sched.cronRef': 'Cron Reference',
                'cron.minute': 'minute (0-59)',
                'cron.hour': 'hour (0-23)',
                'cron.dayOfMonth': 'day of month (1-31)',
                'cron.month': 'month (1-12)',
                'cron.dayOfWeek': 'day of week (0-7, Sun=0 or 7)',
                'sched.actionLabel2': 'Action: {action}',
                'sched.examples': 'Examples:',
                'sched.every6h': 'Every 6 hours',
                'sched.daily4am': 'Daily at 4:00 AM',
                'sched.every30m': 'Every 30 minutes',
                'sched.weeklySunday': 'Weekly on Sunday at midnight',
                'sched.createTitle': 'New Scheduled Task',
                'sched.taskName': 'Task Name',
                'sched.taskNamePlaceholder': 'e.g., Daily Restart',
                'sched.cronExpr': 'Cron Expression',
                'sched.cronPlaceholder': 'e.g., 0 4 * * *',
                'sched.action': 'Action',
                'sched.action.restart': 'Restart Server',
                'sched.action.start': 'Start Server',
                'sched.action.stop': 'Stop Server',
                'sched.action.backup': 'Create Backup',
                'sched.action.command': 'Run Command',
                'sched.command': 'Command',
                'sched.commandPlaceholder': 'e.g., say Server restarting in 5 minutes!',
                'sched.allRequired': 'All fields are required',
                'sched.created': 'Schedule created',
                'sched.enabled': 'Task enabled',
                'sched.disabled': 'Task disabled',
                'sched.deleted': 'Schedule deleted',

                'settings.title': 'Settings',
                'settings.subtitle': 'Panel and server configuration',
                'settings.loading': 'Loading settings...',
                'settings.serverSettings': 'Server Settings',
                'settings.serverName': 'Server Name',
                'settings.javaPath': 'Java Path',
                'settings.javaPathHint': 'e.g., java or /usr/bin/java',
                'settings.minMemory': 'Min Memory',
                'settings.minMemoryHint': '-Xms value',
                'settings.maxMemory': 'Max Memory',
                'settings.maxMemoryHint': '-Xmx value',
                'settings.jvmFlags': 'JVM Flags',
                'settings.jvmFlagsHint': 'Additional Java arguments',
                'settings.maxBackups': 'Max Backups',
                'settings.maxBackupsHint': 'Auto-delete oldest when exceeded',
                'settings.consoleBuffer': 'Console Buffer',
                'settings.consoleBufferHint': 'Max console lines to keep',
                'settings.saveSettings': 'Save Settings',
                'settings.security': 'Security',
                'settings.currentPassword': 'Current Password',
                'settings.currentPasswordPlaceholder': 'Current password',
                'settings.newPassword': 'New Password',
                'settings.newPasswordPlaceholder': 'New password',
                'settings.changePassword': 'Change Password',
                'settings.saved': 'Settings saved!',
                'settings.enterNewPassword': 'Enter a new password',
                'settings.passwordChanged': 'Password changed successfully',

                'gm.survival': 'Survival',
                'gm.creative': 'Creative',
                'gm.adventure': 'Adventure',
                'gm.spectator': 'Spectator',
                'df.peaceful': 'Peaceful',
                'df.easy': 'Easy',
                'df.normal': 'Normal',
                'df.hard': 'Hard'
            },
            serverMsg: {},
            serverMsgRules: [],
            timeUnits: { d: 'd', h: 'h', m: 'm', s: 's' }
        }
    };

    var current = DEFAULT_LOCALE;
    var listeners = [];

    function normalize(lang) {
        if (!lang) return DEFAULT_LOCALE;
        if (LOCALES[lang]) return lang;
        var lower = String(lang).toLowerCase();
        if (lower.indexOf('zh') === 0) return 'zh-CN';
        if (lower.indexOf('en') === 0) return 'en';
        return DEFAULT_LOCALE;
    }

    // 首次访问默认使用简体中文；之后以用户手动选择为准
    function detectInitial() {
        var saved = null;
        try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { }
        if (saved) return normalize(saved);
        return DEFAULT_LOCALE;
    }

    function t(key, params) {
        var pack = LOCALES[current];
        var str = pack.dict[key];
        if (str === undefined) {
            // 回退到英文，再回退到 key 本身
            str = LOCALES['en'].dict[key];
            if (str === undefined) return key;
        }
        if (params) {
            Object.keys(params).forEach(function (k) {
                str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
            });
        }
        return str;
    }

    // 翻译后端返回的英文消息；英文环境下原样返回
    function tm(msg) {
        if (!msg) return msg;
        var pack = LOCALES[current];
        if (!pack.serverMsg || Object.keys(pack.serverMsg).length === 0) return msg;
        if (pack.serverMsg[msg] !== undefined) return pack.serverMsg[msg];
        for (var i = 0; i < pack.serverMsgRules.length; i++) {
            var m = msg.match(pack.serverMsgRules[i][0]);
            if (m) {
                var out = pack.serverMsgRules[i][1];
                for (var g = 1; g < m.length; g++) {
                    out = out.split('$' + g).join(m[g]);
                }
                return out;
            }
        }
        return msg;
    }

    function getLocale() { return current; }
    function availableLocales() {
        return Object.keys(LOCALES).map(function (k) {
            return { code: k, name: LOCALES[k].name, short: LOCALES[k].short };
        });
    }
    function localeMeta(code) { return LOCALES[code] || LOCALES[DEFAULT_LOCALE]; }

    function applyStatic() {
        document.documentElement.lang = LOCALES[current].htmlLang;
        document.title = t('app.title');
        var nodes = document.querySelectorAll('[data-i18n]');
        Array.prototype.forEach.call(nodes, function (el) {
            el.textContent = t(el.getAttribute('data-i18n'));
        });
        var phs = document.querySelectorAll('[data-i18n-placeholder]');
        Array.prototype.forEach.call(phs, function (el) {
            el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
        });
        var tis = document.querySelectorAll('[data-i18n-title]');
        Array.prototype.forEach.call(tis, function (el) {
            el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
        });
        renderSwitchers();
    }

    function setLocale(lang, skipPersist) {
        lang = normalize(lang);
        var changed = lang !== current;
        current = lang;
        if (!skipPersist) {
            try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { }
        }
        applyStatic();
        if (changed) {
            listeners.forEach(function (fn) {
                try { fn(lang); } catch (e) { console.error('[i18n] listener error', e); }
            });
        }
    }

    function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

    // ─── 语言切换器 ───
    // 结构：.lang-switch > button.lang-switch-btn + ul.lang-switch-menu
    function buildSwitcher(root) {
        root.innerHTML = '';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lang-switch-btn';
        btn.innerHTML = '<span class="lang-icon">🌐</span><span class="lang-current"></span><span class="lang-caret">▾</span>';

        var menu = document.createElement('div');
        menu.className = 'lang-switch-menu hidden';

        availableLocales().forEach(function (loc) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'lang-switch-item';
            item.setAttribute('data-lang', loc.code);
            item.innerHTML = '<span class="lang-item-name">' + loc.name + '</span>';
            item.addEventListener('click', function (e) {
                e.stopPropagation();
                setLocale(loc.code); // 动态页面由 onChange 监听者负责重渲染
                closeAll();
            });
            menu.appendChild(item);
        });

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var willOpen = menu.classList.contains('hidden');
            closeAll();
            if (willOpen) menu.classList.remove('hidden');
        });

        menu.addEventListener('click', function (e) { e.stopPropagation(); });

        root.appendChild(btn);
        root.appendChild(menu);

        function syncActive() {
            Array.prototype.forEach.call(menu.querySelectorAll('.lang-switch-item'), function (it) {
                it.classList.toggle('active', it.getAttribute('data-lang') === current);
            });
            var cur = root.querySelector('.lang-current');
            if (cur) cur.textContent = localeMeta(current).short;
        }
        syncActive();
        root._syncLang = syncActive;
    }

    var closeAll = function () {
        Array.prototype.forEach.call(document.querySelectorAll('.lang-switch-menu'), function (m) {
            m.classList.add('hidden');
        });
    };
    document.addEventListener('click', closeAll);

    function renderSwitchers() {
        Array.prototype.forEach.call(document.querySelectorAll('.lang-switch'), function (root) {
            if (!root._built) {
                buildSwitcher(root);
                root._built = true;
            } else if (root._syncLang) {
                root._syncLang();
            }
        });
    }

    window.I18N = {
        t: t,
        tm: tm,
        getLocale: getLocale,
        setLocale: setLocale,
        onChange: onChange,
        availableLocales: availableLocales,
        localeMeta: localeMeta,
        applyStatic: applyStatic,
        renderSwitchers: renderSwitchers,
        timeUnits: function () { return LOCALES[current].timeUnits; }
    };
    window.t = t;

    // 初始应用（DOM 可能尚未就绪时等待）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setLocale(detectInitial(), true); });
    } else {
        setLocale(detectInitial(), true);
    }
})();
