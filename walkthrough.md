# Live Transaction Dashboard Walkthrough

I have successfully created a premium React dashboard for visualizing live transactions on a world map.

## Application Overview
The application simulates a real-time data feed of global transactions and visualizes them on an interactive world map.

### Key Features
- **Live World Map**: Powered by `react-simple-maps`, showing transactions as they happen with animated markers.
- **Real-time Stats**: Floating glassmorphism cards displaying total volume, active users, and transaction count.
- **Live Feed**: A scrolling sidebar showing the latest transaction details.
- **Premium Design**: Dark mode aesthetic with gradients, blurs, and smooth animations using `framer-motion`.

## How to Run

1.  Navigate to the project directory:
    ```bash
    cd transaction-dashboard
    ```

2.  Install dependencies (if not already done):
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

4.  Open your browser to the URL shown (usually `http://localhost:5173`).

## Project Structure
- `src/components/WorldMap.jsx`: Renders the map and animated markers.
- `src/components/Dashboard.jsx`: Main layout using Tailwind CSS grid/flex.
- `src/context/TransactionContext.jsx`: Simulates the live data feed.
- `src/constants.js`: Configuration for cities and currencies.

## Dependencies
- `react-simple-maps`: Map visualization
- `framer-motion`: Animations
- `lucide-react`: Icons
- `tailwindcss`: Styling
