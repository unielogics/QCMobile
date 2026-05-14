// Single source of truth for keyboard-avoiding behavior. Wraps the
// stock RN KeyboardAvoidingView and computes the right vertical
// offset for the tab bar so composers don't get hidden behind the
// on-screen keyboard.
//
// Android nuance:
//   - app.json sets `android.softwareKeyboardLayoutMode: "pan"` so the
//     activity does NOT resize when the keyboard opens — it pans
//     content up. That matches iOS behavior.
//   - We use `behavior="padding"` on both platforms.
//   - `keyboardVerticalOffset` should ONLY count IMMUTABLE chrome that
//     sits below the KAV's bottom edge (e.g., the bottom tab bar).
//     The system nav bar is NOT immutable space — when the keyboard
//     is up the keyboard reports its own height, the nav bar is
//     either hidden or accounted for by the OS. Subtracting
//     insets.bottom here used to LEAVE THE COMPOSER UNDER THE
//     KEYBOARD by that many pixels (~50px on phones with 3-button
//     nav like the S22). The composer's own paddingBottom keeps it
//     clear of the system nav bar when the keyboard is CLOSED.

import { type ReactNode } from "react";
import { KeyboardAvoidingView, type StyleProp, type ViewStyle } from "react-native";

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
  // Tab bar inside expo-router (tabs) navigator: 64px tall. Don't
  // also subtract insets.bottom — see the comment block above.
  const tabBar = excludeTabBar ? 0 : TAB_BAR_HEIGHT;
  const computed = offset !== undefined ? offset : tabBar;
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
