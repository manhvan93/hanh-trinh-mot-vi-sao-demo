'use strict';

const nonceLength = 12;
const tagLength = 16;
const contentContext = new TextEncoder().encode('hanh-trinh-mot-vi-sao/html/v1');
const framePolicy = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data: blob:",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

const messages = {
  missing: 'Hãy mở liên kết đầy đủ từ mã QR để xem món quà.',
  unsupported: 'Hãy mở liên kết bằng trình duyệt hỗ trợ HTTPS.',
  failed: 'Chưa mở được món quà. Hãy quét lại mã QR hoặc kiểm tra kết nối.'
};

async function openGift() {
  const fragment = location.hash;
  const match = fragment.match(/^#k=([A-Za-z0-9_-]{43})$/);
  if (fragment) history.replaceState(null, '', location.pathname + location.search);
  if (!match) return 'missing';
  if (!window.isSecureContext || !crypto.subtle) return 'unsupported';

  const base64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
  const rawKey = Uint8Array.from(atob(base64 + '='), character => character.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
  rawKey.fill(0);
  const response = await fetch('./payload.bin', {
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Payload unavailable');
  const payload = new Uint8Array(await response.arrayBuffer());
  if (payload.byteLength <= nonceLength + tagLength) throw new Error('Invalid payload');
  const decrypted = await crypto.subtle.decrypt({
    name: 'AES-GCM',
    iv: payload.subarray(0, nonceLength),
    additionalData: contentContext
  }, key, payload.subarray(nonceLength));

  const documentText = new TextDecoder('utf-8', { fatal: true }).decode(decrypted);
  const head = /^\s*<!doctype html>\s*<html(?:\s+[^>]*?)?>\s*<head(?:\s+[^>]*?)?>/i;
  if (!head.test(documentText)) throw new Error('Invalid document');
  const frame = document.createElement('iframe');
  frame.title = 'Hành trình của một vì sao';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('allowfullscreen', '');
  frame.referrerPolicy = 'no-referrer';
  frame.srcdoc = documentText.replace(head, opener =>
    opener + `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${framePolicy}">`);
  document.body.replaceChildren(frame);
  return null;
}

const message = document.getElementById('message');

function showGift() {
  if (!message.isConnected) return;
  openGift().then(result => {
    if (result) message.textContent = messages[result];
  }).catch(() => {
    message.textContent = messages.failed;
  });
}

window.addEventListener('hashchange', showGift);
showGift();
