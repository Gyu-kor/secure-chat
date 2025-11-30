const MAX_USERS = 3;
const SCROLL_THRESHOLD_PX = 100;
const IMAGE_MAX_SIZE_PX = 1200;
const IMAGE_COMPRESSION_QUALITY = 0.7;
const SCROLL_DELAYS_MS = [0, 50, 150, 300];
const KEYBOARD_ANIMATION_DELAY_MS = 300;
const SESSION_EXPIRED_COUNTDOWN_SECONDS = 3;

const WEBRTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image'
};

const CONNECTION_STATES = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed'
};

const DATA_CHANNEL_STATES = {
  OPEN: 'open',
  CLOSED: 'closed',
  CONNECTING: 'connecting'
};


