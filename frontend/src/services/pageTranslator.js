import { translateBatch } from './api';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);
const ATTRIBUTE_NAMES = ['placeholder', 'title', 'aria-label'];
const MAX_CACHE_SIZE = 8000;

const originalTextMap = new WeakMap();
const originalAttributeMap = new WeakMap();
const translationCache = new Map();

let runCounter = 0;

const trimCache = () => {
  while (translationCache.size > MAX_CACHE_SIZE) {
    const oldestKey = translationCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    translationCache.delete(oldestKey);
  }
};

const cacheKey = (text, language) => `${language}:${text}`;

const rememberOriginalText = (node) => {
  if (!originalTextMap.has(node)) {
    originalTextMap.set(node, node.nodeValue || '');
  }
  return originalTextMap.get(node) || '';
};

const rememberOriginalAttribute = (element, attrName) => {
  if (!originalAttributeMap.has(element)) {
    originalAttributeMap.set(element, {});
  }

  const map = originalAttributeMap.get(element);
  if (!(attrName in map)) {
    map[attrName] = element.getAttribute(attrName) || '';
  }
  return map[attrName];
};

const shouldSkipNode = (node) => {
  if (!node || !node.parentElement) {
    return true;
  }

  if (node.parentElement.closest('[data-no-translate="true"]')) {
    return true;
  }

  return SKIP_TAGS.has(node.parentElement.tagName);
};

const splitPadding = (value) => {
  const text = String(value || '');
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return {
    prefix: match?.[1] || '',
    content: match?.[2] || '',
    suffix: match?.[3] || '',
  };
};

const collectTextEntries = (root = document.body) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const entries = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (shouldSkipNode(node)) {
      continue;
    }

    const original = rememberOriginalText(node);
    if (!original || !original.trim()) {
      continue;
    }

    entries.push({ node, original });
  }

  return entries;
};

const collectAttributeEntries = (root = document.body) => {
  const entries = [];
  const selector = ATTRIBUTE_NAMES.map((attr) => `[${attr}]`).join(',');
  const elements = root.querySelectorAll(selector);

  elements.forEach((element) => {
    if (element.closest('[data-no-translate="true"]')) {
      return;
    }

    ATTRIBUTE_NAMES.forEach((attrName) => {
      if (!element.hasAttribute(attrName)) {
        return;
      }

      const original = rememberOriginalAttribute(element, attrName);
      if (!original || !original.trim()) {
        return;
      }

      entries.push({
        element,
        attrName,
        original,
      });
    });
  });

  return entries;
};

const resolveTranslations = async (texts, targetLanguage) => {
  const pending = [];
  const resultMap = new Map();

  texts.forEach((text) => {
    const key = cacheKey(text, targetLanguage);
    if (translationCache.has(key)) {
      resultMap.set(text, translationCache.get(key));
      return;
    }
    pending.push(text);
  });

  if (pending.length > 0) {
    const { translatedTexts } = await translateBatch({
      texts: pending,
      targetLanguage,
      sourceLanguage: 'auto',
    });

    pending.forEach((entry, index) => {
      const translated = translatedTexts?.[index] || entry;
      resultMap.set(entry, translated);
      translationCache.set(cacheKey(entry, targetLanguage), translated);
    });
    trimCache();
  }

  return resultMap;
};

const restoreOriginalContent = (textEntries, attributeEntries) => {
  textEntries.forEach(({ node, original }) => {
    node.nodeValue = original;
  });

  attributeEntries.forEach(({ element, attrName, original }) => {
    element.setAttribute(attrName, original);
  });
};

export const applyPageTranslation = async (targetLanguage) => {
  if (typeof document === 'undefined' || !document.body) {
    return;
  }

  const currentRun = ++runCounter;
  const textEntries = collectTextEntries(document.body);
  const attributeEntries = collectAttributeEntries(document.body);

  if (targetLanguage === 'en') {
    restoreOriginalContent(textEntries, attributeEntries);
    return;
  }

  const textLookup = textEntries.map(({ original }) => splitPadding(original).content).filter(Boolean);
  const attributeLookup = attributeEntries.map(({ original }) => original.trim()).filter(Boolean);
  const uniqueTexts = [...new Set([...textLookup, ...attributeLookup])];

  if (uniqueTexts.length === 0) {
    return;
  }

  const translatedMap = await resolveTranslations(uniqueTexts, targetLanguage);
  if (currentRun !== runCounter) {
    return;
  }

  textEntries.forEach(({ node, original }) => {
    const { prefix, content, suffix } = splitPadding(original);
    const translated = translatedMap.get(content) || content;
    node.nodeValue = `${prefix}${translated}${suffix}`;
  });

  attributeEntries.forEach(({ element, attrName, original }) => {
    const translated = translatedMap.get(original.trim()) || original;
    element.setAttribute(attrName, translated);
  });
};

