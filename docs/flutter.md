# Flutter - Cross-Platform Development Guide

A beginner-friendly, in-depth guide to building cross-platform apps with Flutter, covering mobile (iOS + Android), desktop (macOS, Windows, Linux), and web from a single codebase.

## Table of Contents

- [What is Flutter?](#what-is-flutter)
- [Why Flutter?](#why-flutter)
- [Flutter vs React Native](#flutter-vs-react-native)
- [Setting Up Flutter](#setting-up-flutter)
- [Dart Language Crash Course](#dart-language-crash-course)
- [Core Concepts](#core-concepts)
- [Widgets - Everything is a Widget](#widgets---everything-is-a-widget)
- [Layout System](#layout-system)
- [Material Design and Cupertino](#material-design-and-cupertino)
- [Navigation and Routing](#navigation-and-routing)
- [State Management](#state-management)
- [HTTP and API Calls](#http-and-api-calls)
- [Local Storage](#local-storage)
- [Platform-Specific Code](#platform-specific-code)
- [Desktop Support](#desktop-support)
- [Theming and Dark Mode](#theming-and-dark-mode)
- [Animations](#animations)
- [Testing](#testing)
- [Deployment](#deployment)
- [Common Patterns and Best Practices](#common-patterns-and-best-practices)
- [Resources](#resources)

---

## What is Flutter?

Flutter is Google's UI toolkit for building natively compiled applications for mobile, web, and desktop from a single codebase. Unlike React Native which uses native platform components, Flutter draws every pixel itself using the Skia (now Impeller) rendering engine.

```
Your Dart Code --> Flutter Framework --> Rendering Engine (Impeller/Skia) --> Native Canvas
                                          Draws everything from scratch
                                          Same pixels on every platform
```

Key idea: Flutter doesn't use platform UI components at all. It paints its own widgets directly on a canvas, which means:

- Pixel-perfect consistency across platforms
- No platform-specific rendering bugs
- Custom designs are easy (you're already drawing everything)
- Looks identical on iOS and Android (unless you intentionally make it different)

## Why Flutter?

### Strengths

- **True cross-platform** - one codebase for iOS, Android, web, macOS, Windows, and Linux - all are first-class targets
- **Fast development** - hot reload (sub-second) preserves app state while you edit code
- **Beautiful by default** - built-in Material Design 3 and Cupertino (iOS-style) widgets
- **Performance** - compiles to native ARM code, no JavaScript bridge
- **Desktop is first-class** - unlike React Native where desktop is an afterthought, Flutter's desktop support is mature and official
- **Dart language** - easy to learn, especially if you know Java, C#, TypeScript, or Kotlin
- **Rich widget library** - hundreds of built-in widgets covering most UI needs
- **Strong typing** - Dart is sound null-safe, catches errors at compile time
- **Google backing** - used in Google Pay, Google Ads, Google Classroom, and many Google internal apps

### Weaknesses (Be Honest)

- **Not native UI** - widgets look like Material/Cupertino but aren't actual platform widgets (some users notice)
- **Dart is niche** - smaller job market than JavaScript/TypeScript
- **App size** - Flutter apps are larger than native apps (~15-20MB minimum)
- **Web performance** - web support works but is heavier than a purpose-built web app
- **Platform APIs** - need plugins for everything (camera, Bluetooth, etc.), though the plugin ecosystem is large

## Flutter vs React Native

| Feature                 | Flutter                        | React Native                  |
| ----------------------- | ------------------------------ | ----------------------------- |
| Language                | Dart                           | JavaScript/TypeScript         |
| Rendering               | Own engine (Impeller)          | Native platform components    |
| UI consistency          | Pixel-perfect across platforms | Slight platform differences   |
| Desktop support         | Official, mature               | Community-driven, less mature |
| Web support             | Supported (heavier)            | Via react-native-web          |
| Hot reload              | Sub-second, stateful           | Fast refresh, stateful        |
| Learning curve (JS dev) | Must learn Dart                | Familiar JS/React             |
| Learning curve (other)  | Dart is easy to pick up        | Must learn React paradigm     |
| npm/JS ecosystem        | No access                      | Full access                   |
| Native look & feel      | Simulated                      | Actual native components      |
| Performance             | Excellent                      | Very good                     |
| Community size          | Large, growing fast            | Larger (older framework)      |
| Hiring market           | Growing                        | Larger (JS developers)        |

**Choose Flutter if:** You want the best desktop support, pixel-perfect cross-platform UI, or your team doesn't already know React.

**Choose React Native if:** Your team knows React/JS, you need native platform UI feel, or you want access to the npm ecosystem.

## Setting Up Flutter

### Prerequisites

- Git
- Platform-specific requirements:
  - **macOS:** Xcode (for iOS), Android Studio (for Android)
  - **Windows:** Visual Studio (for Windows desktop), Android Studio
  - **Linux:** Android Studio

### Installation

```bash
# macOS (Homebrew)
brew install flutter

# Or manual install (any platform)
git clone https://github.com/flutter/flutter.git -b stable
export PATH="$PATH:$(pwd)/flutter/bin"

# Verify installation and check for missing dependencies
flutter doctor
```

`flutter doctor` is your best friend. It checks your environment and tells you exactly what's missing.

```
Doctor summary (to see all details, run flutter doctor -v):
[✓] Flutter (Channel stable, 3.x.x)
[✓] Android toolchain - develop for Android devices
[✓] Xcode - develop for iOS and macOS
[✓] Chrome - develop for the web
[✓] Android Studio
[✓] VS Code
[✓] Connected device (2 available)
[✓] Network resources
```

### IDE Setup

**VS Code** (recommended):

- Install the "Flutter" extension (also installs "Dart" extension)
- `Cmd+Shift+P` -> "Flutter: New Project" to create projects
- F5 to run with debugging

**Android Studio / IntelliJ**:

- Install the "Flutter" plugin
- File -> New -> New Flutter Project

### Create Your First Project

```bash
flutter create my_app
cd my_app
flutter run
```

This opens the app on your connected device or emulator. Edit `lib/main.dart` and save - hot reload updates the app instantly.

### Project Structure

```
my_app/
  lib/                  # Your Dart code lives here
    main.dart           # App entry point
  test/                 # Tests
    widget_test.dart
  android/              # Android-specific native code
  ios/                  # iOS-specific native code
  macos/                # macOS-specific native code
  windows/              # Windows-specific native code
  linux/                # Linux-specific native code
  web/                  # Web-specific files
  pubspec.yaml          # Dependencies (like package.json)
  analysis_options.yaml # Linting rules
```

## Dart Language Crash Course

Dart is the language Flutter uses. If you know TypeScript, Java, Kotlin, or C#, you'll pick it up quickly.

### Variables and Types

```dart
// Type inference (like TypeScript's let/const)
var name = 'Alice';          // String inferred
final age = 30;              // final = can't reassign (like const in JS)
const pi = 3.14159;          // const = compile-time constant

// Explicit types
String greeting = 'Hello';
int count = 42;
double price = 9.99;
bool isActive = true;
List<String> fruits = ['apple', 'banana', 'cherry'];
Map<String, int> scores = {'alice': 95, 'bob': 87};

// Null safety (Dart is sound null-safe)
String? nullableName;        // Can be null (the ? means nullable)
String nonNullName = 'Bob';  // Cannot be null

// Null-aware operators
String display = nullableName ?? 'Unknown';  // Default if null
int? length = nullableName?.length;          // Safe access
```

### Functions

```dart
// Basic function
String greet(String name) {
  return 'Hello, $name!';
}

// Arrow syntax (single expression)
String greet(String name) => 'Hello, $name!';

// Named parameters (very common in Flutter)
void createUser({required String name, int age = 0, String? email}) {
  print('$name, $age, $email');
}
createUser(name: 'Alice', age: 30);  // email is optional

// Optional positional parameters
void log(String message, [String? tag]) {
  print('${tag ?? 'INFO'}: $message');
}
```

### Classes

```dart
class User {
  final String name;
  final int age;
  final String? email;

  // Constructor with named parameters
  const User({required this.name, required this.age, this.email});

  // Method
  String display() => '$name (age: $age)';

  // Override toString
  @override
  String toString() => 'User($name, $age)';
}

// Usage
final user = User(name: 'Alice', age: 30, email: 'alice@example.com');
print(user.display());  // Alice (age: 30)
```

### Async/Await

```dart
// Futures are like Promises in JavaScript
Future<String> fetchData() async {
  final response = await http.get(Uri.parse('https://api.example.com/data'));
  return response.body;
}

// Using it
void loadData() async {
  try {
    final data = await fetchData();
    print(data);
  } catch (e) {
    print('Error: $e');
  }
}

// Streams (like observables - continuous data flow)
Stream<int> countUp() async* {
  for (int i = 0; i < 10; i++) {
    await Future.delayed(Duration(seconds: 1));
    yield i;
  }
}
```

### Collections

```dart
// Lists
final numbers = [1, 2, 3, 4, 5];
final doubled = numbers.map((n) => n * 2).toList();
final evens = numbers.where((n) => n % 2 == 0).toList();

// Spread operator
final moreNumbers = [...numbers, 6, 7, 8];

// Collection if/for (powerful Flutter pattern)
final widgets = [
  Text('Always shown'),
  if (isLoggedIn) Text('Welcome back!'),
  for (var item in items) ListTile(title: Text(item.name)),
];

// Maps
final config = {
  'theme': 'dark',
  'language': 'en',
};
config['theme'];           // 'dark'
config.containsKey('font'); // false
```

### Pattern Matching (Dart 3+)

```dart
// Switch expressions (like Rust/Kotlin)
String describe(Object obj) => switch (obj) {
  int n when n > 0 => 'positive number',
  int n when n < 0 => 'negative number',
  int()            => 'zero',
  String s         => 'string: $s',
  _                => 'something else',
};

// Record types
(String, int) getUserInfo() => ('Alice', 30);
final (name, age) = getUserInfo();
```

## Core Concepts

### Everything is a Widget

In Flutter, everything you see on screen is a widget. Widgets are like React components but more granular:

```dart
// React equivalent:        Flutter:
// <div>                    Container / SizedBox
// <span>                   Text
// <img>                    Image
// <input>                  TextField
// <button>                 ElevatedButton / TextButton
// <ul>                     ListView
// className="flex"         Row / Column
// style={{ padding: 8 }}   Padding widget or EdgeInsets
```

There are two types of widgets:

### StatelessWidget (Like a Functional Component)

```dart
class Greeting extends StatelessWidget {
  final String name;

  const Greeting({super.key, required this.name});

  @override
  Widget build(BuildContext context) {
    return Text(
      'Hello, $name!',
      style: Theme.of(context).textTheme.headlineMedium,
    );
  }
}

// Usage
Greeting(name: 'Alice')
```

### StatefulWidget (Like a Class Component with useState)

```dart
class Counter extends StatefulWidget {
  const Counter({super.key});

  @override
  State<Counter> createState() => _CounterState();
}

class _CounterState extends State<Counter> {
  int _count = 0;

  void _increment() {
    setState(() {
      _count++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text('Count: $_count', style: Theme.of(context).textTheme.headlineLarge),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: _increment,
          child: const Text('Increment'),
        ),
      ],
    );
  }
}
```

`setState()` is like calling the setter from `useState` in React - it tells Flutter to rebuild this widget.

### The Widget Tree

Flutter apps are a tree of nested widgets:

```dart
MaterialApp                          // Root - provides Material theme
  └── Scaffold                       // Page structure (app bar, body, FAB)
      ├── AppBar                     // Top bar
      │   └── Text('My App')
      └── Center                     // Centers its child
          └── Column                 // Vertical layout
              ├── Text('Hello')
              ├── SizedBox(h: 16)    // Spacing
              └── ElevatedButton
                  └── Text('Click')
```

### Your First Full App

```dart
import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'My First App',
      theme: ThemeData(
        colorSchemeSeed: Colors.blue,
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final List<String> _todos = [];
  final _controller = TextEditingController();

  void _addTodo() {
    if (_controller.text.isNotEmpty) {
      setState(() {
        _todos.add(_controller.text);
        _controller.clear();
      });
    }
  }

  void _removeTodo(int index) {
    setState(() {
      _todos.removeAt(index);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Todo List'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    decoration: const InputDecoration(
                      hintText: 'Add a todo...',
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => _addTodo(),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _addTodo,
                  child: const Text('Add'),
                ),
              ],
            ),
          ),
          Expanded(
            child: _todos.isEmpty
                ? const Center(child: Text('No todos yet!'))
                : ListView.builder(
                    itemCount: _todos.length,
                    itemBuilder: (context, index) {
                      return ListTile(
                        title: Text(_todos[index]),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete),
                          onPressed: () => _removeTodo(index),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
```

## Widgets - Everything is a Widget

### Layout Widgets

```dart
// Row - horizontal layout (like flexDirection: 'row')
Row(
  mainAxisAlignment: MainAxisAlignment.spaceBetween,  // justify-content
  crossAxisAlignment: CrossAxisAlignment.center,       // align-items
  children: [
    Text('Left'),
    Text('Center'),
    Text('Right'),
  ],
)

// Column - vertical layout (like flexDirection: 'column')
Column(
  mainAxisAlignment: MainAxisAlignment.center,
  children: [
    Text('Top'),
    Text('Middle'),
    Text('Bottom'),
  ],
)

// Stack - overlapping widgets (like position: absolute)
Stack(
  children: [
    Image.network('https://example.com/bg.jpg'),
    Positioned(
      bottom: 16,
      left: 16,
      child: Text('Overlay text'),
    ),
  ],
)

// Wrap - like flexWrap: 'wrap'
Wrap(
  spacing: 8,
  runSpacing: 8,
  children: [
    Chip(label: Text('Flutter')),
    Chip(label: Text('Dart')),
    Chip(label: Text('Mobile')),
    Chip(label: Text('Desktop')),
  ],
)
```

### Spacing and Sizing

```dart
// SizedBox - explicit size or spacing
SizedBox(width: 200, height: 100, child: Text('Fixed size'))
SizedBox(height: 16)  // Vertical spacing (like marginBottom)
SizedBox(width: 8)    // Horizontal spacing

// Padding
Padding(
  padding: EdgeInsets.all(16),           // All sides
  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
  padding: EdgeInsets.only(top: 32, bottom: 16),
  child: Text('Padded content'),
)

// Container - div-like (padding, margin, decoration, size)
Container(
  width: 200,
  height: 200,
  padding: EdgeInsets.all(16),
  margin: EdgeInsets.all(8),
  decoration: BoxDecoration(
    color: Colors.blue.shade100,
    borderRadius: BorderRadius.circular(12),
    boxShadow: [
      BoxShadow(
        color: Colors.black26,
        blurRadius: 8,
        offset: Offset(0, 2),
      ),
    ],
  ),
  child: Text('Styled container'),
)

// Expanded - takes remaining space (like flex: 1)
Row(
  children: [
    SizedBox(width: 80, child: Text('Fixed')),
    Expanded(child: Text('Takes remaining space')),  // flex: 1
    Expanded(flex: 2, child: Text('Takes 2x space')), // flex: 2
  ],
)
```

### Input Widgets

```dart
// TextField (like <input>)
TextField(
  controller: _controller,
  decoration: InputDecoration(
    labelText: 'Email',
    hintText: 'Enter your email',
    prefixIcon: Icon(Icons.email),
    border: OutlineInputBorder(),
    errorText: _hasError ? 'Invalid email' : null,
  ),
  keyboardType: TextInputType.emailAddress,
  onChanged: (value) => print('Typing: $value'),
  onSubmitted: (value) => print('Submitted: $value'),
)

// Switch
Switch(
  value: _isDarkMode,
  onChanged: (value) => setState(() => _isDarkMode = value),
)

// Checkbox
Checkbox(
  value: _isChecked,
  onChanged: (value) => setState(() => _isChecked = value!),
)

// Slider
Slider(
  value: _volume,
  min: 0,
  max: 100,
  divisions: 10,
  label: '${_volume.round()}%',
  onChanged: (value) => setState(() => _volume = value),
)

// DropdownButton
DropdownButton<String>(
  value: _selectedCity,
  items: ['New York', 'London', 'Tokyo'].map((city) {
    return DropdownMenuItem(value: city, child: Text(city));
  }).toList(),
  onChanged: (value) => setState(() => _selectedCity = value!),
)
```

### Scrollable Widgets

```dart
// ListView - scrollable list (like FlatList in React Native)
ListView.builder(
  itemCount: items.length,
  itemBuilder: (context, index) {
    return ListTile(
      leading: CircleAvatar(child: Text('${index + 1}')),
      title: Text(items[index].title),
      subtitle: Text(items[index].description),
      trailing: Icon(Icons.chevron_right),
      onTap: () => _onItemTap(items[index]),
    );
  },
)

// GridView - scrollable grid
GridView.builder(
  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
    crossAxisCount: 2,    // 2 columns
    crossAxisSpacing: 8,
    mainAxisSpacing: 8,
  ),
  itemCount: products.length,
  itemBuilder: (context, index) {
    return ProductCard(product: products[index]);
  },
)

// SingleChildScrollView - for single scrollable content
SingleChildScrollView(
  child: Column(
    children: [
      // Long content that might exceed screen height
    ],
  ),
)
```

### Buttons

```dart
// Filled button (primary action)
FilledButton(
  onPressed: () => print('Tapped'),
  child: Text('Submit'),
)

// Elevated button (with shadow)
ElevatedButton(
  onPressed: () {},
  child: Text('Elevated'),
)

// Outlined button
OutlinedButton(
  onPressed: () {},
  child: Text('Cancel'),
)

// Text button (minimal)
TextButton(
  onPressed: () {},
  child: Text('Learn More'),
)

// Icon button
IconButton(
  icon: Icon(Icons.favorite),
  onPressed: () {},
)

// Floating action button
FloatingActionButton(
  onPressed: () {},
  child: Icon(Icons.add),
)

// Button with icon
FilledButton.icon(
  onPressed: () {},
  icon: Icon(Icons.send),
  label: Text('Send'),
)
```

## Layout System

Flutter uses a constraint-based layout system. Understanding it prevents 90% of layout bugs.

### The Golden Rule

Parent widgets pass **constraints** (min/max width/height) down to children. Children choose a **size** within those constraints. Parents decide **position**.

```dart
// This FAILS - Column gives infinite height, ListView needs bounded height
Column(
  children: [
    Text('Header'),
    ListView(...)   // Error: unbounded height
  ],
)

// Fix: use Expanded to give ListView bounded height
Column(
  children: [
    Text('Header'),
    Expanded(
      child: ListView(...),  // Now has bounded height
    ),
  ],
)
```

### Common Layout Patterns

```dart
// App with sidebar (desktop/tablet)
Row(
  children: [
    SizedBox(
      width: 250,
      child: NavigationDrawer(...),
    ),
    Expanded(
      child: MainContent(),
    ),
  ],
)

// Responsive layout
LayoutBuilder(
  builder: (context, constraints) {
    if (constraints.maxWidth > 800) {
      return WideLayout();   // Desktop/tablet
    } else {
      return NarrowLayout();  // Mobile
    }
  },
)

// Card grid that adapts to screen width
GridView.builder(
  gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
    maxCrossAxisExtent: 300,  // Each card max 300px wide
    crossAxisSpacing: 16,
    mainAxisSpacing: 16,
  ),
  itemCount: items.length,
  itemBuilder: (context, index) => ItemCard(item: items[index]),
)
```

## Material Design and Cupertino

Flutter ships two complete widget sets:

### Material Design 3 (Android/Desktop/Web)

```dart
MaterialApp(
  theme: ThemeData(
    colorSchemeSeed: Colors.indigo,
    useMaterial3: true,
    brightness: Brightness.light,
  ),
  darkTheme: ThemeData(
    colorSchemeSeed: Colors.indigo,
    useMaterial3: true,
    brightness: Brightness.dark,
  ),
  themeMode: ThemeMode.system,  // Follow system setting
  home: HomeScreen(),
)
```

Material 3 widgets include: `AppBar`, `NavigationBar`, `NavigationRail`, `NavigationDrawer`, `Card`, `FilledButton`, `SearchBar`, `SegmentedButton`, `Badge`, and more.

### Cupertino (iOS-Style)

```dart
import 'package:flutter/cupertino.dart';

CupertinoApp(
  theme: CupertinoThemeData(
    primaryColor: CupertinoColors.activeBlue,
  ),
  home: CupertinoPageScaffold(
    navigationBar: CupertinoNavigationBar(
      middle: Text('iOS Style'),
    ),
    child: Center(
      child: CupertinoButton.filled(
        child: Text('Tap Me'),
        onPressed: () {},
      ),
    ),
  ),
)
```

### Adaptive Widgets (Use Both)

```dart
import 'dart:io' show Platform;

Widget buildButton() {
  if (Platform.isIOS || Platform.isMacOS) {
    return CupertinoButton.filled(
      child: Text('Submit'),
      onPressed: () {},
    );
  }
  return FilledButton(
    onPressed: () {},
    child: Text('Submit'),
  );
}

// Or use the adaptive constructors
Switch.adaptive(value: _value, onChanged: (v) => setState(() => _value = v))
Slider.adaptive(value: _value, onChanged: (v) => setState(() => _value = v))
CircularProgressIndicator.adaptive()
```

## Navigation and Routing

### Declarative Routing with go_router (Recommended)

```yaml
# pubspec.yaml
dependencies:
  go_router: ^14.0.0
```

```dart
import 'package:go_router/go_router.dart';

// Define routes
final router = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const HomeScreen(),
    ),
    GoRoute(
      path: '/profile/:userId',
      builder: (context, state) {
        final userId = state.pathParameters['userId']!;
        return ProfileScreen(userId: userId);
      },
    ),
    GoRoute(
      path: '/settings',
      builder: (context, state) => const SettingsScreen(),
    ),
    // Nested routes with shell (tab bar, sidebar)
    ShellRoute(
      builder: (context, state, child) => AppShell(child: child),
      routes: [
        GoRoute(path: '/home', builder: (_, __) => const HomeTab()),
        GoRoute(path: '/search', builder: (_, __) => const SearchTab()),
        GoRoute(path: '/account', builder: (_, __) => const AccountTab()),
      ],
    ),
  ],
);

// Use in MaterialApp
MaterialApp.router(
  routerConfig: router,
)

// Navigate
context.go('/profile/123');          // Replace current route
context.push('/settings');           // Push onto stack
context.pop();                       // Go back
```

### Simple Navigation (Navigator)

For simpler apps without a routing package:

```dart
// Push a new screen
Navigator.push(
  context,
  MaterialPageRoute(builder: (context) => DetailScreen(id: 42)),
);

// Go back
Navigator.pop(context);

// Push and remove all previous routes
Navigator.pushAndRemoveUntil(
  context,
  MaterialPageRoute(builder: (context) => HomeScreen()),
  (route) => false,  // Remove everything
);
```

## State Management

### setState (Built-in, Simple Cases)

Good for widget-local state (form inputs, toggles, counters):

```dart
class ToggleExample extends StatefulWidget {
  const ToggleExample({super.key});

  @override
  State<ToggleExample> createState() => _ToggleExampleState();
}

class _ToggleExampleState extends State<ToggleExample> {
  bool _isEnabled = false;

  @override
  Widget build(BuildContext context) {
    return Switch(
      value: _isEnabled,
      onChanged: (value) => setState(() => _isEnabled = value),
    );
  }
}
```

### Provider (Official Recommendation for Medium Apps)

```yaml
# pubspec.yaml
dependencies:
  provider: ^6.0.0
```

```dart
// Define a model
class CartModel extends ChangeNotifier {
  final List<Product> _items = [];

  List<Product> get items => List.unmodifiable(_items);
  int get totalItems => _items.length;
  double get totalPrice => _items.fold(0, (sum, item) => sum + item.price);

  void add(Product product) {
    _items.add(product);
    notifyListeners();  // Triggers rebuild of consumers
  }

  void remove(Product product) {
    _items.remove(product);
    notifyListeners();
  }
}

// Provide it at the top of the tree
void main() {
  runApp(
    ChangeNotifierProvider(
      create: (context) => CartModel(),
      child: const MyApp(),
    ),
  );
}

// Consume it in any widget
class CartIcon extends StatelessWidget {
  const CartIcon({super.key});

  @override
  Widget build(BuildContext context) {
    final itemCount = context.watch<CartModel>().totalItems;
    return Badge(
      label: Text('$itemCount'),
      child: IconButton(
        icon: const Icon(Icons.shopping_cart),
        onPressed: () => context.push('/cart'),
      ),
    );
  }
}

// Read without listening (for actions)
FilledButton(
  onPressed: () => context.read<CartModel>().add(product),
  child: Text('Add to Cart'),
)
```

### Riverpod (Recommended for Larger Apps)

Riverpod is a more robust alternative to Provider with better testing, no BuildContext dependency, and compile-safe providers.

```yaml
# pubspec.yaml
dependencies:
  flutter_riverpod: ^2.5.0
  riverpod_annotation: ^2.3.0
dev_dependencies:
  riverpod_generator: ^2.4.0
  build_runner: ^2.4.0
```

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

// Simple state provider
final counterProvider = StateProvider<int>((ref) => 0);

// Async data provider
final usersProvider = FutureProvider<List<User>>((ref) async {
  final response = await http.get(Uri.parse('https://api.example.com/users'));
  return (jsonDecode(response.body) as List)
      .map((json) => User.fromJson(json))
      .toList();
});

// Notifier (complex state logic)
class TodoNotifier extends Notifier<List<Todo>> {
  @override
  List<Todo> build() => [];

  void add(String title) {
    state = [...state, Todo(title: title, completed: false)];
  }

  void toggle(int index) {
    state = [
      for (int i = 0; i < state.length; i++)
        if (i == index)
          state[i].copyWith(completed: !state[i].completed)
        else
          state[i],
    ];
  }
}

final todoProvider = NotifierProvider<TodoNotifier, List<Todo>>(TodoNotifier.new);

// Wrap app with ProviderScope
void main() {
  runApp(const ProviderScope(child: MyApp()));
}

// Consume in widgets
class TodoList extends ConsumerWidget {
  const TodoList({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final todos = ref.watch(todoProvider);

    return ListView.builder(
      itemCount: todos.length,
      itemBuilder: (context, index) {
        final todo = todos[index];
        return CheckboxListTile(
          title: Text(todo.title),
          value: todo.completed,
          onChanged: (_) => ref.read(todoProvider.notifier).toggle(index),
        );
      },
    );
  }
}

// Handle async data
class UserList extends ConsumerWidget {
  const UserList({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncUsers = ref.watch(usersProvider);

    return asyncUsers.when(
      data: (users) => ListView(
        children: users.map((u) => ListTile(title: Text(u.name))).toList(),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, stack) => Center(child: Text('Error: $err')),
    );
  }
}
```

### State Management Comparison

| Solution   | Complexity | Best For              | Learning Curve      |
| ---------- | ---------- | --------------------- | ------------------- |
| `setState` | Simple     | Local widget state    | None                |
| Provider   | Medium     | Small-medium apps     | Low                 |
| Riverpod   | Medium     | Medium-large apps     | Medium              |
| Bloc/Cubit | High       | Large enterprise apps | High                |
| GetX       | Low        | Rapid prototyping     | Low (controversial) |

Recommendation: start with `setState` + Provider, move to Riverpod when you need more power.

## HTTP and API Calls

### Using the http Package

```yaml
# pubspec.yaml
dependencies:
  http: ^1.2.0
```

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class ApiService {
  static const _baseUrl = 'https://api.example.com';

  // GET request
  Future<List<User>> getUsers() async {
    final response = await http.get(
      Uri.parse('$_baseUrl/users'),
      headers: {'Authorization': 'Bearer $token'},
    );

    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);
      return data.map((json) => User.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load users: ${response.statusCode}');
    }
  }

  // POST request
  Future<User> createUser(String name, String email) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/users'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'name': name, 'email': email}),
    );

    if (response.statusCode == 201) {
      return User.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to create user');
    }
  }
}
```

### Using Dio (More Feature-Rich)

```yaml
# pubspec.yaml
dependencies:
  dio: ^5.4.0
```

```dart
import 'package:dio/dio.dart';

class ApiClient {
  late final Dio _dio;

  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: 'https://api.example.com',
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 3),
    ));

    // Interceptors (like axios interceptors)
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
      onError: (error, handler) {
        if (error.response?.statusCode == 401) {
          // Handle token refresh
        }
        handler.next(error);
      },
    ));
  }

  Future<List<User>> getUsers() async {
    final response = await _dio.get('/users');
    return (response.data as List).map((json) => User.fromJson(json)).toList();
  }
}
```

### JSON Serialization

```dart
// Manual (simple)
class User {
  final String id;
  final String name;
  final String email;

  const User({required this.id, required this.name, required this.email});

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {'id': id, 'name': name, 'email': email};
  }
}

// Code generation (recommended for larger projects)
// pubspec.yaml: json_annotation, json_serializable, build_runner
import 'package:json_annotation/json_annotation.dart';
part 'user.g.dart';

@JsonSerializable()
class User {
  final String id;
  final String name;
  final String email;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  const User({required this.id, required this.name, required this.email, required this.createdAt});

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
  Map<String, dynamic> toJson() => _$UserToJson(this);
}

// Run: dart run build_runner build
```

## Local Storage

### shared_preferences (Key-Value)

```yaml
dependencies:
  shared_preferences: ^2.2.0
```

```dart
import 'package:shared_preferences/shared_preferences.dart';

// Save
final prefs = await SharedPreferences.getInstance();
await prefs.setString('username', 'alice');
await prefs.setBool('dark_mode', true);
await prefs.setInt('login_count', 5);

// Read
final username = prefs.getString('username') ?? 'Guest';
final isDark = prefs.getBool('dark_mode') ?? false;

// Delete
await prefs.remove('username');
```

### sqflite (SQLite Database)

```yaml
dependencies:
  sqflite: ^2.3.0
  path: ^1.9.0
```

```dart
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DatabaseHelper {
  static Database? _database;

  Future<Database> get database async {
    _database ??= await _initDB();
    return _database!;
  }

  Future<Database> _initDB() async {
    final path = join(await getDatabasesPath(), 'app.db');
    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) {
        return db.execute(
          'CREATE TABLE notes(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, created_at TEXT)',
        );
      },
    );
  }

  Future<int> insertNote(Note note) async {
    final db = await database;
    return db.insert('notes', note.toMap());
  }

  Future<List<Note>> getNotes() async {
    final db = await database;
    final maps = await db.query('notes', orderBy: 'created_at DESC');
    return maps.map((map) => Note.fromMap(map)).toList();
  }
}
```

### Hive (NoSQL, Fast)

```yaml
dependencies:
  hive: ^2.2.3
  hive_flutter: ^1.1.0
```

```dart
import 'package:hive_flutter/hive_flutter.dart';

// Initialize
await Hive.initFlutter();
final box = await Hive.openBox('settings');

// Write
box.put('theme', 'dark');
box.put('user', {'name': 'Alice', 'age': 30});

// Read
final theme = box.get('theme', defaultValue: 'light');

// Delete
box.delete('theme');
```

## Platform-Specific Code

### Checking the Platform

```dart
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

if (kIsWeb) {
  // Running in a browser
} else if (Platform.isIOS) {
  // iOS
} else if (Platform.isAndroid) {
  // Android
} else if (Platform.isMacOS) {
  // macOS desktop
} else if (Platform.isWindows) {
  // Windows desktop
} else if (Platform.isLinux) {
  // Linux desktop
}
```

### Responsive Design Helper

```dart
class Responsive {
  static bool isMobile(BuildContext context) =>
      MediaQuery.sizeOf(context).width < 600;

  static bool isTablet(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= 600 &&
      MediaQuery.sizeOf(context).width < 1200;

  static bool isDesktop(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= 1200;
}

// Usage
Widget build(BuildContext context) {
  if (Responsive.isDesktop(context)) {
    return DesktopLayout();
  } else if (Responsive.isTablet(context)) {
    return TabletLayout();
  }
  return MobileLayout();
}
```

## Desktop Support

Flutter's desktop support is one of its biggest advantages over React Native.

### Enabling Desktop

```bash
# Enable desktop platforms (one-time)
flutter config --enable-macos-desktop
flutter config --enable-windows-desktop
flutter config --enable-linux-desktop

# Create a project with desktop support
flutter create --platforms=ios,android,macos,windows,linux my_app

# Run on desktop
flutter run -d macos
flutter run -d windows
flutter run -d linux
```

### Desktop-Specific Considerations

```dart
import 'dart:io' show Platform;

class AppLayout extends StatelessWidget {
  const AppLayout({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isDesktop = Platform.isMacOS || Platform.isWindows || Platform.isLinux;

    if (isDesktop) {
      return Row(
        children: [
          // Sidebar navigation for desktop
          NavigationRail(
            selectedIndex: _selectedIndex,
            destinations: const [
              NavigationRailDestination(icon: Icon(Icons.home), label: Text('Home')),
              NavigationRailDestination(icon: Icon(Icons.search), label: Text('Search')),
              NavigationRailDestination(icon: Icon(Icons.settings), label: Text('Settings')),
            ],
            onDestinationSelected: (index) => _onNavigate(index),
          ),
          Expanded(child: child),
        ],
      );
    }

    // Bottom navigation for mobile
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.search), label: 'Search'),
          NavigationDestination(icon: Icon(Icons.settings), label: 'Settings'),
        ],
        onDestinationSelected: (index) => _onNavigate(index),
      ),
    );
  }
}
```

### Window Management (Desktop)

```yaml
dependencies:
  window_manager: ^0.3.8 # Control window size, title, etc.
```

```dart
import 'package:window_manager/window_manager.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (Platform.isMacOS || Platform.isWindows || Platform.isLinux) {
    await windowManager.ensureInitialized();
    await windowManager.setMinimumSize(const Size(400, 300));
    await windowManager.setSize(const Size(1200, 800));
    await windowManager.setTitle('My Desktop App');
    await windowManager.center();
  }

  runApp(const MyApp());
}
```

### Keyboard Shortcuts (Desktop)

```dart
Shortcuts(
  shortcuts: {
    LogicalKeySet(LogicalKeyboardKey.control, LogicalKeyboardKey.keyN):
        const CreateNewIntent(),
    LogicalKeySet(LogicalKeyboardKey.control, LogicalKeyboardKey.keyS):
        const SaveIntent(),
    LogicalKeySet(LogicalKeyboardKey.escape):
        const DismissIntent(),
  },
  child: Actions(
    actions: {
      CreateNewIntent: CallbackAction<CreateNewIntent>(
        onInvoke: (_) => _createNew(),
      ),
      SaveIntent: CallbackAction<SaveIntent>(
        onInvoke: (_) => _save(),
      ),
    },
    child: Focus(
      autofocus: true,
      child: MyApp(),
    ),
  ),
)

class CreateNewIntent extends Intent {
  const CreateNewIntent();
}

class SaveIntent extends Intent {
  const SaveIntent();
}
```

### Menu Bar (macOS/Windows/Linux)

```dart
PlatformMenuBar(
  menus: [
    PlatformMenu(
      label: 'File',
      menus: [
        PlatformMenuItem(
          label: 'New',
          shortcut: const SingleActivator(LogicalKeyboardKey.keyN, meta: true),
          onSelected: () => _createNew(),
        ),
        PlatformMenuItem(
          label: 'Save',
          shortcut: const SingleActivator(LogicalKeyboardKey.keyS, meta: true),
          onSelected: () => _save(),
        ),
        const PlatformMenuItemGroup(members: []),  // Separator
        PlatformMenuItem(
          label: 'Quit',
          shortcut: const SingleActivator(LogicalKeyboardKey.keyQ, meta: true),
          onSelected: () => exit(0),
        ),
      ],
    ),
    PlatformMenu(
      label: 'Edit',
      menus: [
        PlatformMenuItem(label: 'Cut', shortcut: const SingleActivator(LogicalKeyboardKey.keyX, meta: true)),
        PlatformMenuItem(label: 'Copy', shortcut: const SingleActivator(LogicalKeyboardKey.keyC, meta: true)),
        PlatformMenuItem(label: 'Paste', shortcut: const SingleActivator(LogicalKeyboardKey.keyV, meta: true)),
      ],
    ),
  ],
  child: MyApp(),
)
```

## Theming and Dark Mode

### Complete Theme Setup

```dart
class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      theme: _buildTheme(Brightness.light),
      darkTheme: _buildTheme(Brightness.dark),
      themeMode: ThemeMode.system,  // Follow OS setting
      home: const HomeScreen(),
    );
  }

  ThemeData _buildTheme(Brightness brightness) {
    return ThemeData(
      colorSchemeSeed: const Color(0xff6366f1),  // Indigo
      useMaterial3: true,
      brightness: brightness,

      // Customize specific components
      cardTheme: CardTheme(
        elevation: brightness == Brightness.light ? 2 : 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        filled: true,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        ),
      ),
    );
  }
}

// Access theme in any widget
Widget build(BuildContext context) {
  final colorScheme = Theme.of(context).colorScheme;
  final textTheme = Theme.of(context).textTheme;

  return Container(
    color: colorScheme.surface,
    child: Text(
      'Themed text',
      style: textTheme.headlineMedium?.copyWith(
        color: colorScheme.onSurface,
      ),
    ),
  );
}
```

### Dynamic Theme Switching

```dart
// Using Riverpod
final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.system);

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp(
      theme: ThemeData(colorSchemeSeed: Colors.blue, useMaterial3: true),
      darkTheme: ThemeData(colorSchemeSeed: Colors.blue, useMaterial3: true, brightness: Brightness.dark),
      themeMode: themeMode,
      home: const HomeScreen(),
    );
  }
}

// Toggle in settings
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);

    return SegmentedButton<ThemeMode>(
      segments: const [
        ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode), label: Text('Light')),
        ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.settings), label: Text('System')),
        ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode), label: Text('Dark')),
      ],
      selected: {themeMode},
      onSelectionChanged: (modes) {
        ref.read(themeModeProvider.notifier).state = modes.first;
      },
    );
  }
}
```

## Animations

### Implicit Animations (Easy)

These animate automatically when their properties change:

```dart
// AnimatedContainer - animates any property change
AnimatedContainer(
  duration: const Duration(milliseconds: 300),
  curve: Curves.easeInOut,
  width: _expanded ? 300 : 100,
  height: _expanded ? 300 : 100,
  color: _expanded ? Colors.blue : Colors.red,
  child: const Center(child: Text('Tap me')),
)

// AnimatedOpacity
AnimatedOpacity(
  opacity: _visible ? 1.0 : 0.0,
  duration: const Duration(milliseconds: 500),
  child: Text('Fade me'),
)

// AnimatedSlide
AnimatedSlide(
  offset: _show ? Offset.zero : const Offset(0, 1),
  duration: const Duration(milliseconds: 300),
  child: const Card(child: Text('Slide up')),
)

// AnimatedSwitcher - crossfade between widgets
AnimatedSwitcher(
  duration: const Duration(milliseconds: 300),
  child: _showFirst
      ? const Text('First', key: ValueKey('first'))
      : const Text('Second', key: ValueKey('second')),
)
```

### Explicit Animations (Full Control)

```dart
class PulseAnimation extends StatefulWidget {
  const PulseAnimation({super.key});

  @override
  State<PulseAnimation> createState() => _PulseAnimationState();
}

class _PulseAnimationState extends State<PulseAnimation>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(seconds: 1),
      vsync: this,
    )..repeat(reverse: true);

    _scaleAnimation = Tween<double>(begin: 1.0, end: 1.2).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: _scaleAnimation,
      child: Container(
        width: 100,
        height: 100,
        decoration: BoxDecoration(
          color: Colors.blue,
          borderRadius: BorderRadius.circular(50),
        ),
      ),
    );
  }
}
```

### Hero Animations (Page Transitions)

```dart
// On the source screen
Hero(
  tag: 'product-${product.id}',  // Must match between screens
  child: Image.network(product.imageUrl, width: 100, height: 100),
)

// On the destination screen
Hero(
  tag: 'product-${product.id}',  // Same tag
  child: Image.network(product.imageUrl, width: 300, height: 300),
)
// Flutter automatically animates the image flying between screens
```

## Testing

### Unit Tests

```dart
// test/calculator_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:my_app/calculator.dart';

void main() {
  group('Calculator', () {
    test('adds two numbers', () {
      expect(Calculator.add(2, 3), equals(5));
    });

    test('divides by zero throws', () {
      expect(() => Calculator.divide(1, 0), throwsArgumentError);
    });
  });
}
```

### Widget Tests

```dart
// test/counter_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_app/counter.dart';

void main() {
  testWidgets('Counter increments smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(home: Counter()));

    // Verify initial state
    expect(find.text('0'), findsOneWidget);
    expect(find.text('1'), findsNothing);

    // Tap the increment button
    await tester.tap(find.byIcon(Icons.add));
    await tester.pump();  // Rebuild after setState

    // Verify the counter incremented
    expect(find.text('0'), findsNothing);
    expect(find.text('1'), findsOneWidget);
  });

  testWidgets('shows error on empty form submit', (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(home: LoginForm()));

    await tester.tap(find.text('Submit'));
    await tester.pumpAndSettle();  // Wait for animations

    expect(find.text('Email is required'), findsOneWidget);
  });
}
```

### Integration Tests

```dart
// integration_test/app_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:my_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('full login flow', (tester) async {
    app.main();
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('email')), 'test@example.com');
    await tester.enterText(find.byKey(const Key('password')), 'password123');
    await tester.tap(find.text('Sign In'));
    await tester.pumpAndSettle();

    expect(find.text('Welcome'), findsOneWidget);
  });
}
```

### Running Tests

```bash
flutter test                          # All unit and widget tests
flutter test test/calculator_test.dart # Specific test file
flutter test --coverage               # With coverage report
flutter drive --target=integration_test/app_test.dart  # Integration tests
```

## Deployment

### Android

```bash
# Build APK (for testing/sideloading)
flutter build apk --release

# Build App Bundle (for Google Play Store)
flutter build appbundle --release

# Output: build/app/outputs/bundle/release/app-release.aab
```

Before releasing, configure `android/app/build.gradle`:

- Application ID
- Version code and name
- Signing configuration
- ProGuard rules

### iOS

```bash
# Build for App Store
flutter build ios --release

# Then open Xcode to archive and submit
open ios/Runner.xcworkspace
```

Before releasing, configure in Xcode:

- Bundle identifier
- Signing team
- App icons and launch screen

### macOS

```bash
flutter build macos --release
# Output: build/macos/Build/Products/Release/my_app.app
```

### Windows

```bash
flutter build windows --release
# Output: build/windows/x64/runner/Release/
```

### Linux

```bash
flutter build linux --release
# Output: build/linux/x64/release/bundle/
```

### Web

```bash
flutter build web --release
# Output: build/web/
# Deploy to any static hosting (Firebase Hosting, Vercel, Netlify, etc.)
```

### Distribution Packages

```yaml
# For creating installers, use:
# macOS: create-dmg or electron-builder
# Windows: msix package
# Linux: snapcraft or AppImage

# pubspec.yaml for MSIX (Windows)
dev_dependencies:
  msix: ^3.16.0
```

```bash
# Create Windows MSIX installer
dart run msix:create
```

## Common Patterns and Best Practices

### Project Structure (Feature-First)

```
lib/
  core/                 # Shared utilities
    theme/
      app_theme.dart
    router/
      app_router.dart
    network/
      api_client.dart
    widgets/            # Shared widgets
      loading_indicator.dart
  features/
    auth/
      data/
        auth_repository.dart
      domain/
        user_model.dart
      presentation/
        login_screen.dart
        register_screen.dart
        widgets/
          login_form.dart
    home/
      data/
      domain/
      presentation/
        home_screen.dart
    settings/
      ...
  main.dart
```

### const Constructors (Performance)

```dart
// Always use const when possible - prevents unnecessary rebuilds
const SizedBox(height: 16)          // Good
SizedBox(height: 16)                // Allocates new object every build

const Text('Hello')                 // Good
Text('Hello')                       // Allocates new object every build

const EdgeInsets.all(16)            // Good
EdgeInsets.all(16)                  // Allocates new object every build
```

### Keys (When to Use)

```dart
// Use keys when Flutter needs to distinguish between widgets of the same type
ListView(
  children: items.map((item) =>
    ListTile(
      key: ValueKey(item.id),  // Prevents weird behavior when list reorders
      title: Text(item.name),
    ),
  ).toList(),
)

// AnimatedSwitcher needs keys to know widgets changed
AnimatedSwitcher(
  child: Text('$count', key: ValueKey(count)),
)
```

### Dispose Controllers

```dart
class MyFormState extends State<MyForm> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void dispose() {
    // Always dispose controllers to prevent memory leaks
    _nameController.dispose();
    _emailController.dispose();
    _scrollController.dispose();
    super.dispose();
  }
}
```

### Avoid Rebuilding Expensive Widgets

```dart
// Bad - builds ExpensiveWidget every time parent rebuilds
Widget build(BuildContext context) {
  return Column(
    children: [
      Text('Count: $count'),
      ExpensiveWidget(),  // Rebuilt unnecessarily
    ],
  );
}

// Good - extract as const or use const constructor
Widget build(BuildContext context) {
  return Column(
    children: [
      Text('Count: $count'),
      const ExpensiveWidget(),  // Skipped if unchanged
    ],
  );
}
```

## Resources

### Official Documentation

- Flutter: https://flutter.dev
- Dart: https://dart.dev
- Flutter Widget Catalog: https://docs.flutter.dev/ui/widgets
- Flutter Cookbook: https://docs.flutter.dev/cookbook
- Pub.dev (package registry): https://pub.dev

### Essential Packages

| Package              | Purpose                | pub.dev Link                          |
| -------------------- | ---------------------- | ------------------------------------- |
| go_router            | Navigation/routing     | pub.dev/packages/go_router            |
| flutter_riverpod     | State management       | pub.dev/packages/flutter_riverpod     |
| dio                  | HTTP client            | pub.dev/packages/dio                  |
| shared_preferences   | Key-value storage      | pub.dev/packages/shared_preferences   |
| hive                 | NoSQL database         | pub.dev/packages/hive                 |
| sqflite              | SQLite database        | pub.dev/packages/sqflite              |
| freezed              | Immutable data classes | pub.dev/packages/freezed              |
| json_serializable    | JSON serialization     | pub.dev/packages/json_serializable    |
| flutter_hooks        | React-like hooks       | pub.dev/packages/flutter_hooks        |
| cached_network_image | Image caching          | pub.dev/packages/cached_network_image |
| window_manager       | Desktop window control | pub.dev/packages/window_manager       |

### Learning Path (Recommended Order)

1. Learn Dart basics (1-2 days) - https://dart.dev/language
2. Follow the Flutter codelab: https://docs.flutter.dev/get-started/codelab
3. Build a simple app with Material widgets and setState
4. Learn navigation with go_router
5. Add state management (Provider, then Riverpod)
6. Add HTTP calls and JSON serialization
7. Build for desktop when ready
8. Learn testing
9. Deploy to app stores

### Community

- Flutter Discord: https://discord.gg/flutter
- r/FlutterDev on Reddit
- Flutter YouTube channel: https://youtube.com/@flutterdev
- Flutter Weekly newsletter
