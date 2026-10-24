const express = require('express');
const cors = require('cors');
const path = require('path');
const { errorHandler } = require('./common/middleware/errorHandler');
const routes = require('./routes');

const app = express();

app.use(cors({
  origin: true, // Set to true to reflect the request origin
  credentials: true,
}));
app.use(express.json());

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[HTTP ${new Date().toLocaleTimeString('ar-EG')}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.use('/api', routes);

// Serve static frontend files (Single-port production architecture)
const frontendDist = path.join(__dirname, '../../frontend/dist');

// Disable caching for HTML so any browser immediately fetches updates
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && (!req.path.includes('.') || req.path.endsWith('.html'))) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use(express.static(frontendDist));

// SPA fallback for frontend client-side routing
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) next();
    });
  }
  next();
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
