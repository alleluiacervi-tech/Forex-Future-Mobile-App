export type RootStackParamList = {
  Landing: undefined;
  Main: undefined;
  CurrencyDetail: { pair: string };
  ChartDetail: { pair: string };
  TradeDetail: { pair: string };
  About: undefined;
  Welcome: undefined;
  AdminDashboard: undefined;
  Register: undefined;
  LoginOtp:
    | undefined
    | {
        email?: string;
        code?: string;
        debugCode?: string;
        debugExpiresAt?: string;
      };
  VerifyEmail:
    | undefined
    | {
        email?: string;
        code?: string;
        debugCode?: string;
        debugExpiresAt?: string;
        nextScreen?: keyof RootStackParamList;
        nextParams?: unknown;
      };
  ForgotPassword:
    | undefined
    | {
        email?: string;
      };
  ResetPassword:
    | undefined
    | {
        email?: string;
        code?: string;
        debugCode?: string;
        debugExpiresAt?: string;
      };
  Subscription: undefined;
  Settings: undefined;
  SubscriptionPlan: undefined;
  Security: undefined;
  BillingPayments:
    | undefined
    | {
        setupTrial?: boolean;
        email?: string;
        password?: string;
        selectedBilling?: 'monthly' | 'quarterly' | 'yearly';
        selectedPrice?: number;
        billingLabel?: string;
      };
  Pricing: undefined;
  Payment:
    | undefined
    | {
        plan?: string;
      };
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
  RiskDisclosure: undefined;
  Licenses: undefined;
  HelpCenter: undefined;
  ContactUs: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Market: undefined;
  Notifications: undefined;
  Profile: undefined;
};
