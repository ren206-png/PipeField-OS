# PipeField OS — iOS Build Guide

## What's been set up for you
- ✅ Capacitor 8 installed + configured (`capacitor.config.ts`)
- ✅ iOS Xcode project generated (`ios/App/`)
- ✅ App icons generated in all required sizes
- ✅ Splash screen with dark theme
- ✅ Info.plist configured (deep links, camera, push notifications)
- ✅ 6 native plugins: SplashScreen, StatusBar, App, Haptics, Keyboard, PushNotifications
- ✅ Supabase deep link scheme: `pipefield://`
- ✅ NativeAppProvider wired into root layout

---

## Step 1 — Install Xcode

1. Open **App Store** on your Mac
2. Search **Xcode** → Install (it's free, ~15 GB)
3. After install, open Xcode once to accept the license agreement
4. Run in Terminal: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`

---

## Step 2 — Open the project in Xcode

```bash
cd /Users/rennerkargbo/Desktop/pipefield-os
npx cap open ios
```

This opens `ios/App/App.xcodeproj` in Xcode automatically.

---

## Step 3 — Set your Apple Developer team

1. In Xcode, click **App** in the project navigator (left panel)
2. Select the **App** target → **Signing & Capabilities** tab
3. Under **Team**, select your Apple Developer account
   - If you don't have one: enroll at developer.apple.com ($99/year for App Store)
   - For testing on your own device only: a free Apple ID works
4. Change **Bundle Identifier** to something unique if needed (currently `app.pipefield.os`)

---

## Step 4 — Test on your iPhone

1. Plug your iPhone into your Mac via USB
2. Trust the computer on your phone when prompted
3. In Xcode top bar, select your iPhone from the device dropdown
4. Press ▶ (Run) — the app installs and launches
5. The app loads `https://pipefield-os.vercel.app` in a native shell

---

## Step 5 — Archive for App Store

1. In Xcode: **Product → Archive**
2. Wait for the build (~2-3 min)
3. When Archive window opens → **Distribute App**
4. Choose **App Store Connect** → **Upload**
5. Follow prompts (auto-signing is easiest)

---

## Step 6 — Submit on App Store Connect

1. Go to https://appstoreconnect.apple.com
2. **My Apps → + → New App**
3. Fill in: Name = "PipeField OS", Bundle ID = `app.pipefield.os`
4. Add screenshots (use the iOS Simulator, Cmd+S to save)
5. Write description, select category: **Business** or **Productivity**
6. Submit for Review (~24-48h for first review)

---

## Updating the app

When you push new features to Vercel, the iOS app automatically picks them up
on next launch — **no App Store update needed**.

Only submit a new App Store build when you change native code (plugins, icons,
permissions, etc.).

To sync native changes:
```bash
npx cap sync ios
# Then re-open in Xcode and archive
```

---

## Deep Links (Supabase email confirmation)

The URL scheme `pipefield://` is registered. When a user clicks a Supabase
confirmation email link, it opens the native app instead of the browser.

In Supabase Dashboard → Authentication → URL Configuration, add:
```
pipefield://auth/callback
```
as a redirect URL.

---

## Native plugins available in the app

| Plugin | What it does |
|---|---|
| SplashScreen | Dark launch screen, auto-hides after load |
| StatusBar | Dark text on dark background |
| App | Deep link handling, back button (Android) |
| Haptics | Tactile feedback on button presses |
| Keyboard | Scrolls content above keyboard |
| PushNotifications | Ready to wire up (needs APNs cert in Xcode) |
