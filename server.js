const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for local uploads
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

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
    },
    {
      id: "widget-weather-centro",
      name: "Clima - Centro RJ",
      type: "weather",
      url: "-22.9068,-43.1729"
    },
    {
      id: "widget-weather-copacabana",
      name: "Clima - Copacabana RJ",
      type: "weather",
      url: "-22.9698,-43.1864"
    },
    {
      id: "widget-weather-barra",
      name: "Clima - Barra RJ",
      type: "weather",
      url: "-22.9997,-43.3602"
    },
    {
      id: "widget-news-rj",
      name: "G1 Notícias - Rio de Janeiro",
      type: "news",
      url: "https://g1.globo.com/dinamico/recipiente/g1/rio-de-janeiro/rss2.xml"
    },
    {
      id: "widget-instagram",
      name: "Instagram Embed",
      type: "instagram",
      url: "https://lightwidget.com/widgets/placeholder.html"
    }
  ],
  currentMedia: {
    id: "1",
    name: "Imagem Colorida (Padrão)",
    type: "image",
    url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1000",
    version: 1
  },
  lastHeartbeat: null,
  playlist: {
    isActive: false,
    items: [],
    imageDuration: 10,
    currentIndex: 0,
    lastSwitchTime: 0
  }
};

// Custom RSS Regex Parser (Zero external dependency)
function parseRss(xml) {
  const items = [];
  // Match each <item> block
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  
  for (const itemXml of itemMatches) {
    // Extract title (handles CDATA and plain text)
    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemXml.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemXml.match(/<description>([\s\S]*?)<\/description>/);
    
    // Attempt to extract image URL (media:content, media:thumbnail, or img tag inside description)
    let imageUrl = '';
    const mediaMatch = itemXml.match(/<media:content[^>]*url="([^"]+)"/) || itemXml.match(/<media:thumbnail[^>]*url="([^"]+)"/);
    if (mediaMatch) {
      imageUrl = mediaMatch[1];
    } else if (descMatch) {
      const imgInDesc = descMatch[1].match(/<img[^>]*src="([^"]+)"/);
      if (imgInDesc) imageUrl = imgInDesc[1];
    }
    
    if (titleMatch && linkMatch) {
      items.push({
        title: titleMatch[1].trim(),
        link: linkMatch[1].trim(),
        description: descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim().substring(0, 150) + '...' : '',
        imageUrl: imageUrl
      });
    }
  }
  return items.slice(0, 8); // top 8 articles
}

// Helper to read database
function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDb(defaultDb);
      return defaultDb;
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const db = JSON.parse(data);
    
    // Auto-migrate: check if default widgets or items are missing and add them
    let migrated = false;
    defaultDb.mediaList.forEach(defaultItem => {
      const exists = db.mediaList.some(item => item.id === defaultItem.id);
      if (!exists) {
        db.mediaList.push(defaultItem);
        migrated = true;
      }
    });
    
    if (migrated) {
      console.log("Database migrated: added missing default widget options.");
      writeDb(db);
    }
    
    return db;
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
  
  // Auto-advance playlist if active
  if (db.playlist && db.playlist.isActive && db.playlist.items.length > 0) {
    const now = Date.now();
    const durationMs = (db.playlist.imageDuration || 10) * 1000;
    const elapsed = now - db.playlist.lastSwitchTime;
    
    if (elapsed >= durationMs) {
      const steps = Math.floor(elapsed / durationMs);
      db.playlist.currentIndex = (db.playlist.currentIndex + steps) % db.playlist.items.length;
      db.playlist.lastSwitchTime = now - (elapsed % durationMs);
      
      const nextMedia = db.playlist.items[db.playlist.currentIndex];
      const currentVersion = (db.currentMedia && db.currentMedia.version) || 0;
      
      db.currentMedia = {
        ...nextMedia,
        version: currentVersion + 1
      };
      writeDb(db);
    }
  }

  res.json(db.currentMedia || null);
});

// API: File Upload Endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado" });
  }
  // Return relative URL for static loading
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
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

  // Deactivate playlist on manual selection
  if (db.playlist) {
    db.playlist.isActive = false;
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

// API: Start Playlist Autoplay
app.post('/api/playlist/start', (req, res) => {
  const { ids, duration } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Missing or invalid media IDs array" });
  }

  const db = readDb();
  const playlistItems = db.mediaList.filter(item => ids.includes(item.id));
  if (playlistItems.length === 0) {
    return res.status(400).json({ error: "None of the selected media items exist in the library" });
  }

  const imageDuration = parseInt(duration) || 10;
  const now = Date.now();

  db.playlist = {
    isActive: true,
    items: playlistItems,
    imageDuration,
    currentIndex: 0,
    lastSwitchTime: now
  };

  // Instantly transition to the first item in the playlist
  const currentVersion = (db.currentMedia && db.currentMedia.version) || 0;
  db.currentMedia = {
    ...playlistItems[0],
    version: currentVersion + 1
  };
  writeDb(db);

  res.json({ success: true, playlist: db.playlist, currentMedia: db.currentMedia });
});

// API: Stop Playlist Autoplay
app.post('/api/playlist/stop', (req, res) => {
  const db = readDb();
  if (db.playlist) {
    db.playlist.isActive = false;
  }
  writeDb(db);
  res.json({ success: true, playlist: db.playlist });
});

// API: Get current Playlist status
app.get('/api/playlist/status', (req, res) => {
  const db = readDb();
  res.json(db.playlist || { isActive: false, items: [], imageDuration: 10 });
});

// API: Weather forecast proxy (Open-Meteo)
app.get('/api/widgets/weather', (req, res) => {
  const lat = req.query.lat || '-8.5307';
  const lon = req.query.lon || '-36.4357';
  
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=America/Sao_Paulo`;
  
  https.get(weatherUrl, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      try {
        const json = JSON.parse(data);
        res.json(json);
      } catch (e) {
        res.status(500).json({ error: "Failed to parse weather data" });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: "Failed to fetch weather: " + err.message });
  });
});

// API: Sports RSS Feed proxy
app.get('/api/widgets/news', (req, res) => {
  const feedUrl = req.query.url || 'https://ge.globo.com/servico/sem-patrocinio/rss/cogumelo/rss2.xml';
  
  https.get(feedUrl, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      try {
        const parsedNews = parseRss(data);
        res.json(parsedNews);
      } catch (e) {
        res.status(500).json({ error: "Failed to parse RSS feed data" });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: "Failed to fetch RSS: " + err.message });
  });
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
