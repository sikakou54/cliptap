/**
 * スニペットグリッド表示
 *
 * @description
 * フィルタリング済みのスニペットをグリッドレイアウト（1〜3列）で表示。
 * カテゴリ情報のメモ化により、アコーディオン開閉時の再計算を防止。
 */
import { useMemo } from 'react';
import type { Category, SnippetWithDisplay, Snippet } from '@cliptap/shared';
import { SnippetCard } from '@components/snippet/SnippetCard';
import { EmptySnippetGrid } from '@components/snippet/EmptySnippetGrid';

/**
 * グリッドに並べる項目
 *
 * @remarks
 * 通常の一覧は定型文をそのまま並べるが、検索画面の横断検索では
 * 同じ定型文がプロファイルごとの展開結果に分かれて複数行になる（§8.7）。
 * IDだけでは行を区別できないため、行を示す値・行のプロファイル名・
 * コピー時の展開の基準を任意項目として持つ。
 */
export type SnippetGridItem = SnippetWithDisplay & {
  /** 行を一意にする値（横断検索のときだけ入る） */
  rowKey?: string;
  /** この展開結果になったプロファイル（横断検索のときだけ入る） */
  matchedProfileIds?: string[];
};

interface SnippetGridProps {
  /** フィルタリング済みスニペット一覧 */
  filteredSnippets: SnippetGridItem[];
  /** グリッドの列数 */
  gridColumns: 1 | 2 | 3;
  /** コピー済みスニペットのID */
  copiedId: string | null;
  /** タイトルをコピー済みのスニペットのID */
  copiedTitleId: string | null;
  /** カテゴリ一覧 */
  categories: Category[];
  /** カテゴリIDから色を取得する関数 */
  getCategoryColor: (categoryId: string | null) => string | null;
  /** カテゴリIDから名前を取得する関数 */
  getCategoryName: (categoryId: string | null) => string;
  /** コピーボタンクリック時のコールバック */
  onCopy: (snippet: Snippet) => void;
  /** タイトルコピーボタンクリック時のコールバック */
  onCopyTitle: (snippet: Snippet) => void;
  /** 編集ボタンクリック時のコールバック */
  onEdit: (snippet: Snippet) => void;
  /** 削除ボタンクリック時のコールバック */
  onDelete: (snippetId: string) => void;
  /** 0件のときに追加方法の案内を出すか（追加ボタンが見えている画面だけtrue） */
  showEmptyHint?: boolean;
}

export function SnippetGrid({
  filteredSnippets,
  gridColumns,
  copiedId,
  copiedTitleId,
  categories,
  getCategoryColor,
  getCategoryName,
  onCopy,
  onCopyTitle,
  onEdit,
  onDelete,
  showEmptyHint = true,
}: SnippetGridProps) {
  /* カテゴリ情報をMapに変換（カテゴリIDから色と名前を高速検索できるようにする）
      メモ化により、categoriesやgetCategoryColor/getCategoryNameが変更された時のみ再計算。
      アコーディオン開閉時の不要な再計算を防止し、パフォーマンスを向上。 */
  const categoryInfoMap = useMemo(() => {
    const map = new Map<string, { color: string | null; name: string }>();
    /* 各カテゴリの色と名前をMapに登録（未分類はバッジを表示しないため登録しない） */
    categories.forEach((category) => {
      map.set(category.id, {
        color: getCategoryColor(category.id),
        name: getCategoryName(category.id),
      });
    });
    return map;
  }, [categories, getCategoryColor, getCategoryName]);

  /* スニペットが0件の場合は空状態を表示
      フィルタリング結果が0件の場合、空状態メッセージと新規作成ボタンを表示。 */
  if (filteredSnippets.length === 0) {
    return <EmptySnippetGrid showEmptyHint={showEmptyHint} />;
  }

  /* グリッドの列数に応じたクラスを生成（レスポンシブ対応）
      1列: 常に1列表示
      2列: モバイル1列、デスクトップ2列
      3列: モバイル1列、タブレット2列、デスクトップ3列 */
  const gridClass = `grid gap-4 pb-20 items-start ${
    gridColumns === 1 ? 'grid-cols-1' :
    gridColumns === 2 ? 'grid-cols-1 md:grid-cols-2' :
    'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  }`;

  /* スニペットグリッドコンテナ（1〜3列、レスポンシブ対応）
      pb-20で下部にマージンを確保（フッターやスクロール時の余白）。 */
  return (
    <div className={gridClass}>
      {filteredSnippets.map((snippet) => {
        /* スニペットに紐づくカテゴリ情報を取得
            categoryInfoMapから高速検索。未分類および削除済みカテゴリはnullとし、
            モバイル版と同じくカテゴリバッジを表示しない。 */
        const categoryInfo = snippet.categoryId ? categoryInfoMap.get(snippet.categoryId) ?? null : null;

        /* スニペットカード
            各スニペットのタイトル・内容・カテゴリ情報を表示。
            コピー・編集・削除ボタンを提供。
            isCopiedがtrueの場合はコピー済み状態を視覚的に表示。 */
        return (
          <SnippetCard
            /* 横断検索では同じ定型文が複数行に分かれるため、IDだけでは重複する */
            key={snippet.rowKey ?? snippet.id}
            snippet={snippet}
            isCopied={copiedId === (snippet.rowKey ?? snippet.id)}
            isTitleCopied={copiedTitleId === (snippet.rowKey ?? snippet.id)}
            categoryColor={categoryInfo?.color ?? null}
            categoryName={categoryInfo?.name ?? null}
            onCopy={() => onCopy(snippet)}
            onCopyTitle={() => onCopyTitle(snippet)}
            onEdit={() => onEdit(snippet)}
            onDelete={() => onDelete(snippet.id)}
          />
        );
      })}
    </div>
  );
}
