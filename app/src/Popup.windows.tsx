import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, type NativeSyntheticEvent } from 'react-native';
import type { PopupProps } from './Popup';

export default function Popup({ children, onDismiss }: PopupProps) {
  const container = useRef<View>(null);
  useEffect(() => {
    container.current?.focus();
  }, []);
  const keyboardProps = {
    focusable: true,
    enableFocusRing: false,
    keyDownEvents: [{ key: 'Escape' }],
    onKeyDown: (event: NativeSyntheticEvent<{ key: string }>) => {
      if (event.nativeEvent.key === 'Escape') {
        event.stopPropagation();
        onDismiss();
      }
    },
  };
  return (
    <View
      ref={container}
      {...keyboardProps}
      accessibilityViewIsModal
      style={styles.container}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
});
