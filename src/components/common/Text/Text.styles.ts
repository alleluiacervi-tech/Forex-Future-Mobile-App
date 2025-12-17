import { StyleSheet } from 'react-native';
import { typography, colors } from '../../../theme';

export const textStyles = StyleSheet.create({
  h1: typography.h1,
  h2: typography.h2,
  h3: typography.h3,
  h4: typography.h4,
  body: typography.body,
  bodySmall: typography.bodySmall,
  caption: typography.caption,
  defaultColor: {
    color: colors.text,
  },
});

