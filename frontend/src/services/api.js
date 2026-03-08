import axios from 'axios';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      if (!url.includes('/auth/')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

const parseFileRef = (fileRefOrUrl) => {
  const rawValue = String(fileRefOrUrl || '').trim();
  if (!rawValue) {
    return '';
  }

  const extractFromPath = (pathname) => {
    const normalized = String(pathname || '').split('?')[0].split('#')[0];
    const parts = normalized.split('/').filter(Boolean);
    const fileIndex = parts.findIndex((part) => part === 'file');

    if (fileIndex >= 0 && parts[fileIndex + 1]) {
      return parts[fileIndex + 1];
    }

    return parts[parts.length - 1] || '';
  };

  try {
    const url = new URL(rawValue);
    return extractFromPath(url.pathname);
  } catch {
    return extractFromPath(rawValue) || rawValue;
  }
};

const throwForBadResponse = async (response) => {
  if (response.ok) {
    return;
  }

  let message = `Request failed with status ${response.status}`;
  try {
    const payload = await response.json();
    message = payload?.message || payload?.error || message;
  } catch {
    // ignore parse errors
  }

  throw new Error(message);
};

// ---------- Auth ----------
export const loginUser = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response.data;
};

export const registerUser = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

export const forgotPassword = async (email) => {
  const response = await api.post('/auth/forgot-password', { email });
  return response.data;
};

export const resetPassword = async (token, newPassword) => {
  const response = await api.post('/auth/reset-password', { token, newPassword });
  return response.data;
};

// ---------- Records ----------
export const uploadRecord = async (formData) => {
  const response = await api.post('/records/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getRecords = async (patientId, search = '') => {
  const params = search ? { search } : {};
  const idOrMe = patientId || 'me';
  const response = await api.get(`/records/${idOrMe}`, { params });
  return response.data;
};

export const getRecentRecords = async (patientId, limit = 5) => {
  const idOrMe = patientId || 'me';
  const response = await api.get(`/records/${idOrMe}/recent`, { params: { limit } });
  return response.data;
};

export const getVaultStatus = async (patientId) => {
  if (!patientId) {
    const response = await api.get('/records/vault-status');
    return response.data;
  }

  const response = await api.get(`/records/${patientId}/vault-status`);
  return response.data;
};

export const deleteRecordFile = async (fileRefOrUrl, password) => {
  const fileRef = parseFileRef(fileRefOrUrl);
  const response = await api.delete(`/records/file/${encodeURIComponent(fileRef)}`, {
    data: { password },
  });
  return response.data;
};

export const updateRecordFile = async (fileRefOrUrl, payload) => {
  const fileRef = parseFileRef(fileRefOrUrl);
  const response = await api.patch(`/records/file/${encodeURIComponent(fileRef)}`, payload);
  return response.data;
};

export const refreshVaultStatus = async () => {
  const response = await api.get('/records/vault-status');
  return response.data;
};

// ---------- Chat ----------
export const sendChatMessage = async ({ userId, message, language = 'en', conversationId }) => {
  const response = await api.post('/chat', {
    userId,
    message,
    language,
    conversationId,
    stream: false,
  });
  return response.data;
};

export const getChatHistory = async (userId, { conversationId, limit = 20 } = {}) => {
  const response = await api.get(`/chat/history/${encodeURIComponent(userId)}`, {
    params: {
      conversationId,
      limit,
    },
  });
  return response.data;
};

export const streamChatMessage = async (
  { userId, message, language = 'en', conversationId },
  { onChunk, onDone, onError } = {}
) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      userId,
      message,
      language,
      conversationId,
      stream: true,
    }),
  });

  await throwForBadResponse(response);

  if (!response.body) {
    throw new Error('Streaming is not supported by the current browser/runtime.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let donePayload = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      const lines = event.split('\n');
      const dataLine = lines.find((line) => line.startsWith('data: '));
      if (!dataLine) {
        continue;
      }

      let payload = null;
      try {
        payload = JSON.parse(dataLine.slice(6));
      } catch {
        continue;
      }

      if (payload.type === 'chunk' && payload.content) {
        onChunk?.(payload.content);
      } else if (payload.type === 'done') {
        donePayload = payload;
        onDone?.(payload);
      } else if (payload.type === 'error') {
        const streamError = new Error(payload.message || 'Chat streaming failed.');
        onError?.(streamError);
        throw streamError;
      }
    }
  }

  return donePayload;
};

// ---------- Translation ----------
export const translateText = async ({ text, targetLanguage, sourceLanguage = 'auto' }) => {
  const response = await api.post('/translate', {
    text,
    targetLanguage,
    sourceLanguage,
  });
  return response.data;
};

export const translateBatch = async ({ texts, targetLanguage, sourceLanguage = 'auto' }) => {
  const response = await api.post('/translate/batch', {
    texts,
    targetLanguage,
    sourceLanguage,
  });
  return response.data;
};

export default api;
