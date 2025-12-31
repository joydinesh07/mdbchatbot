# React Live Transaction Dashboard

## Goal Description
Create a premium, real-time looking React dashboard that visualizes live transactions on a world map. The app will feature a modern dark-themed UI, animated map markers for transactions, and a live data feed simulation.

## User Review Required
None.

## Proposed Changes

### Project Setup
- Initialize Vite React project in `/Users/dharaniiyugan/.gemini/antigravity/scratch/transaction-dashboard`
- Configure Tailwind CSS

### Dependencies
- `react-simple-maps`: For the world map visualization
- `d3-scale`: For color scales (optional, simplified to CSS/Tailwind)
- `framer-motion`: For smooth animations of transactions popping up
- `lucide-react`: For UI icons
- `clsx`, `tailwind-merge`: For class handling

### Components

#### [NEW] `src/components/WorldMap.jsx`
- Renders the world map using `react-simple-maps`.
- Renders transaction markers (circles) that animate using `framer-motion` upon arrival.

#### [NEW] `src/context/TransactionContext.jsx`
- Simulates a WebSocket connection.
- Generates random transactions (lat, lng, amount, currency, user) every few seconds.

#### [NEW] `src/components/DashboardLayout.jsx`
- Main container with glassmorphism overlay.
- Contains the Map, Stats Cards, and Recent Transactions list.

#### [NEW] `src/components/StatsCard.jsx`
- Displays aggregated metrics (Total Volume, etc.).

#### [NEW] `src/components/TransactionFeed.jsx`
- A scrolling list of the latest transactions.

## Verification Plan
### Automated Tests
- Build check: `npm run build`
- Lint check: `npm run lint`

### Manual Verification
- Run `npm run dev`
- Verify map renders correctly.
- Verify "live" transactions appear on the map as animated dots.
- Verify the feed updates in real-time.
