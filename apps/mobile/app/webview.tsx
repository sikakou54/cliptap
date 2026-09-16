/**
 * @module WebViewScreen
 * @description WebView画面
 *
 * 利用規約やプライバシーポリシーなどの静的HTMLコンテンツを表示。
 * アプリ内のassets/web/配下のHTMLファイルを読み込む。
 *
 * @param file - 表示するHTMLファイル名（拡張子なし）
 * @param title - ヘッダーに表示するタイトル
 *
 * @see assets/web/terms.html - 利用規約
 * @see assets/web/privacy.html - プライバシーポリシー
 */

import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useTheme } from '@lib/themeSystem';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { useWebViewScreen } from '@hooks/screens/useWebViewScreen';

export default function WebViewScreen() {
  const { colors } = useTheme();
  const { file, title: paramTitle } = useLocalSearchParams<{ file: string; title: string }>();

  const { htmlContent, loading, title, handleShouldStartLoad } = useWebViewScreen({
    file: file ?? '',
    title: paramTitle ?? 'ClipTap',
  });

  return (
    <ScreenContainer title={title} backIcon="arrow-back">
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <WebView
          source={{ html: htmlContent }}
          style={styles.webview}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          /* お問い合わせのmailtoリンクはWebViewが扱えないため、OSへ渡してメールアプリを開く */
          onShouldStartLoadWithRequest={handleShouldStartLoad}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webview: {
    flex: 1,
  },
});
