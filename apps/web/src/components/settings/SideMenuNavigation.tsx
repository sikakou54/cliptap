/**
 * サイドメニューナビゲーションコンポーネント
 *
 * @description
 * ページナビゲーションリンク（ホーム、カテゴリ、プロファイル、変数）、
 * エクスポート/インポートボタン、広告表示（Freeプランのみ）を提供
 */
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '@cliptap/shared';

export interface MenuItem {
  path: string;
  label: string;
  icon: string;
}

interface SideMenuNavigationProps {
  menuItems: MenuItem[];
  onClose: () => void;
  onImport: () => void;
  onExport: () => void;
  onCloseFile: () => void;
  isSubscribed: boolean;
}

export function SideMenuNavigation({
  menuItems,
  onClose,
  onImport,
  onExport,
  onCloseFile,
  isSubscribed,
}: SideMenuNavigationProps) {
  const { t } = useTranslation();
  const location = useLocation();

  /* サイドメニューナビゲーション（ページリンク、エクスポート/インポート、広告） */
  return (
    <div className="flex-1 p-4 space-y-2 overflow-y-auto">
      {/* ページナビゲーションリンク（ホーム、カテゴリ、プロファイル、変数） */}
      {menuItems.map((item, index) => {
        const isActive = location.pathname === item.path;
        /* ページナビゲーションリンク（ホーム、カテゴリ、プロファイル、変数） */
        return (
          <div key={item.path}>
            <Link
              to={item.path}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                ${isActive
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                  : 'text-gray-700 dark:text-[#A0A0A0] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]'
                }
              `}
            >
              {/* メニューアイコン */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {/* メニューラベル */}
              <span className={`text-sm ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
            </Link>
            {/* 最初のメニューアイテムの後に区切り線を表示 */}
            {index === 0 && <div className="my-2 border-t border-gray-200 dark:border-[#2A2A2A]" />}
          </div>
        );
      })}

      {/* 区切り線 */}
      <div className="my-2 border-t border-gray-200 dark:border-[#2A2A2A]" />

      {/* インポートボタン */}
      <button
        onClick={onImport}
        className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-[#A0A0A0] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span className="text-sm">{t('export_import.import')}</span>
      </button>

      {/* エクスポートボタン */}
      <button
        onClick={onExport}
        className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-[#A0A0A0] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <span className="text-sm">{t('export_import.export')}</span>
      </button>

      <button
        onClick={onCloseFile}
        className="w-full flex items-center gap-3 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span className="text-sm">{t('settings.web_specific.close_file')}</span>
      </button>

      <div className="my-2 border-t border-gray-200 dark:border-[#2A2A2A]" />

      <a
        href="terms.html"
        target="_blank"
        rel="noreferrer"
        onClick={onClose}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50 dark:text-[#A0A0A0] dark:hover:bg-[#2A2A2A]"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h7l5 5v13H7a2 2 0 01-2-2V5a2 2 0 012-2zm7 0v5h5M9 13h6M9 17h6" />
        </svg>
        <span className="text-sm">{t('settings.terms')}</span>
      </a>

      <a
        href="privacy.html"
        target="_blank"
        rel="noreferrer"
        onClick={onClose}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50 dark:text-[#A0A0A0] dark:hover:bg-[#2A2A2A]"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 3v5c0 4.55-2.99 8.74-7 10-4.01-1.26-7-5.45-7-10V6l7-3zm0 5v4m0 4h.01" />
        </svg>
        <span className="text-sm">{t('settings.privacy')}</span>
      </a>

      {/* 広告バナー（Freeプランのみ表示） */}
      {!isSubscribed && (
        <div className="mt-auto pt-4">
          <div className="w-full flex justify-center">
            <a href="https://px.a8.net/svt/ejp?a8mat=45IFX2+AQZRZM+2PEO+OC77L" rel="nofollow">
              <img
                width="250"
                height="250"
                alt=""
                src="https://www25.a8.net/svt/bgt?aid=251123222650&wid=001&eno=01&mid=s00000012624004088000&mc=1"
                className="rounded-lg"
              />
            </a>
            {/* トラッキング用の非表示画像 */}
            <img
              width="1"
              height="1"
              src="https://www12.a8.net/0.gif?a8mat=45IFX2+AQZRZM+2PEO+OC77L"
              alt=""
              className="hidden"
            />
          </div>
        </div>
      )}
    </div>
  );
}
