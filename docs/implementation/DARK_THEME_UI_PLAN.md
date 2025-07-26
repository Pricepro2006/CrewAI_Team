# Dark Theme UI Implementation Plan

## Design Specifications

### Color Palette
```css
/* Dark Theme Colors */
--bg-primary: #0a0a0a;        /* Main background */
--bg-secondary: #141414;      /* Sidebar background */
--bg-tertiary: #1f1f1f;       /* Card backgrounds */
--bg-hover: #2a2a2a;          /* Hover states */
--text-primary: #ffffff;      /* Primary text */
--text-secondary: #a0a0a0;    /* Secondary text */
--text-muted: #6b6b6b;        /* Muted text */
--accent-primary: #4f46e5;    /* Primary accent (indigo) */
--accent-secondary: #6366f1;  /* Secondary accent */
--border-color: #2d2d2d;      /* Border color */
--error: #ef4444;             /* Error states */
--success: #10b981;           /* Success states */
--warning: #f59e0b;           /* Warning states */
```

### Layout Structure
```
┌─────────────────────────────────────────────────┐
│  Header Bar (App Title, User Menu)              │
├─────────────┬───────────────────────────────────┤
│             │                                   │
│   Sidebar   │         Main Content Area         │
│             │                                   │
│ • Chat      │     ┌─────────────────────┐     │
│ • Agents    │     │                     │     │
│ • Knowledge │     │   Chat Interface    │     │
│ • Settings  │     │                     │     │
│             │     └─────────────────────┘     │
│             │                                   │
└─────────────┴───────────────────────────────────┘
```

## Implementation Steps

### Step 1: Create Dark Theme CSS Variables
```css
/* src/ui/styles/theme.css */
:root {
  /* Dark theme variables */
}

[data-theme="dark"] {
  /* Dark theme overrides */
}
```

### Step 2: Update App.css for Dark Theme
```css
/* Global dark theme styles */
body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}
```

### Step 3: Create Sidebar Component
```typescript
// src/ui/components/Layout/Sidebar.tsx
- Navigation menu
- Active state indicators
- Collapsible functionality
- Icon support
```

### Step 4: Update MainLayout Component
```typescript
// src/ui/components/Layout/MainLayout.tsx
- Integrate sidebar
- Dark theme classes
- Responsive design
```

### Step 5: Style Chat Interface for Dark Theme
```typescript
// src/ui/components/Chat/ChatInterface.tsx
- Dark message bubbles
- Improved contrast
- Syntax highlighting for code
```

### Step 6: Create Theme Toggle
```typescript
// src/ui/components/ThemeToggle.tsx
- Light/Dark mode switch
- Persist preference
- Smooth transitions
```

## Component Styling Guidelines

### Message Bubbles
```css
.user-message {
  background-color: var(--accent-primary);
  color: white;
  border-radius: 18px 18px 4px 18px;
}

.assistant-message {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border-radius: 18px 18px 18px 4px;
  border: 1px solid var(--border-color);
}
```

### Input Area
```css
.chat-input {
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.chat-input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}
```

### Sidebar Navigation
```css
.sidebar-item {
  color: var(--text-secondary);
  padding: 12px 20px;
  transition: all 0.2s;
}

.sidebar-item:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-item.active {
  background-color: var(--accent-primary);
  color: white;
}
```