// Single source of truth for keyboard-avoiding behavior on mobile.
//
// Goal: when the soft keyboard opens, the composer (TextInput + Send)
// stays visible on both platforms regardless of installed-build
// manifest quirks. We use KeyboardAvoidingView with a per-platform
// `behavior` because relying on `windowSoftInputMode` alone is
// brittle — older installed APKs may have a different mode than what
// app.json currently declares, and the symptom is exactly the bug the
// user reports: composer hidden under the keyboard.
//
// iOS: behavior="padding" → RN pads the KAV bottom by the keyboard
//   height. keyboardVerticalOffset accounts for chrome below the
//   KAV's outer bottom edge (bottom tab bar, when mounted).
// Android: behavior="height" → RN shrinks the KAV's height by the
//   keyboard height. This works regardless of whether the OS picks
//   adjustResize or adjustPan, because RN computes the offset from
//   the Keyboard module's own events, not from the OS layout pass.

import { type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from "react-native";

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  // Override the iOS vertical offset. Use when the wrapping screen
  // is outside the tab navigator (modal sheets, sign-in route).
  offset?: number;
  // Skip the tab-bar offset (the screen sits ABOVE the tab
  // navigator — e.g. /agent/loan/[id]).
  excludeTabBar?: boolean;
  // Escape hatch: pass enabled={false} to fully bypass the wrapper.
  enabled?: boolean;
}

const TAB_BAR_HEIGHT = 64;

export function KeyboardAware({
  children,
  style,
  offset,
  excludeTabBar = false,
  enabled = true,
}: Props) {
  const tabBar = excludeTabBar ? 0 : TAB_BAR_HEIGHT;
  const computed = offset !== undefined ? offset : tabBar;
  const isAndroid = Platform.OS === "android";

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={isAndroid ? "height" : "padding"}
      keyboardVerticalOffset={computed}
      enabled={enabled}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
