# GoldenBuddy Minimal

A privacy-first, real-time app for seniors to connect with neighbors for Walking, Chess, or Coffee.

## Quick Deploy

### Option 1: Firebase Demo (Pre-configured)
The app comes pre-configured with a demo Firebase project. **For testing only** - it may have limits.

### Option 2: Your Own Firebase (Recommended for production)

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com/
   - Create project "goldenbuddy-[yourname]"
   - Enable **Realtime Database**
   - Start in **Test Mode** (read/write: true)

2. **Update Config** in `index.html` (around line 175):
   ```javascript
   const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_PROJECT.firebaseapp.com",
       databaseURL: "https://YOUR_PROJECT.firebaseio.com",
       ...
   };
   ```

3. **Deploy to GitHub Pages**
   ```bash
   git add .
   git commit -m "Add Firebase config"
   git remote add origin https://github.com/YOUR_USERNAME/goldenbuddy.git
   git push -u origin main
   ```

4. **GitHub Pages**: Settings → Pages → Branch: main → Save

## How to Test Real-Time

1. **Open the app** in Browser A (your phone/computer)
2. Enter name, select area, choose activity
3. **Open the app** in Browser B (different device/incognito)
4. Enter different name, **same area**
5. **Both users will see each other immediately** (green dot)
6. Tap "Invite" → Other user sees notification
7. Accept → Both enter Connection Room

## Features

- 🔒 **Zero tracking** - No GPS, no personal data stored
- ⚡ **Real-time** - See neighbors online instantly via Firebase
- 🛡️ **Safe meetings** - Suggested public locations
- 📱 **Senior-friendly** - Large text, simple interface
