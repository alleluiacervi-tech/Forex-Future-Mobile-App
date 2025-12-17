import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ScreenWrapper, Container, EmptyState } from '../../components/layout';

export default function NotificationsScreen() {
  return (
    <ScreenWrapper>
      <Container>
        <EmptyState
          icon="notifications-none"
          title="No Notifications"
          message="You don't have any notifications yet"
        />
      </Container>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({});

