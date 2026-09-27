"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const investigation_1 = __importDefault(require("./routes/investigation"));
const gitService_1 = require("./services/gitService");
const app = (0, express_1.default)();
const PORT = parseInt(String(process.env['PORT'] ?? '3001'), 10);
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '1mb' }));
// Root and health check
app.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'ReproForge backend is running', health: '/api/health' });
});
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});
// Validate GitHub URL without starting investigation
app.post('/api/validate-url', (req, res) => {
    const { url } = req.body;
    if (!url) {
        res.status(400).json({ valid: false, error: 'url is required.' });
        return;
    }
    const result = (0, gitService_1.validateGitHubUrl)(url);
    res.json(result);
});
app.use('/api/investigation', investigation_1.default);
const server = app.listen(PORT, () => {
    console.log(`ReproForge backend running on http://localhost:${PORT}`);
});
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Kill the existing process first:`);
        console.error(`  Get-NetTCPConnection -LocalPort ${PORT} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
        process.exit(1);
    }
    else {
        throw err;
    }
});
//# sourceMappingURL=server.js.map