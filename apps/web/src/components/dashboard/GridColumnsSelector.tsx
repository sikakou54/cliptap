/**
 * グリッド列数選択
 *
 * @description
 * 定型文・ショートカット一覧の表示列数（1〜3列）を切り替えるドロップダウンメニュー。
 * デスクトップのみ表示される（モバイル幅は常に1列のため切り替える意味がない・§14.9）。
 *
 * @remarks
 * ヘッダーには選択中の列数のアイコンだけを出し、他の候補はメニューを開いてから選ぶ。
 * 3つのボタンを常に並べると、使う頻度のわりにヘッダー右側のアイコンが増え、
 * 押せる場所が多いだけで現在どの列数なのかも読み取りにくいためである。
 * 開閉の作法と項目の見た目は、隣に並ぶソートメニュー（SortMenu）に合わせている。
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@cliptap/shared';

/** 選べる列数（メニューに並べる順） */
const COLUMN_OPTIONS = [1, 2, 3] as const;

/** 列数として取り得る値 */
type GridColumns = (typeof COLUMN_OPTIONS)[number];

/**
 * ColumnsIconのProps
 * @property cols - 何列を表すアイコンを描くか
 * @property className - 大きさを決めるクラス（ヘッダーとメニュー項目で変える）
 */
interface ColumnsIconProps {
  cols: GridColumns;
  className: string;
}

/**
 * 列数アイコン（1列/2列/3列のグリッドアイコン）
 */
function ColumnsIcon({ cols, className }: ColumnsIconProps) {
  /* 列数アイコン */
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      {cols === 1 && (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      )}
      {cols === 2 && (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h6M14 6h6M4 12h6M14 12h6M4 18h6M14 18h6" />
      )}
      {cols === 3 && (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h4M10 6h4M16 6h4M4 12h4M10 12h4M16 12h4M4 18h4M10 18h4M16 18h4" />
      )}
    </svg>
  );
}

/**
 * GridColumnsSelectorのProps
 * @property gridColumns - 現在の列数
 * @property setGridColumns - 列数を変更するコールバック
 */
interface GridColumnsSelectorProps {
  gridColumns: GridColumns;
  setGridColumns: (cols: GridColumns) => void;
}

export function GridColumnsSelector({ gridColumns, setGridColumns }: GridColumnsSelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* 外部クリックで閉じる（SortMenuと同じ扱い） */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (cols: GridColumns) => {
    setGridColumns(cols);
    setIsOpen(false);
  };

  /* グリッド列数選択（ドロップダウン形式、デスクトップのみ表示） */
  return (
    <div className="relative hidden md:block" ref={menuRef}>
      {/* 列数ボタン（選択中の列数をアイコンで示す） */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label={t('common.columns')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <ColumnsIcon cols={gridColumns} className="w-6 h-6" />
      </button>

      {/* ドロップダウンメニュー。
          上下に余白を置かず角丸で切り取るのはSortMenuと同じ理由で、
          先頭と末尾の項目を指したときに枠線との間へ背景の付かない帯を残さないため */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#2A2A2A] rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-20">
          {COLUMN_OPTIONS.map((cols) => (
            /* 列数オプションボタン */
            <button
              key={cols}
              onClick={() => handleSelect(cols)}
              className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${
                gridColumns === cols
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              {/* 列数アイコンと文言 */}
              <span className="flex items-center gap-2">
                <ColumnsIcon cols={cols} className="w-4 h-4" />
                {`${cols}${t('common.column', { count: cols })}`}
              </span>
              {/* 選択中のチェックマーク */}
              {gridColumns === cols && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
