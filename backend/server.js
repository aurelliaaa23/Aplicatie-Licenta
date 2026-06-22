require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');

// Adaugă linia asta sub app.use(express.json());


const { sequelize, Rol } = require('./models');

// ── Rute ────────────────────────────────────────────────
const authRoutes        = require('./routes/auth.routes');
const dosareRoutes      = require('./routes/dosare.routes');
const documenteRoutes   = require('./routes/documente.routes');
const programariRoutes  = require('./routes/programari.routes');
const notificariRoutes  = require('./routes/notificari.routes');

const app    = express();
const server = http.createServer(app);

// ── Socket.IO ────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, methods: ['GET', 'POST'] },
});
app.set('io', io);

// ── Middleware-uri globale ────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// ── Rute API ─────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/dosare',     dosareRoutes);
app.use('/api/documente',  documenteRoutes);
app.use('/api/programari', programariRoutes);
app.use('/api/notificari', notificariRoutes);

// ── Rută de test ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Erori globale ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Eroare server:', err.stack);
  res.status(500).json({ eroare: err.message || 'Eroare internă server' });
});

// ── Socket.IO events ─────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Socket conectat: ${socket.id}`);

  socket.on('join_room', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`👤 User ${userId} în camera sa`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket deconectat: ${socket.id}`);
  });
});

// ── Pornire server ────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function pornireSever() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexiune MySQL stabilită');

    await sequelize.sync({ alter: true });
    console.log('✅ Modele sincronizate');

    // Roluri inițiale
    const roluriInitiale = [
      'cetățean', 'funcționar', 'medic',
      'funcționar_primărie', 'reprezentant_școală',
      'manager', 'administrator',
    ];
    for (const numeRol of roluriInitiale) {
      await Rol.findOrCreate({ where: { nume: numeRol } });
    }
    console.log('✅ Roluri inițializate');

    server.listen(PORT, () => {
      console.log(`🚀 Server pornit pe portul ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Eroare pornire server:', err);
    process.exit(1);
  }
}

pornireSever();