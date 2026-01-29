# Adaptive Keyboard Architecture

Visual reference for system architecture and data flow.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│              (Your Form Component / Page)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ uses
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              useAdaptiveKeyboard Hook                        │
│  (State Management: formData, activeField, handlers)         │
└────────┬──────────────────────────────────────┬─────────────┘
         │                                      │
         │ provides state                       │ provides handlers
         ▼                                      ▼
┌──────────────────────┐            ┌─────────────────────────┐
│  AdaptiveFormField   │            │  AdaptiveKeyboard       │
│  (Input Component)   │            │  (Keyboard Component)   │
└──────────┬───────────┘            └──────────┬──────────────┘
           │                                   │
           │ uses                              │ uses
           ▼                                   ▼
┌──────────────────────┐            ┌─────────────────────────┐
│  Label Component     │            │  KeyboardKey            │
│  (Radix UI)          │            │  (Button Component)     │
└──────────────────────┘            └──────────┬──────────────┘
                                                │
                                                │ uses
                                                ▼
                                    ┌─────────────────────────┐
                                    │  keyboard-layouts.ts    │
                                    │  (Layout Configs)       │
                                    └─────────────────────────┘
```

---

## 🔄 Data Flow Diagram

### User Taps Input Field

```
User Taps Field
      │
      ▼
onFocus() Event
      │
      ▼
handleFieldFocus("fieldName")
      │
      ├─── setActiveField("fieldName")
      └─── setShowKeyboard(true)
      │
      ▼
Keyboard Appears with Appropriate Mode
```

### User Taps Keyboard Key

```
User Taps Key
      │
      ▼
handleKeyPress(key)
      │
      ├─── Is Action Key? ──YES──► Execute Action
      │                             (backspace/clear/enter/shift/etc)
      │
      └─── Is Character? ──YES──► onInput(char)
                                       │
                                       ▼
                          handleInput(char)
                                       │
                                       ▼
                     setFormData(prev => ({
                       ...prev,
                       [activeField]: prev[activeField] + char
                     }))
                                       │
                                       ▼
                          React Re-renders
                                       │
                                       ▼
                          UI Updates with New Value
```

---

## 📦 Component Hierarchy

```
YourForm
├── Container (pb-[340px])
│   ├── AdaptiveFormField (username)
│   │   ├── Label
│   │   └── input[readOnly]
│   │
│   ├── AdaptiveFormField (email)
│   │   ├── Label
│   │   └── input[readOnly]
│   │
│   └── AdaptiveFormField (phone)
│       ├── Label
│       └── input[readOnly]
│
└── Fixed Keyboard Container (bottom-0, z-50)
    └── AdaptiveKeyboard
        ├── Header
        │   ├── Mode Indicator (QWERTY/Numeric/Symbols)
        │   ├── Shift/Caps Indicator
        │   ├── Mode Switch Buttons
        │   └── Close Button
        │
        ├── Keyboard Grid
        │   └── KeyboardKey[] (multiple rows)
        │       └── Button (individual key)
        │
        └── Footer
            └── Status Bar
```

---

## 🎯 State Management Flow

```typescript
// Hook manages all state
useAdaptiveKeyboard({
  fields: ["username", "email", "phone"],
  fieldConfigs: {
    username: { type: "text", keyboardMode: "qwerty" },
    email: { type: "email", keyboardMode: "qwerty" },
    phone: { type: "tel", keyboardMode: "numeric" },
  },
  onSubmit: (data) => { /* handle submit */ }
})

// State stored in hook:
{
  formData: {
    username: "",
    email: "",
    phone: ""
  },
  activeField: "username" | "email" | "phone" | null,
  showKeyboard: boolean,
  inputRefs: { username: ref, email: ref, phone: ref }
}

// Flow:
1. User focuses field → activeField set
2. User taps key → formData updated
3. React re-renders → input shows new value
4. User presses Enter → activeField changes to next
5. Last field Enter → onSubmit() called
```

---

## 🎨 Layout Strategy

### Form Layout

```
┌────────────────────────────────────────┐
│  Header / Navbar                       │
├────────────────────────────────────────┤
│                                        │
│  Form Content                          │
│  - Input Fields                        │
│  - Buttons                             │
│  - etc.                                │
│                                        │
│  ⚠️ Bottom Padding: pb-[340px]        │
│     (Prevents keyboard overlap)        │
│                                        │
├────────────────────────────────────────┤
│                                        │  ← Keyboard appears here
│  Fixed Keyboard (z-50)                 │
│  - Always at bottom                    │
│  - Overlays content below padding      │
└────────────────────────────────────────┘
```

### Responsive Behavior

```
Desktop/Tablet          Mobile
┌─────────┐            ┌──────┐
│         │            │      │
│  Form   │            │ Form │
│         │            │      │
│         │            ├──────┤
├─────────┤            │      │
│Keyboard │            │ KB   │
└─────────┘            └──────┘
```

---

## 🔌 Integration Points

### Option 1: Direct Integration (Simple Forms)

```
Your Component
      │
      ├─── import { AdaptiveKeyboard, AdaptiveFormField }
      │
      ├─── useState for value, showKeyboard
      │
      ├─── render AdaptiveFormField
      │
      └─── render AdaptiveKeyboard with handlers
```

### Option 2: Hook Integration (Complex Forms)

```
Your Component
      │
      ├─── import { useAdaptiveKeyboard }
      │
      ├─── const { formData, handlers, ... } = useAdaptiveKeyboard(config)
      │
      ├─── render AdaptiveFormField[] with formData
      │
      └─── render AdaptiveKeyboard with handlers
```

---

## 🎭 Mode Switching Logic

```typescript
// Auto mode switching based on inputType
useEffect(() => {
  if (inputType === "number" || inputType === "tel") {
    setMode("numeric");
  } else if (inputType === "email") {
    setMode("qwerty");
  } else {
    setMode(initialMode);
  }
}, [inputType, initialMode]);

// Manual mode switching via buttons
handleModeSwitch = (key) => {
  if (key.key === "123") setMode("numeric");
  else if (key.key === "#+=") setMode("symbols");
  else if (key.key === "ABC") setMode("qwerty");
};
```

---

## 🎹 Key Processing Pipeline

```
Key Press Event
      │
      ▼
handleKeyPress(key: KeyType)
      │
      ├─── Has action? ───YES──► Switch (action)
      │                           ├─ backspace → onBackspace()
      │                           ├─ clear → onClear()
      │                           ├─ enter → onEnter()
      │                           ├─ shift → toggle shift
      │                           ├─ caps → toggle caps
      │                           └─ mode → switch mode
      │
      └─── Is character? ─YES──► Apply transformations
                                  │
                                  ├─ isShifted? → toUpperCase()
                                  ├─ isCapsLock? → toUpperCase()
                                  │
                                  ▼
                           onInput(char)
                                  │
                                  ▼
                          Update formData
```

---

## 🏃 Navigation Flow

```
Form with 3 fields: [A] [B] [C]

User on field A, presses Enter:
      │
      ▼
handleEnter()
      │
      ├─── Find current index (0)
      ├─── Next index = 1
      ├─── Next field = B
      │
      ├─── setActiveField("B")
      └─── inputRefs.current["B"].focus()
      │
      ▼
User now on field B

...continues until last field...

User on field C, presses Enter:
      │
      ▼
handleEnter()
      │
      ├─── Current index = 2
      ├─── Is last field? YES
      │
      └─── onSubmit(formData)
```

---

## 🔐 Security Architecture

```
┌─────────────────────────────────────────┐
│  Physical Keyboard                      │
│  ❌ BLOCKED (readOnly on inputs)        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Clipboard / Paste                      │
│  ❌ BLOCKED (readOnly on inputs)        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Virtual Keyboard                       │
│  ✅ ONLY INPUT METHOD                   │
│  │                                      │
│  ├─ Controlled character set            │
│  ├─ Mode-specific validation            │
│  ├─ All input monitored via callbacks   │
│  └─ Audit trail of keystrokes           │
└─────────────────────────────────────────┘
```

---

## 💾 State Structure

```typescript
// Hook internal state
{
  // Form values
  formData: Record<FieldName, string>;

  // Keyboard state
  mode: "qwerty" | "numeric" | "symbols";
  isShifted: boolean;
  isCapsLock: boolean;

  // Focus management
  activeField: FieldName | null;
  showKeyboard: boolean;

  // Refs for DOM manipulation
  inputRefs: Record<FieldName, HTMLInputElement | null>;

  // Field configurations
  fieldConfigs: Record<
    FieldName,
    {
      type: "text" | "number" | "email" | "tel";
      keyboardMode: KeyboardMode;
    }
  >;
}
```

---

## 🎨 Styling Architecture

```
Global Theme (index.css)
      │
      ├─── CSS Variables (--radius, --color-*)
      │
      ▼
Tailwind Utility Classes
      │
      ├─── bg-slate-800 (keyboard background)
      ├─── text-white (key text)
      ├─── rounded-lg (key shape)
      └─── etc.
      │
      ▼
Component-Specific Styles
      │
      ├─── KeyboardKey variants
      │    ├─ default: gray
      │    ├─ action: darker gray
      │    ├─ special: teal
      │    ├─ danger: red
      │    └─ success: green
      │
      └─── Responsive sizing
           ├─ min-h-[52px] (default keys)
           └─ min-h-[60px] (numeric mode)
```

---

## 🔄 Re-render Optimization

```typescript
// Memoized handlers prevent unnecessary re-renders
const handleInput = useCallback(
  (char: string) => {
    // ... implementation
  },
  [activeField]
); // Only re-create if activeField changes

const handleBackspace = useCallback(() => {
  // ... implementation
}, [activeField]);

const handleEnter = useCallback(() => {
  // ... implementation
}, [activeField, fields, formData, onSubmit]);

// Effect for auto mode switching
useEffect(() => {
  // ... mode switching logic
}, [inputType, initialMode]); // Only run when these change
```

---

## 📱 Touch Interaction

```
Touch Event
      │
      ▼
Button onClick
      │
      ├─── Visual Feedback
      │    ├─ active:scale-[0.97]
      │    ├─ active:shadow-none
      │    └─ transition-all duration-150
      │
      └─── Execute Handler
           │
           ▼
      Update State
```

---

## 🎯 Type Safety Flow

```typescript
// Generic type for field names
type FieldName = "username" | "email" | "phone";

// Hook with generic
const hook = useAdaptiveKeyboard<FieldName>({
  fields: ["username", "email", "phone"], // ✅ Type-safe
  // fields: ["invalid"],                  // ❌ Type error
});

// Access formData with type safety
hook.formData.username; // ✅ string
hook.formData.email; // ✅ string
hook.formData.invalid; // ❌ Type error

// Set active field with type safety
hook.handleFieldFocus("username"); // ✅ Valid
hook.handleFieldFocus("invalid"); // ❌ Type error
```

---

## 🔗 Dependency Graph

```
AdaptiveKeyboard
├── react (hooks: useState, useCallback, useEffect)
├── lucide-react (icons: Keyboard, Hash, Calculator, X)
├── KeyboardKey component
├── keyboard-layouts (LAYOUTS config)
└── cn utility (from shared/utils)

AdaptiveFormField
├── react (forwardRef)
├── @radix-ui/react-label (Label component)
└── cn utility

useAdaptiveKeyboard
└── react (hooks: useState, useRef, useCallback)

KeyboardKey
├── react (ReactNode type)
├── class-variance-authority (for variants)
└── cn utility

keyboard-layouts
└── pure TypeScript (no dependencies)
```

---

## 🎉 Complete System

All components work together to provide a seamless touch-optimized input experience with full physical keyboard blocking and intelligent mode switching.

---

**For implementation details, see the [Integration Guide](../ADAPTIVE_KEYBOARD_INTEGRATION.md)**
