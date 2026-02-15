# GoldenBuddy Minimal - Firebase Version

## Setup Instructions

### 1. Create Firebase Project
1. Go to https://console.firebase.google.com/
2. Create new project "goldenbuddy"
3. Enable **Realtime Database** (not Firestore)
4. Start in **Test Mode** (allows read/write without auth)
5. Copy your Firebase config

### 2. Update Firebase Config
Open `index.html` and replace the Firebase config at line ~870:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### 3. Deploy to GitHub Pages
```
git add .
git commit -m "Add Firebase real-time backend"
git push origin main
```

## How Testing Works

1. **User A** opens the app, enters name + selects area
2. **User B** opens the app in another browser/device, enters name + same area
3. Both users see each other in real-time (green dot)
4. User A taps "Invite" on User B's card
5. User B sees invite notification + badge
6. User B accepts → both enter Connection Room
7. Both can see invite history in their profile
