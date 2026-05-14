// Single source of truth for keyboard-avoiding behavior on mobile.
//
// The whole point: when the soft keyboard opens, the composer
// (text input + send button) at the bottom of a chat screen has to
// stay visible. iOS and Android handle this with different OS-level
// mechanisms, and mixing them up makes the composer disappear
// behind the keyboard. This wrapper picks the right mechanism per
// platform.
//
// iOS: there is no OS-level pan / resize for the keyboard. The
// app has to translate its own content up. We use
// `behavior="padding"` so React Native pads the bottom of the KAV
// when the keyboard rises. `keyboardVerticalOffset` accounts for
// any chrome BELOW the KAV's outer bottom edge (the bottom tab
// bar, when one is mounted).
//
// Android: `app.json` sets `android.softwareKeyboardLayoutMode:
// "pan"`. The OS slides the entire window up so the focused input
// stays on screen. RN's KeyboardAvoidingView must NOT also add
// padding in this mode — the two mechanisms double up and end up
// pushing the composer either too high or, more commonly, leave
// it directly under the keyboard. So on Android we disable the
// KeyboardAvoidingView entirely (`enabled={false}`) and let pan
// mode handle the lift. The composer's own paddingBottom is what
// keeps it clear of the system nav bar when the keyboard is
// CLOSED — see LoanChatComposer.tsx.

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

  // Android: pan mode handles everything at the OS layer.
  // Disabling KAV avoids the double-handling bug that left the
  // composer behind the keyboard.
  const isAndroid = Platform.OS === "android";
  const effectiveEnabled = enabled && !isAndroid;

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={isAndroid ? undefined : "padding"}
      keyboardVerticalOffset={computed}
      enabled={effectiveEnabled}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
