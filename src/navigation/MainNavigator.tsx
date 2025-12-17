import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList, MainTabParamList } from './types';
import { NAVIGATION_CONFIG } from './config';

// Screens
import HomeScreen from '../screens/Home';
import MarketScreen from '../screens/Market';
import NotificationsScreen from '../screens/Notifications';
import ProfileScreen from '../screens/Profile';
import CurrencyDetailScreen from '../screens/CurrencyDetail';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Market') {
            iconName = 'show-chart';
          } else if (route.name === 'Notifications') {
            iconName = 'notifications';
          } else {
            iconName = 'account-circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        ...NAVIGATION_CONFIG,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Market" component={MarketScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: NAVIGATION_CONFIG.headerStyle.backgroundColor,
          },
          headerTintColor: NAVIGATION_CONFIG.headerTintColor,
        }}
      >
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CurrencyDetail"
          component={CurrencyDetailScreen}
          options={{ title: 'Currency Details' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

