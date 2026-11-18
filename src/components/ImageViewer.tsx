import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Full-screen photo viewer. */
export default function ImageViewer({
  uri,
  onClose,
}: {
  uri: string | null;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={!!uri}
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={styles.page}>
        {!!uri && (
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel="Ảnh toàn màn hình"
          />
        )}
        <SafeAreaView style={styles.top} edges={['top']}>
          <Pressable
            onPress={onClose}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Đóng ảnh"
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' },
  image: { flex: 1, width: '100%' },
  top: { position: 'absolute', top: 0, right: 0 },
  close: {
    margin: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
});
