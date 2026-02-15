# GoldenBuddy Minimal - Specification

## Project Overview

**Project Name:** GoldenBuddy Minimal  
**Type:** Single-page web application  
**Core Functionality:** Decentralized, privacy-centric signaling app for seniors to find local activity partners (Walking, Chess, Coffee) without AI, GPS, or permanent databases.  
**Target Users:** Seniors seeking safe, local social connections

---

## UI/UX Specification

### Layout Structure

**Single-page app with view transitions:**
1. **Welcome View** - Initial setup (area selection)
2. **Dashboard View** - Main lobby showing online neighbors
3. **Connection View** - Active chat/meeting room
4. **Safety Modal** - Safety Protocol acknowledgment
5. **Profile View** - User's daily color/emoji and settings

**Responsive Breakpoints:**
- Mobile-first: 320px - 480px (primary target)
- Tablet: 481px - 768px
- Desktop: 769px+

### Visual Design

**Color Palette:**
- Primary: `#2D5A4A` (Forest Green - trustworthy, calm)
- Secondary: `#F5E6D3` (Warm Cream - friendly, readable)
- Accent: `#E8985E` (Warm Orange - call-to-action)
- Background: `#FFFDF9` (Off-white)
- Text Primary: `#1A1A1A` (Near black)
- Text Secondary: `#5A5A5A` (Dark gray)
- Online indicator: `#4CAF50` (Green)
- Offline indicator: `#9E9E9E` (Gray)
- Danger/Warning: `#C62828` (Red)

**Typography:**
- Primary Font: `"Nunito", sans-serif` (Rounded, friendly, highly legible)
- Heading sizes: 32px (h1), 24px (h2), 20px (h3)
- Body text: 18px (minimum for senior accessibility)
- Button text: 20px bold
- Line height: 1.6

**Spacing System:**
- Base unit: 8px
- Section padding: 24px
- Card padding: 16px
- Button padding: 16px 32px
- Gap between elements: 16px

**Visual Effects:**
- Card shadows: `0 4px 12px rgba(0,0,0,0.08)`
- Button hover: scale(1.02) with 200ms ease
- View transitions: fade 300ms
- Pulse animation for heartbeat indicator

### Components

**1. Area Picker**
- Large dropdown with predefined areas (Arlington County and surrounding)
- Areas tagged as "Verified Hub" have badge
- Confirm button

**2. Activity Selector**
- Three large buttons with icons: Walking (🚶), Chess (♟️), Coffee (☕)
- Selected state: filled background with accent color
- Horizontal layout on mobile, vertical on desktop

**3. Neighbor Card**
- Shows: ID (anonymized), activity, online status, time since last heartbeat
- Online: green dot pulsing
- "Invite" button
- Tap to see more details

**4. Invite Modal**
- Shows neighbor details
- "Send Invite" button
- "Cancel" button

**5. Inbox/Invites Panel**
- List of received invites
- Accept/Decline buttons
- Status: PENDING, ACCEPTED

**6. Connection Room**
- Shows: Buddy's activity, meeting spot suggestion
- "Text my family" button (tel: link)
- "Daily Color/Emoji" display
- "End Connection" button
- Safe Zone reminder

**7. Safety Modal**
- Senior Safety Protocol text
- List of Community Safe Zones
- "I Understand" checkbox and button

**8. Status Bar**
- Shows connection status
- Heartbeat indicator (pulsing dot)
- Current area name

---

## Functionality Specification

### Core Features

**1. User Identity**
- Generate 5-character random alphanumeric ID on first visit
- Store ID in localStorage
- Daily color/emoji pair generated from ID (consistent per day)

**2. Heartbeat System**
- Poll every 8 seconds
- POST Unix timestamp to `u{id}` key
- Used to determine online status (less than 60 seconds old = online)

**3. Neighborhood Directory**
- Area ID mapped to directory key `d{areaId}`
- Users register by adding their ID to directory on dashboard entry
- Filter显示: only show neighbors with heartbeat < 60 seconds

**4. Invite System**
- Create invite: POST to `inv{receiverId}` with sender info and activity
- Track invites in sender's `sended_{id}` key
- Accept: Update status to ACCEPTED
- Both parties detect ACCEPTED and enter Connection Room

**5. Activity Selection**
- Three activities: Walking, Chess, Coffee
- User selects one on dashboard
- Displayed on neighbor cards

**6. Safe Zones**
- Static list of libraries and parks in Northern Virginia
- Displayed in Safety Protocol modal
- Suggested in Connection Room

**7. Trusted Contact**
- "Text my family" button using `sms:` or `tel:` protocol
- Pre-filled message: "I have arrived at [Safe Zone] for my GoldenBuddy [Activity]."

### Data Flow

**API Base:** `https://keyvalue.immanuel.co/api/key/`

**Keys:**
- `u{id}` - User heartbeat (Unix timestamp)
- `d{areaId}` - Directory of user IDs in area (JSON array)
- `inv{id}` - Inbox for user (JSON array of invite objects)
- `sended_{id}` - Outbox for user (JSON array of sent invites)

**Invite Object:**
```json
{
  "fromId": "ABC12",
  "activity": "Walking",
  "status": "PENDING|ACCEPTED|DECLINED",
  "timestamp": 1234567890
}
```

### Edge Cases

- No neighbors online: Show friendly message
- API failure: Show error, allow retry, use exponential backoff
- Stale heartbeat: Gracefully remove from list
- Multiple invites: Queue and process in order
- Same user sent multiple invites: Replace existing

---

## Acceptance Criteria

1. ✅ User can select area and see neighbors in that area
2. ✅ Heartbeat posts every 8 seconds while on dashboard
3. ✅ Online status updates in real-time (within 60s window)
4. ✅ User can send invite to another neighbor
5. ✅ User can accept/decline received invites
6. ✅ Both users enter Connection Room on accept
7. ✅ Daily color/emoji visible in Connection Room
8. ✅ "Text my family" opens messaging with pre-filled text
9. ✅ Safety Protocol must be acknowledged before first heartbeat
10. ✅ All text is minimum 18px for accessibility
11. ✅ High contrast colors meet WCAG AA standards
12. ✅ Works offline gracefully with clear error messages

---

## Technical Notes

- Pure HTML/CSS/JS (no frameworks)
- Uses fetch API for REST calls
- localStorage for persistence
- No external dependencies except Google Fonts
