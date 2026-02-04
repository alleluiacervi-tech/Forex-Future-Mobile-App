export type RootStackParamList = {
  Landing: undefined;
  Main: undefined;
  CurrencyDetail: { pair: string };
  ChartDetail: { pair: string };
  TradeDetail: { pair: string };
  About: undefined;
  Welcome: undefined;
  ForgotPassword:
    | undefined
    | {
        email?: string;
      };
  ResetPassword:
    | undefined
    | {
        email?: string;
        token?: string;
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
