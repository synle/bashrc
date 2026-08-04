# React Native - Cross-Platform Development Guide

A beginner-friendly, in-depth guide to building cross-platform apps with React Native, covering mobile (iOS + Android), desktop (Electron), and web from a single codebase.

## Table of Contents

- [What is React Native?](#what-is-react-native)
- [Why React Native in 2025-2026?](#why-react-native-in-2025-2026)
- [Core Concepts](#core-concepts)
- [Getting Started with Expo](#getting-started-with-expo)
- [React Native vs React (Web)](#react-native-vs-react-web)
- [Design Systems Overview](#design-systems-overview)
- [Tamagui (Recommended)](#tamagui-recommended)
- [gluestack-ui v2](#gluestack-ui-v2)
- [Other Design Systems](#other-design-systems)
- [Universal Monorepo Setup](#universal-monorepo-setup)
- [React Native Web - The Bridge](#react-native-web---the-bridge)
- [Navigation](#navigation)
- [State Management](#state-management)
- [Common Patterns and Gotchas](#common-patterns-and-gotchas)
- [Testing](#testing)
- [Deployment](#deployment)
- [Resources](#resources)

---

## What is React Native?

React Native (RN) is a framework by Meta that lets you build native mobile apps using JavaScript and React. Unlike hybrid frameworks that render inside a WebView, React Native renders actual native UI components.

```
Your JS Code --> React Native Bridge --> Native UI Components
                                          - UIKit (iOS)
                                          - Android Views (Android)
                                          - DOM Elements (Web, via react-native-web)
```

Key idea: you write React components, but instead of `<div>` and `<span>`, you use `<View>` and `<Text>`. React Native translates these into platform-native equivalents.

```jsx
// React (Web)
<div style={{ padding: 16 }}>
  <span>Hello World</span>
</div>

// React Native
<View style={{ padding: 16 }}>
  <Text>Hello World</Text>
</View>
```

## Why React Native in 2025-2026?

React Native has matured significantly. Here's what's changed:

### New Architecture (Default since RN 0.76)

- **Fabric Renderer** - new rendering system with synchronous layout, concurrent rendering support, and better integration with React 18+ features
- **TurboModules** - lazy-loaded native modules with synchronous access, replacing the old async bridge
- **Codegen** - type-safe bridge between JS and native code, auto-generated from TypeScript/Flow specs
- **Bridgeless Mode** - eliminates the old serialized JSON bridge entirely

### Expo is Now the Standard

Expo used to be a limited "managed" wrapper. Now it's the officially recommended way to build RN apps:

- `npx create-expo-app` is the default RN starter
- Handles iOS/Android builds in the cloud (EAS Build)
- Over-the-air (OTA) updates without app store review
- Config plugins replace most need for native code modifications
- Expo Router provides file-based routing (like Next.js)

### Hermes Engine (Default)

- Custom JS engine built for React Native
- Faster startup (bytecode precompilation)
- Lower memory usage
- Better debugging with Chrome DevTools

### Ecosystem Maturity

- TypeScript is first-class
- Large library ecosystem (camera, maps, payments, auth, etc.)
- Strong community support
- Used by Meta, Microsoft, Shopify, Discord, and many others

## Core Concepts

### Components

React Native provides platform-agnostic core components:

```jsx
import { View, Text, Image, ScrollView, TextInput, Pressable } from "react-native";

function MyComponent() {
  return (
    <ScrollView>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome</Text>
        <Image source={{ uri: "https://example.com/photo.png" }} style={styles.image} />
        <TextInput placeholder="Type here..." onChangeText={(text) => console.log(text)} />
        <Pressable onPress={() => alert("Pressed!")}>
          <Text>Tap Me</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
```

Important: there is no CSS in React Native. Styling uses JavaScript objects that resemble CSS but with camelCase properties and Flexbox as the default layout.

### StyleSheet

```jsx
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
});
```

Key differences from CSS:

- No units - all numbers are density-independent pixels (dp)
- Flexbox defaults to `flexDirection: 'column'` (not `row` like web)
- No cascading - styles don't inherit (except some `Text` properties)
- No pseudo-classes - use `Pressable` with style functions for interactive states

### Platform-Specific Code

```jsx
import { Platform } from "react-native";

// Inline platform checks
const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === "ios" ? 44 : 0,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
      web: { boxShadow: "0 2px 4px rgba(0,0,0,0.1)" },
    }),
  },
});

// File-based platform splitting
// Button.ios.tsx    - used on iOS
// Button.android.tsx - used on Android
// Button.web.tsx    - used on web
// The bundler picks the right file automatically
```

## Getting Started with Expo

### Prerequisites

- Node.js 18+
- For iOS development: macOS with Xcode
- For Android development: Android Studio with an emulator
- For quick testing: Expo Go app on your physical device

### Create a New Project

```bash
# Create a new Expo project with TypeScript
npx create-expo-app@latest my-app
cd my-app

# Start the development server
npx expo start
```

This gives you a QR code. Scan it with Expo Go on your phone to see the app instantly.

### Project Structure

```
my-app/
  app/                  # File-based routing (Expo Router)
    (tabs)/             # Tab layout group
      index.tsx         # Home tab (/)
      explore.tsx       # Explore tab (/explore)
      _layout.tsx       # Tab navigator layout
    _layout.tsx         # Root layout
    +not-found.tsx      # 404 page
  assets/               # Images, fonts
  components/           # Reusable components
  constants/            # Theme colors, config
  hooks/                # Custom React hooks
  app.json              # Expo configuration
  tsconfig.json         # TypeScript config
  package.json
```

### Expo Router (File-Based Routing)

Expo Router works like Next.js - files in `app/` become routes:

```
app/
  index.tsx             # /
  about.tsx             # /about
  blog/
    index.tsx           # /blog
    [id].tsx            # /blog/123 (dynamic route)
  (auth)/               # Group (doesn't affect URL)
    login.tsx           # /login
    register.tsx        # /register
  _layout.tsx           # Root layout wrapper
```

```tsx
// app/blog/[id].tsx
import { useLocalSearchParams } from "expo-router";
import { View, Text } from "react-native";

export default function BlogPost() {
  const { id } = useLocalSearchParams();
  return (
    <View>
      <Text>Blog Post #{id}</Text>
    </View>
  );
}
```

## React Native vs React (Web)

If you know React for the web, here's a translation table:

| React (Web)           | React Native           | Notes                                     |
| --------------------- | ---------------------- | ----------------------------------------- |
| `<div>`               | `<View>`               | Generic container                         |
| `<span>`, `<p>`       | `<Text>`               | All text must be inside `<Text>`          |
| `<img>`               | `<Image>`              | Requires explicit width/height            |
| `<input>`             | `<TextInput>`          | Controlled/uncontrolled same as web       |
| `<button>`            | `<Pressable>`          | More flexible than old `TouchableOpacity` |
| `<a href>`            | `<Link>` (expo-router) | Or `Linking.openURL()`                    |
| `<ul>/<li>`           | `<FlatList>`           | Virtualized by default (huge perf win)    |
| `overflow: scroll`    | `<ScrollView>`         | Explicit scrollable container             |
| CSS files             | `StyleSheet.create()`  | JS objects, no cascade                    |
| `className`           | `style`                | Pass style objects directly               |
| `onClick`             | `onPress`              | Touch-based, not click-based              |
| `window.localStorage` | `AsyncStorage`         | Async key-value store                     |
| `fetch()`             | `fetch()` (same!)      | Works identically                         |

Things that work exactly the same:

- `useState`, `useEffect`, `useContext`, `useRef` - all hooks
- `fetch()` for HTTP requests
- `async/await`
- Component composition patterns
- Context API
- State management libraries (Redux, Zustand, Jotai, etc.)

## Design Systems Overview

React Native doesn't have a single dominant design system like MUI is for React web. Here's the landscape:

| Library                   | Style       | Web Support | Best For                      |
| ------------------------- | ----------- | ----------- | ----------------------------- |
| **Tamagui**               | Universal   | Excellent   | Cross-platform monorepos      |
| **gluestack-ui v2**       | Utility     | Excellent   | Tailwind-like DX on native    |
| **React Native Paper**    | Material    | Good        | Material Design apps          |
| **Dripsy**                | Theme-first | Good        | Lightweight universal styling |
| **NativeWind**            | Tailwind    | Good        | Tailwind CSS on native        |
| **React Native Elements** | Simple      | Partial     | Quick prototyping             |

For cross-platform (mobile + desktop/web), **Tamagui** and **gluestack-ui v2** are the strongest choices.

## Tamagui (Recommended)

Tamagui is a universal UI system for React Native and web. It's the most mature solution for building one component library that works everywhere.

### Why Tamagui?

- **Compile-time optimization** - extracts styles to CSS on web (fast!), flat styles on native
- **Universal** - same components on iOS, Android, and web
- **Theming** - built-in dark/light mode, custom themes, sub-themes
- **Responsive** - responsive props based on screen size
- **Animations** - cross-platform animations (CSS on web, native drivers on mobile)
- **Large component library** - sheets, dialogs, toasts, tabs, forms, popovers, and more

### Installation

```bash
# In an Expo project
npx expo install tamagui @tamagui/config @tamagui/babel-plugin

# Or with npm
npm install tamagui @tamagui/config
```

### Configuration

```tsx
// tamagui.config.ts
import { createTamagui } from "tamagui";
import { createInterFont } from "@tamagui/font-inter";
import { shorthands } from "@tamagui/shorthands";
import { themes, tokens } from "@tamagui/themes";

const interFont = createInterFont();

const config = createTamagui({
  themes,
  tokens,
  shorthands,
  fonts: {
    heading: interFont,
    body: interFont,
  },
});

export type AppConfig = typeof config;

// Make TypeScript aware of your config
declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
```

```tsx
// app/_layout.tsx (Expo Router)
import { TamaguiProvider } from "tamagui";
import config from "../tamagui.config";

export default function RootLayout() {
  return (
    <TamaguiProvider config={config}>
      <Slot />
    </TamaguiProvider>
  );
}
```

### Core Components

```tsx
import { Button, H1, Paragraph, XStack, YStack, Input, Card, Image } from "tamagui";

function ProfileCard() {
  return (
    // YStack = vertical stack (like flexDirection: 'column')
    // XStack = horizontal stack (like flexDirection: 'row')
    <Card elevate bordered padding="$4" margin="$3">
      <YStack gap="$3" alignItems="center">
        <Image source={{ uri: "https://example.com/avatar.png" }} width={80} height={80} borderRadius={40} />
        <H1 size="$6">Jane Doe</H1>
        <Paragraph theme="alt2">Software Engineer</Paragraph>

        <XStack gap="$2">
          <Button size="$3" theme="active">
            Follow
          </Button>
          <Button size="$3" variant="outlined">
            Message
          </Button>
        </XStack>

        <Input size="$4" placeholder="Leave a note..." width="100%" />
      </YStack>
    </Card>
  );
}
```

### Tamagui Styling Concepts

```tsx
import { styled, View, Text } from "tamagui";

// Create custom styled components (like styled-components but universal)
const CustomCard = styled(View, {
  backgroundColor: "$background",
  borderRadius: "$4",
  padding: "$4",
  shadowColor: "$shadowColor",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,

  // Variants
  variants: {
    type: {
      primary: {
        backgroundColor: "$blue4",
      },
      danger: {
        backgroundColor: "$red4",
      },
    },
    size: {
      small: { padding: "$2" },
      large: { padding: "$6" },
    },
  } as const,

  // Default variant values
  defaultVariants: {
    type: "primary",
    size: "small",
  },
});

// Usage
<CustomCard type="danger" size="large">
  <Text>Alert!</Text>
</CustomCard>;
```

### Theming

```tsx
import { Theme, useTheme } from "tamagui";

// Use built-in themes
function App() {
  return (
    <Theme name="dark">
      <MyScreen />
      {/* Nest sub-themes */}
      <Theme name="blue">
        <HighlightSection />
      </Theme>
    </Theme>
  );
}

// Access theme values in components
function ThemedComponent() {
  const theme = useTheme();
  return (
    <View style={{ backgroundColor: theme.background.val }}>
      <Text style={{ color: theme.color.val }}>Themed text</Text>
    </View>
  );
}
```

### Responsive Design

```tsx
import { useMedia } from "tamagui";

function ResponsiveLayout() {
  const media = useMedia();

  return (
    <YStack
      padding="$2"
      // Responsive props - applies at breakpoint and above
      $sm={{ padding: "$3" }}
      $md={{ padding: "$4" }}
      $lg={{ padding: "$6" }}
    >
      {/* Stack horizontally on larger screens, vertically on small */}
      {media.md ? (
        <XStack gap="$4">
          <Sidebar />
          <MainContent />
        </XStack>
      ) : (
        <YStack gap="$4">
          <MainContent />
          <Sidebar />
        </YStack>
      )}
    </YStack>
  );
}
```

### Animations

```tsx
import { Button, styled, View } from "tamagui";

const AnimatedBox = styled(View, {
  width: 100,
  height: 100,
  backgroundColor: "$blue10",
  borderRadius: "$4",

  // Define enter/exit animations
  animation: "bouncy",

  // These become animated when they change
  variants: {
    active: {
      true: {
        scale: 1.2,
        opacity: 1,
        backgroundColor: "$green10",
      },
      false: {
        scale: 1,
        opacity: 0.6,
      },
    },
  } as const,
});

function AnimationDemo() {
  const [active, setActive] = useState(false);

  return (
    <YStack gap="$4" alignItems="center">
      <AnimatedBox active={active} />
      <Button onPress={() => setActive(!active)}>Toggle</Button>
    </YStack>
  );
}
```

## gluestack-ui v2

gluestack-ui is a universal component library with a Tailwind-like developer experience. It's the successor to NativeBase.

### Why gluestack-ui?

- **Tailwind-like DX** - utility classes via NativeWind integration
- **Accessible** - WAI-ARIA compliant out of the box
- **Universal** - works on React Native + web
- **Headless option** - use unstyled components and bring your own styles
- **Copy-paste components** - like shadcn/ui, you own the component code

### Installation

```bash
npx gluestack-ui init

# Or manually
npm install @gluestack-ui/themed @gluestack-style/react react-native-svg
```

### Usage

```tsx
import {
  Box,
  Button,
  ButtonText,
  Heading,
  Text,
  VStack,
  HStack,
  Input,
  InputField,
  Card,
  Avatar,
  AvatarImage,
  AvatarFallbackText,
  Badge,
  BadgeText,
} from "@gluestack-ui/themed";

function UserCard() {
  return (
    <Card size="md" variant="elevated" margin="$4">
      <VStack space="md" alignItems="center">
        <Avatar size="xl">
          <AvatarFallbackText>Jane Doe</AvatarFallbackText>
          <AvatarImage source={{ uri: "https://example.com/avatar.png" }} />
        </Avatar>

        <VStack alignItems="center">
          <Heading size="lg">Jane Doe</Heading>
          <Text size="sm" color="$textLight500">
            Software Engineer
          </Text>
          <Badge size="sm" variant="solid" action="success" marginTop="$2">
            <BadgeText>Available</BadgeText>
          </Badge>
        </VStack>

        <HStack space="sm">
          <Button size="sm" action="primary">
            <ButtonText>Follow</ButtonText>
          </Button>
          <Button size="sm" variant="outline" action="secondary">
            <ButtonText>Message</ButtonText>
          </Button>
        </HStack>

        <Input variant="outline" size="md" width="100%">
          <InputField placeholder="Leave a note..." />
        </Input>
      </VStack>
    </Card>
  );
}
```

### Theming

```tsx
import { GluestackUIProvider, createConfig } from "@gluestack-ui/themed";
import { config as defaultConfig } from "@gluestack-ui/config";

// Customize the theme
const config = createConfig({
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    colors: {
      ...defaultConfig.tokens.colors,
      primary500: "#6366f1", // Custom primary color
    },
  },
});

function App() {
  return (
    <GluestackUIProvider config={config} colorMode="dark">
      <MyApp />
    </GluestackUIProvider>
  );
}
```

### gluestack-ui vs Tamagui Comparison

| Feature             | Tamagui                | gluestack-ui v2                       |
| ------------------- | ---------------------- | ------------------------------------- |
| Styling approach    | Styled-components-like | Utility/Tailwind-like                 |
| Compile-time optim. | Yes (big perf win)     | Partial                               |
| Component count     | 50+                    | 30+                                   |
| Dark mode           | Built-in themes        | Built-in colorMode                    |
| Learning curve      | Moderate               | Lower (familiar if you know Tailwind) |
| Customization       | Variants + themes      | Copy-paste + config                   |
| Animation           | Built-in               | Separate (react-native-reanimated)    |
| Community size      | Larger                 | Growing                               |

**Choose Tamagui** if you want maximum performance, rich theming, and a styled-components-like API.

**Choose gluestack-ui** if you prefer Tailwind-style utility props and a shadcn/ui-like copy-paste model.

## Other Design Systems

### React Native Paper (Material Design 3)

Best for apps that should follow Material Design guidelines.

```bash
npm install react-native-paper react-native-safe-area-context
```

```tsx
import { PaperProvider, Button, Card, Text, TextInput } from "react-native-paper";

function App() {
  return (
    <PaperProvider>
      <Card style={{ margin: 16 }}>
        <Card.Title title="Welcome" subtitle="Material Design 3" />
        <Card.Content>
          <Text variant="bodyLarge">This follows Material Design 3 specs.</Text>
          <TextInput label="Email" mode="outlined" style={{ marginTop: 12 }} />
        </Card.Content>
        <Card.Actions>
          <Button mode="contained">Submit</Button>
          <Button mode="outlined">Cancel</Button>
        </Card.Actions>
      </Card>
    </PaperProvider>
  );
}
```

Web support: works via react-native-web.

### NativeWind (Tailwind CSS for React Native)

Not a component library but a styling solution - use Tailwind classes in React Native.

```bash
npm install nativewind tailwindcss
```

```tsx
import { View, Text, Pressable } from "react-native";

function Card() {
  return (
    <View className="bg-white rounded-xl shadow-lg p-6 m-4">
      <Text className="text-xl font-bold text-gray-900">Card Title</Text>
      <Text className="text-gray-600 mt-2">Card description text.</Text>
      <Pressable className="bg-blue-500 rounded-lg py-3 mt-4 active:bg-blue-600">
        <Text className="text-white text-center font-semibold">Action</Text>
      </Pressable>
    </View>
  );
}
```

### Libraries to Avoid

- **NativeBase v3** - deprecated, replaced by gluestack-ui
- **React Native Elements** - limited web support, less active development
- **Shoutem UI** - abandoned

## Universal Monorepo Setup

This is the recommended architecture for building one app that runs on mobile (iOS/Android) and desktop (Electron) from a shared codebase.

### Architecture Overview

```
monorepo/
  packages/
    ui/                 # Shared Tamagui/design-system components
      src/
        Button.tsx
        Card.tsx
        Input.tsx
        theme.ts
        index.ts
      package.json      # "name": "@myapp/ui"

    app/                # Shared business logic
      src/
        hooks/
          useAuth.ts
          useApi.ts
        stores/
          userStore.ts
        utils/
          format.ts
        api/
          client.ts
      package.json      # "name": "@myapp/app"

  apps/
    mobile/             # Expo (React Native) - iOS & Android
      app/              # Expo Router pages
        index.tsx
        profile.tsx
        _layout.tsx
      app.json
      package.json

    desktop/            # Electron + React + react-native-web
      src/
        main.ts         # Electron main process
        renderer/
          App.tsx
          index.tsx
      electron.config.ts
      package.json

  package.json          # Root workspace config
  turbo.json            # Turborepo config (optional but recommended)
```

### Step 1: Initialize the Monorepo

```bash
mkdir my-universal-app && cd my-universal-app
npm init -y

# Or use Turborepo for better monorepo tooling
npx create-turbo@latest
```

Root `package.json`:

```json
{
  "name": "my-universal-app",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

### Step 2: Create the Shared UI Package

```bash
mkdir -p packages/ui/src
cd packages/ui
npm init -y
```

```json
// packages/ui/package.json
{
  "name": "@myapp/ui",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "tamagui": "^1.90.0",
    "@tamagui/config": "^1.90.0"
  },
  "peerDependencies": {
    "react": "*",
    "react-native": "*"
  }
}
```

```tsx
// packages/ui/src/CustomButton.tsx
import { styled, Button, GetProps } from "tamagui";

export const CustomButton = styled(Button, {
  borderRadius: "$6",
  fontWeight: "600",

  variants: {
    variant: {
      primary: {
        backgroundColor: "$blue10",
        color: "$white",
        hoverStyle: { backgroundColor: "$blue11" },
      },
      secondary: {
        backgroundColor: "$gray4",
        color: "$gray12",
        hoverStyle: { backgroundColor: "$gray5" },
      },
      danger: {
        backgroundColor: "$red10",
        color: "$white",
        hoverStyle: { backgroundColor: "$red11" },
      },
    },
    size: {
      sm: { height: 36, paddingHorizontal: "$3", fontSize: "$3" },
      md: { height: 44, paddingHorizontal: "$4", fontSize: "$4" },
      lg: { height: 52, paddingHorizontal: "$5", fontSize: "$5" },
    },
  } as const,

  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

export type CustomButtonProps = GetProps<typeof CustomButton>;
```

```tsx
// packages/ui/src/index.ts

// Re-export everything from tamagui for convenience
export * from "tamagui";

// Export custom components
export { CustomButton } from "./CustomButton";
export type { CustomButtonProps } from "./CustomButton";

// Export theme config
export { default as tamaguiConfig } from "./theme";
```

### Step 3: Create the Shared App Logic Package

```bash
mkdir -p packages/app/src/hooks packages/app/src/api
```

```tsx
// packages/app/src/hooks/useAuth.ts
import { useState, useCallback } from "react";

interface User {
  id: string;
  name: string;
  email: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch("https://api.example.com/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      setUser(data.user);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}
```

```tsx
// packages/app/src/index.ts
export { useAuth } from "./hooks/useAuth";
```

### Step 4: Create the Mobile App (Expo)

```bash
cd apps
npx create-expo-app mobile
cd mobile
npm install @myapp/ui @myapp/app
```

```tsx
// apps/mobile/app/_layout.tsx
import { TamaguiProvider } from "@myapp/ui";
import { tamaguiConfig } from "@myapp/ui";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <TamaguiProvider config={tamaguiConfig}>
      <Stack />
    </TamaguiProvider>
  );
}
```

```tsx
// apps/mobile/app/index.tsx
import { YStack, H1, Paragraph, Input, CustomButton } from "@myapp/ui";
import { useAuth } from "@myapp/app";
import { useState } from "react";

export default function LoginScreen() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <YStack flex={1} justifyContent="center" padding="$5" gap="$4">
      <H1 textAlign="center">Welcome Back</H1>
      <Paragraph textAlign="center" theme="alt2">
        Sign in to continue
      </Paragraph>

      <Input size="$4" placeholder="Email" value={email} onChangeText={setEmail} />
      <Input size="$4" placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

      <CustomButton variant="primary" size="lg" onPress={() => login(email, password)} disabled={loading}>
        {loading ? "Signing in..." : "Sign In"}
      </CustomButton>

      <CustomButton variant="secondary" size="md">
        Create Account
      </CustomButton>
    </YStack>
  );
}
```

### Step 5: Create the Desktop App (Electron)

```bash
cd apps
mkdir desktop && cd desktop
npm init -y
npm install react react-dom react-native-web tamagui @myapp/ui @myapp/app
npm install -D electron electron-builder vite @vitejs/plugin-react
```

```tsx
// apps/desktop/src/main.ts
// Electron main process
import { app, BrowserWindow } from "electron";
import path from "path";

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

```tsx
// apps/desktop/src/renderer/App.tsx
// Same components work on desktop via react-native-web!
import { YStack, H1, Paragraph, Input, CustomButton } from "@myapp/ui";
import { useAuth } from "@myapp/app";
import { useState } from "react";

export default function App() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // This is nearly identical to the mobile version!
  return (
    <YStack flex={1} justifyContent="center" padding="$5" gap="$4" maxWidth={400} margin="auto">
      <H1 textAlign="center">Welcome Back</H1>
      <Paragraph textAlign="center" theme="alt2">
        Sign in to continue
      </Paragraph>

      <Input size="$4" placeholder="Email" value={email} onChangeText={setEmail} />
      <Input size="$4" placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

      <CustomButton variant="primary" size="lg" onPress={() => login(email, password)} disabled={loading}>
        {loading ? "Signing in..." : "Sign In"}
      </CustomButton>
    </YStack>
  );
}
```

```typescript
// apps/desktop/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "react-native": "react-native-web",
    },
  },
});
```

The key insight: the Vite alias `'react-native': 'react-native-web'` makes all imports from `react-native` resolve to the web equivalents. Tamagui components automatically render as DOM elements on web.

### Running the Apps

```bash
# From root
# Mobile
cd apps/mobile && npx expo start

# Desktop
cd apps/desktop && npm run dev     # Vite dev server
cd apps/desktop && npm run electron # Electron window

# Or with Turborepo
npx turbo dev
```

## React Native Web - The Bridge

React Native Web is the foundational technology that makes universal apps possible. Understanding it helps debug cross-platform issues.

### What it Does

```
React Native Component     -->  Web DOM Element
<View>                     -->  <div>
<Text>                     -->  <span> (with reset styles)
<Image>                    -->  <img>
<TextInput>                -->  <input>
<ScrollView>               -->  <div> (with overflow: auto)
<Pressable>                -->  <div> (with event handlers)
StyleSheet.create({...})   -->  CSS classes (injected into <head>)
```

### Platform Detection

```tsx
import { Platform } from "react-native";

// Platform.OS values:
// 'ios'     - iPhone/iPad
// 'android' - Android
// 'web'     - Browser/Electron (via react-native-web)
// 'windows' - Windows (via react-native-windows)
// 'macos'   - macOS (via react-native-macos)

if (Platform.OS === "web") {
  // Web-specific code (runs in Electron too)
}
```

### Limitations

Not everything in React Native has a web equivalent:

| Feature                             | Web Support                   |
| ----------------------------------- | ----------------------------- |
| Basic components (View, Text, etc.) | Full                          |
| StyleSheet                          | Full                          |
| Animated API                        | Full                          |
| Flexbox layout                      | Full                          |
| Accessibility props                 | Full                          |
| `Alert.alert()`                     | Partial (uses window.confirm) |
| Native modules                      | None (need web alternatives)  |
| `Linking`                           | Partial                       |
| Camera, GPS, Sensors                | Need separate web packages    |

## Navigation

### Expo Router (Recommended)

File-based routing that works on mobile and web:

```tsx
// app/_layout.tsx - Tab navigation
import { Tabs } from "expo-router";
import { Home, User, Settings } from "@tamagui/lucide-icons";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Settings color={color} />,
        }}
      />
    </Tabs>
  );
}
```

### React Navigation (Alternative)

If you're not using Expo Router:

```bash
npm install @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context
```

```tsx
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

const Stack = createNativeStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Details" component={DetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

## State Management

All major React state management libraries work with React Native:

### Zustand (Recommended for Simplicity)

```bash
npm install zustand
```

```tsx
import { create } from "zustand";

interface AppStore {
  count: number;
  user: { name: string } | null;
  increment: () => void;
  setUser: (user: { name: string } | null) => void;
}

const useStore = create<AppStore>((set) => ({
  count: 0,
  user: null,
  increment: () => set((state) => ({ count: state.count + 1 })),
  setUser: (user) => set({ user }),
}));

// Use in any component (mobile or desktop)
function Counter() {
  const { count, increment } = useStore();
  return (
    <YStack>
      <Text>Count: {count}</Text>
      <Button onPress={increment}>+1</Button>
    </YStack>
  );
}
```

### TanStack Query (for Server State)

```bash
npm install @tanstack/react-query
```

```tsx
import { useQuery, useMutation, QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

// Wrap your app
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MyApp />
    </QueryClientProvider>
  );
}

// Fetch data
function UserList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetch("https://api.example.com/users").then((r) => r.json()),
  });

  if (isLoading) return <Text>Loading...</Text>;
  if (error) return <Text>Error: {error.message}</Text>;

  return <FlatList data={data} renderItem={({ item }) => <Text>{item.name}</Text>} keyExtractor={(item) => item.id} />;
}
```

## Common Patterns and Gotchas

### Lists: Always Use FlatList (Not map)

```tsx
// Bad - renders all items at once, slow with many items
{
  items.map((item) => <ItemCard key={item.id} item={item} />);
}

// Good - virtualized, only renders visible items
<FlatList data={items} renderItem={({ item }) => <ItemCard item={item} />} keyExtractor={(item) => item.id} />;
```

### Safe Area Handling

```tsx
import { SafeAreaView } from "react-native-safe-area-context";

function Screen() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      {/* Content won't overlap with notch or status bar */}
    </SafeAreaView>
  );
}
```

### Images Need Explicit Dimensions

```tsx
// This won't show anything - images MUST have width and height
<Image source={{ uri: 'https://example.com/photo.png' }} />

// Correct
<Image
  source={{ uri: 'https://example.com/photo.png' }}
  style={{ width: 200, height: 200 }}
/>
```

### Keyboard Avoiding

```tsx
import { KeyboardAvoidingView, Platform } from "react-native";

function FormScreen() {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      {/* Form inputs here */}
    </KeyboardAvoidingView>
  );
}
```

### Async Storage (localStorage Equivalent)

```bash
npx expo install @react-native-async-storage/async-storage
```

```tsx
import AsyncStorage from "@react-native-async-storage/async-storage";

// Save data
await AsyncStorage.setItem("user_token", "abc123");

// Read data
const token = await AsyncStorage.getItem("user_token");

// Remove data
await AsyncStorage.removeItem("user_token");
```

### Debugging

```bash
# Expo DevTools - press in terminal
j   # Open Chrome DevTools (JS debugger)
r   # Reload
m   # Toggle menu
a   # Open on Android
i   # Open on iOS simulator
w   # Open in web browser
```

## Testing

### Jest + React Native Testing Library

```bash
npm install -D @testing-library/react-native jest
```

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { LoginScreen } from "./LoginScreen";

test("shows error on empty submit", () => {
  render(<LoginScreen />);

  fireEvent.press(screen.getByText("Sign In"));

  expect(screen.getByText("Email is required")).toBeTruthy();
});

test("calls login with email and password", () => {
  const mockLogin = jest.fn();
  render(<LoginScreen onLogin={mockLogin} />);

  fireEvent.changeText(screen.getByPlaceholderText("Email"), "test@example.com");
  fireEvent.changeText(screen.getByPlaceholderText("Password"), "password123");
  fireEvent.press(screen.getByText("Sign In"));

  expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password123");
});
```

### Detox (E2E Testing)

```bash
npm install -D detox
```

```tsx
describe("Login Flow", () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it("should login successfully", async () => {
    await element(by.id("email-input")).typeText("user@example.com");
    await element(by.id("password-input")).typeText("password123");
    await element(by.id("login-button")).tap();
    await expect(element(by.text("Welcome"))).toBeVisible();
  });
});
```

## Deployment

### Mobile (Expo EAS)

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure builds
eas build:configure

# Build for app stores
eas build --platform ios        # iOS App Store
eas build --platform android    # Google Play Store
eas build --platform all        # Both

# Submit to stores
eas submit --platform ios
eas submit --platform android

# Over-the-air update (skip app review for JS changes)
eas update --branch production
```

### Desktop (Electron Builder)

```bash
# In apps/desktop
npm install -D electron-builder
```

```json
// apps/desktop/package.json
{
  "build": {
    "appId": "com.myapp.desktop",
    "productName": "My App",
    "mac": {
      "target": "dmg"
    },
    "win": {
      "target": "nsis"
    },
    "linux": {
      "target": "AppImage"
    }
  },
  "scripts": {
    "build:desktop": "vite build && electron-builder"
  }
}
```

## Resources

### Official Documentation

- React Native: https://reactnative.dev
- Expo: https://docs.expo.dev
- Tamagui: https://tamagui.dev
- gluestack-ui: https://gluestack.io
- React Native Web: https://necolas.github.io/react-native-web
- React Navigation: https://reactnavigation.org
- Expo Router: https://expo.github.io/router

### Learning Path (Recommended Order)

1. Learn React basics (if not already known)
2. Follow the Expo tutorial: https://docs.expo.dev/tutorial/introduction
3. Build a simple mobile app with core components
4. Add Tamagui or gluestack-ui for a design system
5. Add navigation with Expo Router
6. Add state management (Zustand) and data fetching (TanStack Query)
7. Set up the monorepo structure when you need desktop support
8. Deploy with EAS Build

### Community

- React Native Discord: https://discord.gg/reactnative
- Expo Discord: https://chat.expo.dev
- Tamagui Discord: https://discord.gg/tamagui
- r/reactnative on Reddit
