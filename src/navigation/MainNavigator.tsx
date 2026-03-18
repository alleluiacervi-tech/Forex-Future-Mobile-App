


import React from 'react';
import { View, StyleSheet } from 'react-native';
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
import { useAuth } from '../context/AuthContext'; // ADDED: for push notification auth check (CHECK 2)
import { usePushNotifications } from '../hooks'; // ADDED: push notification hook (CHECK 2 + 13)

// Screens
import LandingScreen from '../screens/Landing';
import HomeScreen from '../screens/Home';
import MarketScreen from '../screens/Market';
import NotificationsScreen from '../screens/Notifications';
import ProfileScreen from '../screens/Profile';
import CurrencyDetailScreen from '../screens/CurrencyDetail';
import AboutScreen from '../screens/About';
import WelcomeScreen from '../screens/Welcome';
import {
  AdminDashboardScreen,
  AdminUsersScreen,
  AdminUserDetailScreen,
  AdminBroadcastScreen,
  AdminSystemScreen,
} from '../screens/admin';
import AdminModeToggle from '../components/admin/AdminModeToggle';
import LoginOtpScreen from '../screens/LoginOtp';
import VerifyEmailScreen from '../screens/VerifyEmail';
import ForgotPasswordScreen from '../screens/ForgotPassword';
import ResetPasswordScreen from '../screens/ResetPassword';
import SubscriptionScreen from '../screens/Subscription';
import RegisterScreen from '../screens/Auth/RegisterScreen';
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
import PricingScreen from '../screens/Pricing';
import PaymentScreen from '../screens/Payment';
import OnboardingScreen from '../screens/Onboarding';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'forexapp://'],
  config: {
    screens: {
      Landing: '',
      Onboarding: 'onboarding',
      Welcome: 'welcome',
      AdminDashboard: 'admin-dashboard',
      AdminUsers: 'admin-users',
      AdminUserDetail: 'admin-user-detail',
      AdminBroadcast: 'admin-broadcast',
      AdminSystem: 'admin-system',
      Register: 'register',
      LoginOtp: 'login-otp',
      VerifyEmail: 'verify-email',
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset-password',
      Main: 'main',
      Subscription: 'subscription',
      Settings: 'settings',
    },
  },
};

function MainTabs() {
  // ADDED: register push notifications when user is authenticated (CHECK 2)
  const { isAuthenticated } = useAuth();
  usePushNotifications(isAuthenticated);

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
        // FIXED: removed tabBarStyle: { display: 'none' } which hid the entire tab bar
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
      <View style={navStyles.container}>
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
          name="Onboarding"
          component={OnboardingScreen}
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
          name="AdminDashboard"
          component={AdminDashboardScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminUsers"
          component={AdminUsersScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminUserDetail"
          component={AdminUserDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminBroadcast"
          component={AdminBroadcastScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminSystem"
          component={AdminSystemScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="LoginOtp"
          component={LoginOtpScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="VerifyEmail"
          component={VerifyEmailScreen}
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
          name="Pricing"
          component={PricingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Payment"
          component={PaymentScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TermsOfService"
          component={TermsOfServiceScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
      <AdminModeToggle />
      </View>
    </NavigationContainer>
  );
}

const navStyles = StyleSheet.create({
  container: { flex: 1 },
});
