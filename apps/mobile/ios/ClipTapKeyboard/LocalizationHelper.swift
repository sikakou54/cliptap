//
//  LocalizationHelper.swift
//  ClipTapKeyboard
//
//  【目的】
//  キーボード拡張の多言語対応を簡単にするためのヘルパークラス
//  NSLocalizedStringを使いやすくラップし、翻訳キーの管理を一元化します
//
//  【使用方法】
//  L10n.profile.all          → "すべて" (日本語) / "All" (英語)
//  L10n.snippet.copy         → "コピー" (日本語) / "Copy" (英語)
//
//  【動作の仕組み】
//  1. デバイスの言語設定を確認
//  2. 対応する .lproj フォルダ（ja.lproj または en.lproj）から翻訳を取得
//  3. 翻訳が見つからない場合は、英語（デフォルト）を返す
//
//  【対応言語】
//  - 日本語 (ja.lproj/Localizable.strings)
//  - 英語 (en.lproj/Localizable.strings)
//

import Foundation

/// キーボードの詳細ログは開発ビルドだけで出力する。
enum KeyboardLog {
    static func debug(_ message: String) {
#if DEBUG
        NSLog("%@", message)
#endif
    }

    static func debug(_ format: String, _ arguments: CVarArg...) {
#if DEBUG
        withVaList(arguments) { NSLogv(format, $0) }
#endif
    }
}

/// 多言語対応のヘルパークラス（L10n = Localization の略）
/// 翻訳キーを構造化して管理し、型安全にアクセスできるようにします
enum L10n {

    // MARK: - Language (表示言語の判定)

    /// キーボード拡張の表示言語が日本語かどうか
    ///
    /// 【Locale.currentを使わない理由】
    /// Locale.currentは「端末の言語設定」ではなく「バンドルが持つローカライズで絞り込んだ結果」を返します。
    /// キーボード拡張にローカライズが含まれていない場合、日本語端末でも en と判定されてしまいます。
    ///
    /// 【先頭だけを見ない理由】
    /// 端末の優先言語が [中国語, 日本語] のように非対応言語が先頭の場合、先頭だけを見ると
    /// バンドルが解決する表示言語（日本語）と判定結果（英語）が食い違います。
    /// Bundle.main.preferredLocalizationsと同じ解決順（優先言語を順に走査して対応言語の初出を採用）にしつつ、
    /// バンドルのローカライズ同梱状況には依存しない形で判定します。
    ///
    /// 【単一の判定箇所】
    /// 拡張キーボード内の言語判定はすべてこのプロパティを使用すること。
    /// 個別に Locale.preferredLanguages.first を見ると画面ごとに言語が食い違います。
    static var isJapanese: Bool {
        for language in Locale.preferredLanguages {
            if language.hasPrefix("ja") { return true }
            if language.hasPrefix("en") { return false }
        }
        return false
    }

    // MARK: - Profile (環境・プロファイル関連)

    /// プロファイル（環境）関連の翻訳
    enum Profile {
        /// "すべて" / "All"
        static var all: String {
            let key = "profile.all"
            let localized = L10n.localized(key)
            // フォールバック: 翻訳が見つからない場合は言語に応じてデフォルト値を返す
            if localized == key {
                return L10n.isJapanese ? "すべて" : "All"
            }
            return localized
        }

        /// "環境を選択" / "Select Environment"
        static let select = localized("profile.select")

        /// "環境なし" / "No Environment"
        static let none = localized("profile.none")
    }

    // MARK: - Category (カテゴリ関連)

    /// カテゴリ関連の翻訳
    enum Category {
        /// "すべて" / "All"
        static var all: String {
            let key = "category.all"
            let localized = L10n.localized(key)
            // フォールバック: 翻訳が見つからない場合は言語に応じてデフォルト値を返す
            if localized == key {
                return L10n.isJapanese ? "すべて" : "All"
            }
            return localized
        }

        /// "カテゴリを選択" / "Select Category"
        static let select = localized("category.select")

        /// "カテゴリなし" / "No Category"
        static let none = localized("category.none")

        /// "未分類" / "Uncategorized"
        static let uncategorized = localized("category.uncategorized")
    }

    // MARK: - Snippet (スニペット関連)

    /// スニペット関連の翻訳
    enum Snippet {
        /// "スニペット" / "Snippet"
        static let title = localized("snippet.title")

        /// "スニペットを選択" / "Select Snippet"
        static let select = localized("snippet.select")

        /// "スニペットがありません" / "No snippets available"
        static let empty = localized("snippet.empty")

        /// "該当するスニペットが見つかりません" / "No matching snippets found"
        static let noResults = localized("snippet.no_results")

        /// "コピー" / "Copy"
        static let copy = localized("snippet.copy")

        /// "挿入" / "Insert"
        static let insert = localized("snippet.insert")

        /// "プレビュー" / "Preview"
        static let preview = localized("snippet.preview")

        /// "詳細" / "Details"
        static let detail = localized("snippet.detail")

        /// "閉じる" / "Close"
        static let close = localized("snippet.close")

        /// "タイトルなし" / "No Title"
        static let noTitle = localized("snippet_no_title")
    }

    // MARK: - Shortcut (ショートカット関連)

    /// ショートカット関連の翻訳
    enum Shortcut {
        /// "ショートカットがありません" / "No shortcuts available"
        static let empty = localized("shortcut.empty")

        /// "メインアプリでショートカットを作成してください" / "Create shortcuts in the main app"
        static let emptyHint = localized("shortcut.empty_hint")
    }

    // MARK: - Search (検索関連)

    /// 検索関連の翻訳
    enum Search {
        /// "スニペットを検索" / "Search snippets"
        static let placeholder = localized("search.placeholder")

        /// "クリア" / "Clear"
        static let clear = localized("search.clear")

        /// "検索結果がありません" / "No search results"
        static let noResults = localized("search.no_results")
    }

    // MARK: - Error (エラーメッセージ)

    /// エラーメッセージの翻訳
    enum Error {
        /// "データベースエラーが発生しました" / "Database error occurred"
        static let database = localized("error.database")

        /// "データの読み込みに失敗しました" / "Failed to load data"
        static let loadFailed = localized("error.load_failed")

        /// "アクセス権限がありません" / "Access permission denied"
        static let permission = localized("error.permission")

        /// "不明なエラーが発生しました" / "Unknown error occurred"
        static let unknown = localized("error.unknown")
    }

    // MARK: - Subscription (サブスクリプション関連)

    /// サブスクリプション関連の翻訳
    enum Subscription {
        /// "この機能は有料プランが必要です" / "This feature requires a premium plan"
        static let required = localized("subscription.required")

        /// "アップグレード" / "Upgrade"
        static let upgrade = localized("subscription.upgrade")

        /// "プレミアム" / "Premium"
        static let premium = localized("subscription.premium")

        /// "無料" / "Free"
        static let free = localized("subscription.free")
    }

    // MARK: - Variable (変数関連)

    /// 変数関連の翻訳
    enum Variable {
        /// "今日" / "Today"
        static let today = localized("variable.today")

        /// "現在" / "Now"
        static let now = localized("variable.now")

        /// "時刻" / "Time"
        static let time = localized("variable.time")

        /// "変数が見つかりません" / "Variable not found"
        static let notFound = localized("variable.not_found")
    }

    // MARK: - Button (ボタン)

    /// ボタンのラベル翻訳
    enum Button {
        /// "OK"
        static let ok = localized("button.ok")

        /// "キャンセル" / "Cancel"
        static let cancel = localized("button.cancel")

        /// "完了" / "Done"
        static let done = localized("button.done")

        /// "戻る" / "Back"
        static let back = localized("button.back")

        /// "閉じる" / "Close"
        static let close = localized("button.close")

        /// "再試行" / "Retry"
        static let retry = localized("button.retry")
    }

    // MARK: - Message (メッセージ)

    /// メッセージの翻訳
    enum Message {
        /// "コピーしました" / "Copied"
        static let copied = localized("message.copied")

        /// "挿入しました" / "Inserted"
        static let inserted = localized("message.inserted")

        /// "読み込み中..." / "Loading..."
        static let loading = localized("message.loading")

        /// "メインアプリでスニペットを作成してください" / "Create snippets in the main app"
        static let emptyState = localized("message.empty_state")
    }

    // MARK: - Accessibility (アクセシビリティ)

    /// アクセシビリティラベルの翻訳
    enum Accessibility {
        /// "環境ボタン" / "Profile button"
        static let profileButton = localized("accessibility.profile_button")

        /// "カテゴリボタン" / "Category button"
        static let categoryButton = localized("accessibility.category_button")

        /// "スニペット項目" / "Snippet item"
        static let snippetItem = localized("accessibility.snippet_item")

        /// "閉じるボタン" / "Close button"
        static let closeButton = localized("accessibility.close_button")

        /// "コピーボタン" / "Copy button"
        static let copyButton = localized("accessibility.copy_button")

        /// "並び替えボタン" / "Sort button"
        static let sortButton = localized("accessibility.sort_button")

        /// "次のキーボード" / "Next keyboard"
        static let nextKeyboardButton = localized("accessibility.next_keyboard_button")

        /// "タイトル挿入ボタン" / "Insert title button"
        static let insertTitleButton = localized("accessibility.insert_title_button")

        /// "改行ボタン" / "Insert newline button"
        static let insertNewlineButton = localized("accessibility.insert_newline_button")

        /// "ショートカットを表示" / "Show shortcuts"
        ///
        /// 定型文／ショートカットのトグルが定型文を表示しているときのラベル。
        /// トグルは押した先を示すため、ボタン名ではなく「押すと何が起きるか」で表す。
        static let showShortcutsButton = localized("accessibility.show_shortcuts_button")

        /// "定型文を表示" / "Show snippets"
        ///
        /// 定型文／ショートカットのトグルがショートカットを表示しているときのラベル。
        static let showSnippetsButton = localized("accessibility.show_snippets_button")
    }

    // MARK: - Sort (ソート関連)

    /// ソート関連の翻訳
    enum Sort {
        /// "並順" / "Sort"
        static let label = localized("sort.label")

        /// "作成日時" / "Created"
        static let created = localized("sort.created")

        /// "更新日時" / "Updated"
        static let updated = localized("sort.updated")

        /// "タイトル" / "Title"
        static let title = localized("sort.title")

        /// "名前" / "Name"（ショートカットの並べ替えで使う。定型文はタイトル、ショートカットは名前）
        static let name = localized("sort.name")

        /// "使用頻度" / "Frequency"
        static let usage = localized("sort.usage")
    }

    // MARK: - Settings (設定関連)

    /// 設定関連の翻訳
    enum Settings {
        /// "設定" / "Settings"
        static let title = localized("settings.title")

        /// "使用頻度の記録" / "Usage Tracking"
        static let usageTracking = localized("settings.usage_tracking")

        /// "有効" / "On"
        static let usageTrackingActive = localized("settings.usage_tracking_active")

        /// "無効" / "Off"
        static let usageTrackingInactive = localized("settings.usage_tracking_inactive")

        /// "この機能を使用するにはフルアクセスの許可が必要です" / "Full access is required to use this feature"
        static let usageTrackingRequiresFullAccess = localized("settings.usage_tracking_requires_full_access")

        /// フルアクセス許可手順
        static let fullAccessInstructions = localized("settings.full_access_instructions")
    }

    // MARK: - Localization Helper

    /// 翻訳キーから翻訳済みの文字列を取得する内部ヘルパー関数
    ///
    /// - Parameter key: 翻訳キー（例: "snippet.copy"）
    /// - Returns: 翻訳された文字列（例: "コピー" または "Copy"）
    ///
    /// 【動作の仕組み】
    /// 1. NSLocalizedString を使用して、現在の言語設定に応じた翻訳を取得
    /// 2. ja.lproj/Localizable.strings または en.lproj/Localizable.strings から読み込み
    /// 3. 翻訳が見つからない場合は、キーそのものを返す（デバッグに便利）
    ///
    /// 【Bundle.main との違い】
    /// キーボード拡張では Bundle.main ではなく、拡張自身の Bundle を使用する必要があります。
    /// 現在のファイルが含まれるBundleを取得します。
    private static func localized(_ key: String) -> String {
        // キーボード拡張のBundleを取得
        // Bundle(for:)ではなく、Bundle.mainを使用してキーボード拡張自身のBundleを取得
        let bundle = Bundle.main

        // まずLocalizable.stringsから翻訳を取得
        var localizedString = bundle.localizedString(forKey: key, value: nil, table: nil)

        // キーがそのまま返ってきた場合は、デフォルト値を使用
        if localizedString == key {
            // フォールバック: ハードコードされたデフォルト値
            localizedString = getDefaultValue(for: key)
            KeyboardLog.debug("[L10n] ⚠️ Translation not found for key: \(key), using fallback: \(localizedString)")
        }

        return localizedString
    }

    /// 翻訳ファイルが見つからない場合のフォールバック値
    private static func getDefaultValue(for key: String) -> String {
        let isJapanese = L10n.isJapanese

        switch key {
        // Profile
        case "profile.all": return isJapanese ? "すべて" : "All"
        case "profile.select": return isJapanese ? "環境を選択" : "Select Environment"
        case "profile.none": return isJapanese ? "環境なし" : "No Environment"

        // Category
        case "category.all": return isJapanese ? "すべて" : "All"
        case "category.select": return isJapanese ? "カテゴリを選択" : "Select Category"
        case "category.none": return isJapanese ? "カテゴリなし" : "No Category"
        case "category.uncategorized": return isJapanese ? "未分類" : "Uncategorized"

        // Snippet
        case "snippet.title": return isJapanese ? "スニペット" : "Snippet"
        case "snippet.select": return isJapanese ? "スニペットを選択" : "Select Snippet"
        case "snippet.empty": return isJapanese ? "スニペットがありません" : "No snippets available"
        case "snippet.no_results": return isJapanese ? "該当するスニペットが見つかりません" : "No matching snippets found"
        case "snippet.copy": return isJapanese ? "コピー" : "Copy"
        case "snippet.insert": return isJapanese ? "挿入" : "Insert"
        case "snippet.preview": return isJapanese ? "プレビュー" : "Preview"
        case "snippet.detail": return isJapanese ? "詳細" : "Details"
        case "snippet.close": return isJapanese ? "閉じる" : "Close"

        // Shortcut
        case "shortcut.empty": return isJapanese ? "ショートカットがありません" : "No shortcuts available"
        case "shortcut.empty_hint": return isJapanese ? "メインアプリでショートカットを作成してください" : "Create shortcuts in the main app"

        // Search
        case "search.placeholder": return isJapanese ? "スニペットを検索" : "Search snippets"
        case "search.clear": return isJapanese ? "クリア" : "Clear"
        case "search.no_results": return isJapanese ? "検索結果がありません" : "No search results"

        // Error
        case "error.database": return isJapanese ? "データベースエラーが発生しました" : "Database error occurred"
        case "error.load_failed": return isJapanese ? "データの読み込みに失敗しました" : "Failed to load data"
        case "error.permission": return isJapanese ? "アクセス権限がありません" : "Access permission denied"
        case "error.unknown": return isJapanese ? "不明なエラーが発生しました" : "Unknown error occurred"

        // Subscription
        case "subscription.required": return isJapanese ? "この機能は有料プランが必要です" : "This feature requires a premium plan"
        case "subscription.upgrade": return isJapanese ? "アップグレード" : "Upgrade"
        case "subscription.premium": return isJapanese ? "プレミアム" : "Premium"
        case "subscription.free": return isJapanese ? "無料" : "Free"

        // Variable
        case "variable.today": return isJapanese ? "今日" : "Today"
        case "variable.now": return isJapanese ? "現在" : "Now"
        case "variable.time": return isJapanese ? "時刻" : "Time"
        case "variable.not_found": return isJapanese ? "変数が見つかりません" : "Variable not found"

        // Button
        case "button.ok": return "OK"
        case "button.cancel": return isJapanese ? "キャンセル" : "Cancel"
        case "button.done": return isJapanese ? "完了" : "Done"
        case "button.back": return isJapanese ? "戻る" : "Back"
        case "button.close": return isJapanese ? "閉じる" : "Close"
        case "button.retry": return isJapanese ? "再試行" : "Retry"

        // Message
        case "message.copied": return isJapanese ? "コピーしました" : "Copied"
        case "message.inserted": return isJapanese ? "挿入しました" : "Inserted"
        case "message.loading": return isJapanese ? "読み込み中..." : "Loading..."
        case "message.empty_state": return isJapanese ? "メインアプリでスニペットを作成してください" : "Create snippets in the main app"

        // Accessibility
        case "accessibility.profile_button": return isJapanese ? "環境ボタン" : "Profile button"
        case "accessibility.category_button": return isJapanese ? "カテゴリボタン" : "Category button"
        case "accessibility.snippet_item": return isJapanese ? "スニペット項目" : "Snippet item"
        case "accessibility.close_button": return isJapanese ? "閉じるボタン" : "Close button"
        case "accessibility.copy_button": return isJapanese ? "コピーボタン" : "Copy button"
        case "accessibility.sort_button": return isJapanese ? "並び替えボタン" : "Sort button"
        case "accessibility.insert_title_button": return isJapanese ? "タイトル挿入ボタン" : "Insert title button"
        case "accessibility.show_shortcuts_button": return isJapanese ? "ショートカットを表示" : "Show shortcuts"
        case "accessibility.show_snippets_button": return isJapanese ? "定型文を表示" : "Show snippets"

        // Sort
        case "sort.label": return isJapanese ? "並順" : "Sort"
        case "sort.created": return isJapanese ? "作成日時" : "Created"
        case "sort.updated": return isJapanese ? "更新日時" : "Updated"
        case "sort.title": return isJapanese ? "タイトル" : "Title"
        case "sort.name": return isJapanese ? "名前" : "Name"
        case "sort.usage": return isJapanese ? "使用頻度" : "Frequency"

        // Settings
        case "settings.title": return isJapanese ? "設定" : "Settings"
        case "settings.usage_tracking": return isJapanese ? "使用頻度の記録" : "Usage Tracking"
        case "settings.usage_tracking_active": return isJapanese ? "有効" : "On"
        case "settings.usage_tracking_inactive": return isJapanese ? "無効" : "Off"
        case "settings.usage_tracking_requires_full_access":
            return isJapanese
                ? "キーボードからの挿入回数を記録するには、フルアクセスの許可が必要です。許可すると使用頻度順の並べ替えが使えます。"
                : "Full Access is required to record how often each snippet is inserted from the keyboard. Allowing it enables sorting by usage."
        case "settings.full_access_instructions":
            return isJapanese
                ? "1. 設定アプリを開く\n2. 「一般」→「キーボード」→「キーボード」を選択\n3. 「ClipTap」をタップ\n4. 「フルアクセスを許可」をON"
                : "1. Open the Settings app\n2. Go to \"General\" → \"Keyboard\" → \"Keyboards\"\n3. Tap \"ClipTap\"\n4. Turn on \"Allow Full Access\""

        default: return key
        }
    }
}

/// NSLocalizedStringがクラスを必要とするため、ダミークラスを定義
private class LocalizationHelper {}
