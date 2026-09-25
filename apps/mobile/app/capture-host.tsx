/**
 * @module CaptureHostScreen
 * @description 撮影用ホスト画面（開発モード限定）
 *
 * ストア掲載画像で「他のアプリの入力欄に ClipTap のキーボードから入力している」場面を撮るため、
 * store/screen/host/ の無印の入力欄をWebViewで開くだけの画面。
 *
 * Safariで同じHTMLを開くとキーボードの上にフォーム用のアクセサリバー（∧ ∨ 完了）が必ず出る。
 * あれはページ側からは消せないが、WKWebViewを自前で持てば `hideKeyboardAccessoryView` が
 * WKContentView の inputAccessoryView を差し替えて消してくれる。それがこの画面の存在理由。
 *
 * 画面としての中身は無い。ヘッダーもインセットも出さず、WebViewだけを全面に置く。
 * ClipTapのUIが1pxでも写るとホストがClipTapだと分かってしまい、掲載画像として使えないため。
 *
 * 本番バンドルからの除外はしていない。開発用シード（seed.ts）と違って
 * 大きなデータを抱えず、__DEV__ の外では何も描画しないため。
 * 到達経路も設定 > Developer Menu だけで、そこ自体が __DEV__ 配下にある。
 *
 * @see store/screen/host/README.md - ホストの方針と撮影手順
 * @see src/components/settings/DeveloperMenu.tsx - この画面への入口
 */

import { StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { WebView } from 'react-native-webview';
import { ScreenContainer } from '@components/common/ScreenContainer';

/**
 * 撮影用ホストの配信元
 *
 * `node store/screen/host/serve.mjs` で起こす。シミュレータはMacのネットワークを
 * そのまま使うので localhost で届く（Info.plist の NSAllowsLocalNetworking が true）。
 * 実機で撮るときはMacのLAN IPへ書き換える。
 */
const HOST_URL = 'http://localhost:4599/';

export default function CaptureHostScreen() {
  /* 開発モードでのみ使う画面。到達経路は Developer Menu だけだが、念のため何も描画しない */
  if (!__DEV__) {
    return null;
  }

  return (
    /* ヘッダーを持たず、セーフエリアも確保しない。状態バーの下の余白はホスト側のCSSが持つ。
       ScreenContainer は必ずヘッダーを描画するため、空の要素を渡して打ち消している */
    <ScreenContainer customHeader={<></>} edges={[]}>
      <WebView
        source={{ uri: HOST_URL }}
        style={styles.webview}
        /* この画面の目的。キーボードの上に出るSafariのアクセサリバーを消す */
        hideKeyboardAccessoryView={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        /* 撮り直しのたびに古い画面が出ると気付けない */
        cacheEnabled={false}
        /* 入力欄をタップした瞬間にキーボードを出す（既定はユーザー操作を要求する） */
        keyboardDisplayRequiresUserAction={false}
        /* 本文が伸びてもWebView側では弾ませない。構図が撮影のたびに変わるため */
        bounces={false}
      />
      {/* 閉じるための透明な当たり判定。状態バーの帯に重ねてあるので撮影画像には写らない。
          ヘッダーが無いぶん、ここが唯一の戻る手段になる */}
      <Pressable
        style={styles.exit}
        onPress={() => router.back()}
        accessibilityLabel="Close capture host"
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
  },
  /** 状態バーの帯に重ねる透明な閉じる領域 */
  exit: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 88,
    height: 54,
  },
});
