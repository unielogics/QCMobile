// Single source of truth for keyboard-avoiding behavior. Wraps the
// stock RN KeyboardAvoidingView and computes the right vertical
// offset for the tab bar + status bar so composers don't get hidden
// behind the on-screen keyboard.
//
// Android nuance (Phase 6 fix):
//   - app.json sets `android.softwareKeyboardLayoutMode: "pan"` so the
//     activity does NOT resize when the keyboard opens — it pans
//     content up. That matches iOS behavior.
//   - With pan mode, `behavior="padding"` is the right RN KAV mode on
//     both platforms. Previously we used `behavior="height"` on
//     Android which assumes the window resizes; with pan it does not,
//     so the composer ended up behind the keyboard.
//   - We add `insets.bottom` to the offset so the composer also sits
//     above the system navigation bar (3-button nav or gesture pill)
//     on Android edge-to-edge devices.

import { type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  // Override the computed offset. Use when the wrapping screen is
  // outside the tab navigator (e.g. modal sheet, sign-in route).
  offset?: number;
  // Skip the tab bar offset (e.g. when the wrapping screen sits
  // ABOVE the tab navigator like /agent/loan/[id]).
  excludeTabBar?: boolean;
  enabled?: boolean;
}

const TAB_BAR_HEIGHT = 64;

export function KeyboardAware({ children, style, offset, excludeTabBar = false, enabled = true }: Props) {
  const insets = useSafeAreaInsets();
  // Tab bar inside expo-router (tabs) navigator: 64px tall.
  const tabBar = excludeTabBar ? 0 : TAB_BAR_HEIGHT;
  // System nav bar (Android) / home indicator (iOS) — accounted for
  // via the safe-area inset returned by react-native-safe-area-context.
  const computed = offset !== undefined ? offset : tabBar + insets.bottom;
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior="padding"
      keyboardVerticalOffset={computed}
      enabled={enabled}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
