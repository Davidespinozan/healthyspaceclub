import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readAnalyticsConsent, storeAnalyticsConsent, clearAnalyticsConsent,
  analyticsAllowed, shouldPromptConsent, privacySignalBlocks,
} from '../analyticsConsent';

const KEY = 'hsc_analytics_consent';

beforeEach(() => { try { localStorage.removeItem(KEY); } catch { /* noop */ } });
afterEach(() => { vi.unstubAllGlobals(); });

// ── §28 · estado de consentimiento ────────────────────────────────────────────
describe('§28 consent state', () => {
  it('default → unknown', () => {
    expect(readAnalyticsConsent()).toBe('unknown');
    expect(shouldPromptConsent()).toBe(true);
    expect(analyticsAllowed()).toBe(false);
  });
  it('valor inválido → unknown', () => {
    localStorage.setItem(KEY, 'garbage');
    expect(readAnalyticsConsent()).toBe('unknown');
  });
  it('ACCEPT persiste accepted', () => {
    storeAnalyticsConsent('accepted');
    expect(readAnalyticsConsent()).toBe('accepted');
    expect(analyticsAllowed()).toBe(true);
    expect(shouldPromptConsent()).toBe(false);
  });
  it('DECLINE persiste declined y sobrevive relectura', () => {
    storeAnalyticsConsent('declined');
    expect(readAnalyticsConsent()).toBe('declined');
    expect(analyticsAllowed()).toBe(false);
    expect(shouldPromptConsent()).toBe(false);
  });
  it('withdraw (accepted→declined) persiste declined', () => {
    storeAnalyticsConsent('accepted');
    storeAnalyticsConsent('declined');
    expect(readAnalyticsConsent()).toBe('declined');
    expect(analyticsAllowed()).toBe(false);
  });
  it('clear → unknown', () => {
    storeAnalyticsConsent('accepted');
    clearAnalyticsConsent();
    expect(readAnalyticsConsent()).toBe('unknown');
    expect(shouldPromptConsent()).toBe(true);
  });
});

// ── §3/§28 · señales de privacidad del navegador ──────────────────────────────
describe('§3 GPC / DNT', () => {
  it('GPC=true bloquea captura aunque esté accepted', () => {
    vi.stubGlobal('navigator', { globalPrivacyControl: true });
    storeAnalyticsConsent('accepted');
    expect(privacySignalBlocks()).toBe(true);
    expect(analyticsAllowed()).toBe(false);        // señal manda sobre 'accepted'
    expect(shouldPromptConsent()).toBe(false);      // no se pregunta si hay señal
  });
  it('DNT="1" bloquea captura', () => {
    vi.stubGlobal('navigator', { doNotTrack: '1' });
    storeAnalyticsConsent('accepted');
    expect(privacySignalBlocks()).toBe(true);
    expect(analyticsAllowed()).toBe(false);
  });
  it('sin señal → no bloquea', () => {
    vi.stubGlobal('navigator', { globalPrivacyControl: false, doNotTrack: null });
    storeAnalyticsConsent('accepted');
    expect(privacySignalBlocks()).toBe(false);
    expect(analyticsAllowed()).toBe(true);
  });
});
