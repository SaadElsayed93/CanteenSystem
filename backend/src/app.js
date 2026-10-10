const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./common/middleware/errorHandler');
const routes = require('./routes');

const app = express();

app.use(cors({
  origin: true, // Set to true to reflect the request origin
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
