import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  code?: string;
  url?: string;
  onClose?: () => void;
};

const DeviceCodeModal: React.FC<Props> = ({ visible, code, url, onClose }) => {
  if (!visible) return null;
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Connect Trakt</Text>
          <Text style={styles.subtitle}>Visit</Text>
          <Text style={styles.url}>{url || 'https://trakt.tv/activate'}</Text>
          <Text style={styles.subtitle}>and enter the code</Text>
          <Text style={styles.code}>{code || '------'}</Text>
          <Text style={styles.note}>Leave this screen open while you authorize.</Text>
          <Text style={styles.dismiss}>Press Back to close this prompt.</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    width: 420,
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontFamily: 'Inter-Medium',
    marginBottom: 12,
  },
  subtitle: {
    color: '#bbbbbb',
    fontSize: 14,
    marginTop: 4,
  },
  url: {
    color: 'white',
    fontSize: 16,
    marginTop: 6,
  },
  code: {
    color: 'white',
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    letterSpacing: 2,
    marginVertical: 12,
  },
  note: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  dismiss: {
    color: '#bbbbbb',
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
    opacity: 0.8,
  },
});

export default DeviceCodeModal;
