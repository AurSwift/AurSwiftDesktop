# React Hook Form + Zod Integration Guide

Complete guide for integrating the Adaptive Keyboard with React Hook Form and Zod validation.

---

## ⚠️ The Challenge

The adaptive keyboard uses `readOnly` inputs to block physical keyboard input. This creates a conflict with React Hook Form:

```tsx
// ❌ This doesn't work!
const { register } = useForm()

<input 
  {...register("username")}  // Expects onChange to fire
  readOnly  // Blocks onChange!
/>
```

**Problem**: With `readOnly` set, React Hook Form's `onChange` handler never fires, so the form state doesn't update when you type on the adaptive keyboard.

---

## ✅ The Solution

We've created a dedicated hook `useKeyboardWithRHF` that bridges the keyboard and React Hook Form by manually calling `setValue`.

---

## 🚀 Quick Start

### 1. Install (Already Done)

All dependencies are already in AuraSwift:
- `react-hook-form` ✅
- `@hookform/resolvers` ✅
- `zod` ✅

### 2. Use the Hook

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AdaptiveKeyboard, AdaptiveFormField } from "@/components/adaptive-keyboard";
import { useKeyboardWithRHF } from "@/shared/hooks";

// Define Zod schema
const schema = z.object({
  username: z.string().min(3, "Min 3 characters"),
  email: z.string().email("Invalid email"),
  phone: z.string().regex(/^\d{10}$/, "Must be 10 digits"),
});

type FormData = z.infer<typeof schema>;

function MyForm() {
  // React Hook Form setup
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: "",
      email: "",
      phone: "",
    },
    mode: "onChange", // Validate on change
  });

  // Keyboard integration
  const keyboard = useKeyboardWithRHF({
    setValue: form.setValue,
    watch: form.watch,
    fieldConfigs: {
      username: { keyboardMode: "qwerty" },
      email: { keyboardMode: "qwerty" },
      phone: { keyboardMode: "numeric" },
    },
  });

  const onSubmit = (data: FormData) => {
    console.log("Valid data:", data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="pb-[340px]">
      {/* Username Field */}
      <AdaptiveFormField
        {...form.register("username")}
        label="Username"
        value={keyboard.formValues.username}
        error={form.formState.errors.username?.message}
        onFocus={() => keyboard.handleFieldFocus("username")}
        readOnly
      />

      {/* Email Field */}
      <AdaptiveFormField
        {...form.register("email")}
        label="Email"
        value={keyboard.formValues.email}
        error={form.formState.errors.email?.message}
        onFocus={() => keyboard.handleFieldFocus("email")}
        readOnly
      />

      {/* Phone Field */}
      <AdaptiveFormField
        {...form.register("phone")}
        label="Phone"
        value={keyboard.formValues.phone}
        error={form.formState.errors.phone?.message}
        onFocus={() => keyboard.handleFieldFocus("phone")}
        readOnly
      />

      <button type="submit" disabled={!form.formState.isValid}>
        Submit
      </button>

      {/* Keyboard */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <AdaptiveKeyboard
          onInput={keyboard.handleInput}
          onBackspace={keyboard.handleBackspace}
          onClear={keyboard.handleClear}
          onEnter={() => console.log("Next")}
          initialMode={keyboard.activeFieldConfig?.keyboardMode || "qwerty"}
          visible={keyboard.showKeyboard}
          onClose={keyboard.handleCloseKeyboard}
        />
      </div>
    </form>
  );
}
```

---

## 📖 API Reference

### `useKeyboardWithRHF`

Hook to integrate adaptive keyboard with React Hook Form.

```typescript
interface UseKeyboardWithRHFOptions<T extends FieldValues> {
  setValue: UseFormSetValue<T>           // RHF's setValue function
  watch: UseFormWatch<T>                 // RHF's watch function
  fieldConfigs?: Partial<Record<keyof T, {
    keyboardMode?: "qwerty" | "numeric" | "symbols"
  }>>
}
```

**Returns:**

```typescript
{
  // State
  activeField: keyof T | null            // Currently focused field
  showKeyboard: boolean                  // Keyboard visibility
  activeFieldConfig: FieldConfig | null  // Config for active field
  formValues: T                          // All form values (from watch())

  // Handlers (automatically integrate with RHF)
  handleInput: (char: string) => void
  handleBackspace: () => void
  handleClear: () => void
  handleFieldFocus: (field: keyof T) => void
  handleCloseKeyboard: () => void

  // Utilities
  setShowKeyboard: (show: boolean) => void
}
```

---

## 🎯 Features

### ✅ Real-Time Validation

Validation happens automatically as you type on the keyboard:

```tsx
const schema = z.object({
  username: z.string().min(3, "Min 3 characters"),
  email: z.string().email("Invalid email"),
});

const form = useForm({
  resolver: zodResolver(schema),
  mode: "onChange", // Validate on every change
});

// When you type on keyboard:
// 1. keyboard.handleInput() called
// 2. setValue() called with shouldValidate: true
// 3. Zod validation runs automatically
// 4. Errors appear in real-time
```

### ✅ All Zod Features Work

- String validation (min, max, regex, email, url, etc.)
- Number validation (min, max, int, positive, etc.)
- Custom validation (refine, superRefine)
- Async validation
- Conditional validation
- Nested objects
- Arrays

### ✅ All RHF Features Work

- Form state (`isDirty`, `isValid`, `isSubmitting`, etc.)
- Field state (`touched`, `dirty`, `error`)
- Form methods (`reset`, `setError`, `clearErrors`)
- Watch values
- Trigger validation manually
- Submit handlers

---

## 💡 Advanced Examples

### Example 1: Custom Validation Rules

```tsx
const schema = z.object({
  username: z
    .string()
    .min(3, "Min 3 characters")
    .max(20, "Max 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
  
  password: z
    .string()
    .min(8, "Min 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain number"),
  
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords must match",
  path: ["confirmPassword"],
});
```

### Example 2: Async Validation

```tsx
const schema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
});

const form = useForm({
  resolver: zodResolver(schema),
  mode: "onChange",
});

// Add async validation
const checkUsernameAvailable = async (username: string) => {
  const response = await fetch(`/api/check-username?username=${username}`);
  return response.json();
};

// In your component
useEffect(() => {
  const subscription = form.watch(async (value, { name }) => {
    if (name === "username" && value.username && value.username.length >= 3) {
      const available = await checkUsernameAvailable(value.username);
      if (!available) {
        form.setError("username", {
          type: "manual",
          message: "Username already taken",
        });
      }
    }
  });
  return () => subscription.unsubscribe();
}, [form]);
```

### Example 3: Conditional Fields

```tsx
const schema = z.object({
  accountType: z.enum(["personal", "business"]),
  username: z.string().min(3),
  companyName: z.string().optional(),
}).refine(
  (data) => {
    if (data.accountType === "business") {
      return !!data.companyName && data.companyName.length >= 3;
    }
    return true;
  },
  {
    message: "Company name required for business accounts",
    path: ["companyName"],
  }
);
```

### Example 4: Field Navigation

```tsx
const fields = ["username", "email", "phone"] as const;
type FieldName = (typeof fields)[number];

const keyboard = useKeyboardWithRHF<FormData>({ setValue, watch });

const handleEnter = () => {
  if (!keyboard.activeField) return;
  
  const currentIndex = fields.indexOf(keyboard.activeField as FieldName);
  if (currentIndex < fields.length - 1) {
    // Move to next field
    const nextField = fields[currentIndex + 1];
    keyboard.handleFieldFocus(nextField);
    inputRefs.current[nextField]?.focus();
  } else {
    // Last field - submit if valid
    if (form.formState.isValid) {
      form.handleSubmit(onSubmit)();
    }
  }
};

<AdaptiveKeyboard
  onEnter={handleEnter}
  // ... other props
/>
```

---

## 🧪 Testing

### Test Real-Time Validation

1. Start with empty form
2. Focus username field
3. Type "ab" on keyboard
4. See error: "Min 3 characters"
5. Type "c" on keyboard
6. Error disappears ✓

### Test Submit Validation

```tsx
const onSubmit = (data: FormData) => {
  console.log("Valid data:", data);
};

const onError = (errors: any) => {
  console.log("Validation failed:", errors);
};

<form onSubmit={form.handleSubmit(onSubmit, onError)}>
```

---

## 🐛 Common Issues

### Issue: Validation Not Running

**Problem**: Errors don't appear when typing

**Solution**: Set `mode: "onChange"` in useForm

```tsx
const form = useForm({
  resolver: zodResolver(schema),
  mode: "onChange", // ✅ Add this
});
```

### Issue: Form State Not Updating

**Problem**: `form.formState.isDirty` stays false

**Solution**: Ensure `shouldDirty: true` in setValue (already handled by hook)

```tsx
// The hook already does this:
setValue(field, value, {
  shouldValidate: true,
  shouldDirty: true, // ✅ This marks field as dirty
  shouldTouch: true,
});
```

### Issue: Submit Button Not Enabling

**Problem**: Button stays disabled even when form is valid

**Solution**: Check `form.formState.isValid`

```tsx
<button 
  type="submit" 
  disabled={!form.formState.isValid}  // ✅ Correct
>
  Submit
</button>
```

---

## 📊 Comparison: Manual vs Hook

### Without Hook (Manual)

```tsx
// ❌ Lots of boilerplate
const [activeField, setActiveField] = useState(null);
const [showKeyboard, setShowKeyboard] = useState(false);
const formValues = watch();

const handleInput = (char: string) => {
  if (!activeField) return;
  setValue(activeField, formValues[activeField] + char, {
    shouldValidate: true,
    shouldDirty: true,
  });
};

const handleBackspace = () => {
  if (!activeField) return;
  setValue(activeField, formValues[activeField].slice(0, -1), {
    shouldValidate: true,
  });
};
// ... more handlers
```

### With Hook (Recommended)

```tsx
// ✅ Clean and simple
const keyboard = useKeyboardWithRHF({
  setValue: form.setValue,
  watch: form.watch,
});

// All handlers ready to use:
// - keyboard.handleInput
// - keyboard.handleBackspace
// - keyboard.handleClear
// - keyboard.handleFieldFocus
```

---

## 🎯 Best Practices

### 1. Always Set Validation Mode

```tsx
const form = useForm({
  resolver: zodResolver(schema),
  mode: "onChange", // ✅ Validate as user types
});
```

### 2. Show Errors Clearly

```tsx
<AdaptiveFormField
  error={form.formState.errors.username?.message}
  // ... other props
/>
```

### 3. Disable Submit When Invalid

```tsx
<button 
  type="submit" 
  disabled={!form.formState.isValid || form.formState.isSubmitting}
>
  Submit
</button>
```

### 4. Configure Keyboard Modes

```tsx
const keyboard = useKeyboardWithRHF({
  setValue: form.setValue,
  watch: form.watch,
  fieldConfigs: {
    phone: { keyboardMode: "numeric" },    // ✅ Numbers only
    email: { keyboardMode: "qwerty" },     // ✅ Full keyboard
    amount: { keyboardMode: "numeric" },   // ✅ Numbers
  },
});
```

### 5. Handle Both Success and Error

```tsx
const onSubmit = (data: FormData) => {
  console.log("Success:", data);
  // Process valid data
};

const onError = (errors: any) => {
  console.log("Errors:", errors);
  // Show error notification
};

<form onSubmit={form.handleSubmit(onSubmit, onError)}>
```

---

## 📚 Complete Example

See the working demo:
- **File**: `packages/renderer/src/components/adaptive-keyboard/examples/react-hook-form-example.tsx`
- **Import**: `import { ReactHookFormExample } from "@/components/adaptive-keyboard/examples/react-hook-form-example"`

---

## ✅ Summary

**Does it work with React Hook Form + Zod?**

✅ **YES!** Using the `useKeyboardWithRHF` hook:

1. ✅ Full Zod validation support
2. ✅ Real-time validation as you type
3. ✅ All RHF features work
4. ✅ Clean, simple API
5. ✅ Production-ready

**Key Points:**
- Use `useKeyboardWithRHF` hook (not vanilla `useAdaptiveKeyboard`)
- Set `mode: "onChange"` in useForm
- All validation happens automatically
- Works exactly like normal RHF, just with virtual keyboard input

---

**You're all set! React Hook Form + Zod + Adaptive Keyboard work perfectly together. 🎉**

