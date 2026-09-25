/**
 * 共通ページレイアウト（固定サイドメニュー付き）
 *
 * @description
 * 設定画面などで使用する共通レイアウトコンポーネント。
 * サイドメニュー、ヘッダー、メインコンテンツエリアを提供する。
 * モバイル時はハンバーガーメニューでサイドメニューを表示。
 *
 * レスポンシブ対応:
 * - デスクトップ（md以上）: サイドメニュー固定表示、メインコンテンツは左マージン72（18rem）
 * - モバイル: サイドメニューはオーバーレイ表示、ヘッダーにハンバーガーメニューボタン
 */
import type { ReactNode } from 'react';
import { useState, useCallback } from 'react';
import { useAuth, useDatabase } from '@cliptap/shared';
import { SideMenu } from '@components/settings/SideMenu';
import { ExportPasswordModal } from '@components/export';
import { ImportFileModal } from '@components/import';
import { AccountLinkModal } from '@components/auth/AccountLinkModal';
import { useBodyScrollLock } from '@hooks/useBodyScrollLock';
import { useSideMenu } from '@hooks/useSideMenu';
import { useExportScreen } from '@hooks/screens/useExportScreen';
import { useImportScreen } from '@hooks/screens/useImportScreen';
import { PageHeader } from './PageHeader';

interface PageLayoutProps {
  /** ページタイトル */
  title: string;
  /** タイトル横に表示するアイコン（SVG path） */
  icon?: string;
  /** メインコンテンツ */
  children: ReactNode;
  /** ヘッダー右側に配置するアクション要素 */
  rightAction?: ReactNode;
}

export function PageLayout({ title, icon, children, rightAction }: PageLayoutProps) {
  const { setLoaded } = useDatabase();
  const { user, signInWithGoogle, signInWithApple, loading: authLoading, error: authError } = useAuth();

  const [showAccountLinkModal, setShowAccountLinkModal] = useState(false);

  const openAccountLinkModal = useCallback(() => {
    setShowAccountLinkModal(true);
  }, []);

  const closeAccountLinkModal = useCallback(() => {
    setShowAccountLinkModal(false);
  }, []);

  const {
    isOpen: isSideMenuOpen,
    isOverlay: isSideMenuOverlay,
    toggle: toggleSideMenu,
    close: closeSideMenu,
  } = useSideMenu();

  /* バックアップ・復元はDashboardと同じフックで扱い、閉じる防止や一時DBの破棄の扱いを揃える */
  const exportScreen = useExportScreen();
  const importScreen = useImportScreen({ user, setLoaded });

  const isModalOpen = exportScreen.showExportModal || importScreen.showFileModal || showAccountLinkModal;
  /* サイドメニューは本文へ覆いかぶさるときだけ背景を止める（押し出して並べているときは本文をスクロールできる） */
  useBodyScrollLock(isModalOpen || (isSideMenuOverlay && isSideMenuOpen));

  /* ページレイアウト（サイドメニュー、ヘッダー、メインコンテンツ、モーダル群） */
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* サイドメニュー（レスポンシブ対応、モバイルではオーバーレイ表示） */}
      <SideMenu
        onExport={exportScreen.openExportModal}
        onImport={importScreen.openFileModal}
        isOpen={isSideMenuOpen}
        isOverlay={isSideMenuOverlay}
        onClose={closeSideMenu}
        onAccountLink={openAccountLinkModal}
      />

      {/* メインコンテンツエリア（サイドメニューを開いている間は、その幅の分だけ右へ寄せる） */}
      <div className={`${isSideMenuOpen ? 'md:ml-72' : ''} transition-all duration-300`}>
        {/* ページヘッダー（固定表示、モバイルではハンバーガーメニューボタン付き） */}
        <PageHeader
          title={title}
          icon={icon}
          rightAction={rightAction}
          isSideMenuOpen={isSideMenuOpen}
          onToggleSideMenu={toggleSideMenu}
        />

        {/* メインコンテンツ（ページ固有の内容） */}
        <main className="px-6 py-6 pt-24">
          {children}
        </main>
      </div>

      {/* バックアップ用パスワード入力モーダル（出力中は閉じられず、成功時に閉じる） */}
      <ExportPasswordModal
        isOpen={exportScreen.showExportModal}
        onClose={exportScreen.closeExportModal}
        onSubmit={exportScreen.handleExport}
        isProcessing={exportScreen.isExporting}
      />

      {/* 復元ファイル選択モーダル（検証後に全削除の確認を出し、同意すると全データを置き換える） */}
      <ImportFileModal
        isOpen={importScreen.showFileModal}
        onClose={importScreen.closeFileModal}
        onFileSelected={importScreen.handleFileSelected}
        isLoading={importScreen.isBusy}
      />

      {/* アカウント連携モーダル（Google/Apple認証） */}
      <AccountLinkModal
        isOpen={showAccountLinkModal}
        onClose={closeAccountLinkModal}
        onSignInWithGoogle={signInWithGoogle}
        onSignInWithApple={signInWithApple}
        isLoading={authLoading}
        error={authError}
      />
    </div>
  );
}
