# Forex Trading App

A modern, feature-rich Forex trading application built with React Native, Expo, and TypeScript.

## Features

- 📊 **Real-time Currency Pairs** - View live prices for major Forex pairs
- 📈 **Interactive Charts** - Visualize price movements with beautiful charts
- 💹 **Trading Interface** - Execute buy/sell orders with risk management
- 💼 **Portfolio Management** - Track your positions and trading history
- 🎨 **Modern UI** - Beautiful, dark-themed interface optimized for trading
- 📱 **Cross-platform** - Works on both iOS and Android

## Screens

1. **Dashboard** - Overview of portfolio balance, quick stats, and popular pairs
2. **Charts** - Browse all currency pairs with filtering options
3. **Trading** - Execute trades with lot size, stop loss, and take profit
4. **Portfolio** - View open positions and trading history
5. **Settings** - Account settings and app preferences

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Expo CLI (installed globally)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on your device:
   - Scan the QR code with Expo Go app (iOS/Android)
   - Press `i` for iOS simulator
   - Press `a` for Android emulator

### Mobile API setup (required for auth on real devices)

Create a root `.env` and set:

```bash
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:4000
```

For Expo `--tunnel`, your backend is **not** tunneled automatically. Use a public HTTPS backend URL instead.

## Project Structure

```
ForexTradingApp/
├── components/          # Reusable UI components
│   ├── PriceCard.tsx
│   └── PriceChart.tsx
├── screens/            # Screen components
│   ├── DashboardScreen.tsx
│   ├── ChartsScreen.tsx
│   ├── TradingScreen.tsx
│   ├── PortfolioScreen.tsx
│   └── SettingsScreen.tsx
├── navigation/         # Navigation configuration
│   └── AppNavigator.tsx
├── types/             # TypeScript type definitions
│   └── index.ts
├── data/              # Mock data and API utilities
│   └── mockData.ts
├── App.tsx            # Main app component
└── package.json       # Dependencies
```

## Technologies Used

- **React Native** - Mobile app framework
- **Expo** - Development platform
- **TypeScript** - Type safety
- **React Navigation** - Navigation library
- **React Native Chart Kit** - Charting library
- **React Native Vector Icons** - Icon library
- **React Native Linear Gradient** - Gradient components

## Development

### Running the App

```bash
# Start Expo development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on Web
npm run web
```

### Building for Production

```bash
# Build for iOS
expo build:ios

# Build for Android
expo build:android
```

## License

This project is licensed under the MIT License.
