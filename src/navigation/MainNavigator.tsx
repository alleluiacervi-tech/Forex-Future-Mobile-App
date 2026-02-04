import React from 'react';
import type { ComponentProps } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { RootStackParamList, MainTabParamList } from '../types';
import { NAVIGATION_CONFIG } from './config';
import { navigationRef } from './rootNavigation';

// Screens
import LandingScreen from '../screens/Landing';
import HomeScreen from '../screens/Home';
import MarketScreen from '../screens/Market';
import NotificationsScreen from '../screens/Notifications';
import ProfileScreen from '../screens/Profile';
import CurrencyDetailScreen from '../screens/CurrencyDetail';
import AboutScreen from '../screens/About';
import WelcomeScreen from '../screens/Welcome';
import ForgotPasswordScreen from '../screens/ForgotPassword';
import ResetPasswordScreen from '../screens/ResetPassword';
import SubscriptionScreen from '../screens/Subscription';
import SettingsScreen from '../screens/Settings';
import SubscriptionPlanScreen from '../screens/Account/SubscriptionPlanScreen';
import SecurityScreen from '../screens/Account/SecurityScreen';
import BillingPaymentsScreen from '../screens/Account/BillingPaymentsScreen';
import PrivacyPolicyScreen from '../screens/Legal/PrivacyPolicyScreen';
import RiskDisclosureScreen from '../screens/Legal/RiskDisclosureScreen';
import LicensesScreen from '../screens/Legal/LicensesScreen';
import HelpCenterScreen from '../screens/Support/HelpCenterScreen';
import ContactUsScreen from '../screens/Support/ContactUsScreen';
import TermsOfServiceScreen from '../screens/Terms/TermsOfServiceScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'forexapp://'],
  config: {
    screens: {
      Landing: '',
      Welcome: 'welcome',
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset-password',
      Main: 'main',
      Subscription: 'subscription',
      Settings: 'settings',
    },
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: ComponentProps<typeof Icon>['name'];

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
        tabBarStyle: { display: 'none' },
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
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: NAVIGATION_CONFIG.headerStyle.backgroundColor,
          },
          headerTintColor: NAVIGATION_CONFIG.headerTintColor,
        }}
        initialRouteName="Landing"
      >
        <Stack.Screen
          name="Landing"
          component={LandingScreen}
          options={{ headerShown: false }}
        />
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
        <Stack.Screen
          name="About"
          component={AboutScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Subscription"
          component={SubscriptionScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SubscriptionPlan"
          component={SubscriptionPlanScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Security"
          component={SecurityScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BillingPayments"
          component={BillingPaymentsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RiskDisclosure"
          component={RiskDisclosureScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Licenses"
          component={LicensesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="HelpCenter"
          component={HelpCenterScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ContactUs"
          component={ContactUsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TermsOfService"
          component={TermsOfServiceScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
