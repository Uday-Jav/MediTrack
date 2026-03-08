import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, X, Stethoscope } from 'lucide-react';
import ChatMessage from './ChatMessage';
import { getChatHistory, sendChatMessage, streamChatMessage } from '../services/api';
import { useAppSettings } from '../context/AppSettingsContext';

const QUICK_SYMPTOMS = [
  'I have a mild fever and sore throat.',
  'I have a headache and body pain.',
  'I have cough with a runny nose.',
  'I feel acidity and mild stomach pain.',
];

const CHAT_HISTORY_PREFIX = 'medivault_chat_history_';

const getUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.id || user.userId || '';
  } catch {
    return '';
  }
};

const toUiMessages = (messages) =>
  messages.map((entry, index) => ({
    id: `${entry.role}-${entry.createdAt || Date.now()}-${index}`,
    role: entry.role,
    content: entry.content,
    createdAt: entry.createdAt || new Date().toISOString(),
  }));

const ChatWidget = () => {
  const { language } = useAppSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const scrollRef = useRef(null);
  const userId = useMemo(() => getUserId(), []);
  const storageKey = `${CHAT_HISTORY_PREFIX}${userId || 'guest'}`;

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.messages)) {
        setMessages(parsed.messages);
      }
      if (parsed.conversationId) {
        setConversationId(parsed.conversationId);
      }
    } catch {
      // ignore invalid local cache
    }
  }, [storageKey]);

  useEffect(() => {
    const persistedMessages = messages
      .filter((entry) => !entry.streaming)
      .slice(-40);

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        conversationId,
        messages: persistedMessages,
      })
    );
  }, [conversationId, messages, storageKey]);

  useEffect(() => {
    if (!isOpen || historyLoaded || !userId || messages.length > 0) {
      return;
    }

    let isMounted = true;
    const loadHistory = async () => {
      try {
        const response = await getChatHistory(userId, { conversationId, limit: 20 });
        if (!isMounted || !Array.isArray(response?.messages) || response.messages.length === 0) {
          return;
        }

        setConversationId(response.conversationId || conversationId);
        setMessages(toUiMessages(response.messages));
      } catch {
        // keep local-first behavior
      } finally {
        if (isMounted) {
          setHistoryLoaded(true);
        }
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [conversationId, historyLoaded, isOpen, messages.length, userId]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

  const updateAssistantMessage = (assistantId, updater) => {
    setMessages((prev) =>
      prev.map((entry) => (entry.id === assistantId ? { ...entry, ...updater(entry) } : entry))
    );
  };

  const sendMessage = async (rawText) => {
    const messageText = String(rawText || '').trim();
    if (!messageText || isSending) {
      return;
    }

    const resolvedUserId = userId || 'anonymous-user';
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      createdAt: new Date().toISOString(),
    };
    const assistantId = `assistant-${Date.now()}`;

    setInput('');
    setErrorMessage('');
    setIsSending(true);
    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        streaming: true,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      let streamedText = '';
      const streamResult = await streamChatMessage(
        {
          userId: resolvedUserId,
          message: messageText,
          language,
          conversationId: conversationId || undefined,
        },
        {
          onChunk: (chunk) => {
            streamedText += chunk;
            updateAssistantMessage(assistantId, () => ({
              content: streamedText,
              streaming: true,
            }));
          },
        }
      );

      const finalReply = streamResult?.reply || streamedText;
      const nextConversationId = streamResult?.conversationId || conversationId;

      if (nextConversationId) {
        setConversationId(nextConversationId);
      }

      updateAssistantMessage(assistantId, () => ({
        content: finalReply,
        streaming: false,
      }));
    } catch (streamError) {
      try {
        const fallback = await sendChatMessage({
          userId: resolvedUserId,
          message: messageText,
          language,
          conversationId: conversationId || undefined,
        });

        if (fallback?.conversationId) {
          setConversationId(fallback.conversationId);
        }

        updateAssistantMessage(assistantId, () => ({
          content: fallback?.reply || 'I could not generate a response. Please try again.',
          streaming: false,
        }));
      } catch (error) {
        updateAssistantMessage(assistantId, () => ({
          content: 'Unable to contact the medical assistant right now. Please try again shortly.',
          streaming: false,
        }));
        setErrorMessage(error.message || 'Unable to send message.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await sendMessage(input);
  };

  const handleInputKeyDown = async (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await sendMessage(input);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60]" data-no-translate="false">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-full bg-gradient-to-r from-brand-500 to-brand-600 p-4 text-white shadow-glow hover:scale-105 transition-transform"
          aria-label="Open medical assistant chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      ) : (
        <div className="w-[22rem] max-w-[calc(100vw-1.5rem)] h-[34rem] max-h-[75vh] rounded-3xl border border-slate-200 bg-slate-50/95 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden dark:bg-slate-900/95 dark:border-slate-700">
          <div className="px-4 py-3 bg-gradient-to-r from-brand-600 to-accent-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              <div>
                <p className="text-sm font-semibold">AI Medical Assistant</p>
                <p className="text-[11px] text-brand-100">For guidance only, not diagnosis</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 hover:bg-white/20 transition-colors"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="rounded-xl bg-white p-3 border border-slate-200 text-xs text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
                Share your symptoms and I will suggest possible minor conditions, safe home care, and when to see a doctor.
              </div>
            )}

            {messages.length <= 1 && (
              <div className="grid grid-cols-1 gap-2">
                {QUICK_SYMPTOMS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => sendMessage(suggestion)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 hover:border-brand-300 hover:text-brand-700 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {messages.map((entry) => (
              <ChatMessage key={entry.id} message={entry} />
            ))}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 dark:border-slate-700 p-3 bg-white/80 dark:bg-slate-900/80">
            {errorMessage && <p className="mb-2 text-xs text-red-600">{errorMessage}</p>}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleInputKeyDown}
                rows={1}
                placeholder="Describe your symptoms..."
                className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="rounded-xl bg-brand-600 p-2.5 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;

