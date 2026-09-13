/**
 * @module EditSnippetScreen
 * @description 定型文編集画面
 *
 * 既存の定型文を編集するためのモーダル画面。
 *
 * @param id - 編集対象の定型文ID
 *
 * @features
 * - タイトル（任意）
 * - 本文（必須）
 * - カテゴリ（任意）
 * - 対象プロファイル（複数選択可、空=全プロファイル）
 * - タイトル付きコピー設定
 *
 * @navigation
 * - ホーム・検索の定型文カードの「・・・」メニュー→編集 → /snippet/edit?id=xxx
 *
 * @see components/snippet/SnippetFormScreen.tsx - 共通フォームコンポーネント
 * @see app/snippet/create.tsx - 新規作成画面
 */
import { useLocalSearchParams } from 'expo-router';
import { SnippetFormScreen } from '@components/snippet/SnippetFormScreen';

export default function EditSnippetScreen() {
  const params = useLocalSearchParams();

  /* 定型文編集フォーム（URLパラメータからIDを取得して編集モードで表示） */
  return (
    <SnippetFormScreen mode="edit" snippetId={params.id as string} />
  );
}
