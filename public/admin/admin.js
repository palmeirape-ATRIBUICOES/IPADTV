// Global state
let mediaLibrary = [];
let currentActiveMedia = null;
let selectedMediaId = null;
let checkedPlaylistIds = [];

// DOM Elements
const playerStatusBadge = document.getElementById('player-status-badge');
const playerStatusText = document.getElementById('player-status-text');
const activeMediaPreview = document.getElementById('active-media-preview');
const activeMediaTitle = document.getElementById('active-media-title');
const activeMediaType = document.getElementById('active-media-type');
const addMediaForm = document.getElementById('add-media-form');
const mediaLibraryContainer = document.getElementById('media-library');
const actionBar = document.getElementById('action-bar');
const selectedMediaName = document.getElementById('selected-media-name');
const btnDisplayNow = document.getElementById('btn-display-now');

// Playlist DOM Elements
const playlistDurationInput = document.getElementById('playlist-duration');
const btnStartPlaylist = document.getElementById('btn-start-playlist');
const btnStopPlaylist = document.getElementById('btn-stop-playlist');
const playlistStatusMsg = document.getElementById('playlist-status-msg');

// Dynamic configuration elements
const mediaTypeSelect = document.getElementById('media-type');
const mediaUrlInput = document.getElementById('media-url');
const mediaUrlLabel = document.querySelector('label[for="media-url"]');
const mediaFileGroup = document.getElementById('media-file-group');
const mediaFileInput = document.getElementById('media-file');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  fetchLibrary();
  fetchCurrentMedia();
  checkPlayerStatus();
  fetchPlaylistStatus();
  
  // Setup periodic polling
  setInterval(checkPlayerStatus, 5000);   // Check player heartbeat every 5s
  setInterval(fetchCurrentMedia, 5000);    // Update current media thumbnail every 5s
  setInterval(fetchPlaylistStatus, 5000);   // Update playlist status display every 5s
  
  // Event Listeners
  addMediaForm.addEventListener('submit', handleAddMedia);
  btnDisplayNow.addEventListener('click', handleDisplayNow);
  btnStartPlaylist.addEventListener('click', handleStartPlaylist);
  btnStopPlaylist.addEventListener('click', handleStopPlaylist);

  // Switch labels and placeholders dynamically based on media type selected
  mediaTypeSelect.addEventListener('change', () => {
    const val = mediaTypeSelect.value;
    
    // Default URL fields to not required since user can choose a file instead
    mediaUrlInput.required = false;

    if (val === 'image') {
      mediaUrlLabel.textContent = 'URL Pública da Imagem (ou envie arquivo)';
      mediaUrlInput.placeholder = 'https://exemplo.com/imagem.jpg';
      mediaFileGroup.style.display = 'block';
    } else if (val === 'video') {
      mediaUrlLabel.textContent = 'URL Pública do Vídeo MP4 (ou envie arquivo)';
      mediaUrlInput.placeholder = 'https://exemplo.com/video.mp4';
      mediaFileGroup.style.display = 'block';
    } else if (val === 'weather') {
      mediaUrlLabel.textContent = 'Coordenadas (Lat,Lon) - Opcional';
      mediaUrlInput.placeholder = 'Ex: -22.9068,-43.1729 (Vazio para Centro, RJ)';
      mediaFileGroup.style.display = 'none';
      mediaFileInput.value = '';
    } else if (val === 'news') {
      mediaUrlLabel.textContent = 'URL do Feed RSS de Esporte';
      mediaUrlInput.placeholder = 'Ex: https://g1.globo.com/dinamico/recipiente/g1/rio-de-janeiro/rss2.xml';
      mediaUrlInput.required = true; // RSS requires a URL feed
      mediaFileGroup.style.display = 'none';
      mediaFileInput.value = '';
    } else if (val === 'instagram') {
      mediaUrlLabel.textContent = 'URL do Widget Iframe (LightWidget)';
      mediaUrlInput.placeholder = 'Ex: https://lightwidget.com/widgets/sua-url-aqui.html';
      mediaUrlInput.required = true; // Instagram embed requires widget link
      mediaFileGroup.style.display = 'none';
      mediaFileInput.value = '';
    }
  });

  // Trigger initial change event to align fields
  mediaTypeSelect.dispatchEvent(new Event('change'));
});

// Fetch player status
function checkPlayerStatus() {
  fetch('/api/player-status')
    .then(res => res.json())
    .then(data => {
      if (data.status === 'online') {
        playerStatusBadge.className = 'status-badge status-online';
        playerStatusText.textContent = 'PLAYER CONECTADO';
      } else {
        playerStatusBadge.className = 'status-badge status-offline';
        playerStatusText.textContent = 'PLAYER OFFLINE';
      }
    })
    .catch(err => {
      console.error('Error fetching player status:', err);
      playerStatusBadge.className = 'status-badge status-offline';
      playerStatusText.textContent = 'ERRO SERVIDOR';
    });
}

// Fetch library
function fetchLibrary() {
  fetch('/api/media')
    .then(res => res.json())
    .then(data => {
      mediaLibrary = data;
      renderLibrary();
    })
    .catch(err => {
      console.error('Error fetching media library:', err);
      mediaLibraryContainer.innerHTML = '<div class="empty-state">Erro ao carregar mídias.</div>';
    });
}

// Fetch currently active media
function fetchCurrentMedia() {
  fetch('/api/current-media')
    .then(res => res.json())
    .then(data => {
      currentActiveMedia = data;
      renderActiveMedia();
      updateActiveCardBorder();
    })
    .catch(err => console.error('Error fetching active media:', err));
}

// Fetch playlist status
function fetchPlaylistStatus() {
  fetch('/api/playlist/status')
    .then(res => res.json())
    .then(data => {
      if (data.isActive) {
        btnStartPlaylist.style.display = 'none';
        btnStopPlaylist.style.display = 'block';
        playlistStatusMsg.textContent = `Playlist ATIVA (${data.items.length} itens, ${data.imageDuration}s)`;
        playlistStatusMsg.classList.add('active');
        
        // Auto-check items if they match the active playlist and we don't have user edits
        if (checkedPlaylistIds.length === 0) {
          checkedPlaylistIds = data.items.map(item => item.id);
          // Sync check checkboxes in DOM
          syncCheckboxSelections();
          updatePlaylistButtonState();
        }
      } else {
        btnStartPlaylist.style.display = 'block';
        btnStopPlaylist.style.display = 'none';
        playlistStatusMsg.textContent = 'Playlist inativa';
        playlistStatusMsg.classList.remove('active');
      }
    })
    .catch(err => console.error('Error fetching playlist status:', err));
}

// Render active media preview
function renderActiveMedia() {
  if (!currentActiveMedia) {
    activeMediaPreview.innerHTML = '<p class="no-active-text">Nenhuma mídia ativa selecionada</p>';
    activeMediaTitle.textContent = 'Nenhum';
    activeMediaType.className = 'badge';
    activeMediaType.textContent = 'N/A';
    return;
  }

  activeMediaTitle.textContent = currentActiveMedia.name;
  
  const typesMap = {
    image: 'Imagem',
    video: 'Vídeo',
    weather: 'Clima',
    news: 'Notícias',
    instagram: 'Instagram'
  };
  activeMediaType.textContent = typesMap[currentActiveMedia.type] || 'Widget';
  activeMediaType.className = 'badge ' + currentActiveMedia.type;

  if (currentActiveMedia.type === 'image') {
    activeMediaPreview.innerHTML = `<img src="${currentActiveMedia.url}" alt="${currentActiveMedia.name}">`;
  } else if (currentActiveMedia.type === 'video') {
    activeMediaPreview.innerHTML = `
      <div style="position:relative; width:100%; height:100%;">
        <video src="${currentActiveMedia.url}" muted style="width:100%; height:100%; object-fit:contain;"></video>
        <span style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:32px; background:rgba(0,0,0,0.6); padding:10px; border-radius:50%; line-height:1;">▶</span>
      </div>`;
  } else if (currentActiveMedia.type === 'weather') {
    activeMediaPreview.innerHTML = `<div class="preview-icon" style="font-size:40px; opacity:0.8;">☀️ Clima</div>`;
  } else if (currentActiveMedia.type === 'news') {
    activeMediaPreview.innerHTML = `<div class="preview-icon" style="font-size:40px; opacity:0.8;">📰 Notícias</div>`;
  } else if (currentActiveMedia.type === 'instagram') {
    activeMediaPreview.innerHTML = `<div class="preview-icon" style="font-size:40px; opacity:0.8;">📸 Instagram</div>`;
  }
}

// Render library grid
function renderLibrary() {
  if (mediaLibrary.length === 0) {
    mediaLibraryContainer.innerHTML = '<div class="empty-state">Nenhuma mídia cadastrada ainda.</div>';
    return;
  }

  mediaLibraryContainer.innerHTML = '';
  mediaLibrary.forEach(item => {
    const card = document.createElement('div');
    card.className = `media-item-card ${selectedMediaId === item.id ? 'selected' : ''}`;
    card.setAttribute('data-id', item.id);
    
    // Check if it is currently active on the player
    const isActive = currentActiveMedia && currentActiveMedia.id === item.id;
    if (isActive) {
      card.classList.add('active-now');
    }

    let previewContent = '';
    if (item.type === 'image') {
      previewContent = `<img src="${item.url}" alt="${item.name}">`;
    } else if (item.type === 'video') {
      previewContent = `<span class="preview-icon">🎬</span>`;
    } else if (item.type === 'weather') {
      previewContent = `<span class="preview-icon">☀️</span>`;
    } else if (item.type === 'news') {
      previewContent = `<span class="preview-icon">📰</span>`;
    } else if (item.type === 'instagram') {
      previewContent = `<span class="preview-icon">📸</span>`;
    }

    const typeLabel = {
      image: 'Imagem',
      video: 'Vídeo',
      weather: 'Clima',
      news: 'Notícias',
      instagram: 'Instagram'
    }[item.type] || 'Widget';

    card.innerHTML = `
      <div class="playlist-select-wrapper">
        <input type="checkbox" class="playlist-checkbox" data-id="${item.id}" ${checkedPlaylistIds.includes(item.id) ? 'checked' : ''}>
      </div>
      ${isActive ? '<span class="active-overlay">ATIVO</span>' : ''}
      <div class="media-item-preview">${previewContent}</div>
      <div class="media-item-info">
        <div class="media-title">${item.name}</div>
        <div class="media-item-footer">
          <span class="type-tag">${typeLabel}</span>
          <button class="btn-delete" data-id="${item.id}">🗑️</button>
        </div>
      </div>
    `;

    // Click on card to select (manual display)
    card.addEventListener('click', (e) => {
      // Prevent selection if clicking the delete button or checkbox
      if (e.target.classList.contains('btn-delete') || e.target.classList.contains('playlist-checkbox')) return;
      selectMedia(item.id);
    });

    // Checkbox change handler (playlist configuration)
    card.querySelector('.playlist-checkbox').addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      if (e.target.checked) {
        if (!checkedPlaylistIds.includes(id)) {
          checkedPlaylistIds.push(id);
        }
      } else {
        checkedPlaylistIds = checkedPlaylistIds.filter(checkedId => checkedId !== id);
      }
      updatePlaylistButtonState();
    });

    // Delete handler
    card.querySelector('.btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteMedia(item.id);
    });

    mediaLibraryContainer.appendChild(card);
  });
  
  updatePlaylistButtonState();
}

// Select a media item from the list
function selectMedia(id) {
  selectedMediaId = id;
  const item = mediaLibrary.find(i => i.id === id);
  if (!item) return;

  // Highlight in DOM
  const cards = mediaLibraryContainer.querySelectorAll('.media-item-card');
  cards.forEach(card => {
    if (card.getAttribute('data-id') === id) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  // Update Bottom Action Bar
  selectedMediaName.textContent = item.name;
  actionBar.classList.remove('hidden');
}

// Updates border colors for the active card if it refreshed in the background
function updateActiveCardBorder() {
  const cards = mediaLibraryContainer.querySelectorAll('.media-item-card');
  cards.forEach(card => {
    const id = card.getAttribute('data-id');
    const isActive = currentActiveMedia && currentActiveMedia.id === id;
    
    // Toggle active classes
    if (isActive) {
      card.classList.add('active-now');
      if (!card.querySelector('.active-overlay')) {
        const overlay = document.createElement('span');
        overlay.className = 'active-overlay';
        overlay.textContent = 'ATIVO';
        card.appendChild(overlay);
      }
    } else {
      card.classList.remove('active-now');
      const overlay = card.querySelector('.active-overlay');
      if (overlay) overlay.remove();
    }
  });
}

// Update the checked state of HTML checkboxes to match checkedPlaylistIds
function syncCheckboxSelections() {
  const checkboxes = mediaLibraryContainer.querySelectorAll('.playlist-checkbox');
  checkboxes.forEach(cb => {
    const id = cb.getAttribute('data-id');
    cb.checked = checkedPlaylistIds.includes(id);
  });
}

// Enable/disable the Start Playlist button based on selection count
function updatePlaylistButtonState() {
  if (checkedPlaylistIds.length > 0) {
    btnStartPlaylist.disabled = false;
  } else {
    btnStartPlaylist.disabled = true;
  }
}

// Submit media form
function handleAddMedia(e) {
  e.preventDefault();
  
  const name = document.getElementById('media-name').value;
  const type = document.getElementById('media-type').value;
  let url = document.getElementById('media-url').value;
  const file = mediaFileInput.files[0];

  const submitButton = addMediaForm.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.textContent;

  // Validation: Check that the user has supplied either a file or a URL (or coordinates for weather)
  if (type !== 'weather' && !url && !file) {
    alert("Por favor, insira uma URL ou selecione um arquivo local para fazer o envio.");
    return;
  }

  // Set default coordinates if adding weather widget and coordinates are left blank
  if (type === 'weather' && !url) {
    url = '-22.9068,-43.1729'; // Default coords for Centro, Rio de Janeiro
  }

  submitButton.disabled = true;
  submitButton.textContent = "Carregando mídia...";

  // Check if a local file was selected to perform upload
  if (file) {
    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
      .then(res => {
        if (!res.ok) throw new Error('Falha no upload do arquivo');
        return res.json();
      })
      .then(data => {
        // Use returned local path as media URL
        saveMediaMetadata(name, type, data.url, submitButton, originalButtonText);
      })
      .catch(err => {
        console.error(err);
        alert('Erro ao fazer upload do arquivo. Tente novamente.');
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      });
  } else {
    // Normal link-based save
    saveMediaMetadata(name, type, url, submitButton, originalButtonText);
  }
}

// Saves media metadata to database
function saveMediaMetadata(name, type, url, submitButton, originalButtonText) {
  fetch('/api/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type, url })
  })
    .then(res => {
      if (!res.ok) throw new Error('Failed to save media metadata');
      return res.json();
    })
    .then(() => {
      addMediaForm.reset();
      
      // Reset labels and fields to default 'image' style
      mediaUrlLabel.textContent = 'URL Pública da Imagem';
      mediaUrlInput.placeholder = 'https://exemplo.com/imagem.jpg';
      
      fetchLibrary();
    })
    .catch(err => {
      console.error(err);
      alert('Erro ao cadastrar mídia. Verifique os dados.');
    })
    .finally(() => {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    });
}

// Display selected media on iPad (Manual display)
function handleDisplayNow() {
  if (!selectedMediaId) return;

  fetch('/api/select-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: selectedMediaId })
  })
    .then(res => {
      if (!res.ok) throw new Error('Failed to display media');
      return res.json();
    })
    .then(data => {
      currentActiveMedia = data;
      renderActiveMedia();
      updateActiveCardBorder();
      fetchPlaylistStatus(); // Stop playlist in UI since manual override happened
      
      // Hide and reset selection
      actionBar.classList.add('hidden');
      selectedMediaId = null;
      const cards = mediaLibraryContainer.querySelectorAll('.media-item-card');
      cards.forEach(card => card.classList.remove('selected'));
    })
    .catch(err => {
      console.error(err);
      alert('Erro ao enviar conteúdo ao iPad.');
    });
}

// Start playlist
function handleStartPlaylist() {
  if (checkedPlaylistIds.length === 0) return;
  const duration = playlistDurationInput.value;

  fetch('/api/playlist/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: checkedPlaylistIds, duration: duration })
  })
    .then(res => {
      if (!res.ok) throw new Error('Failed to start playlist');
      return res.json();
    })
    .then(data => {
      currentActiveMedia = data.currentMedia;
      renderActiveMedia();
      updateActiveCardBorder();
      fetchPlaylistStatus();
    })
    .catch(err => {
      console.error(err);
      alert('Erro ao iniciar playlist no iPad.');
    });
}

// Stop playlist
function handleStopPlaylist() {
  fetch('/api/playlist/stop', {
    method: 'POST'
  })
    .then(res => {
      if (!res.ok) throw new Error('Failed to stop playlist');
      return res.json();
    })
    .then(() => {
      fetchPlaylistStatus();
    })
    .catch(err => {
      console.error(err);
      alert('Erro ao parar playlist.');
    });
}

// Delete media
function deleteMedia(id) {
  if (!confirm('Deseja realmente remover esta mídia da biblioteca?')) return;

  fetch(`/api/media/${id}`, {
    method: 'DELETE'
  })
    .then(res => {
      if (!res.ok) throw new Error('Failed to delete media');
      return res.json();
    })
    .then(() => {
      // Clear checkbox selections for deleted id
      checkedPlaylistIds = checkedPlaylistIds.filter(checkedId => checkedId !== id);
      
      if (selectedMediaId === id) {
        actionBar.classList.add('hidden');
        selectedMediaId = null;
      }
      fetchLibrary();
      fetchCurrentMedia();
      fetchPlaylistStatus();
    })
    .catch(err => {
      console.error(err);
      alert('Erro ao excluir mídia.');
    });
}
