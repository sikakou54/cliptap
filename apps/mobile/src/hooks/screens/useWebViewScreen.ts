/**
 * WebView画面カスタムフック
 *
 * 利用規約やプライバシーポリシーなどの静的HTMLコンテンツを読み込む処理を管理するフック。
 * UI層からファイル読み込みロジックを分離する。
 *
 * 主な責務:
 * - URLパラメータからファイル名とタイトルを取得
 * - HTMLファイルの読み込み
 * - ローディング状態の管理
 * - ページ内のリンクのうち、WebViewが扱えないもの（mailto）をOSへ渡す
 *
 * @see app/webview.tsx - WebView画面UI
 */

import { useState, useEffect, useCallback } from 'react';
import { Linking } from 'react-native';
import { File } from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Logger } from '@cliptap/shared';
import termsHtml from '../../../assets/web/terms.html';
import privacyHtml from '../../../assets/web/privacy.html';

/* ======================================== */
/* 型定義 */
/* ======================================== */

/** useWebViewScreen フックのパラメータ */
interface UseWebViewScreenParams {
  /** 表示するHTMLファイル名（'terms' | 'privacy'） */
  file: string;
  /** 表示タイトル */
  title: string;
}

/** useWebViewScreen フックの返却値 */
export interface UseWebViewScreenReturn {
  /** 読み込んだHTMLコンテンツ */
  htmlContent: string;
  /** ファイル読み込み中フラグ */
  loading: boolean;
  /** 表示タイトル */
  title: string;
  /** WebViewが読み込みを始める前の判定（falseを返すとWebViewでは開かない） */
  handleShouldStartLoad: (request: { url: string }) => boolean;
}

/* ======================================== */
/* フック実装 */
/* ======================================== */

export function useWebViewScreen(params: UseWebViewScreenParams): UseWebViewScreenReturn {
  /* ======================================== */
  /* パラメータ取得 */
  /* ======================================== */
  const { file, title: paramTitle } = params;

  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  /* ======================================== */
  /* 初期化処理 */
  /* ======================================== */

  useEffect(() => {
    const loadHtmlFile = async () => {
      try {
        /* ファイル名に応じてアセットモジュールを選択 */
        let assetModule: number | undefined;

        if (file === 'terms') {
          assetModule = termsHtml;
        } else if (file === 'privacy') {
          assetModule = privacyHtml;
        }

        if (assetModule === undefined) {
          setLoading(false);
          return;
        }

        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();

        if (asset.localUri) {
          const fileHandle = new File(asset.localUri);
          const content = await fileHandle.text();
          setHtmlContent(content);
        }
      } catch (error) {
        Logger.error('Failed to load HTML file:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadHtmlFile();
  }, [file]);

  /* ======================================== */
  /* イベントハンドラ */
  /* ======================================== */

  /**
   * ページ内のリンクを開く前の判定
   *
   * @param request - WebViewが読み込もうとしている対象
   * @returns WebViewで読み込む場合はtrue
   *
   * @remarks
   * お問い合わせ先のメールアドレスは `mailto:` のリンクにしてある。
   * WebViewはこのスキームを扱えず、そのままではタップしても何も起きないため、
   * OSへ渡してメールアプリを開く（件名はリンク側のsubjectが持つ）。
   * メールアプリが無い端末では開けないので、失敗しても画面は保ったまま記録だけ残す。
   */
  const handleShouldStartLoad = useCallback((request: { url: string }): boolean => {
    if (!request.url.startsWith('mailto:')) return true;

    Linking.openURL(request.url).catch((error) =>
      Logger.error('Open mail app failed:', error)
    );
    return false;
  }, []);

  /* ======================================== */
  /* 戻り値 */
  /* ======================================== */

  return {
    htmlContent,
    loading,
    title: paramTitle,
    handleShouldStartLoad,
  };
}
