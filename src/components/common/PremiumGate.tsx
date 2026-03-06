// ADDED: premium feature gate modal (CHECK 10)
import React from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Text } from './Text';
import { colors } from '../../theme';

type PremiumGateProps = {
  visible: boolean;
  onClose: () => void;
  onSubscribe: () => void;
  featureName?: string;
};

export const PremiumGate: React.FC<PremiumGateProps> = ({
  visible,
  onClose,
  onSubscribe,
  featureName = 'This feature',
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              <View style={styles.iconCircle}>
                <Icon name="lock" size={36} color={colors.primary} />
              </View>
              <Text variant="h3" style={styles.title}>
                Premium Feature
              </Text>
              <Text variant="body" color={colors.textSecondary} style={styles.message}>
                {featureName} requires an active subscription. Subscribe to unlock all premium features.
              </Text>
              <TouchableOpacity style={styles.subscribeButton} onPress={onSubscribe} activeOpacity={0.8}>
                <Text variant="body" style={styles.subscribeText}>
                  View Plans
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.dismissButton}>
                <Text variant="bodySmall" color={colors.textSecondary}>
                  Maybe later
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${colors.primary}14`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  subscribeButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  subscribeText: {
    color: colors.onPrimary,
    fontWeight: '800',
  },
  dismissButton: {
    paddingVertical: 8,
  },
});
