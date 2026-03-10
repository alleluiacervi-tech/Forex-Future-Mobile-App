import React, { useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

type Props = {
  orderId: string;
  clientId: string;
  onApproved: (data: { orderId: string }) => void;
  onError: (message: string) => void;
  onCancel: () => void;
};

const buildCheckoutHtml = (clientId: string, orderId: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #070E17; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; font-family: -apple-system, sans-serif; }
    #paypal-button-container { width: 100%; max-width: 400px; }
    .loading { color: #9FB2C8; text-align: center; padding: 24px; font-size: 14px; }
  </style>
</head>
<body>
  <div id="paypal-button-container">
    <div class="loading">Loading payment options...</div>
  </div>
  <script src="https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture&enable-funding=card"></script>
  <script>
    paypal.Buttons({
      createOrder: function() {
        return '${orderId}';
      },
      onApprove: function(data) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'approved', orderId: data.orderID }));
      },
      onCancel: function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cancelled' }));
      },
      onError: function(err) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: String(err) }));
      },
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'paypal',
        tagline: false,
      },
      fundingSource: undefined,
    }).render('#paypal-button-container');
  </script>
</body>
</html>
`;

export default function PayPalCheckoutWebView({ orderId, clientId, onApproved, onError, onCancel }: Props) {
  const webViewRef = useRef<WebView>(null);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'approved') {
        onApproved({ orderId: data.orderId });
      } else if (data.type === 'cancelled') {
        onCancel();
      } else if (data.type === 'error') {
        onError(data.message || 'Payment failed.');
      }
    } catch {
      onError('Unexpected payment error.');
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: buildCheckoutHtml(clientId, orderId) }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#00D1FF" />
          </View>
        )}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#070E17',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#070E17',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
