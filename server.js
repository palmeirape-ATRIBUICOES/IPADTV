const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initial database state
const defaultDb = {
  mediaList: [
    {
      id: "1",
      name: "Imagem Colorida (Padrão)",
      type: "image",
      url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1000"
    },
    {
      id: "2",
      name: "Imagem de Natureza",
      type: "image",
      url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1000"
    },
    {
      id: "3",
      name: "Vídeo Loop (Big Buck Bunny)",
      type: "video",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
    }
  ],
  currentMedia: {
    id: "1",
    name: "Imagem Colorida (Padrão)",
    type: "image",
    url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1000",
    version: 1
  },
  lastHeartbeat: null
};

// Helper to read database
function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDb(defaultDb);
      return defaultDb;
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database file. Reverting to default:", err);
    return defaultDb;
  }
}

// Helper to write database
function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Error writing database file:", err);
  }
}

// API: Get all media in library
app.get('/api/media', (req, res) => {
  const db = readDb();
  res.json(db.mediaList);
});

// API: Add a new media to the library
app.post('/api/media', (req, res) => {
  const { name, type, url } = req.body;
  if (!name || !type || !url) {
    return res.status(400).json({ error: "Missing required fields (name, type, url)" });
  }
  if (type !== 'image' && type !== 'video') {
    return res.status(400).json({ error: "Type must be either 'image' or 'video'" });
  }

  const db = readDb();
  const newItem = {
    id: Date.now().toString(),
    name,
    type,
    url
  };
  db.mediaList.push(newItem);
  writeDb(db);

  res.status(201).json(newItem);
});

// API: Delete a media from the library
app.delete('/api/media/:id', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const index = db.mediaList.findIndex(item => item.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Media not found" });
  }
  db.mediaList.splice(index, 1);
  writeDb(db);
  res.json({ success: true });
});

// API: Get currently active media
app.get('/api/current-media', (req, res) => {
  const db = readDb();
  res.json(db.currentMedia || null);
});

// API: Select media to display on the player
app.post('/api/select-media', (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "Missing media ID" });
  }

  const db = readDb();
  const selected = db.mediaList.find(item => item.id === id);
  if (!selected) {
    return res.status(404).json({ error: "Media not found in library" });
  }

  const currentVersion = (db.currentMedia && db.currentMedia.version) || 0;
  
  db.currentMedia = {
    ...selected,
    version: currentVersion + 1
  };
  writeDb(db);

  res.json(db.currentMedia);
});

// API: Heartbeat ping from the iPad player
app.post('/api/heartbeat', (req, res) => {
  const db = readDb();
  db.lastHeartbeat = Date.now();
  writeDb(db);
  res.json({ success: true, timestamp: db.lastHeartbeat });
});

// API: Check player status (Online if heartbeat received in last 20 seconds)
app.get('/api/player-status', (req, res) => {
  const db = readDb();
  const now = Date.now();
  const threshold = 20000; // 20 seconds
  const online = db.lastHeartbeat && (now - db.lastHeartbeat < threshold);
  
  res.json({
    status: online ? "online" : "offline",
    lastHeartbeat: db.lastHeartbeat,
    secondsSinceLast: db.lastHeartbeat ? Math.round((now - db.lastHeartbeat) / 1000) : null
  });
});

// Fallback to index.html for undefined UI routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`===================================================`);
  console.log(`Mini Signage Server started on port ${PORT}`);
  console.log(`Access Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`Access Player:      http://localhost:${PORT}/player`);
  console.log(`===================================================`);
});
