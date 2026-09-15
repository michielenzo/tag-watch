import React, { PropsWithChildren } from 'react';
import { Modal } from 'react-native';

export type PopupProps = PropsWithChildren<{ onDismiss: () => void }>;

export default function Popup({ children, onDismiss }: PopupProps) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss}>
      {children}
    </Modal>
  );
}
