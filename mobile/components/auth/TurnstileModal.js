import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

const buildTurnstileHtml = (siteKey) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Turnstile</title>
    <style>
      html, body { height: 100%; margin: 0; background: #ffffff; }
      .container { height: 100%; display: flex; align-items: center; justify-content: center; }
    </style>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  </head>
  <body>
    <div class="container">
      <div id="turnstile-widget"></div>
    </div>
    <script>
      const post = (payload) => {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      };
      const renderWidget = () => {
        if (!window.turnstile) {
          setTimeout(renderWidget, 50);
          return;
        }
        window.turnstile.render('#turnstile-widget', {
          sitekey: '${siteKey}',
          callback: function(token) { post({ token }); },
          'expired-callback': function() { post({ expired: true }); },
          'error-callback': function() { post({ error: true }); },
        });
      };
      renderWidget();
    </script>
  </body>
</html>`;

const TurnstileModal = ({ visible, siteKey, onSuccess, onCancel }) => {
  const html = useMemo(() => buildTurnstileHtml(siteKey || ''), [siteKey]);

  const handleMessage = (event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload?.token) {
        onSuccess(payload.token);
        return;
      }
    } catch {
      // Ignore malformed payloads
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 bg-black/40 items-center justify-center px-6">
        <View className="bg-white w-full max-w-[420px] rounded-3xl p-6">
          <Text className="text-lg font-bold text-slate-900 text-center mb-2">
            One Quick Check
          </Text>
          <Text className="text-sm text-slate-600 text-center mb-4">
            Please complete the security check to continue.
          </Text>
          {siteKey ? (
            <View className="h-[170px] w-full overflow-hidden rounded-2xl border border-slate-200">
              <WebView
                originWhitelist={['*']}
                source={{ html }}
                onMessage={handleMessage}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                renderLoading={() => (
                  <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="small" color="#10B981" />
                  </View>
                )}
              />
            </View>
          ) : (
            <View className="h-[170px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
              <Text className="text-sm text-slate-500 text-center px-4">
                Turnstile site key is missing.
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={onCancel}
            className="mt-4 py-3 rounded-xl bg-slate-100"
            activeOpacity={0.8}
          >
            <Text className="text-center text-slate-700 font-semibold">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default TurnstileModal;