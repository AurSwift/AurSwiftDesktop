# Adaptive Keyboard - Quick Reference Card

One-page cheat sheet for the Adaptive Keyboard system.

---

## 🎯 Import Statements

```tsx
// Components
import { AdaptiveKeyboard, AdaptiveFormField } from "@/components/adaptive-keyboard";

// Hook
import { useAdaptiveKeyboard } from "@/shared/hooks/use-adaptive-keyboard";

// Types
import type { KeyboardMode, KeyType } from "@/components/adaptive-keyboard";
```

---

## ⚡ Minimal Example

```tsx
function SimpleForm() {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);

  return (
    <>
      <div className="pb-[340px]">
        <AdaptiveFormField label="Username" value={value} onFocus={() => setShow(true)} readOnly />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50">
        <AdaptiveKeyboard
          visible={show}
          onInput={(c) => setValue((v) => v + c)}
          onBackspace={() => setValue((v) => v.slice(0, -1))}
          onClear={() => setValue("")}
          onEnter={() => console.log("Submit")}
          onClose={() => setShow(false)}
        />
      </div>
    </>
  );
}
```

---

## 🎣 Hook Example

```tsx
type Fields = "username" | "email" | "phone";

function FormWithHook() {
  const { formData, showKeyboard, inputRefs, activeFieldConfig, handleInput, handleBackspace, handleClear, handleEnter, handleFieldFocus } = useAdaptiveKeyboard<Fields>({
    fields: ["username", "email", "phone"],
    fieldConfigs: {
      username: { type: "text", keyboardMode: "qwerty" },
      email: { type: "email", keyboardMode: "qwerty" },
      phone: { type: "tel", keyboardMode: "numeric" },
    },
  });

  return (
    <>
      <div className="pb-[340px]">
        <AdaptiveFormField
          ref={(el) => {
            inputRefs.current.username = el;
          }}
          label="Username"
          value={formData.username}
          onFocus={() => handleFieldFocus("username")}
          readOnly
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50">
        <AdaptiveKeyboard
          onInput={handleInput}
          onBackspace={handleBackspace}
          onClear={handleClear}
          onEnter={handleEnter}
          initialMode={activeFieldConfig?.keyboardMode || "qwerty"}
          inputType={activeFieldConfig?.type || "text"}
          visible={showKeyboard}
        />
      </div>
    </>
  );
}
```

---

## 📋 Component Props

### AdaptiveKeyboard

| Prop          | Type                                     | Required | Default    | Description              |
| ------------- | ---------------------------------------- | -------- | ---------- | ------------------------ |
| `onInput`     | `(char: string) => void`                 | ✅       | -          | Character input handler  |
| `onBackspace` | `() => void`                             | ✅       | -          | Delete last character    |
| `onClear`     | `() => void`                             | ✅       | -          | Clear entire field       |
| `onEnter`     | `() => void`                             | ✅       | -          | Enter/next field handler |
| `onTab`       | `() => void`                             | ❌       | -          | Tab navigation           |
| `initialMode` | `KeyboardMode`                           | ❌       | `"qwerty"` | Starting mode            |
| `inputType`   | `"text" \| "number" \| "email" \| "tel"` | ❌       | `"text"`   | Auto-switch mode         |
| `visible`     | `boolean`                                | ❌       | `true`     | Show/hide                |
| `onClose`     | `() => void`                             | ❌       | -          | Close handler            |
| `className`   | `string`                                 | ❌       | -          | Custom styles            |

### AdaptiveFormField

| Prop       | Type                  | Required | Default | Description      |
| ---------- | --------------------- | -------- | ------- | ---------------- |
| `label`    | `string`              | ✅       | -       | Field label      |
| `value`    | `string`              | ✅       | -       | Field value      |
| `onFocus`  | `() => void`          | ✅       | -       | Focus handler    |
| `error`    | `string`              | ❌       | -       | Error message    |
| `readOnly` | `boolean`             | ⚠️       | `false` | **Set to true!** |
| `...props` | `InputHTMLAttributes` | ❌       | -       | All input props  |

---

## 🎹 Keyboard Modes

```typescript
type KeyboardMode = "qwerty" | "numeric" | "symbols";
```

- **QWERTY**: Full alphanumeric keyboard (default for text/email)
- **NUMERIC**: Calculator-style keypad (auto for number/tel)
- **SYMBOLS**: Special characters (#, $, %, etc.)

---

## 🔧 Hook API

```typescript
useAdaptiveKeyboard<T extends string>({
  fields: T[]                           // Field names
  initialValues?: Partial<Record<T, string>>
  fieldConfigs?: Partial<Record<T, FieldConfig>>
  onSubmit?: (data: Record<T, string>) => void
})
```

**Returns:**

```typescript
{
  // State
  formData: Record<T, string>
  activeField: T | null
  showKeyboard: boolean
  inputRefs: MutableRefObject<Record<T, HTMLInputElement | null>>
  activeFieldConfig: FieldConfig | null

  // Handlers
  handleInput: (char: string) => void
  handleBackspace: () => void
  handleClear: () => void
  handleEnter: () => void
  handleTab: () => void
  handleFieldFocus: (field: T) => void
  handleCloseKeyboard: () => void

  // Utilities
  resetForm: () => void
  updateField: (field: T, value: string) => void
  setFormData: Dispatch<SetStateAction<Record<T, string>>>
  setShowKeyboard: Dispatch<SetStateAction<boolean>>
}
```

---

## 🎨 Essential CSS Classes

### Form Container

```tsx
<div className="pb-[340px]">  {/* Keyboard height + margin */}
```

### Keyboard Container

```tsx
<div className="fixed bottom-0 left-0 right-0 z-50">
```

### Active Field Highlight

```tsx
className={activeField === "username" ? "ring-2 ring-primary" : ""}
```

---

## ⚠️ Common Mistakes

### ❌ Wrong

```tsx
// Missing readOnly
<AdaptiveFormField
  value={value}
  onFocus={handleFocus}
/>

// No bottom padding
<div>
  <AdaptiveFormField ... />
</div>

// Wrong positioning
<div className="relative">
  <AdaptiveKeyboard ... />
</div>
```

### ✅ Correct

```tsx
// With readOnly
<AdaptiveFormField
  value={value}
  onFocus={handleFocus}
  readOnly  // ← Blocks physical keyboard
/>

// With bottom padding
<div className="pb-[340px]">
  <AdaptiveFormField ... />
</div>

// Fixed positioning
<div className="fixed bottom-0 left-0 right-0 z-50">
  <AdaptiveKeyboard ... />
</div>
```

---

## 🐛 Quick Fixes

| Problem                 | Solution                           |
| ----------------------- | ---------------------------------- |
| Physical keyboard works | Add `readOnly` to input            |
| Keyboard blocks content | Add `pb-[340px]` to form container |
| State not updating      | Set `activeField` in `onFocus`     |
| Keyboard not visible    | Check `visible` prop and z-index   |
| Wrong keyboard mode     | Set `inputType` or `initialMode`   |

---

## 📂 File Locations

```
packages/renderer/src/
├── components/adaptive-keyboard/
│   ├── adaptive-keyboard.tsx
│   ├── adaptive-form-field.tsx
│   ├── keyboard-key.tsx
│   ├── keyboard-layouts.ts
│   └── examples/keyboard-demo-form.tsx
└── shared/hooks/
    └── use-adaptive-keyboard.ts
```

---

## 🧪 Testing Checklist

- [ ] Field focus shows keyboard
- [ ] Physical keyboard blocked
- [ ] Mode switches work (ABC/123/#+=)
- [ ] Enter navigates to next field
- [ ] Backspace removes character
- [ ] Clear empties field
- [ ] Shift/Caps Lock work
- [ ] Keyboard can close

---

## 📱 Demo

```tsx
import { KeyboardDemoForm } from "@/components/adaptive-keyboard/examples/keyboard-demo-form";

function App() {
  return <KeyboardDemoForm />;
}
```

---

## 📚 Full Documentation

- **Complete Guide**: `/docs/ADAPTIVE_KEYBOARD_INTEGRATION.md`
- **Integration Summary**: `/KEYBOARD_INTEGRATION_SUMMARY.md`
- **Component README**: `/packages/renderer/src/components/adaptive-keyboard/README.md`

---

**Print this page for quick reference while coding! 📄**
