import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // ── Core identity ──────────────────────────────────────────
  appId:   "com.rennerkargbo.pipefieldos",
  appName: 'PipeField OS',

  // ── Where Capacitor finds the built web assets ─────────────
  // We point to the live Vercel deployment so the app always
  // runs the latest version without re-submitting to the App Store.
  // When you want a fully offline bundle, set webDir + remove server.url.
  webDir: 'out',

  // ── iOS specific ───────────────────────────────────────────
  ios: {
    scheme:             'pipefield',    // deep-link scheme  pipefield://
    contentInset:       'automatic',    // respects safe areas
    backgroundColor:    '#0a0d12',      // matches surface-900
    // false — WKAppBoundDomains is NOT used.
    limitsNavigationsToAppBoundDomains: false,
    preferredContentMode: 'mobile',
    allowsLinkPreview:  false,
    scrollEnabled:      true,
  },

  // ── Server (live production domain) ───────────────────────
  // Both iOS and Android load this origin directly, so the WebView gets real
  // https cookies, same-origin /api calls and normal redirects. (iOS used to
  // proxy it through a custom apphttps:// scheme, which can't store cookies.)
  server: {
    url: 'https://pipefield-os.com',
    cleartext: false,
  },

  // ── Android specific ───────────────────────────────────────
  android: {
    backgroundColor: '#0a0d12',
  },

  // ── Plugin config ──────────────────────────────────────────
  plugins: {
    SplashScreen: {
      launchShowDuration:       2000,
      launchAutoHide:           true,
      backgroundColor:          '#0a0d12',
      androidSplashResourceName: 'splash',
      androidScaleType:          'CENTER_CROP',
      showSpinner:               false,
      iosSpinnerStyle:           'small',
      spinnerColor:              '#4f8ef7',
    },
    StatusBar: {
      style:           'dark',          // light text on dark bg
      backgroundColor: '#0a0d12',
      overlaysWebView:  false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize:     'body',
      style:      'dark',
      resizeOnFullScreen: true,
    },
  },
}

export default config
