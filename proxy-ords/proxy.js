const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();

// habilita CORS para permitir llamadas desde tu frontend en localhost:3000
app.use(cors({ origin: 'http://localhost:3000' }));

// Apunta a la raíz de tu esquema en ORDS
const ORDS_URL = 'https://ga6f1d821261f2a-migodb.adb.mx-queretaro-1.oraclecloudapps.com/ords/migo_user/';

// Middleware para manejar preflight OPTIONS
app.options('/api', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

// Proxy para todas las rutas bajo /api
app.use('/api', createProxyMiddleware({
  target: ORDS_URL,
  changeOrigin: true,
  pathRewrite: { '^/api': '' },
  onProxyRes: (proxyRes) => {
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
}));

app.listen(4000, () => {
  console.log('Proxy corriendo en http://localhost:4000');
});
