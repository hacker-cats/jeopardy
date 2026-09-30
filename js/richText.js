// Rich text rendering for questions and answers
//
// Supported syntax:
//   ```lang\ncode\n```   fenced code block (syntax highlighted when lang is given)
//   `code`               inline code
//   ![alt](url)          embedded image, video file, or YouTube video
//   [text](url)          clickable link
//   https://...          bare URLs become clickable links
//
// Everything is built with DOM APIs (textContent, createTextNode) to prevent XSS.
// Only highlight.js output is assigned via innerHTML, and it escapes its input.

// Matches one inline token: `code`, ![alt](url), [text](url), or a bare URL
const INLINE_TOKEN_PATTERN = /(`[^`]+`|!\[[^\]]*\]\([^)\s]+\)|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s<]+)/g;

const VIDEO_FILE_PATTERN = /\.(mp4|webm|ogg|ogv|mov)([?#]|$)/i;
const YOUTUBE_PATTERN = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i;

// Render text into element, replacing its contents
function renderFormattedText(element, text) {
  element.innerHTML = '';
  element.classList.remove('has-code', 'has-media');

  if (!text) return;

  // All content goes in one wrapper so flex-centered containers keep text flowing inline
  const wrapper = document.createElement('div');
  wrapper.className = 'formatted-text';
  element.appendChild(wrapper);

  // Split on fenced code blocks: ```lang\ncode\n```
  const parts = String(text).split(/(```\w*\n[\s\S]*?```)/g);

  parts.forEach(part => {
    if (!part) return;

    const codeBlockMatch = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
    if (codeBlockMatch) {
      const language = codeBlockMatch[1];
      const code = codeBlockMatch[2].replace(/\n$/, '');
      wrapper.appendChild(createCodeBlock(code, language));
      element.classList.add('has-code');
    } else {
      renderInlineText(wrapper, part);
    }
  });

  if (wrapper.querySelector('.rich-media')) {
    element.classList.add('has-media');
  }
}

// Build a <pre><code> block, syntax highlighted if highlight.js knows the language
function createCodeBlock(code, language) {
  const pre = document.createElement('pre');
  const codeEl = document.createElement('code');
  codeEl.className = 'hljs';

  const canHighlight = window.hljs && language && hljs.getLanguage(language);
  if (canHighlight) {
    codeEl.innerHTML = hljs.highlight(code, { language: language, ignoreIllegals: true }).value;
    codeEl.classList.add('language-' + language);
  } else {
    codeEl.textContent = code;
  }

  pre.appendChild(codeEl);
  return pre;
}

// Render inline code, media, links, and plain text
function renderInlineText(parent, text) {
  const parts = text.split(INLINE_TOKEN_PATTERN);

  parts.forEach(part => {
    if (!part) return;

    const inlineCodeMatch = part.match(/^`([^`]+)`$/);
    const mediaMatch = part.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    const bareUrlMatch = part.match(/^https?:\/\//i);

    if (inlineCodeMatch) {
      const codeEl = document.createElement('code');
      codeEl.className = 'inline-code';
      codeEl.textContent = inlineCodeMatch[1];
      parent.appendChild(codeEl);
    } else if (mediaMatch && isSafeMediaUrl(mediaMatch[2])) {
      parent.appendChild(createMediaElement(mediaMatch[2], mediaMatch[1]));
    } else if (linkMatch && isSafeLinkUrl(linkMatch[2])) {
      parent.appendChild(createLink(linkMatch[2], linkMatch[1]));
    } else if (bareUrlMatch) {
      appendBareUrl(parent, part);
    } else {
      parent.appendChild(document.createTextNode(part));
    }
  });
}

// Link a bare URL, leaving trailing punctuation (like a sentence's final period) as text
function appendBareUrl(parent, text) {
  const url = text.replace(/[.,;:!?)\]'"]+$/, '');
  const trailing = text.slice(url.length);

  parent.appendChild(createLink(url, url));
  if (trailing) {
    parent.appendChild(document.createTextNode(trailing));
  }
}

// Clickable link that opens in a new tab
function createLink(url, label) {
  const link = document.createElement('a');
  link.href = url;
  link.textContent = label;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'rich-link';
  return link;
}

// Build an image, video, or YouTube embed wrapped in a centered block
function createMediaElement(url, altText) {
  const container = document.createElement('div');
  container.className = 'rich-media';

  const youtubeMatch = url.match(YOUTUBE_PATTERN);
  const isVideoFile = VIDEO_FILE_PATTERN.test(url) || /^data:video\//i.test(url);

  if (youtubeMatch) {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + youtubeMatch[1];
    iframe.title = altText || 'YouTube video';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    // YouTube refuses to play embeds that send no referrer
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.className = 'rich-media-youtube';
    container.appendChild(iframe);
  } else if (isVideoFile) {
    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    video.preload = 'metadata';
    if (altText) video.title = altText;
    container.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = url;
    img.alt = altText || 'Question image';
    container.appendChild(img);
  }

  return container;
}

// Media may be http(s), data:image/, data:video/, or a relative path
function isSafeMediaUrl(url) {
  if (/^(https?:\/\/|data:(image|video)\/)/i.test(url)) return true;
  return !hasUrlScheme(url);
}

// Links may be http(s), mailto:, or a relative path
function isSafeLinkUrl(url) {
  if (/^(https?:\/\/|mailto:)/i.test(url)) return true;
  return !hasUrlScheme(url);
}

// True for anything like "javascript:" or "data:" at the start
function hasUrlScheme(url) {
  return /^[a-z][a-z0-9+.-]*:/i.test(url);
}

// Stop any playing videos inside an element (used when a modal closes)
function stopMediaIn(element) {
  element.querySelectorAll('video').forEach(video => video.pause());
  // Resetting an iframe's src is the simplest way to stop a YouTube embed
  element.querySelectorAll('iframe.rich-media-youtube').forEach(iframe => {
    iframe.src = iframe.src;
  });
}
