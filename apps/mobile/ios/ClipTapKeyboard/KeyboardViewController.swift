//
//  KeyboardViewController.swift
//  ClipTapKeyboard
//
//  【目的】
//  カスタムキーボード画面のメインコントローラー
//  ユーザーがスニペット（定型文）を選択して入力できるキーボードUIを提供します
//
//  【画面構成】
//  ┌──────────────────────────────────┐
//  │ [環境▼] [カテゴリ▼] [⚡] [⇅] [⚙] │ ← フィルター行（⚡が定型文／ショートカットのトグル）
//  ├──────────────────────────────────┤
//  │ スニペット1                       │
//  │ スニペット2                       │ ← 一覧（トグルでショートカット一覧に入れ替わる）
//  │ スニペット3                       │
//  └──────────────────────────────────┘
//
//  【ユーザーの操作フロー】
//  1. 環境（プロファイル）を選択 → その環境のスニペット・ショートカットのみ表示
//  2. カテゴリを選択 → さらにカテゴリでフィルタリング（定型文のみ）
//  3. スニペットをタップ → 詳細画面（プレビュー）を表示
//  4. コピーボタンをタップ → テキスト入力欄に挿入
//  5. ⚡をタップ → 一覧がショートカットに切り替わる（もう一度押すと定型文へ戻る）
//
//  【技術的な特徴】
//  - 3層アーキテクチャ: ViewController（UI） → Service（ビジネスロジック） → Mapper（データアクセス）
//  - リアルタイムフィルタリング: 環境・カテゴリ変更時に即座にスニペットリストを更新
//  - 変数置換: {{today}}などのシステム変数や、ユーザー定義変数を実際の値に置換
//  - 振動フィードバック: スニペット挿入時にHaptic Feedback（触覚フィードバック）
//

import UIKit
import os.log

// ログ出力用の設定（デバッグやエラー追跡に使用）
// 開発中の動作確認や、本番環境でのトラブルシューティングに役立ちます
let keyboardLog = OSLog.disabled

/// カスタムキーボードのメインビューコントローラー
/// UIInputViewControllerを継承することで、iOSのカスタムキーボード機能を実装できます
class KeyboardViewController: UIInputViewController {

    private enum ScreenState {
        case loading
        case list
        case detail
        case settings
        case shortcutList
    }

    /**
     * ショートカット画面の表示モード
     *
     * 値一覧をScreenStateへ足さず、ショートカット画面の中のモードとして持つ。
     * ScreenStateはapplyScreenState()が全画面ビューを排他表示するための区分であり、
     * 同じshortcutView内での表示の切り替えまで持たせると、
     * 状態が増えるほど「どのビューを出すか」の組み合わせが読みづらくなるため。
     */
    private enum ShortcutScreenMode {
        case list    /* ショートカット一覧 */
        case values  /* 選択したショートカットの値一覧 */
    }

    // MARK: - Services（サービス層：ビジネスロジックを担当）
    // 3層アーキテクチャを採用: UI層（ViewController） → ビジネスロジック層（Service） → データアクセス層（Mapper）
    // これにより、コードの見通しが良くなり、テストもしやすくなります

    /// スニペット（定型文）の管理を行うサービス
    /// スニペットの取得、挿入、変数置換などの処理を担当
    private let snippetService = SnippetService.shared

    /// カテゴリ（「仕事」「私用」などの分類）の管理を行うサービス
    private let categoryService = CategoryService.shared

    /// プロファイル（環境）の管理を行うサービス
    /// プロファイルとは、例えば「会社用」「個人用」などの設定の塊です
    private let profileService = ProfileService.shared

    /// 変数（{{today}}などの動的な値）の管理を行うサービス
    private let variableService = VariableService.shared

    /// ショートカット（値の使い分け）の管理を行うサービス
    /// 一覧の並べ替えと、選ばれた値の挿入を担当
    private let shortcutService = ShortcutService.shared

    /// サブスクリプション（有料機能）の管理を行うマネージャー

    // MARK: - State（状態管理：画面の現在の状態を保持）

    /// 現在選択中のプロファイル（環境）
    /// 例: 「会社用」プロファイルが選択されている場合、会社用のスニペットのみ表示
    private var currentProfile: Profile?

    /// 現在選択中のカテゴリ
    /// 例: 「仕事」カテゴリが選択されている場合、仕事関連のスニペットのみ表示
    /// nilの場合は「すべて」を表示
    private var currentCategory: Category?

    /// データベースから取得した全スニペット（フィルタ前）
    /// プロファイルでフィルタ済みですが、カテゴリフィルタは未適用
    private var allSnippets: [Snippet] = []

    /// 画面に表示するスニペットのリスト（フィルタ後）
    /// プロファイル + カテゴリの両方でフィルタ済み
    private var filteredSnippets: [Snippet] = []

    /**
     * 一覧に描画済みの内容を表す署名
     *
     * 再取得した内容がこれと一致する場合は再描画しない。
     * nilは「表示が外部要因で変わり得るため毎回描画する」ことを示す。
     */
    private var snippetListSignature: String?

    /// 全カテゴリのリスト（「すべて」ボタン + 各カテゴリボタンを作成するために使用）
    private var categories: [Category] = []

    /// 全プロファイル（環境）のリスト（環境選択ボタンを作成するために使用）
    private var profiles: [Profile] = []

    /// 変数を置換するためのヘルパー（{{today}} → 2025/11/17などの変換を行う）
    private let variableReplacer = VariableReplacer()

    /// カスタム変数のマップ（変数名 → 値の辞書）
    /// 例: ["client_name": "田中", "company_name": "株式会社○○"]
    private var variablesMap: [String: String] = [:]
    private var systemVariableFormats: [String: String] = [:]

    /// 詳細画面で表示中のスニペット
    /// ユーザーがスニペットをタップすると、このプロパティに保存されます
    private var selectedSnippet: Snippet?

    /// ショートカット画面に表示中のショートカット一覧（選んだ基準で並べ替え済み）
    private var sortedShortcuts: [Shortcut] = []

    /// 値一覧を表示しているショートカット
    private var selectedShortcut: Shortcut?

    /// 値一覧に表示中のショートカット値（使用回数の多い順に並べ替え済み）
    private var sortedShortcutValues: [ShortcutValue] = []

    /// ショートカット画面の表示モード（一覧 or 値一覧）
    private var shortcutScreenMode: ShortcutScreenMode = .list

    /// 定型文一覧の現在のソート順
    /// 値: "created" | "updated" | "title" | "usage"
    private var currentSnippetSortBy: String = KeyboardViewController.defaultSortBy

    /**
     * ショートカット一覧の現在のソート順
     *
     * 【定型文と別に持つ理由】
     * 「使用頻度」が指すものが、定型文はコピー回数、ショートカットは値の挿入回数の合計で別物。
     * 1つの設定を共有すると、表示を切り替えるたびに前の一覧の都合で並びが変わってしまう。
     */
    private var currentShortcutSortBy: String = KeyboardViewController.defaultSortBy

    /// 現在表示している画面
    private var screenState: ScreenState = .list

    /**
     * 直前にショートカット行の操作を受け付けた時刻（端末起動からの経過秒）
     *
     * 二度押しで意図しない値を挿入しないための判定に使う（`acceptShortcutTap()`）。
     */
    private var lastShortcutTapAt: TimeInterval = 0

    /**
     * 設定画面を開く直前に表示していた画面
     *
     * フィルター行（設定ボタンを含む）をショートカット表示でも出すようにしたため、
     * 設定はショートカット表示からも開ける。閉じたときに常に定型文へ戻すと、
     * 利用者が選んでいた表示対象が設定を覗いただけで変わってしまうため、戻り先を覚えておく。
     */
    private var screenStateBeforeSettings: ScreenState = .list

    /// 並べ替えの既定値（この値のときはバッジを出さない）
    private static let defaultSortBy = "created"

    /// 定型文のソート設定を保存するUserDefaultsキー
    private let snippetSortPreferenceKey = "keyboard_snippet_sort_by"

    /// ショートカットのソート設定を保存するUserDefaultsキー
    private let shortcutSortPreferenceKey = "keyboard_shortcut_sort_by"

    /// フルアクセス状態を共有するApp GroupのUserDefaultsキー
    private let fullAccessStateKey = "keyboardHasFullAccess"

    /// App Group識別子
    private let appGroupIdentifier = "group.com.sikakou.cliptap"

    /**
     * キーボード全体の高さ（pt）
     *
     * OS標準キーボードに近い高さにして、スニペット一覧の表示領域を確保する。
     */
    private static let keyboardHeight: CGFloat = 280

    /**
     * キーボードの高さ制約
     *
     * 表示のたびに新しい制約を追加すると矛盾した制約が増殖し、
     * レイアウトが不定になって表示領域とタッチ領域がずれるため、1本だけ保持して使い回す。
     */
    private var keyboardHeightConstraint: NSLayoutConstraint?

    /**
     * ショートカット行の二度押しを無視する時間（秒）
     *
     * Android IMEの `INSERT_DEBOUNCE_MS` と同じ値にして、
     * 同じ操作で同じ結果になるようにする。
     */
    private static let shortcutTapDebounce: TimeInterval = 0.3

    // MARK: - UI Components（画面を構成するUI部品）

    // === 統合フィルターエリア（環境 + カテゴリを1行に配置）===
    // 環境選択ドロップダウン（左端固定）+ カテゴリボタン（横スクロール）

    /// 統合フィルターエリア全体を包むコンテナビュー
    /// 環境ドロップダウンとカテゴリスクロールビューを横並びに配置
    private let filterContainerView: UIView = {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = .clear  // 背景色を透明に
        return view
    }()

    /// 環境選択ドロップダウンボタン（左端固定、固定幅）
    /// タップすると環境一覧メニューが表示される
    private let profileDropdownButton: UIButton = {
        let button = UIButton(type: .system)
        button.titleLabel?.font = .systemFont(ofSize: 12, weight: .medium)
        button.contentHorizontalAlignment = .left
        button.contentEdgeInsets = UIEdgeInsets(top: 6, left: 12, bottom: 6, right: 28)  // 右側にシェブロン用のスペースを確保
        button.layer.cornerRadius = 16
        button.backgroundColor = .secondarySystemFill
        button.setTitleColor(.label, for: .normal)
        button.translatesAutoresizingMaskIntoConstraints = false

        return button
    }()

    /// シェブロンアイコン（ドロップダウンボタンの右端に固定配置）
    private let chevronImageView: UIImageView = {
        let config = UIImage.SymbolConfiguration(pointSize: 10, weight: .medium)
        let image = UIImage(systemName: "chevron.down", withConfiguration: config)
        let imageView = UIImageView(image: image)
        imageView.tintColor = .secondaryLabel
        imageView.contentMode = .center
        imageView.translatesAutoresizingMaskIntoConstraints = false
        return imageView
    }()

    /// カテゴリ選択ドロップダウンボタン（環境ドロップダウンの右隣、固定幅）
    /// タップするとカテゴリ一覧メニューが表示される
    private let categoryDropdownButton: UIButton = {
        let button = UIButton(type: .system)
        button.titleLabel?.font = .systemFont(ofSize: 12, weight: .medium)
        button.contentHorizontalAlignment = .left
        button.contentEdgeInsets = UIEdgeInsets(top: 6, left: 12, bottom: 6, right: 28)
        button.layer.cornerRadius = 16
        button.backgroundColor = .secondarySystemFill
        button.setTitleColor(.label, for: .normal)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()

    /// カテゴリ用シェブロンアイコン（ドロップダウンボタンの右端に固定配置）
    private let categoryChevronImageView: UIImageView = {
        let config = UIImage.SymbolConfiguration(pointSize: 10, weight: .medium)
        let image = UIImage(systemName: "chevron.down", withConfiguration: config)
        let imageView = UIImageView(image: image)
        imageView.tintColor = .secondaryLabel
        imageView.contentMode = .center
        imageView.translatesAutoresizingMaskIntoConstraints = false
        return imageView
    }()

    /// ソートボタン（左端に固定配置）
    /// タップするとソートオプションメニューが表示される
    private let sortButton: UIButton = {
        let button = UIButton(type: .system)
        let config = UIImage.SymbolConfiguration(pointSize: 14, weight: .medium)
        let image = UIImage(systemName: "arrow.up.arrow.down", withConfiguration: config)
        button.setImage(image, for: .normal)
        button.tintColor = .label
        button.backgroundColor = .clear
        button.translatesAutoresizingMaskIntoConstraints = false
        button.showsMenuAsPrimaryAction = true
        button.accessibilityLabel = L10n.Accessibility.sortButton
        return button
    }()

    /// ソートボタンのバッジ（デフォルト以外の時に表示）
    /// プライマリカラーの小さな丸で、デフォルト以外のソートが選択されていることを示す
    private let sortBadgeView: UIView = {
        let view = UIView()
        view.backgroundColor = .systemBlue
        view.layer.cornerRadius = 4
        view.translatesAutoresizingMaskIntoConstraints = false
        view.isHidden = true
        return view
    }()

    /// 定型文／ショートカットの表示を切り替えるトグル（ソートボタンの左隣に配置）
    /// タップするたびに一覧の表示対象が入れ替わる
    ///
    /// 【見た目を初期化時に固定しない理由】
    /// ノブの位置・アイコン・読み上げラベルは表示中の一覧によって変わるため、
    /// updateShortcutToggleAppearance(isShowingShortcuts:) が一元的に更新する。
    /// ここでは既定（定型文表示）の見た目だけを与える。
    private let shortcutToggle: ListModeToggle = {
        let toggle = ListModeToggle()
        toggle.translatesAutoresizingMaskIntoConstraints = false
        return toggle
    }()

    /// 設定ボタン（ソートボタンの右隣に配置）
    /// タップすると設定画面が表示される
    private let settingsButton: UIButton = {
        let button = UIButton(type: .system)
        let config = UIImage.SymbolConfiguration(pointSize: 14, weight: .medium)
        let image = UIImage(systemName: "gearshape", withConfiguration: config)
        button.setImage(image, for: .normal)
        button.tintColor = .label
        button.backgroundColor = .clear
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()

    // === スニペット一覧エリア ===

    /// スニペット一覧を表示するテーブルビュー（リスト形式）
    /// 各行をタップすると、詳細画面（プレビュー）が表示されます
    private let tableView: UITableView = {
        let tv = UITableView()
        /* 完全な透明にすると、行の余白や最終行より下から始めたタッチがキーボードへ届かないため、
           目に見えない塗りを置く（UIColor.keyboardTouchableClear を参照） */
        tv.backgroundColor = .keyboardTouchableClear
        tv.translatesAutoresizingMaskIntoConstraints = false
        return tv
    }()

    // === 詳細表示エリア（プレビュー画面）===
    // スニペットをタップすると全画面表示される

    /// 詳細表示画面の全体を包むビュー
    /// 初期状態では非表示（isHidden = true）
    private let detailView: UIView = {
        let view = UIView()
        view.backgroundColor = .clear
        view.translatesAutoresizingMaskIntoConstraints = false
        view.isHidden = true  // 最初は非表示
        return view
    }()

    /// 詳細内容をスクロールできるようにするためのスクロールビュー
    /// スニペットの内容が長い場合でも、スクロールして全文を読めます
    private let detailScrollView: UIScrollView = {
        let sv = UIScrollView()
        sv.translatesAutoresizingMaskIntoConstraints = false
        return sv
    }()

    /// スクロールビューの中身を配置するためのコンテナビュー
    /// Auto Layoutの制約を設定するために必要です
    private let detailContentView: UIView = {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    /// スニペットのタイトルを表示するラベル
    /// copyWithTitleフラグがfalseの場合は非表示になります
    private let detailTitleLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 16)  // 本文（detailContentLabel）と同じフォント
        label.numberOfLines = 0  // 複数行表示可能（改行を許可）
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    /// タイトルだけを入力欄へ挿入するボタン（タイトル行の右端）
    /// メールの件名と本文のように、タイトルと本文を別々の欄へ入れるために使用します
    /// copyWithTitleがOFFのスニペット、またはタイトルが空のスニペットでは非表示になります
    private let titleInsertButton: ExpandedHitAreaButton = {
        let button = ExpandedHitAreaButton()
        // アイコン設定（紙飛行機マーク。下部の挿入ボタンより一回り小さい）
        let config = UIImage.SymbolConfiguration(pointSize: 13, weight: .medium)
        let image = UIImage(systemName: "paperplane.fill", withConfiguration: config)
        button.setImage(image, for: .normal)
        button.backgroundColor = .systemBlue  // 青い背景
        button.tintColor = .white  // 白いアイコン
        button.layer.cornerRadius = 16  // 丸ボタン（半径16で32x32の円形になる）
        button.translatesAutoresizingMaskIntoConstraints = false
        button.isHidden = true  // 初期状態は非表示（copyWithTitleがONのときだけ表示）
        return button
    }()

    /// タイトルと本文の区切り線
    /// タイトルと本文が別々に挿入できることを視覚的に伝えます
    private let titleSeparatorView: UIView = {
        let view = UIView()
        view.backgroundColor = .separator  // ライト/ダークに自動追従するシステム色
        view.translatesAutoresizingMaskIntoConstraints = false
        view.isHidden = true  // 初期状態は非表示（copyWithTitleがONのときだけ表示）
        return view
    }()

    /// スニペットの内容（本文）を表示するラベル
    /// 変数（{{today}}など）は実際の値に置き換えられた状態で表示されます
    private let detailContentLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 16)  // 通常フォント、16ポイント
        label.numberOfLines = 0  // 複数行表示可能
        label.textColor = .label  // システム標準のテキスト色
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    // === 詳細画面の切り替え用制約 ===

    /// copyWithTitleがOFFのときに使う本文の上端制約（本文の上はタイトルラベル）
    /// タイトルラベルは非表示かつ高さ0になるため、従来と同じ表示位置になります
    private var contentTopToTitleConstraint: NSLayoutConstraint?

    /// copyWithTitleがONのときに使う本文の上端制約（本文の上は区切り線）
    private var contentTopToSeparatorConstraint: NSLayoutConstraint?

    /// タイトル挿入ボタンを表示するときだけ有効にする区切り線の下限制約
    /// 非表示のボタンもAuto Layout上は32ptを占めるため、常時有効にすると
    /// タイトルラベルが引き伸ばされてOFF時の本文位置が下がってしまう
    private var separatorTopToButtonConstraint: NSLayoutConstraint?

    // === ボタンエリア（詳細画面下部）===

    /// コピーボタン（テキスト入力欄に挿入）
    /// 紙飛行機アイコンの青い丸ボタン
    private let copyButton: UIButton = {
        let button = UIButton(type: .system)
        // アイコン設定（紙飛行機マーク）
        let config = UIImage.SymbolConfiguration(pointSize: 16, weight: .medium)
        let image = UIImage(systemName: "paperplane.fill", withConfiguration: config)
        button.setImage(image, for: .normal)
        button.backgroundColor = .systemBlue  // 青い背景
        button.tintColor = .white  // 白いアイコン
        button.layer.cornerRadius = 20  // 丸ボタン（半径20で40x40の円形になる）
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()

    /// 閉じるボタン（詳細画面を閉じてリストに戻る）
    /// ×マークのグレーの丸ボタン
    private let closeButton: UIButton = {
        let button = UIButton(type: .system)
        // アイコン設定（×マーク）
        let config = UIImage.SymbolConfiguration(pointSize: 14, weight: .medium)
        let image = UIImage(systemName: "xmark", withConfiguration: config)
        button.setImage(image, for: .normal)
        button.backgroundColor = .secondarySystemFill
        button.tintColor = .label  // システム標準のテキスト色
        button.layer.cornerRadius = 20  // 丸ボタン
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()

    /// 改行挿入ボタン（閉じるボタンと挿入ボタンの間）
    /// 改行マークのグレーの丸ボタン
    ///
    /// 【なぜ必要か】
    /// タイトル挿入・本文挿入のどちらも改行を付けないため、同じ入力欄へ
    /// 「タイトル → 改行 → 本文」と入れるには標準キーボードへの切り替えが必要でした。
    /// このボタンにより、切り替えずに改行を入力できます。
    ///
    /// 【グレーにする理由】
    /// 主要な操作は青い挿入ボタンであることを保つため、閉じるボタンと同じ副次配色にします。
    ///
    /// 【ExpandedHitAreaButtonを使う理由】
    /// 隣接する2つのボタンと揃えた40x40の見た目のまま、
    /// タップ領域だけを44x44へ広げてタップしやすさを確保します。
    private let newlineButton: ExpandedHitAreaButton = {
        let button = ExpandedHitAreaButton()
        // アイコン設定（改行マーク）
        let config = UIImage.SymbolConfiguration(pointSize: 14, weight: .medium)
        let image = UIImage(systemName: "return", withConfiguration: config)
        button.setImage(image, for: .normal)
        button.backgroundColor = .secondarySystemFill
        button.tintColor = .label  // システム標準のテキスト色
        button.layer.cornerRadius = 20  // 丸ボタン
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()

    // === 空状態表示 ===

    /// スニペットが1件もない場合に表示されるメッセージラベル
    /// 「スニペットがありません」などのガイドメッセージを表示
    private let emptyLabel: UILabel = {
        let label = UILabel()
        label.numberOfLines = 0  // 複数行表示可能
        label.font = .systemFont(ofSize: 12)
        label.textColor = .secondaryLabel  // 薄めのグレー（目立たない色）
        label.textAlignment = .center  // 中央揃え
        // 多言語対応: "スニペットがありません\nメインアプリでスニペットを作成してください" / "No snippets available\nCreate snippets in the main app"
        label.text = "\(L10n.Snippet.empty)\n\(L10n.Message.emptyState)"
        label.translatesAutoresizingMaskIntoConstraints = false
        label.isHidden = true  // 初期状態では非表示（スニペットがある場合は表示しない）
        return label
    }()

    // === ローディング画面 ===

    /// ローディング画面全体を包むビュー
    private let loadingView: UIView = {
        let view = UIView()
        view.backgroundColor = .clear
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    /// ローディングインジケーター（くるくる回るやつ）
    private let activityIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .medium)
        indicator.translatesAutoresizingMaskIntoConstraints = false
        indicator.hidesWhenStopped = true
        return indicator
    }()

    /// ローディングメッセージ
    private let loadingLabel: UILabel = {
        let label = UILabel()
        label.text = L10n.Message.loading  // "読み込み中..." / "Loading..."
        label.font = .systemFont(ofSize: 14)
        label.textColor = .secondaryLabel
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    // === 設定画面エリア ===

    /// 設定画面全体を包むビュー（全画面表示）
    private let settingsView: UIView = {
        let view = UIView()
        view.backgroundColor = .clear
        view.translatesAutoresizingMaskIntoConstraints = false
        view.isHidden = true
        return view
    }()

    /// 設定画面のヘッダービュー
    private let settingsHeaderView: UIView = {
        let view = UIView()
        view.backgroundColor = .clear
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    /// 設定画面のタイトルラベル
    private let settingsTitleLabel: UILabel = {
        let label = UILabel()
        label.font = .boldSystemFont(ofSize: 16)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    /// 設定画面の閉じるボタン
    private let settingsCloseButton: UIButton = {
        let button = UIButton(type: .system)
        let config = UIImage.SymbolConfiguration(pointSize: 14, weight: .medium)
        let image = UIImage(systemName: "xmark", withConfiguration: config)
        button.setImage(image, for: .normal)
        button.backgroundColor = .secondarySystemFill
        button.tintColor = .label
        button.layer.cornerRadius = 15
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()

    /// 使用頻度スイッチの行コンテナ
    private let usageTrackingRowView: UIView = {
        let view = UIView()
        view.backgroundColor = .tertiarySystemFill
        view.layer.cornerRadius = 10
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    /// 使用頻度の記録状態の見出しラベル
    private let usageTrackingLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 15)
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    /// 使用頻度の記録が有効かどうかを示すラベル
    /// フルアクセスの許可状態に応じて「有効」「フルアクセスが必要」を出し分ける
    private let usageTrackingStatusLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 15, weight: .medium)
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    /// フルアクセス必要ヒントラベル
    private let fullAccessHintLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 12)
        label.textColor = .secondaryLabel
        label.numberOfLines = 0
        label.translatesAutoresizingMaskIntoConstraints = false
        label.isHidden = true
        return label
    }()

    /// フルアクセス許可手順ラベル
    private let fullAccessInstructionsLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 12)
        label.textColor = .secondaryLabel
        label.numberOfLines = 0
        label.translatesAutoresizingMaskIntoConstraints = false
        label.isHidden = true
        return label
    }()

    // === ショートカット画面エリア ===

    /// ショートカット画面全体を包むビュー
    /// フィルター行の下に敷き、定型文一覧（tableView）と同じ領域を使う
    /// （フィルター行はトグルと環境の切り替えのためショートカット表示中も出したままにする）
    private let shortcutView: UIView = {
        let view = UIView()
        view.backgroundColor = .clear
        view.translatesAutoresizingMaskIntoConstraints = false
        view.isHidden = true
        return view
    }()

    /// ショートカット／値の一覧を表示するテーブルビュー
    /// スニペット一覧（tableView）とは別のテーブルビューなので、
    /// データソース・デリゲートでは必ず同一性で分岐すること
    private let shortcutTableView: UITableView = {
        let tv = UITableView()
        /* 定型文一覧と同じく、行の全域と最終行より下でタップ・スクロールを受けるための目に見えない塗り
           （UIColor.keyboardTouchableClear を参照） */
        tv.backgroundColor = .keyboardTouchableClear
        tv.translatesAutoresizingMaskIntoConstraints = false
        return tv
    }()

    /// ショートカットが1件もない場合に表示されるメッセージラベル
    private let shortcutEmptyLabel: UILabel = {
        let label = UILabel()
        label.numberOfLines = 0
        label.font = .systemFont(ofSize: 12)
        label.textColor = .secondaryLabel
        label.textAlignment = .center
        /* 多言語対応: "ショートカットがありません\nメインアプリでショートカットを作成してください" */
        label.text = "\(L10n.Shortcut.empty)\n\(L10n.Shortcut.emptyHint)"
        label.translatesAutoresizingMaskIntoConstraints = false
        label.isHidden = true
        return label
    }()

    // MARK: - Lifecycle Methods（ライフサイクルメソッド：画面の表示・非表示時に呼ばれる）

    /// 画面が最初に読み込まれたときに1回だけ呼ばれるメソッド
    /// アプリ起動後、初めてこのキーボードが表示されるタイミングで実行されます
    ///
    /// 【処理内容】
    /// 1. 画面のUI部品を配置（setupUI）
    /// 2. サブスクリプション状態をチェック
    /// 3. データベースからデータを読み込み（loadInitialData）
    override func viewDidLoad() {
        super.viewDidLoad()

        // デバッグ用のログ出力（開発中の動作確認用）
        KeyboardLog.debug("============================================================")
        KeyboardLog.debug("🎯🎯🎯 [KeyboardViewController] viewDidLoad CALLED 🎯🎯🎯")
        KeyboardLog.debug("============================================================")

        applySystemKeyboardBackground()

        /* フルアクセス状態をApp Group UserDefaultsに保存（SnippetServiceと共有） */
        saveFullAccessState()

        /* ソート設定を初期読み込み（setupUIより前に実行する必要あり） */
        /* 使用頻度順は読み取りだけで成立するため、フルアクセスの有無で制限しない */
        currentSnippetSortBy = loadSortPreference(forKey: snippetSortPreferenceKey)
        currentShortcutSortBy = loadSortPreference(forKey: shortcutSortPreferenceKey)

        KeyboardLog.debug("🔄 [Sort] Initial sort preference loaded: snippet=%@ shortcut=%@",
                          currentSnippetSortBy, currentShortcutSortBy)

        setupUI()  // UI部品を画面に配置（即座に表示）

        // ローディング画面を表示
        showLoading()

        // データ読み込みをメインスレッドで実行
        // データベースアクセスはDatabase.swiftのdbQueueでスレッドセーフに管理されます
        loadInitialData()
    }

    /// 画面が表示される直前に呼ばれるメソッド
    /// キーボードが表示される度に毎回実行されます（viewDidLoadは1回だけ、こちらは毎回）
    ///
    /// 【なぜ毎回リフレッシュするのか】
    /// ユーザーがメインアプリでスニペットを編集した後、キーボードを開くと
    /// 最新のデータが表示されるようにするためです
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)

        KeyboardLog.debug("============================================================")
        KeyboardLog.debug("👁️👁️👁️ [KeyboardViewController] viewWillAppear CALLED 👁️👁️👁️")
        KeyboardLog.debug("============================================================")

        /* キーボードの高さを再適用する（制約は1本だけ保持するので増殖しない） */
        applyKeyboardHeightConstraint()

        applyHostKeyboardAppearance()

        // キーボードが表示される度に全データをリフレッシュ
        // これにより、メインアプリでの変更がキーボードにも即座に反映されます
        KeyboardLog.debug("🔄 [KeyboardViewController] viewWillAppear - Refreshing all data...")
        refreshAllData()
    }

    override func textDidChange(_ textInput: UITextInput?) {
        super.textDidChange(textInput)
        applyHostKeyboardAppearance()
    }

    /**
     * OS標準キーボードの背景を適用する
     *
     * 独自の背景色を持たず、OSがキーボードに使う背景素材をそのまま使う。
     * ルートビューがkeyboardスタイルのUIInputViewでない場合だけ、背面に
     * UIInputViewを追加してキーボード素材を確実に描画する。
     */
    private func applySystemKeyboardBackground() {
        view.backgroundColor = nil

        if let inputView = view as? UIInputView, inputView.inputViewStyle == .keyboard {
            KeyboardLog.debug("🎨 [Background] Root is UIInputView(.keyboard) - use system material as-is")
            return
        }

        KeyboardLog.debug("🎨 [Background] Root is %@ - insert UIInputView backdrop",
                          String(describing: type(of: view!)))
        let backdrop = UIInputView(frame: .zero, inputViewStyle: .keyboard)
        backdrop.translatesAutoresizingMaskIntoConstraints = false
        view.insertSubview(backdrop, at: 0)
        NSLayoutConstraint.activate([
            backdrop.topAnchor.constraint(equalTo: view.topAnchor),
            backdrop.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            backdrop.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            backdrop.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    /** 入力先アプリが要求するキーボード外観をビューとメニューへ反映する */
    private func applyHostKeyboardAppearance() {
        let style: UIUserInterfaceStyle
        switch textDocumentProxy.keyboardAppearance {
        case .dark:
            style = .dark
        case .light:
            style = .light
        default:
            style = .unspecified
        }

        if view.overrideUserInterfaceStyle != style {
            view.overrideUserInterfaceStyle = style
        }
        if let window = view.window, window.overrideUserInterfaceStyle != style {
            window.overrideUserInterfaceStyle = style
        }
    }

    /**
     * キーボードの高さ制約を適用する
     *
     * 制約は1本だけ生成して保持し、2回目以降は定数の更新だけを行う。
     * 表示のたびに制約を追加すると矛盾した必須制約が積み上がり、
     * UIKitがレイアウトのたびに制約を破棄して復旧するため、
     * ビューの実フレームが不定になって「見えているのに触れない領域」が生まれる。
     *
     * 優先度をrequiredより1段下げているのは、システム側が入力ビューへ付ける制約と
     * 衝突したときにこちらを譲り、制約破棄によるレイアウト崩れを避けるため。
     */
    private func applyKeyboardHeightConstraint() {
        if let constraint = keyboardHeightConstraint {
            constraint.constant = Self.keyboardHeight
            return
        }

        let constraint = view.heightAnchor.constraint(equalToConstant: Self.keyboardHeight)
        constraint.priority = UILayoutPriority(999)
        constraint.isActive = true
        keyboardHeightConstraint = constraint
    }

    // MARK: - Data Loading（データ読み込み処理）

    /// 全データをリフレッシュ（プロファイル、カテゴリ、スニペット）
    ///
    /// 【処理の流れ】
    /// 1. データベースを初期化
    /// 2. プロファイル（環境）を再読み込み → 変更があればボタンを再作成
    /// 3. カテゴリを再読み込み → 変更があればボタンを再作成
    /// 4. スニペットを再読み込み → 一覧を更新
    ///
    /// 【差分検出の仕組み】
    /// データ件数やIDが変わっていなければ、ボタンの再作成をスキップします
    /// これにより、無駄な処理を減らしてパフォーマンスを向上させています
    private func refreshAllData() {
        KeyboardLog.debug("🔄🔄🔄 [refreshAllData] STARTED 🔄🔄🔄")
        do {
            // データベースが初期化されているか確認
            try Database.shared.initialize()

            /* 書式設定は表示のたびに再読込する。
               変数値はプロファイル再読み込み後にまとめて取得するため、ここでは読まない */
            systemVariableFormats = SystemVariableFormatMapper.shared.getAll()

            // プロファイルを再読み込み
            KeyboardLog.debug("🔄 [Refresh] Loading profiles...")
            let newProfiles = profileService.getAllProfiles()

            // プロファイルが変更されたかチェック
            let profilesChanged = profiles.count != newProfiles.count ||
                                  profiles.map({ $0.id }) != newProfiles.map({ $0.id })

            if profilesChanged {
                KeyboardLog.debug("📝 [Refresh] Profiles changed: %d → %d", profiles.count, newProfiles.count)
                profiles = newProfiles

                /* 選択を決めてから表示へ反映する。
                   順序が逆だと、ドロップダウンのタイトルとメニューの選択状態が
                   差し替え前のプロファイルのまま残り、実際の選択と食い違う */
                currentProfile = resolveCurrentProfile(from: profiles)
                setupProfileDropdown()
            } else {
                KeyboardLog.debug("✓ [Refresh] Profiles unchanged: %d profiles", profiles.count)
            }

            if let profileId = currentProfile?.id {
                variablesMap = variableService.getVariablesMap(for: profileId)
            }

            // カテゴリを再読み込み
            KeyboardLog.debug("🔄 [Refresh] Loading categories...")
            let newCategories = categoryService.getAll()

            let categoriesChanged = categories.count != newCategories.count ||
                                   categories.map({ $0.id }) != newCategories.map({ $0.id })

            if categoriesChanged {
                KeyboardLog.debug("📝 [Refresh] Categories changed: %d → %d", categories.count, newCategories.count)
                categories = newCategories

                /* 選択中のカテゴリがメインアプリで削除されていたら「すべて」へ戻す。
                   残したままだと、存在しないIDで絞り込み続けて一覧が常に0件になり、
                   ドロップダウンには消えたカテゴリ名が出たままなので原因に気付けない
                   （プロファイルをresolveCurrentProfileで解決し直すのと同じ理由） */
                if let selectedId = currentCategory?.id,
                   !categories.contains(where: { $0.id == selectedId }) {
                    KeyboardLog.debug("📝 [Refresh] Selected category is gone - falling back to all")
                    currentCategory = nil
                }

                setupCategoryDropdown()
            } else {
                KeyboardLog.debug("✓ [Refresh] Categories unchanged: %d categories", categories.count)
            }

            // スニペットを再読み込み
            KeyboardLog.debug("🔄 [Refresh] Loading snippets...")
            let previousCount = allSnippets.count
            reloadSnippets()
            let newCount = allSnippets.count

            if previousCount != newCount {
                KeyboardLog.debug("📝 [Refresh] Snippets changed: %d → %d", previousCount, newCount)
            } else {
                KeyboardLog.debug("✓ [Refresh] Snippets unchanged: %d snippets", newCount)
            }

            /* ショートカットは画面を開くときに読み直すため、ここでは表示中のときだけ作り直す */
            if screenState == .shortcutList {
                KeyboardLog.debug("🔄 [Refresh] Reloading shortcut screen...")
                reloadShortcutScreen()
            }

            KeyboardLog.debug("✅ [Refresh] All data refreshed successfully")

        } catch {
            KeyboardLog.debug("❌ [Refresh] Failed to refresh data: %@", error.localizedDescription)
        }
    }

    private func setupUI() {
        // 統合フィルターコンテナ（環境ドロップダウン + カテゴリドロップダウン + ショートカットボタン + ソートボタン + 設定ボタン）
        view.addSubview(filterContainerView)
        filterContainerView.addSubview(profileDropdownButton)
        filterContainerView.addSubview(categoryDropdownButton)
        filterContainerView.addSubview(shortcutToggle)
        filterContainerView.addSubview(sortButton)
        filterContainerView.addSubview(settingsButton)

        // シェブロンアイコンをボタンの上に配置
        profileDropdownButton.addSubview(chevronImageView)
        categoryDropdownButton.addSubview(categoryChevronImageView)

        // ソートバッジをボタンに追加
        sortButton.addSubview(sortBadgeView)

        // ソートボタンのメニューを設定
        setupSortButtonMenu()

        // ショートカットボタンのアクションを設定
        shortcutToggle.addTarget(self, action: #selector(shortcutToggleTapped), for: .touchUpInside)

        // 設定ボタンのアクションを設定
        settingsButton.addTarget(self, action: #selector(settingsButtonTapped), for: .touchUpInside)

        NSLayoutConstraint.activate([
            /* フィルターコンテナ: 画面上部に配置（横向き時のノッチ側を避けるためセーフエリア基準）。
               高さはタップ領域の最小44ptにし、中のボタンは36ptのまま縦中央に置く。
               iOSは親ビューの外側へのタッチを子へ届けないため、行が36ptのままだと
               表示切替トグルが判定を44ptへ広げても、上下2ptずつしか効かない。
               行を上下4ptずつ広げた分は、上の余白と一覧までの間隔を4ptずつ詰めて相殺し、見た目の位置は変えない */
            filterContainerView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 4),
            filterContainerView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 8),
            filterContainerView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -8),
            filterContainerView.heightAnchor.constraint(equalToConstant: 44),

            /* 環境ドロップダウンボタン: 左端に固定、固定幅92pt・高さ36ptで縦中央 */
            profileDropdownButton.leadingAnchor.constraint(equalTo: filterContainerView.leadingAnchor),
            profileDropdownButton.centerYAnchor.constraint(equalTo: filterContainerView.centerYAnchor),
            profileDropdownButton.heightAnchor.constraint(equalToConstant: 36),
            profileDropdownButton.widthAnchor.constraint(equalToConstant: 92),

            /* シェブロンアイコン: ボタンの右端に固定配置 */
            chevronImageView.trailingAnchor.constraint(equalTo: profileDropdownButton.trailingAnchor, constant: -10),
            chevronImageView.centerYAnchor.constraint(equalTo: profileDropdownButton.centerYAnchor),
            chevronImageView.widthAnchor.constraint(equalToConstant: 12),
            chevronImageView.heightAnchor.constraint(equalToConstant: 12),

            /* カテゴリドロップダウンボタン: 環境ドロップダウンの右隣（幅は下の categoryDropdownWidthConstraint で指定） */
            categoryDropdownButton.leadingAnchor.constraint(equalTo: profileDropdownButton.trailingAnchor, constant: 8),
            categoryDropdownButton.centerYAnchor.constraint(equalTo: filterContainerView.centerYAnchor),
            categoryDropdownButton.heightAnchor.constraint(equalToConstant: 36),

            /* カテゴリドロップダウンの右端がボタン群に重ならないための上限（必須） */
            categoryDropdownButton.trailingAnchor.constraint(lessThanOrEqualTo: shortcutToggle.leadingAnchor, constant: -8),

            /* カテゴリ用シェブロンアイコン: ボタンの右端に固定配置 */
            categoryChevronImageView.trailingAnchor.constraint(equalTo: categoryDropdownButton.trailingAnchor, constant: -10),
            categoryChevronImageView.centerYAnchor.constraint(equalTo: categoryDropdownButton.centerYAnchor),
            categoryChevronImageView.widthAnchor.constraint(equalToConstant: 12),
            categoryChevronImageView.heightAnchor.constraint(equalToConstant: 12),

            /* 設定ボタン: 右端に固定、固定幅36pt・高さ36ptで縦中央 */
            settingsButton.trailingAnchor.constraint(equalTo: filterContainerView.trailingAnchor),
            settingsButton.centerYAnchor.constraint(equalTo: filterContainerView.centerYAnchor),
            settingsButton.heightAnchor.constraint(equalToConstant: 36),
            settingsButton.widthAnchor.constraint(equalToConstant: 36),

            /* 表示切替トグル: ソートボタンの左隣。ピル形なので高さは行いっぱいに広げず、
               32ptで縦中央に置く。タップ判定はListModeToggleが44ptまで広げ、
               行（親ビュー）を44ptにしてあるので、広げた判定がそのまま効く */
            shortcutToggle.trailingAnchor.constraint(equalTo: sortButton.leadingAnchor, constant: -4),
            shortcutToggle.centerYAnchor.constraint(equalTo: filterContainerView.centerYAnchor),
            shortcutToggle.widthAnchor.constraint(equalToConstant: ListModeToggle.trackWidth),
            shortcutToggle.heightAnchor.constraint(equalToConstant: ListModeToggle.trackHeight),

            /* ソートボタン: 設定ボタンの左隣、固定幅36pt・高さ36ptで縦中央 */
            sortButton.trailingAnchor.constraint(equalTo: settingsButton.leadingAnchor, constant: -4),
            sortButton.centerYAnchor.constraint(equalTo: filterContainerView.centerYAnchor),
            sortButton.heightAnchor.constraint(equalToConstant: 36),
            sortButton.widthAnchor.constraint(equalToConstant: 36),

            /* ソートバッジ: ボタン右上に配置、8x8ptの円 */
            sortBadgeView.widthAnchor.constraint(equalToConstant: 8),
            sortBadgeView.heightAnchor.constraint(equalToConstant: 8),
            sortBadgeView.topAnchor.constraint(equalTo: sortButton.topAnchor, constant: 2),
            sortBadgeView.trailingAnchor.constraint(equalTo: sortButton.trailingAnchor, constant: -2)
        ])

        /* カテゴリドロップダウンの幅92ptは「そうしたい」希望として扱い、必須にはしない。
           ヘッダーに必要な横幅は
           8+92(環境)+8+92(カテゴリ)+8+52(表示切替)+4+36(ソート)+4+36(設定)+8 = 348pt になる。
           表示切替をアイコン1つ（36pt）からトグル（52pt）へ広げた分は、
           2つのドロップダウンを100ptから92ptへ詰めて相殺しており、行の合計は変えていない。
           対応最小OS（iOS 17）で最も狭い端末は幅375ptのため通常は縮まないが、
           これより狭い幅になった場合に固定幅のままだとボタン群と重なってしまう。
           優先度を下げておけば、上のtrailing上限が効いてカテゴリ名側だけが縮み、
           右のボタン群（36ptの固定幅）は押せる大きさのまま必ず表示され続ける。 */
        let categoryDropdownWidthConstraint = categoryDropdownButton.widthAnchor.constraint(equalToConstant: 92)
        /* UIButtonの水平方向の圧縮抵抗は既定で.defaultHigh(750)であり、同値にすると
           「幅92」と「内容幅以上」が同じ強さで競合して幅が一意に定まらない。
           1つ上げて幅92を勝たせ、長いカテゴリ名はボタン側の省略に委ねる。
           上のtrailing上限は必須（1000）なので、狭いときに縮む挙動は保たれる */
        categoryDropdownWidthConstraint.priority = UILayoutPriority(rawValue: UILayoutPriority.defaultHigh.rawValue + 1)
        categoryDropdownWidthConstraint.isActive = true

        // TableView: フィルターコンテナの下に配置（+36ptの表示エリア拡大）
        tableView.delegate = self
        tableView.dataSource = self
        tableView.register(SnippetCell.self, forCellReuseIdentifier: SnippetCell.reuseIdentifier)

        /* 行の高さを固定し、自動高さ計算（セルフサイジング）を無効化する。
           推定高さのままだと行の実フレームが見た目とずれ、余白部分でタッチが拾えないことがある */
        tableView.rowHeight = SnippetCell.rowHeight
        tableView.estimatedRowHeight = 0

        /* 内容が画面に収まっていてもドラッグに反応させる（無反応に見える状態をなくす） */
        tableView.alwaysBounceVertical = true

        /* セルの余白を読みやすさ優先の幅に合わせず、行を画面幅いっぱいに使う */
        tableView.cellLayoutMarginsFollowReadableWidth = false

        view.addSubview(tableView)
        /* 下端をセーフエリアに合わせる: ホームインジケータ帯に入るとOSのジェスチャがスワイプを奪い、
           その領域から始めたドラッグがスクロールにならないため */
        NSLayoutConstraint.activate([
            /* 間隔はフィルター行を44ptに広げた分だけ詰めてあり、一覧の位置は広げる前と同じ */
            tableView.topAnchor.constraint(equalTo: filterContainerView.bottomAnchor, constant: 4),
            tableView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])

        // Detail View (全画面表示)
        view.addSubview(detailView)
        detailView.addSubview(detailScrollView)
        detailScrollView.addSubview(detailContentView)
        detailContentView.addSubview(detailTitleLabel)
        /* タイトル挿入ボタンと区切り線はスクロールされる中身なのでcontentViewへ追加する。
           下部の挿入・閉じるボタンと違いdetailViewへ重ねないため、スクロール操作は奪わない */
        detailContentView.addSubview(titleInsertButton)
        detailContentView.addSubview(titleSeparatorView)
        detailContentView.addSubview(detailContentLabel)
        /* ボタンは透明なコンテナに包まずdetailViewへ直接追加する。
           全幅・透明のコンテナを重ねると、その範囲のスクロール操作をコンテナが奪ってしまう */
        detailView.addSubview(copyButton)
        detailView.addSubview(newlineButton)
        detailView.addSubview(closeButton)

        NSLayoutConstraint.activate([
            // DetailView: 全画面表示
            detailView.topAnchor.constraint(equalTo: view.topAnchor),
            detailView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            detailView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            detailView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            // ScrollView: 全画面（下端はセーフエリアに合わせ、ホームインジケータ帯を避ける）
            detailScrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            detailScrollView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            detailScrollView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            detailScrollView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),

            // ContentView: ScrollViewのコンテンツ（ボタン分の下パディング追加）
            detailContentView.topAnchor.constraint(equalTo: detailScrollView.topAnchor),
            detailContentView.leadingAnchor.constraint(equalTo: detailScrollView.leadingAnchor),
            detailContentView.trailingAnchor.constraint(equalTo: detailScrollView.trailingAnchor),
            detailContentView.bottomAnchor.constraint(equalTo: detailScrollView.bottomAnchor),
            detailContentView.widthAnchor.constraint(equalTo: detailScrollView.widthAnchor),

            // Title Label
            detailTitleLabel.topAnchor.constraint(equalTo: detailContentView.topAnchor, constant: 12),
            detailTitleLabel.leadingAnchor.constraint(equalTo: detailContentView.leadingAnchor, constant: 12),
            detailTitleLabel.trailingAnchor.constraint(equalTo: titleInsertButton.leadingAnchor, constant: -8),

            // Title Insert Button（タイトル行の右端に置く32x32の丸ボタン）
            titleInsertButton.topAnchor.constraint(equalTo: detailContentView.topAnchor, constant: 8),
            titleInsertButton.trailingAnchor.constraint(equalTo: detailContentView.trailingAnchor, constant: -12),
            titleInsertButton.widthAnchor.constraint(equalToConstant: 32),
            titleInsertButton.heightAnchor.constraint(equalToConstant: 32),

            // Title Separator（タイトル行と本文の区切り線）
            titleSeparatorView.leadingAnchor.constraint(equalTo: detailContentView.leadingAnchor, constant: 12),
            titleSeparatorView.trailingAnchor.constraint(equalTo: detailContentView.trailingAnchor, constant: -12),
            titleSeparatorView.heightAnchor.constraint(equalToConstant: 0.5),

            // Content Label（ボタンエリア分の下マージン追加：60pt）
            detailContentLabel.leadingAnchor.constraint(equalTo: detailContentView.leadingAnchor, constant: 12),
            detailContentLabel.trailingAnchor.constraint(equalTo: detailContentView.trailingAnchor, constant: -12),
            detailContentLabel.bottomAnchor.constraint(equalTo: detailContentView.bottomAnchor, constant: -72),

            // Buttons: 画面右下に固定（丸ボタン、セーフエリア内に収める）
            copyButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),
            copyButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -12),
            copyButton.widthAnchor.constraint(equalToConstant: 40),
            copyButton.heightAnchor.constraint(equalToConstant: 40),

            // 改行ボタン（挿入ボタンと閉じるボタンの間）
            newlineButton.bottomAnchor.constraint(equalTo: copyButton.bottomAnchor),
            newlineButton.trailingAnchor.constraint(equalTo: copyButton.leadingAnchor, constant: -12),
            newlineButton.widthAnchor.constraint(equalToConstant: 40),
            newlineButton.heightAnchor.constraint(equalToConstant: 40),

            closeButton.bottomAnchor.constraint(equalTo: copyButton.bottomAnchor),
            closeButton.trailingAnchor.constraint(equalTo: newlineButton.leadingAnchor, constant: -12),
            closeButton.widthAnchor.constraint(equalToConstant: 40),
            closeButton.heightAnchor.constraint(equalToConstant: 40)
        ])

        /* 区切り線はタイトルの直下に置きたいが、1行タイトルではタイトルより背の高い挿入ボタンがはみ出す。
           優先度を下げた等式にすることで、複数行タイトルではタイトル基準、
           1行タイトルでは下のseparatorTopToButtonConstraint（ボタン基準）が採用される */
        let separatorTopToTitleConstraint = titleSeparatorView.topAnchor.constraint(
            equalTo: detailTitleLabel.bottomAnchor,
            constant: 8
        )
        separatorTopToTitleConstraint.priority = .defaultHigh
        separatorTopToTitleConstraint.isActive = true

        /* ボタンを表示するときだけ、その高さ分を区切り線の下限として効かせる。
           常時有効にすると、非表示のボタン（Auto Layout上は32ptを占める）を避けるために
           ソルバが優先度750の上記等式を満たそうとタイトルラベルを28ptへ引き伸ばし、
           タイトル非表示時でも本文が押し下がってしまう */
        let separatorTopToButton = titleSeparatorView.topAnchor.constraint(
            greaterThanOrEqualTo: titleInsertButton.bottomAnchor,
            constant: 8
        )
        separatorTopToButtonConstraint = separatorTopToButton  // 初期状態はボタン非表示のためactivateしない

        /* 本文の上端はcopyWithTitleの状態で付け替える。
           どちらも同じアンカーへの等式なので、必ず片方だけをactiveにする */
        let contentTopToTitle = detailContentLabel.topAnchor.constraint(
            equalTo: detailTitleLabel.bottomAnchor,
            constant: 8
        )
        let contentTopToSeparator = detailContentLabel.topAnchor.constraint(
            equalTo: titleSeparatorView.bottomAnchor,
            constant: 12
        )
        contentTopToTitleConstraint = contentTopToTitle
        contentTopToSeparatorConstraint = contentTopToSeparator
        contentTopToTitle.isActive = true  // 初期状態はタイトル非表示（従来の表示位置）

        copyButton.addTarget(self, action: #selector(copyButtonTapped), for: .touchUpInside)
        closeButton.addTarget(self, action: #selector(closeDetailView), for: .touchUpInside)
        titleInsertButton.addTarget(self, action: #selector(titleInsertButtonTapped), for: .touchUpInside)
        titleInsertButton.accessibilityLabel = L10n.Accessibility.insertTitleButton
        newlineButton.addTarget(self, action: #selector(newlineButtonTapped), for: .touchUpInside)
        newlineButton.accessibilityLabel = L10n.Accessibility.insertNewlineButton

        // Empty Label
        view.addSubview(emptyLabel)
        NSLayoutConstraint.activate([
            emptyLabel.centerXAnchor.constraint(equalTo: tableView.centerXAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: tableView.centerYAnchor),
            emptyLabel.leadingAnchor.constraint(equalTo: tableView.leadingAnchor, constant: 20),
            emptyLabel.trailingAnchor.constraint(equalTo: tableView.trailingAnchor, constant: -20)
        ])

        // Loading View (全画面ローディング)
        view.addSubview(loadingView)
        loadingView.addSubview(activityIndicator)
        loadingView.addSubview(loadingLabel)

        NSLayoutConstraint.activate([
            // Loading View: 全画面表示
            loadingView.topAnchor.constraint(equalTo: view.topAnchor),
            loadingView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            loadingView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            loadingView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            // Activity Indicator: 中央
            activityIndicator.centerXAnchor.constraint(equalTo: loadingView.centerXAnchor),
            activityIndicator.centerYAnchor.constraint(equalTo: loadingView.centerYAnchor, constant: -20),

            // Loading Label: インジケーターの下
            loadingLabel.topAnchor.constraint(equalTo: activityIndicator.bottomAnchor, constant: 12),
            loadingLabel.centerXAnchor.constraint(equalTo: loadingView.centerXAnchor)
        ])

        /* キーボードの高さ（制約はapplyKeyboardHeightConstraintで一元管理する） */
        applyKeyboardHeightConstraint()

        // Settings View (設定画面 - 全画面表示)
        view.addSubview(settingsView)
        settingsView.addSubview(settingsHeaderView)
        settingsHeaderView.addSubview(settingsTitleLabel)
        settingsHeaderView.addSubview(settingsCloseButton)
        settingsView.addSubview(usageTrackingRowView)
        usageTrackingRowView.addSubview(usageTrackingLabel)
        usageTrackingRowView.addSubview(usageTrackingStatusLabel)
        settingsView.addSubview(fullAccessHintLabel)
        settingsView.addSubview(fullAccessInstructionsLabel)

        // 設定画面のアクションを設定
        settingsCloseButton.addTarget(self, action: #selector(closeSettingsView), for: .touchUpInside)

        NSLayoutConstraint.activate([
            // Settings View: 全画面表示
            settingsView.topAnchor.constraint(equalTo: view.topAnchor),
            settingsView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            settingsView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            settingsView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            // Settings Header: 上部に固定
            settingsHeaderView.topAnchor.constraint(equalTo: settingsView.topAnchor),
            settingsHeaderView.leadingAnchor.constraint(equalTo: settingsView.leadingAnchor),
            settingsHeaderView.trailingAnchor.constraint(equalTo: settingsView.trailingAnchor),
            settingsHeaderView.heightAnchor.constraint(equalToConstant: 44),

            // Settings Title: ヘッダー中央
            settingsTitleLabel.centerXAnchor.constraint(equalTo: settingsHeaderView.centerXAnchor),
            settingsTitleLabel.centerYAnchor.constraint(equalTo: settingsHeaderView.centerYAnchor),

            // Settings Close Button: ヘッダー右端
            settingsCloseButton.trailingAnchor.constraint(equalTo: settingsHeaderView.trailingAnchor, constant: -12),
            settingsCloseButton.centerYAnchor.constraint(equalTo: settingsHeaderView.centerYAnchor),
            settingsCloseButton.widthAnchor.constraint(equalToConstant: 30),
            settingsCloseButton.heightAnchor.constraint(equalToConstant: 30),

            // Usage Tracking Row: ヘッダーの下
            usageTrackingRowView.topAnchor.constraint(equalTo: settingsHeaderView.bottomAnchor, constant: 16),
            usageTrackingRowView.leadingAnchor.constraint(equalTo: settingsView.leadingAnchor, constant: 12),
            usageTrackingRowView.trailingAnchor.constraint(equalTo: settingsView.trailingAnchor, constant: -12),
            usageTrackingRowView.heightAnchor.constraint(equalToConstant: 52),

            // Usage Tracking Label: 行の左側
            usageTrackingLabel.leadingAnchor.constraint(equalTo: usageTrackingRowView.leadingAnchor, constant: 16),
            usageTrackingLabel.centerYAnchor.constraint(equalTo: usageTrackingRowView.centerYAnchor),

            // Usage Tracking Status: 行の右側
            usageTrackingStatusLabel.trailingAnchor.constraint(equalTo: usageTrackingRowView.trailingAnchor, constant: -16),
            usageTrackingStatusLabel.centerYAnchor.constraint(equalTo: usageTrackingRowView.centerYAnchor),

            // Full Access Hint: 行の下
            fullAccessHintLabel.topAnchor.constraint(equalTo: usageTrackingRowView.bottomAnchor, constant: 8),
            fullAccessHintLabel.leadingAnchor.constraint(equalTo: settingsView.leadingAnchor, constant: 16),
            fullAccessHintLabel.trailingAnchor.constraint(equalTo: settingsView.trailingAnchor, constant: -16),

            // Full Access Instructions: ヒントの下
            fullAccessInstructionsLabel.topAnchor.constraint(equalTo: fullAccessHintLabel.bottomAnchor, constant: 12),
            fullAccessInstructionsLabel.leadingAnchor.constraint(equalTo: settingsView.leadingAnchor, constant: 16),
            fullAccessInstructionsLabel.trailingAnchor.constraint(equalTo: settingsView.trailingAnchor, constant: -16)
        ])

        // Shortcut View (ショートカット画面 - 全画面表示)
        setupShortcutView()

        applyScreenState()
    }

    /**
     * ショートカット画面を組み立てる
     *
     * 定型文一覧（tableView）と同じく、フィルター行の下に敷くビューとして作る。
     * 全画面で覆わないのは、フィルター行のトグルと環境の切り替えを
     * ショートカット表示中も見せ続けるため。
     * setupUIへ直接書くと1メソッドが長くなりすぎるため、この画面の組み立てだけを分けている。
     */
    private func setupShortcutView() {
        view.addSubview(shortcutView)
        shortcutView.addSubview(shortcutTableView)
        shortcutView.addSubview(shortcutEmptyLabel)

        shortcutTableView.delegate = self
        shortcutTableView.dataSource = self
        shortcutTableView.register(ShortcutCell.self, forCellReuseIdentifier: ShortcutCell.reuseIdentifier)
        shortcutTableView.register(ShortcutValueCell.self, forCellReuseIdentifier: ShortcutValueCell.reuseIdentifier)

        /* 行の高さを固定し、自動高さ計算（セルフサイジング）を無効化する。
           スニペット一覧と同じ理由で、推定高さのままだと行の実フレームが見た目とずれ、
           余白部分でタッチが拾えないことがある。
           一覧モードと値モード（2行）で高さが違うため、モードを切り替えるたびに入れ替える */
        shortcutTableView.rowHeight = ShortcutCell.rowHeight
        shortcutTableView.estimatedRowHeight = 0

        /* 内容が画面に収まっていてもドラッグに反応させる（無反応に見える状態をなくす） */
        shortcutTableView.alwaysBounceVertical = true

        /* セルの余白を読みやすさ優先の幅に合わせず、行を画面幅いっぱいに使う */
        shortcutTableView.cellLayoutMarginsFollowReadableWidth = false

        NSLayoutConstraint.activate([
            /* Shortcut View: フィルター行の下（定型文一覧と同じ位置・同じ余白）。
               フィルター行を覆わないことで、トグルと環境の切り替えが常に触れる */
            shortcutView.topAnchor.constraint(equalTo: filterContainerView.bottomAnchor, constant: 4),
            shortcutView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            shortcutView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            shortcutView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            /* TableView: ショートカット画面いっぱい（一覧・値一覧とも見出しの行は置かない）。
               左右は横向き時のノッチ側を避けるためセーフエリア基準。
               下端をセーフエリアに合わせるのはスニペット一覧と同じ理由で、
               ホームインジケータ帯から始めたドラッグをOSのジェスチャに奪われないようにするため */
            shortcutTableView.topAnchor.constraint(equalTo: shortcutView.topAnchor),
            shortcutTableView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            shortcutTableView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            shortcutTableView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),

            // Empty Label: テーブルビューの中央
            shortcutEmptyLabel.centerXAnchor.constraint(equalTo: shortcutTableView.centerXAnchor),
            shortcutEmptyLabel.centerYAnchor.constraint(equalTo: shortcutTableView.centerYAnchor),
            shortcutEmptyLabel.leadingAnchor.constraint(equalTo: shortcutTableView.leadingAnchor, constant: 20),
            shortcutEmptyLabel.trailingAnchor.constraint(equalTo: shortcutTableView.trailingAnchor, constant: -20)
        ])
    }

    private func loadInitialData() {
        os_log("🚀 loadInitialData started", log: keyboardLog, type: .info)
        KeyboardLog.debug("🚀 [KeyboardViewController] loadInitialData started")

        do {
            // データベースを初期化
            os_log("📦 Initializing database...", log: keyboardLog, type: .info)
            KeyboardLog.debug("📦 [KeyboardViewController] Initializing database...")
            try Database.shared.initialize()
            self.systemVariableFormats = SystemVariableFormatMapper.shared.getAll()
            os_log("✅ Database initialized successfully", log: keyboardLog, type: .info)
            KeyboardLog.debug("✅ [KeyboardViewController] Database initialized successfully")

            // プロファイルを読み込み（Serviceを使用）
            os_log("📦 Loading profiles...", log: keyboardLog, type: .info)
            KeyboardLog.debug("📦 [KeyboardViewController] Loading profiles...")
            let loadedProfiles = profileService.getAllProfiles()
            os_log("✅ Loaded %d profiles", log: keyboardLog, type: .info, loadedProfiles.count)
            KeyboardLog.debug("✅ [KeyboardViewController] Loaded %d profiles", loadedProfiles.count)

            // カテゴリを読み込み（Serviceを使用）
            os_log("📦 Loading categories...", log: keyboardLog, type: .info)
            KeyboardLog.debug("📦 [KeyboardViewController] Loading categories...")
            let loadedCategories = categoryService.getAll()
            os_log("✅ Loaded %d categories", log: keyboardLog, type: .info, loadedCategories.count)
            KeyboardLog.debug("✅ [KeyboardViewController] Loaded %d categories", loadedCategories.count)

            /* 変数とスニペットを読み込み
               （表示に使うプロファイルを先に決める。理由は resolveCurrentProfile を参照） */
            if let profile = self.resolveCurrentProfile(from: loadedProfiles) {
                os_log("✅ Setting current profile: %@", log: keyboardLog, type: .info, profile.name)
                KeyboardLog.debug("✅ [KeyboardViewController] Setting current profile: %@", profile.name)
                self.currentProfile = profile

                // 現在のプロファイルの変数を読み込み
                os_log("📦 Loading variables for profile...", log: keyboardLog, type: .info)
                KeyboardLog.debug("📦 [KeyboardViewController] Loading variables for profile...")
                self.variablesMap = variableService.getVariablesMap(for: profile.id)
                self.systemVariableFormats = SystemVariableFormatMapper.shared.getAll()
                os_log("✅ Loaded %d variables", log: keyboardLog, type: .info, self.variablesMap.count)
                KeyboardLog.debug("✅ [KeyboardViewController] Loaded %d variables", self.variablesMap.count)
            }

            // データを設定
            self.profiles = loadedProfiles
            self.categories = loadedCategories

            // UI更新（既にメインスレッドで実行されているため、asyncは不要）
            self.setupProfileDropdown()
            self.setupCategoryDropdown()

            if self.currentProfile != nil {
                self.reloadSnippets()
            } else {
                os_log("⚠️ No profiles found", log: keyboardLog, type: .error)
                KeyboardLog.debug("⚠️ [KeyboardViewController] No profiles found")
                self.updateEmptyState()
            }

            // ローディング画面を非表示
            self.hideLoading()

            os_log("🏁 loadInitialData completed", log: keyboardLog, type: .info)
            KeyboardLog.debug("🏁 [KeyboardViewController] loadInitialData completed")
            KeyboardLog.debug("📊 Final state: profiles=%d, categories=%d, snippets=%d",
                  self.profiles.count, self.categories.count, self.allSnippets.count)

        } catch {
            os_log("❌ Failed to load data: %@", log: keyboardLog, type: .error, error.localizedDescription)
            KeyboardLog.debug("❌ [KeyboardViewController] Failed to load data: %@", error.localizedDescription)

            // ローディング画面を非表示
            self.hideLoading()

            // 多言語対応: "エラー: データの読み込みに失敗しました" / "Failed to load data"
            self.emptyLabel.text = L10n.Error.loadFailed
        }
    }

    /**
     * 表示に使うプロファイルを決める
     *
     * - Parameter candidates: 環境ドロップダウンに並ぶプロファイル
     * - Returns: アクティブなプロファイル。無ければ先頭（候補が空ならnil）
     *
     * 【先頭ではなくアクティブなものを選ぶ理由】
     * 定型文もショートカットも環境で絞り込むため、キーボードを開いた直後の表示が
     * メインアプリで選んでいる環境と違うと、目当ての項目が出てこない。
     *
     * 【ProfileService.getActiveProfile() を使わない理由】
     * あちらは無効（valid=0）な環境も返し得るが、ドロップダウンには有効な環境しか並ばない。
     * 一覧に無い環境を選択にすると、ボタンの表示名と選べる項目が食い違う。
     */
    private func resolveCurrentProfile(from candidates: [Profile]) -> Profile? {
        return candidates.first(where: { $0.isActive }) ?? candidates.first
    }

    /// 環境ドロップダウンボタンの初期設定
    /// プロファイルが読み込まれた後に呼ばれる
    ///
    /// 【ここで currentProfile を決めない理由】
    /// 選択は呼び出し元（初期読み込み・再読み込み・利用者の選択）が決める。
    /// このメソッドで上書きすると、決まった選択とボタンの表示名がずれる。
    private func setupProfileDropdown() {
        if profiles.isEmpty {
            profileDropdownButton.isHidden = true
            return
        }

        updateProfileDropdownTitle()

        // UIMenuを設定（iOS 14+）
        updateProfileDropdownMenu()

        profileDropdownButton.isHidden = false
    }

    /// 環境ドロップダウンのタイトルを更新
    /// 現在選択中のプロファイル名を表示
    private func updateProfileDropdownTitle() {
        let title = currentProfile?.name ?? "Profile"
        profileDropdownButton.setTitle(title, for: .normal)
    }

    /// カテゴリドロップダウンボタンの初期設定
    /// カテゴリが読み込まれた後に呼ばれる
    private func setupCategoryDropdown() {
        // 初期タイトルを設定
        updateCategoryDropdownTitle()
        // メニューを設定
        updateCategoryDropdownMenu()
    }

    /// カテゴリドロップダウンのタイトルを更新
    /// 現在選択中のカテゴリ名を表示（未選択時は「すべて」）
    private func updateCategoryDropdownTitle() {
        let title = currentCategory?.name ?? L10n.Category.all
        categoryDropdownButton.setTitle(title, for: .normal)
    }

    /// カテゴリドロップダウンメニューを更新
    /// カテゴリ一覧のメニューを生成してボタンに設定
    private func updateCategoryDropdownMenu() {
        var menuActions: [UIAction] = []

        // 「すべて」オプション
        let allAction = UIAction(
            title: L10n.Category.all,
            state: currentCategory == nil ? .on : .off
        ) { [weak self] _ in
            self?.selectCategory(nil)
        }
        menuActions.append(allAction)

        // カテゴリオプション
        for category in categories {
            let action = UIAction(
                title: category.name,
                state: category.id == currentCategory?.id ? .on : .off
            ) { [weak self] _ in
                self?.selectCategory(category)
            }
            menuActions.append(action)
        }

        let menu = UIMenu(title: "", children: menuActions)

        // iOS 14+: UIButtonのmenuプロパティを使用
        if #available(iOS 14.0, *) {
            categoryDropdownButton.menu = menu
            categoryDropdownButton.showsMenuAsPrimaryAction = true
        }
    }

    /// カテゴリを選択する
    private func selectCategory(_ category: Category?) {
        currentCategory = category
        updateCategoryDropdownTitle()
        updateCategoryDropdownMenu()  // メニューの選択状態を更新

        /* ショートカットもカテゴリに属するため、表示中なら切り替えたカテゴリのものへ読み直す。
           値一覧を開いていた場合も一覧へ戻る（切り替え前のカテゴリの値をそのまま残さない） */
        if screenState == .shortcutList {
            reloadShortcutList()
        }

        reloadSnippets()
    }

    /// 環境ドロップダウンメニューを更新
    /// プロファイル一覧のメニューを生成してボタンに設定
    private func updateProfileDropdownMenu() {
        // プロファイル選択メニューを作成
        var menuActions: [UIAction] = []

        for profile in profiles {
            let action = UIAction(
                title: profile.name,
                state: profile.id == currentProfile?.id ? .on : .off
            ) { [weak self] _ in
                self?.selectProfile(profile)
            }
            menuActions.append(action)
        }

        let menu = UIMenu(title: "", children: menuActions)

        // iOS 14+: UIButtonのmenuプロパティを使用
        if #available(iOS 14.0, *) {
            profileDropdownButton.menu = menu
            profileDropdownButton.showsMenuAsPrimaryAction = true
        }
    }

    /// プロファイルを選択する
    private func selectProfile(_ profile: Profile) {
        currentProfile = profile
        updateProfileDropdownTitle()
        updateProfileDropdownMenu()  // メニューの選択状態を更新

        // プロファイル切り替え時に変数を再読み込み
        variablesMap = variableService.getVariablesMap(for: profile.id)
        systemVariableFormats = SystemVariableFormatMapper.shared.getAll()
        KeyboardLog.debug("✅ [KeyboardViewController] Reloaded %d variables for profile: %@", variablesMap.count, profile.name)

        /* ショートカットも環境によって出るものと参照値の中身が変わるため、表示中なら切り替えた環境のものへ読み直す。
           値一覧を開いていた場合も一覧へ戻る（切り替え前の環境の値をそのまま残さない） */
        if screenState == .shortcutList {
            reloadShortcutList()
        }

        reloadSnippets()
    }

    /// スニペット一覧を再読み込み
    ///
    /// 【呼ばれるタイミング】
    /// - 画面の初期表示時
    /// - 環境（プロファイル）を切り替えたとき
    /// - カテゴリを切り替えたとき
    /// - 画面が再表示されたとき（viewWillAppear）
    ///
    /// 【フィルタリングの仕組み】
    /// 1. 現在選択中の環境（プロファイル）でフィルタ → 環境専用のスニペットのみ取得
    /// 2. さらに、カテゴリが選択されている場合はカテゴリでもフィルタ
    ///
    /// 【データの流れ】
    /// データベース → allSnippets（プロファイル+カテゴリでフィルタ済み）
    ///              → filteredSnippets（表示用、現在は同じ内容）
    ///              → 画面に表示
    private func reloadSnippets() {
        os_log("🔄 reloadSnippets started", log: keyboardLog, type: .info)
        KeyboardLog.debug("🔄 [reloadSnippets] Started")
        KeyboardLog.debug("  Current profile: %@ (id: %@)", currentProfile?.name ?? "nil", currentProfile?.id ?? "nil")
        KeyboardLog.debug("  Current category: %@ (id: %@)", currentCategory?.name ?? "all", currentCategory?.id ?? "nil")

        // プロファイルが選択されていない場合は、何も表示しない
        guard let profileId = currentProfile?.id else {
            os_log("⚠️ No profile selected, clearing snippets", log: keyboardLog, type: .error)
            KeyboardLog.debug("⚠️ [reloadSnippets] No profile selected, clearing snippets")
            allSnippets = []
            filteredSnippets = []
            updateEmptyState()  // 空状態メッセージを表示
            return
        }

        // SnippetMapperを使ってデータベースから取得
        // プロファイルとカテゴリの両方でフィルタリングされ、SQLのORDER BYでソート済み
        if let categoryId = currentCategory?.id {
            // カテゴリが選択されている場合
            os_log("🔍 Loading snippets for category: %@ with profile: %@ sortBy: %@", log: keyboardLog, type: .info, categoryId, profileId, currentSnippetSortBy)
            KeyboardLog.debug("🔍 [reloadSnippets] Loading snippets for category: %@ with profile: %@ sortBy: %@", categoryId, profileId, currentSnippetSortBy)
            allSnippets = SnippetMapper.shared.getByCategoryId(categoryId, filterByProfileId: profileId, sortBy: currentSnippetSortBy)
        } else {
            // 「すべて」が選択されている場合（カテゴリフィルタなし）
            os_log("🔍 Loading all snippets with profile: %@ sortBy: %@", log: keyboardLog, type: .info, profileId, currentSnippetSortBy)
            KeyboardLog.debug("🔍 [reloadSnippets] Loading all snippets with profile: %@ sortBy: %@", profileId, currentSnippetSortBy)
            allSnippets = SnippetMapper.shared.getAll(filterByProfileId: profileId, sortBy: currentSnippetSortBy)
        }

        os_log("✅ Loaded %d snippets", log: keyboardLog, type: .info, allSnippets.count)
        KeyboardLog.debug("✅ [reloadSnippets] Loaded %d snippets", allSnippets.count)

        // MapperでORDER BYを使ってソート済みなので、そのまま表示用にコピー
        filteredSnippets = allSnippets
        os_log("✅ Loaded and sorted snippets: %d (sortBy: %@)", log: keyboardLog, type: .info, filteredSnippets.count, currentSnippetSortBy)
        KeyboardLog.debug("✅ [reloadSnippets] Loaded and sorted snippets: %d (sortBy: %@)", filteredSnippets.count, currentSnippetSortBy)

        /* 表示内容が前回と同じなら再描画しない。
           キーボードは表示のたびに全件再取得するため、無条件にreloadDataすると
           スクロール中の再描画コストとスクロール位置の巻き戻りを招く */
        let newSignature = makeSnippetListSignature(filteredSnippets)
        if let newSignature, newSignature == snippetListSignature {
            KeyboardLog.debug("✓ [reloadSnippets] List unchanged - skip reloadData()")
            updateEmptyState()
            return
        }
        snippetListSignature = newSignature

        // テーブルビューを更新（同期的に実行）
        // 注意: UIMenuのアクションは既にメインスレッドで実行されるため、非同期にする必要はない
        tableView.reloadData()
        KeyboardLog.debug("✅ [reloadSnippets] tableView.reloadData() called")

        // 空状態の表示/非表示を更新
        updateEmptyState()
    }

    /**
     * 一覧の表示内容を表す署名を作る
     *
     * - Parameter snippets: 表示対象のスニペット
     * - Returns: 署名。表示が外部要因で変わり得る場合はnil（＝必ず再描画する）
     *
     * セルはタイトルしか表示しないため、ID・タイトル・並び順が同じなら描画結果も同じになる。
     * ただしタイトルに変数を含む場合は、データが同じでも時刻などで表示が変わるためnilを返す。
     */
    private func makeSnippetListSignature(_ snippets: [Snippet]) -> String? {
        if snippets.contains(where: { variableReplacer.hasVariables(in: $0.title ?? "") }) {
            return nil
        }

        return snippets
            .map { "\($0.id)\u{1F}\($0.title ?? "")" }
            .joined(separator: "\u{1E}")
    }

    private func filterSnippets() {
        // カテゴリフィルタはreloadSnippetsで直接適用されるため、このメソッドは不要
        // ただし、既存の呼び出し元があるので維持
        if let categoryId = currentCategory?.id {
            filteredSnippets = allSnippets.filter { $0.categoryId == categoryId }
        } else {
            filteredSnippets = allSnippets
        }

        updateEmptyState()
    }

    private func updateEmptyState() {
        applyScreenState()
        /* 注意: tableView.reloadData() は reloadSnippets() でメインスレッドで直接呼び出すため、ここでは呼ばない */
    }

    /** 現在の画面状態に応じて、一覧と全画面ビューを排他的に表示する */
    private func applyScreenState() {
        let isList = screenState == .list
        let isShortcutList = screenState == .shortcutList
        let isEmpty = filteredSnippets.isEmpty

        /* フィルター行は定型文とショートカットの共通の操作列。
           カテゴリの絞り込みも並べ替えもどちらの一覧にもある操作なので、行ごと出したままにして、
           トグルと環境の切り替えを触れるようにする */
        filterContainerView.isHidden = !isList && !isShortcutList

        /* トグルの見た目（アイコン・色・読み上げ）を表示中の一覧に合わせる */
        updateShortcutToggleAppearance(isShowingShortcuts: isShortcutList)

        tableView.isHidden = !isList || isEmpty
        emptyLabel.isHidden = !isList || !isEmpty

        detailView.isHidden = screenState != .detail
        loadingView.isHidden = screenState != .loading
        settingsView.isHidden = screenState != .settings
        shortcutView.isHidden = !isShortcutList
    }

    /**
     * 定型文／ショートカットのトグルの見た目を更新する
     *
     * - Parameter isShowingShortcuts: ショートカットを表示中ならtrue
     *
     * 今どちらの一覧かは、ノブの位置と中のアイコンの形（定型文=書類、ショートカット=稲妻）で示す。
     * 配色などの見た目の詳細はListModeToggleが持つ。
     */
    private func updateShortcutToggleAppearance(isShowingShortcuts: Bool) {
        /* 読み上げは「押したら何が起きるか」を伝える。見た目は今どちらかを表すため、
           両者で向きが逆になる（ショートカット表示中は「定型文を表示」と読ませる） */
        shortcutToggle.accessibilityLabel = isShowingShortcuts
            ? L10n.Accessibility.showSnippetsButton
            : L10n.Accessibility.showShortcutsButton

        /* 画面状態の適用のたびに呼ばれるため、値が変わらないときはアニメーションを起こさない
           （ListModeToggle側で同値を弾く） */
        shortcutToggle.setShowingShortcuts(isShowingShortcuts, animated: true)
    }

    /// スニペットの詳細画面（プレビュー）を表示
    ///
    /// - Parameter snippet: 表示するスニペット
    ///
    /// 【処理の流れ】
    /// 1. スニペットを選択状態として保存
    /// 2. copyWithTitleフラグに応じてタイトルの表示/非表示を切り替え
    /// 3. 変数（{{today}}など）を実際の値に置き換えてプレビュー表示
    /// 4. アニメーションで詳細画面をフェードイン表示
    ///
    /// 【変数置換の仕組み】
    /// - 現在選択中の環境（プロファイル）の変数マップを取得
    /// - VariableReplacerを使って{{変数名}}を実際の値に置き換え
    /// - 例: "こんにちは{{client_name}}様" → "こんにちは田中様"
    private func showSnippetDetail(_ snippet: Snippet) {
        selectedSnippet = snippet  // 後でコピーボタンを押したときのために保存

        // 変数マップを取得（プロファイルに紐づく変数の一覧）
        var variablesMap: [String: String] = [:]
        if let profileId = currentProfile?.id {
            variablesMap = VariableService.shared.getVariablesMap(for: profileId)
        }

        let variableReplacer = VariableReplacer()

        // copyWithTitleフラグに応じてタイトル表示を制御
        // タイトルもコピーする設定の場合のみ、プレビューでもタイトルを表示
        if snippet.copyWithTitle {
            /* タイトルがNULLでも空文字でもプレースホルダーを表示する */
            let title = snippet.title ?? ""
            let rawTitle = title.isEmpty ? L10n.Snippet.noTitle : title
            let replacedTitle = variableReplacer.replace(
                in: rawTitle,
                variablesMap: variablesMap,
                formats: systemVariableFormats
            )
            detailTitleLabel.text = replacedTitle
            detailTitleLabel.isHidden = false
            /* タイトルが未設定のスニペットはプレースホルダー表示のみで、挿入するものがないためボタンは隠す */
            titleInsertButton.isHidden = title.isEmpty
            titleSeparatorView.isHidden = false
            /* 同一アンカーへの等式のため、必ずdeactivateしてからactivateする */
            if let contentTopToTitle = contentTopToTitleConstraint {
                NSLayoutConstraint.deactivate([contentTopToTitle])
            }
            if let contentTopToSeparator = contentTopToSeparatorConstraint {
                NSLayoutConstraint.activate([contentTopToSeparator])
            }
            /* ボタンを表示するときだけ、区切り線をボタンの下へ押し下げる制約を有効にする */
            separatorTopToButtonConstraint?.isActive = !titleInsertButton.isHidden
        } else {
            // タイトル行と区切り線を非表示（コピーしない設定の場合）
            /* 非表示のラベルもテキストが残っていると高さを持つため、本文の位置がずれないようクリアする */
            detailTitleLabel.text = nil
            detailTitleLabel.isHidden = true
            titleInsertButton.isHidden = true
            titleSeparatorView.isHidden = true
            /* 非表示ボタン基準の制約が残るとタイトルラベルが引き伸ばされ本文が押し下がるため必ず外す */
            separatorTopToButtonConstraint?.isActive = false
            /* 同一アンカーへの等式のため、必ずdeactivateしてからactivateする */
            if let contentTopToSeparator = contentTopToSeparatorConstraint {
                NSLayoutConstraint.deactivate([contentTopToSeparator])
            }
            if let contentTopToTitle = contentTopToTitleConstraint {
                NSLayoutConstraint.activate([contentTopToTitle])
            }
        }

        // 内容を変数置換（{{today}} → 2025/11/17など）
        let preview = variableReplacer.replace(
            in: snippet.content,
            variablesMap: variablesMap,
            formats: systemVariableFormats
        )
        detailContentLabel.text = preview

        /* 前に開いたスニペットのスクロール位置が残ると、最上部のタイトル行と
           タイトル挿入ボタンが画面外になって見えないため先頭へ戻す */
        detailScrollView.setContentOffset(.zero, animated: false)

        // アニメーションで詳細画面を表示
        screenState = .detail
        applyScreenState()

        // フェードインアニメーション（0.2秒かけて透明→不透明）
        detailView.alpha = 0
        UIView.animate(withDuration: 0.2) {
            self.detailView.alpha = 1
        }
    }

    /// 詳細画面を閉じてスニペット一覧に戻る
    ///
    /// 【処理の流れ】
    /// 1. フェードアウトアニメーションで詳細画面を非表示
    /// 2. スニペット一覧を再表示（空の場合は空状態メッセージを表示）
    /// 3. 選択中のスニペットをクリア
    @objc private func closeDetailView() {
        // フェードアウトアニメーション（0.2秒かけて不透明→透明）
        UIView.animate(withDuration: 0.2, animations: {
            self.detailView.alpha = 0
        }) { _ in
            // アニメーション完了後の処理
            if self.screenState == .detail {
                self.screenState = .list
                self.applyScreenState()
            }
            self.selectedSnippet = nil  // 選択解除
        }
    }

    /// コピーボタンがタップされたときの処理
    ///
    /// 【処理の流れ】
    /// 1. 選択中のスニペットを確認
    /// 2. スニペットをテキスト入力欄に挿入
    /// 3. 詳細画面を閉じる
    @objc private func copyButtonTapped() {
        guard let snippet = selectedSnippet else {
            // 選択中のスニペットがない場合（通常は発生しない）
            os_log("⚠️ Copy button tapped but no snippet selected", log: keyboardLog, type: .error)
            KeyboardLog.debug("⚠️ [KeyboardViewController] Copy button tapped but no snippet selected")
            return
        }

        KeyboardLog.debug("[KeyboardViewController] Copy button tapped")

        insertSnippet(snippet)  // スニペットの本文を挿入
        closeDetailView()  // 詳細画面を閉じる
    }

    /// タイトル挿入ボタンがタップされたときの処理
    ///
    /// 【処理の流れ】
    /// 1. 選択中のスニペットを確認
    /// 2. タイトルだけをテキスト入力欄に挿入
    ///
    /// 【詳細画面を閉じない理由】
    /// メールの件名を入れたあと、続けて本文を別の欄へ入れられるようにするため、
    /// タイトル挿入後も詳細画面は開いたままにします。
    @objc private func titleInsertButtonTapped() {
        guard let snippet = selectedSnippet else {
            // 選択中のスニペットがない場合（通常は発生しない）
            os_log("⚠️ Title insert button tapped but no snippet selected", log: keyboardLog, type: .error)
            KeyboardLog.debug("⚠️ [KeyboardViewController] Title insert button tapped but no snippet selected")
            return
        }

        KeyboardLog.debug("[KeyboardViewController] Title insert button tapped")

        // タイトルのみを挿入（変数置換＋振動フィードバックはService側で実行）
        snippetService.insertTitle(
            snippet,
            into: textDocumentProxy,  // iOSのテキスト入力API
            profileId: currentProfile?.id  // 環境IDを渡して、環境専用の変数を使用
        )
    }

    /// 改行ボタンがタップされたときの処理
    ///
    /// 【処理の流れ】
    /// 1. 改行だけをテキスト入力欄に挿入
    ///
    /// 【スニペットを参照しない理由】
    /// 挿入するのは改行のみで、変数置換もプロファイルも関与しないため、
    /// 選択中のスニペットの有無に関わらず動作します。
    ///
    /// 【詳細画面を閉じない理由】
    /// 「タイトル挿入 → 改行 → 本文挿入」と続けて操作できるようにするため、
    /// 改行挿入後も詳細画面は開いたままにします。
    @objc private func newlineButtonTapped() {
        KeyboardLog.debug("[KeyboardViewController] Newline button tapped")

        // 改行を挿入（振動フィードバックはService側で実行）
        snippetService.insertNewline(into: textDocumentProxy)  // iOSのテキスト入力API
    }

    /// スニペットをテキスト入力欄に挿入（キーボードのメイン処理）
    ///
    /// - Parameter snippet: 挿入するスニペット
    ///
    /// 【処理の流れ】
    /// 1. SnippetServiceに処理を委譲
    /// 2. Service内で以下の処理が実行されます：
    ///    - 本文のみを挿入対象にする（タイトルはタイトル挿入ボタンから個別に挿入）
    ///    - 変数（{{today}}など）を実際の値に置き換え
    ///    - textDocumentProxy（iOSのテキスト入力API）を使ってテキストを挿入
    ///    - 振動フィードバック（Haptic Feedback）を実行
    ///
    /// 【textDocumentProxyとは】
    /// iOSが提供するAPI。カスタムキーボードから、現在フォーカスされている
    /// テキストフィールドにテキストを挿入できます。
    /// 例: LINEのメッセージ入力欄、メモアプリなど、どのアプリでも動作します
    private func insertSnippet(_ snippet: Snippet) {
        os_log("📝 insertSnippet called for snippet: %@", log: keyboardLog, type: .info, snippet.id)
        KeyboardLog.debug("📝 [KeyboardViewController] insertSnippet called for snippet: %@", snippet.id)
        KeyboardLog.debug("📝 [KeyboardViewController] Current profile: %@", currentProfile?.name ?? "nil")

        // Serviceを使用してスニペットを挿入（変数置換＋振動フィードバック）
        // ビジネスロジックはServiceに集約することで、コードの見通しが良くなります
        snippetService.insertSnippet(
            snippet,
            into: textDocumentProxy,  // iOSのテキスト入力API
            profileId: currentProfile?.id  // 環境IDを渡して、環境専用の変数を使用
        )

        os_log("✅ insertSnippet completed", log: keyboardLog, type: .info)
        KeyboardLog.debug("✅ [KeyboardViewController] insertSnippet completed")
    }

    // MARK: - Sort Methods（ソート関連メソッド）

    /// ソートボタンのメニューを設定
    /// iOS 14以降のUIMenuを使用して、タップ時にメニューを表示
    /// 4種類の並び順はいずれもDBの読み取りだけで成立するため、常に全項目を表示する
    ///
    /// 【表示中の一覧に合わせて組み直す理由】
    /// 並べ替えの設定は定型文とショートカットで別に持つため、チェックマークの付く項目が一覧ごとに違う。
    /// 名前順の項目名も、定型文は「タイトル」、ショートカットは「名前」と指すものが違う。
    private func setupSortButtonMenu() {
        /* 注意: 並べ替え設定は呼び出し元で設定済みのため、ここでは再読み込みしない
           viewDidLoad時にloadSortPreference(forKey:)で初期化される */
        let isShortcutList = screenState == .shortcutList
        let selectedSortBy = isShortcutList ? currentShortcutSortBy : currentSnippetSortBy
        KeyboardLog.debug("🔄 [Sort] Building menu with sort preference: %@ (shortcut list: %@)",
                          selectedSortBy, isShortcutList ? "true" : "false")

        // メニュー項目を作成
        let createdAction = UIAction(
            title: L10n.Sort.created,
            image: selectedSortBy == "created" ? UIImage(systemName: "checkmark") : nil
        ) { [weak self] _ in
            self?.updateSortPreference("created")
        }

        let updatedAction = UIAction(
            title: L10n.Sort.updated,
            image: selectedSortBy == "updated" ? UIImage(systemName: "checkmark") : nil
        ) { [weak self] _ in
            self?.updateSortPreference("updated")
        }

        let titleAction = UIAction(
            title: isShortcutList ? L10n.Sort.name : L10n.Sort.title,
            image: selectedSortBy == "title" ? UIImage(systemName: "checkmark") : nil
        ) { [weak self] _ in
            self?.updateSortPreference("title")
        }

        /* 使用頻度順はDBの読み取りだけで成立するため、フルアクセスの有無に関わらず提供する
           （フルアクセスなしでもアプリ本体が記録した使用回数で並べ替えできる） */
        let usageAction = UIAction(
            title: L10n.Sort.usage,
            image: selectedSortBy == "usage" ? UIImage(systemName: "checkmark") : nil
        ) { [weak self] _ in
            self?.updateSortPreference("usage")
        }

        let menuChildren: [UIAction] = [createdAction, updatedAction, titleAction, usageAction]

        // メニューを作成してボタンに設定
        let menu = UIMenu(title: L10n.Sort.label, children: menuChildren)
        sortButton.menu = menu

        // バッジ表示を更新
        updateSortBadgeVisibility()
    }

    /// ソート設定を更新（表示中の一覧の設定だけを変える）
    private func updateSortPreference(_ sortBy: String) {
        if screenState == .shortcutList {
            KeyboardLog.debug("🔄 [Sort] Updating shortcut sort preference: %@ → %@", currentShortcutSortBy, sortBy)
            currentShortcutSortBy = sortBy
            saveSortPreference(sortBy, forKey: shortcutSortPreferenceKey)

            // メニューを更新（チェックマークを更新）
            setupSortButtonMenu()

            /* ショートカット一覧を読み直す（先頭へのスクロールも読み直しに含まれる）。
               値一覧を開いていた場合は一覧へ戻るが、並べ替えたのは一覧の並びなので、
               結果が見える場所へ戻した方が操作と結果が結びつく */
            reloadShortcutList()
            return
        }

        KeyboardLog.debug("🔄 [Sort] Updating snippet sort preference: %@ → %@", currentSnippetSortBy, sortBy)
        currentSnippetSortBy = sortBy
        saveSortPreference(sortBy, forKey: snippetSortPreferenceKey)

        // メニューを更新（チェックマークを更新）
        setupSortButtonMenu()

        // スニペット一覧を再読み込み
        reloadSnippets()

        // リストのトップにスクロール
        if !filteredSnippets.isEmpty {
            tableView.scrollToRow(at: IndexPath(row: 0, section: 0), at: .top, animated: true)
        }
    }

    /// ソート設定を保存（UserDefaults）
    private func saveSortPreference(_ sortBy: String, forKey key: String) {
        UserDefaults.standard.set(sortBy, forKey: key)
        KeyboardLog.debug("💾 [Sort] Saved sort preference: %@ (key: %@)", sortBy, key)
    }

    /// ソート設定を読み込み（UserDefaults）
    private func loadSortPreference(forKey key: String) -> String {
        let sortBy = UserDefaults.standard.string(forKey: key) ?? KeyboardViewController.defaultSortBy
        return sortBy
    }

    /// フルアクセス状態をApp Group UserDefaultsに保存
    /// UIInputViewControllerを継承しないSnippetServiceから参照できるようにする
    private func saveFullAccessState() {
        guard let userDefaults = UserDefaults(suiteName: appGroupIdentifier) else {
            KeyboardLog.debug("⚠️ [FullAccess] Failed to get App Group UserDefaults")
            return
        }
        userDefaults.set(self.hasFullAccess, forKey: fullAccessStateKey)
        KeyboardLog.debug("💾 [FullAccess] Saved full access state: %@", self.hasFullAccess ? "true" : "false")
    }

    /// バッジの表示/非表示を更新
    /// デフォルト（created）以外の時にバッジを表示
    ///
    /// 【表示中の一覧の設定で判定する理由】
    /// バッジはボタンを押すと出てくる選択肢の状態を示すもので、その選択肢は表示中の一覧の設定を指すため。
    private func updateSortBadgeVisibility() {
        let selectedSortBy = screenState == .shortcutList ? currentShortcutSortBy : currentSnippetSortBy
        sortBadgeView.isHidden = selectedSortBy == KeyboardViewController.defaultSortBy
    }

    // MARK: - Settings（設定関連）

    /// 設定ボタンがタップされた時のアクション
    @objc private func settingsButtonTapped() {
        KeyboardLog.debug("⚙️ [Settings] Settings button tapped")
        showSettingsView()
    }

    /// 設定画面を表示
    private func showSettingsView() {
        /* 閉じたときに元の一覧へ戻すため、直前の表示対象を控える。
           フィルター行をショートカット表示でも出すようにしたことで、
           設定はショートカット表示からも開けるようになった */
        screenStateBeforeSettings = screenState == .shortcutList ? .shortcutList : .list

        // タイトルを設定
        settingsTitleLabel.text = L10n.Settings.title

        // 見出しラベルを設定
        usageTrackingLabel.text = L10n.Settings.usageTracking

        /* 記録状態を表示（フルアクセスなしでは共有DBへ書き込めないため記録できない） */
        usageTrackingStatusLabel.text = self.hasFullAccess
            ? L10n.Settings.usageTrackingActive
            : L10n.Settings.usageTrackingInactive
        usageTrackingStatusLabel.textColor = self.hasFullAccess ? .systemGreen : .secondaryLabel

        // フルアクセスヒントの表示/非表示
        fullAccessHintLabel.text = L10n.Settings.usageTrackingRequiresFullAccess
        fullAccessHintLabel.isHidden = self.hasFullAccess

        // フルアクセス許可手順の表示/非表示
        fullAccessInstructionsLabel.text = L10n.Settings.fullAccessInstructions
        fullAccessInstructionsLabel.isHidden = self.hasFullAccess

        // 見出しの色を更新
        usageTrackingLabel.textColor = self.hasFullAccess ? .label : .secondaryLabel

        // 設定画面を表示
        screenState = .settings
        applyScreenState()
    }

    /// 設定画面を閉じる
    /// 開く前に見ていた一覧（定型文／ショートカット）へ戻す
    @objc private func closeSettingsView() {
        KeyboardLog.debug("⚙️ [Settings] Closing settings view")

        if screenStateBeforeSettings == .shortcutList {
            /* ショートカットは表示するたびに読み直す決まりのため、
               画面状態を戻すだけにせず必ず取得し直す（設定を見ている間の変更も反映される） */
            showShortcutView()
            return
        }

        screenState = .list
        applyScreenState()
    }

    // MARK: - Shortcut（ショートカット関連）

    /**
     * 定型文／ショートカットのトグルがタップされた時のアクション
     *
     * 【別画面への遷移にしない理由】
     * ショートカットは定型文と並ぶもう一方の一覧であり、行き来は1タップで済ませたい。
     * 同じ位置のトグルで一覧の中身だけを入れ替えることで、
     * 「閉じる」専用のボタンを置かずに往復できる。
     */
    @objc private func shortcutToggleTapped() {
        KeyboardLog.debug("⚡ [Shortcut] Toggle tapped (showing shortcuts: %@)",
                          screenState == .shortcutList ? "true" : "false")

        /* 【カテゴリ選択を「すべて」へ戻す理由】
           カテゴリは定型文とショートカットで共通だが、どちらに何件あるかは別々。
           切り替え先にそのカテゴリのデータが1件も無いと、一覧だけが空になり
           「作成していないのか、絞り込まれているのか」が読み取れない。
           メインアプリのホーム（useHomeScreen.handleToggleListMode）と同じ判断に揃える */
        selectCategory(nil)

        if screenState == .shortcutList {
            showSnippetList()
        } else {
            showShortcutView()
        }
    }

    /// ショートカット画面を表示する（必ず一覧モードから開く）
    private func showShortcutView() {
        reloadShortcutList()

        screenState = .shortcutList
        applyScreenState()

        /* 並べ替えの設定と項目名は一覧ごとに違うため、表示対象を変えたら組み直す。
           表示中の一覧はscreenStateから判断するので、切り替えた後に呼ぶ */
        setupSortButtonMenu()
    }

    /**
     * ショートカット一覧を読み直して表示する（表示モードも一覧へ戻す）
     *
     * 【毎回読み直す理由】
     * メインアプリでの追加・編集と、直前の挿入で増えた使用回数を開くたびに反映するため。
     * 使用頻度順を選んでいるときは、増えた使用回数がそのまま一覧の並びにも効く。
     */
    private func reloadShortcutList() {
        shortcutScreenMode = .list
        selectedShortcut = nil

        /* 選択中のプロファイルに紐づくショートカットと、全プロファイル向け（紐づけ0件）のショートカットだけを出す。
           カスタム変数を参照している値の中身も選択中のプロファイルで解決するため、プロファイルを決められないときは空にする。
           全件へ倒すと、別の環境向けの値をそれと分からないまま挿入できてしまうため
           （表示は空状態の案内になる）。
           カテゴリは「すべて」を選べる絞り込みなので、未選択（nil）はそのまま渡して全件を出す */
        if let profileId = currentProfile?.id {
            sortedShortcuts = shortcutService.sortedShortcuts(
                profileId: profileId,
                categoryId: currentCategory?.id,
                sortBy: currentShortcutSortBy
            )
        } else {
            KeyboardLog.debug("⚠️ [Shortcut] No profile selected - clearing shortcuts")
            sortedShortcuts = []
        }
        sortedShortcutValues = []
        KeyboardLog.debug("⚡ [Shortcut] Loaded %d shortcuts", sortedShortcuts.count)

        applyShortcutRowHeight()
        shortcutTableView.reloadData()
        /* 前に開いたときのスクロール位置が残ると、並べ替えた先頭が画面外になるため先頭へ戻す */
        shortcutTableView.setContentOffset(.zero, animated: false)
        updateShortcutEmptyState()
    }

    /**
     * 選択したショートカットの値一覧へ切り替える
     *
     * - Parameter shortcut: 値一覧を表示するショートカット
     */
    private func showShortcutValues(_ shortcut: Shortcut) {
        selectedShortcut = shortcut
        shortcutScreenMode = .values
        sortedShortcutValues = shortcutService.sortedValues(shortcut.values)
        KeyboardLog.debug("⚡ [Shortcut] Showing %d values for shortcut: %@", sortedShortcutValues.count, shortcut.name)

        /* 値一覧にも見出しの行と戻るボタンは置かない。ショートカット一覧へは、
           値を挿入するか、トグルで定型文へ切り替えてから戻すと開き直す */
        applyShortcutRowHeight()
        shortcutTableView.reloadData()
        shortcutTableView.setContentOffset(.zero, animated: false)
        updateShortcutEmptyState()
    }

    /**
     * ショートカットが選ばれたときの処理
     *
     * - Parameter shortcut: タップされたショートカット
     *
     * 【値の件数で動きを変えない理由】
     * 挿入までの道筋が件数によって変わると、同じ行を押しても
     * 値一覧が出る場合と即座に入力される場合があり、押す前に結果を予測できない。
     * 件数にかかわらず「一覧 → 値一覧 → 挿入」に揃える。
     */
    private func selectShortcut(_ shortcut: Shortcut) {
        /* 階層移動も行の中身が入れ替わる操作のため、挿入と同じ窓で二度押しを塞ぐ */
        guard acceptShortcutTap() else { return }

        /* 値を持たないショートカットはメインアプリで作れない（作成時に1件以上を必須にしている）。
           万一そうしたデータが入っていても、選ぶものが無い一覧を見せないよう何もしない */
        guard !shortcut.values.isEmpty else {
            KeyboardLog.debug("⚠️ [Shortcut] Shortcut has no values: %@", shortcut.id)
            return
        }

        showShortcutValues(shortcut)
    }

    /**
     * ショートカット値を入力欄へ挿入し、ショートカット一覧へ戻る
     *
     * - Parameter value: 挿入するショートカット値
     *
     * 【定型文一覧へ戻さない理由】
     * 表示対象の切り替えはフィルター行のトグルが担うため、挿入を理由に勝手に切り替えない。
     * 続けて別のショートカットを挿す場面が多く、そのたびに切り替え直させると手数が増える。
     *
     * 【値一覧から一覧へ戻す理由】
     * 1つ選び終えた後に同じ値一覧へ留まる必要はない。
     * 読み直すことで、増えた使用回数が値一覧の並び（使用回数の降順）と、
     * 使用頻度順を選んでいるときのショートカット一覧の並びへ反映される。
     */
    private func insertShortcutValue(_ value: ShortcutValue) {
        KeyboardLog.debug("⚡ [Shortcut] Inserting shortcut value: %@", value.id)

        /* 挿入・振動フィードバック・使用回数の記録はService側で実行する */
        shortcutService.insertValue(value, into: textDocumentProxy)

        reloadShortcutList()
    }

    /**
     * ショートカット行の操作を受け付けてよいか判定する
     *
     * 指が跳ねて同じ場所を二度押しすると、1回目で一覧の中身（階層や並び）が入れ替わり、
     * 2回目が差し替わった別の行に当たって、選んだ覚えのない値を挿入してしまう。
     * 行の中身が入れ替わる操作はすべて同じ窓で塞ぐ。
     *
     * 判定は行のタップ1回につき1度だけ行う。階層移動と挿入の両方に置くと、
     * 同じタップが2回数えられ、2度目が必ず落ちてしまう。
     *
     * 単調増加の時計を使うのは、端末の時刻設定が変わっても判定が壊れないようにするため。
     *
     * - Returns: 受け付ける場合はtrue（受け付けた時点で次回の判定用に時刻を記録する）
     */
    private func acceptShortcutTap() -> Bool {
        let now = ProcessInfo.processInfo.systemUptime
        if now - lastShortcutTapAt < Self.shortcutTapDebounce {
            KeyboardLog.debug("⚡ [Shortcut] Tap ignored (too soon)")
            return false
        }

        lastShortcutTapAt = now
        return true
    }

    /**
     * 表示中のショートカット画面を最新のデータで作り直す
     *
     * 【値一覧を開いたままにする条件】
     * 開いていたショートカットが最新のデータにも残っていて、値が1件以上あるときだけ値一覧へ戻す。
     * メインアプリ側で削除・整理された場合にそのまま値一覧を残すと、
     * もう存在しない値を挿入できてしまうため、その場合は一覧に留まる。
     */
    private func reloadShortcutScreen() {
        /* 一覧の読み直しでselectedShortcutが消えるため、先に控えておく */
        let reopeningShortcutId: String? = shortcutScreenMode == .values ? selectedShortcut?.id : nil

        reloadShortcutList()

        guard let shortcutId = reopeningShortcutId else { return }

        guard let shortcut = sortedShortcuts.first(where: { $0.id == shortcutId }),
              !shortcut.values.isEmpty else {
            KeyboardLog.debug("⚠️ [Shortcut] Reopened shortcut is gone or has no values: %@", shortcutId)
            return
        }

        showShortcutValues(shortcut)
    }

    /**
     * 一覧の表示対象を定型文へ戻す
     *
     * トグルでショートカット表示を解除したときに呼ぶ。
     * ショートカット側は読み直して開く決まりのため、ここでは表示を切り替えるだけでよい。
     */
    private func showSnippetList() {
        KeyboardLog.debug("⚡ [Shortcut] Switching the list back to snippets")
        shortcutScreenMode = .list
        selectedShortcut = nil

        /* 表示中だった値一覧の行をテーブルに残さない。
           次に開くときは必ずreloadShortcutList()が走るため表示には出ないが、
           モードと行数の食い違いを切り替えた時点で解消しておく */
        sortedShortcutValues = []
        applyShortcutRowHeight()
        shortcutTableView.reloadData()

        screenState = .list
        applyScreenState()

        /* showShortcutView()と同じ理由で、表示対象を戻したら並べ替えメニューも定型文のものへ戻す */
        setupSortButtonMenu()
    }

    /**
     * 表示モードに応じた固定の行高さを適用する
     *
     * 一覧は1行、値一覧は2行のため高さが異なる。
     * どちらも固定値で、自動高さ計算（セルフサイジング）は使わない。
     */
    private func applyShortcutRowHeight() {
        shortcutTableView.rowHeight = shortcutScreenMode == .values
            ? ShortcutValueCell.rowHeight
            : ShortcutCell.rowHeight
    }

    /**
     * ショートカット画面の空状態を更新する
     *
     * 選択中のプロファイルとカテゴリで1件も無いときに案内を表示する。
     * 絞り込みで0件になった場合も同じ案内を出すのは、定型文側（一覧の空状態）と同じ扱いに揃えるため。
     * 値一覧は値を持たないショートカットでは開かないため、空になることはない。
     */
    private func updateShortcutEmptyState() {
        let isEmpty = shortcutScreenMode == .values
            ? sortedShortcutValues.isEmpty
            : sortedShortcuts.isEmpty

        shortcutTableView.isHidden = isEmpty
        shortcutEmptyLabel.isHidden = !isEmpty
    }

}

extension KeyboardViewController: UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        /* 2つのテーブルビューを1つのデータソースで扱うため、必ずテーブルビューの同一性で分岐する
           （引数のtableViewはプロパティのtableViewを隠すので、比較対象はshortcutTableViewに固定する） */
        if tableView === shortcutTableView {
            return shortcutScreenMode == .values ? sortedShortcutValues.count : sortedShortcuts.count
        }

        return filteredSnippets.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        if tableView === shortcutTableView {
            return shortcutCell(for: tableView, at: indexPath)
        }

        guard let cell = tableView.dequeueReusableCell(
            withIdentifier: SnippetCell.reuseIdentifier,
            for: indexPath
        ) as? SnippetCell else {
            return UITableViewCell()
        }

        let snippet = filteredSnippets[indexPath.row]

        // タイトルを変数置換する
        let rawTitle = snippet.title ?? L10n.Snippet.noTitle
        let replacedTitle = variableReplacer.replace(
            in: rawTitle,
            variablesMap: variablesMap,
            formats: systemVariableFormats
        )

        cell.configure(title: replacedTitle)

        return cell
    }

    /**
     * ショートカット画面の行セルを作る
     *
     * - Parameters:
     *   - tableView: ショートカット画面のテーブルビュー
     *   - indexPath: 対象の行
     * - Returns: モードに応じたセル
     *
     * 【変数置換をしない理由】
     * ショートカットの値は保存された文字列をそのまま挿入するため、
     * 表示も置換せず保存されたままを見せる（定型文の一覧とは扱いが異なる）。
     */
    private func shortcutCell(for tableView: UITableView, at indexPath: IndexPath) -> UITableViewCell {
        if shortcutScreenMode == .values {
            guard let cell = tableView.dequeueReusableCell(
                withIdentifier: ShortcutValueCell.reuseIdentifier,
                for: indexPath
            ) as? ShortcutValueCell else {
                return UITableViewCell()
            }

            let value = sortedShortcutValues[indexPath.row]
            cell.configure(name: value.name, value: value.value)

            return cell
        }

        guard let cell = tableView.dequeueReusableCell(
            withIdentifier: ShortcutCell.reuseIdentifier,
            for: indexPath
        ) as? ShortcutCell else {
            return UITableViewCell()
        }

        let shortcut = sortedShortcuts[indexPath.row]
        cell.configure(name: shortcut.name)

        return cell
    }
}

extension KeyboardViewController: UITableViewDelegate {
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        /* データソースと同じく、必ずテーブルビューの同一性で分岐する */
        if tableView === shortcutTableView {
            tableView.deselectRow(at: indexPath, animated: true)

            if shortcutScreenMode == .values {
                /* 値をタップ: その値だけを現在のカーソル位置へ挿入し、ショートカット一覧へ戻る。
                   階層が入れ替わるため、ここでも二度押しを塞ぐ */
                guard acceptShortcutTap() else { return }
                insertShortcutValue(sortedShortcutValues[indexPath.row])
            } else {
                /* ショートカットをタップ: 値一覧へ進む */
                selectShortcut(sortedShortcuts[indexPath.row])
            }
            return
        }

        os_log("👆 Snippet tapped at index: %d", log: keyboardLog, type: .info, indexPath.row)
        KeyboardLog.debug("👆 [KeyboardViewController] Snippet tapped at index: %d", indexPath.row)

        tableView.deselectRow(at: indexPath, animated: true)
        let snippet = filteredSnippets[indexPath.row]

        KeyboardLog.debug("[KeyboardViewController] Showing snippet detail")

        showSnippetDetail(snippet)
    }

    // MARK: - Loading State（ローディング状態管理）

    /// ローディング画面を表示
    /// データ読み込み開始時に呼び出されます
    private func showLoading() {
        screenState = .loading
        applyScreenState()
        activityIndicator.startAnimating()
    }

    /// ローディング画面を非表示
    /// データ読み込み完了時に呼び出されます
    private func hideLoading() {
        if screenState == .loading {
            screenState = .list
            applyScreenState()
        }
        activityIndicator.stopAnimating()
    }

}

// MARK: - ExpandedHitAreaButton

/**
 * 見た目より広い当たり判定を持つ丸ボタン
 *
 * 【なぜ必要か】
 * タイトル行に置く挿入ボタンは、タイトル文字と釣り合う32ptの見た目にしたい。
 * 一方でタップ領域は最低44x44ptを確保する必要があるため、
 * 描画サイズはそのままに、当たり判定だけを44x44ptへ広げる。
 *
 * 【ファイル配置について】
 * 新しいSwiftファイルを追加するとproject.pbxprojの更新が必要になるため、
 * KeyboardViewControllerと同じファイルに定義している。
 */
final class ExpandedHitAreaButton: UIButton {

    /// 確保する最小タップ領域（pt）
    private static let minimumHitSize: CGFloat = 44

    /// タップ判定の範囲を最小タップ領域まで広げる
    /// - Parameters:
    ///   - point: 自身の座標系でのタッチ位置
    ///   - event: 対象のイベント
    /// - Returns: タップ領域に含まれる場合はtrue
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        /* 32ptなら上下左右に6ptずつ広げて44ptにする。既に44pt以上なら広げない */
        let horizontalInset = min(0, (bounds.width - Self.minimumHitSize) / 2)
        let verticalInset = min(0, (bounds.height - Self.minimumHitSize) / 2)
        return bounds.insetBy(dx: horizontalInset, dy: verticalInset).contains(point)
    }
}

// MARK: - SnippetCell

/**
 * スニペット一覧の行セル
 *
 * 【なぜ専用セルにするか】
 * defaultContentConfigurationは内部ビューの大きさを文字量に合わせて決めるため、
 * 行のどこを触ってもタッチが拾える保証がない。
 * ラベルをcontentViewいっぱいに広げ、行全体を確実にタップ・ドラッグ対象にする。
 *
 * 【セルの背景を透明のままにしてよい理由】
 * 行の余白（左端・「＞」の周り）でタッチを受けられるのは、テーブル側に目に見えない塗り
 * （UIColor.keyboardTouchableClear）を置いているため。セルごとに塗る必要はない。
 *
 * 【ファイル配置について】
 * 新しいSwiftファイルを追加するとproject.pbxprojの更新が必要になるため、
 * KeyboardViewControllerと同じファイルに定義している。
 */
final class SnippetCell: UITableViewCell {

    /// 再利用識別子
    static let reuseIdentifier = "SnippetCell"

    /// 行の高さ（pt）。自動高さ計算を使わず固定値で確定させる
    static let rowHeight: CGFloat = 44

    /// スニペットのタイトルを表示するラベル
    private let titleLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 15)
        label.textColor = .label
        label.lineBreakMode = .byTruncatingTail
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupCell()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupCell()
    }

    /**
     * セルの見た目とレイアウトを設定する
     *
     * ラベルはcontentViewの上下左右いっぱいに広げる。
     * contentViewのタッチを無効にしているのは、行内のビューがタッチを横取りしないようにするため。
     * 選択とスクロールはテーブルビュー側が処理するので、無効にしても行のタップは動作する。
     */
    private func setupCell() {
        backgroundColor = .clear
        accessoryType = .disclosureIndicator
        contentView.isUserInteractionEnabled = false

        contentView.addSubview(titleLabel)
        NSLayoutConstraint.activate([
            titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -8),
            titleLabel.topAnchor.constraint(equalTo: contentView.topAnchor),
            titleLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor)
        ])

        let selectedBackground = UIView()
        selectedBackground.backgroundColor = .secondarySystemFill
        selectedBackgroundView = selectedBackground
    }

    /**
     * 表示するタイトルを設定する
     *
     * - Parameter title: 変数置換済みのタイトル
     */
    func configure(title: String) {
        titleLabel.text = title
    }
}

// MARK: - ShortcutCell

/**
 * ショートカット一覧の行セル
 *
 * 【なぜ専用セルにするか】
 * SnippetCellと同じ理由。defaultContentConfigurationは内部ビューの大きさを文字量に合わせて決めるため、
 * 行のどこを触ってもタッチが拾える保証がない。
 * ラベルをcontentViewいっぱいに広げ、行全体を確実にタップ対象にする。
 * 行の余白でタッチを受けるのはテーブルの目に見えない塗り（UIColor.keyboardTouchableClear）で、
 * セルの背景は透明のままでよい（値一覧の ShortcutValueCell も同じ）。
 *
 * 【ファイル配置について】
 * 新しいSwiftファイルを追加するとproject.pbxprojの更新が必要になるため、
 * KeyboardViewControllerと同じファイルに定義している。
 */
final class ShortcutCell: UITableViewCell {

    /// 再利用識別子
    static let reuseIdentifier = "ShortcutCell"

    /// 行の高さ（pt）。自動高さ計算を使わず固定値で確定させる
    static let rowHeight: CGFloat = 44

    /// ショートカット名を表示するラベル
    private let nameLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 15)
        label.textColor = .label
        label.lineBreakMode = .byTruncatingTail
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupCell()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupCell()
    }

    /**
     * セルの見た目とレイアウトを設定する
     *
     * SnippetCellと同じく、contentViewのタッチを無効にして行内のビューが
     * タッチを横取りしないようにする。選択とスクロールはテーブルビュー側が処理する。
     */
    private func setupCell() {
        backgroundColor = .clear
        contentView.isUserInteractionEnabled = false

        contentView.addSubview(nameLabel)
        NSLayoutConstraint.activate([
            nameLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            nameLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -8),
            nameLabel.topAnchor.constraint(equalTo: contentView.topAnchor),
            nameLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor)
        ])

        let selectedBackground = UIView()
        selectedBackground.backgroundColor = .secondarySystemFill
        selectedBackgroundView = selectedBackground
    }

    /**
     * 表示するショートカット名を設定する
     *
     * - Parameter name: ショートカット名
     *
     * 【常に「＞」を出す理由】
     * 値の件数にかかわらず必ず値一覧へ進むため、どの行も次の階層を持つ。
     */
    func configure(name: String) {
        nameLabel.text = name
        accessoryType = .disclosureIndicator
    }
}

// MARK: - ShortcutValueCell

/**
 * ショートカット値一覧の行セル（値名と値の2行表示）
 *
 * 【2行にする理由】
 * 値名（例: 母）だけでは何を挿入するか分からず、値（例: 090-0000-0000）だけでは
 * どれを選べばよいか分からないため、両方を見せて選べるようにする。
 *
 * 【ファイル配置について】
 * 新しいSwiftファイルを追加するとproject.pbxprojの更新が必要になるため、
 * KeyboardViewControllerと同じファイルに定義している。
 */
final class ShortcutValueCell: UITableViewCell {

    /// 再利用識別子
    static let reuseIdentifier = "ShortcutValueCell"

    /// 行の高さ（pt）。自動高さ計算を使わず固定値で確定させる（2行分）
    static let rowHeight: CGFloat = 56

    /// 値名を表示するラベル
    private let nameLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 15)
        label.textColor = .label
        label.lineBreakMode = .byTruncatingTail
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    /// 挿入される値を表示するラベル
    private let valueLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 12)
        label.textColor = .secondaryLabel
        label.lineBreakMode = .byTruncatingTail
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupCell()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupCell()
    }

    /**
     * セルの見た目とレイアウトを設定する
     *
     * ShortcutCellと同じく、contentViewのタッチを無効にして行全体をタップ対象にする。
     */
    private func setupCell() {
        backgroundColor = .clear
        /* タップすると値を挿入して終わるため、次の階層は無い */
        accessoryType = .none
        contentView.isUserInteractionEnabled = false

        contentView.addSubview(nameLabel)
        contentView.addSubview(valueLabel)
        NSLayoutConstraint.activate([
            nameLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            nameLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            nameLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),

            valueLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            valueLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            valueLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 2),
            /* 行の高さは固定なので、下端は「はみ出さない」ことだけを保証する */
            valueLabel.bottomAnchor.constraint(lessThanOrEqualTo: contentView.bottomAnchor, constant: -8)
        ])

        let selectedBackground = UIView()
        selectedBackground.backgroundColor = .secondarySystemFill
        selectedBackgroundView = selectedBackground
    }

    /**
     * 表示する値名と値を設定する
     *
     * - Parameters:
     *   - name: 値名（例: 母）
     *   - value: 挿入される値（例: 090-0000-0000）
     */
    func configure(name: String, value: String) {
        nameLabel.text = name
        /* 改行を含む値は1行表示だと途中で切れて何の値か分からなくなるため、
           空白へ置き換えて1行に収める。挿入するのは元の文字列のままで、表示だけを整える */
        valueLabel.text = value.components(separatedBy: .newlines).joined(separator: " ")
    }
}

// MARK: - UIColor Extension（タッチを受けるための目に見えない塗り）

extension UIColor {
    /**
     * 目に見えないが、完全な透明ではない塗り（白・不透明度1%）
     *
     * 【なぜ必要か】
     * 拡張キーボードは別プロセスで表示され、背景が完全に透明で何も描かれていない場所から始めたタッチは
     * キーボードへ届かない。通常のアプリのhitTestは背景色を見ないため、UIKit内の判定では説明できないOS側の挙動である。
     * 一覧の背景を .clear にすると、文字や「＞」の上でしかタップもスクロールも始められなくなる。
     * スクロールする一覧にだけこの塗りを置き、行の全域と最終行より下でタッチを受けられるようにする。
     *
     * 【値を1%にする理由】
     * 1%の白はOS標準キーボードの背景素材の上で見分けられず、「ビューは独自背景を持たない」仕様
     * （機能仕様書 §9.3）の意図であるOSの背景の見え方を変えない。
     * 0に近づけすぎると8bit換算で完全な透明になり、タッチが届かなくなる。
     *
     * 参考: https://developer.apple.com/forums/thread/702798 （透明な点へのタッチが無視される報告）、
     * キーボード向けSDK KeyboardKit の UIColor+TappableClear（同じ回避策）
     */
    static let keyboardTouchableClear = UIColor(white: 1, alpha: 0.01)
}

// MARK: - UIColor Extension

/// UIColorの拡張：16進数カラーコード（Hex）からUIColorを生成
///
/// 【用途】
/// カテゴリの色をデータベースに"#FF5733"のような文字列で保存しており、
/// それをUIColorに変換してボタンの色として表示するために使います
///
/// 【使用例】
/// let color = UIColor(hex: "#FF5733")  // オレンジ色
/// let color = UIColor(hex: "007AFF")   // 青色（#なしでもOK）
extension UIColor {
    /// 16進数カラーコードからUIColorを生成する便利イニシャライザ
    ///
    /// - Parameter hex: 16進数カラーコード（例: "#FF5733" または "FF5733"）
    ///
    /// 【対応フォーマット】
    /// - 6桁: "#RRGGBB" → RGB（例: "#FF5733"）
    /// - 8桁: "#RRGGBBAA" → RGBA（例: "#FF573380"、最後の2桁は透明度）
    ///
    /// 【処理の流れ】
    /// 1. 前後の空白を削除し、"#"を除去
    /// 2. 16進数文字列を数値に変換
    /// 3. ビット演算で各色成分（R, G, B, A）を抽出
    /// 4. 0〜255の範囲を0.0〜1.0に正規化してUIColorを生成
    convenience init?(hex: String) {
        // 前後の空白を削除し、#を除去
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        // 16進数文字列を数値（UInt64）に変換
        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }

        let length = hexSanitized.count
        let r, g, b, a: CGFloat

        if length == 6 {
            // 6桁の場合: RRGGBB
            // ビット演算で各色成分を抽出
            // 例: 0xFF5733 → R=0xFF, G=0x57, B=0x33
            r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0  // 赤: 上位8ビット
            g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0   // 緑: 中位8ビット
            b = CGFloat(rgb & 0x0000FF) / 255.0          // 青: 下位8ビット
            a = 1.0  // 不透明
        } else if length == 8 {
            // 8桁の場合: RRGGBBAA（透明度付き）
            r = CGFloat((rgb & 0xFF000000) >> 24) / 255.0  // 赤
            g = CGFloat((rgb & 0x00FF0000) >> 16) / 255.0  // 緑
            b = CGFloat((rgb & 0x0000FF00) >> 8) / 255.0   // 青
            a = CGFloat(rgb & 0x000000FF) / 255.0          // 透明度（Alpha）
        } else {
            // 6桁または8桁以外は対応していない
            return nil
        }

        // RGBAの各成分からUIColorを生成
        self.init(red: r, green: g, blue: b, alpha: a)
    }
}

/**
 * 定型文／ショートカットの表示切替トグル
 *
 * 【見た目】
 * 枠線だけの角丸のトラックの中を、同じ色の縁を付けた白いノブが左右に動く切替スイッチの形。
 * 左（書類のアイコン）が定型文、右（稲妻のアイコン）がショートカット。
 * アイコンだけの切替と違い、今どちらを見ているかと、押すと反対側へ移ることが同時に分かる。
 *
 * 【アプリと同じ見た目にする理由】
 * 同じ「一覧の表示対象を切り替える」操作をアプリのホームとキーボードの両方で行うため、
 * どちらでも同じものだと分かるようにしている。配色と寸法はアプリの
 * ListModeToggle（apps/mobile/src/components/common/ListModeToggle.tsx）と同値で、
 * 変えるときはアプリ・iOS・Androidの3実装を同じ変更で揃えること。
 * トラックとアイコンの色は表示対象で変えず、ノブの位置とアイコンの形だけで見分ける。
 *
 * 【タップ領域】
 * トラックは32ptでHIGの44ptに届かないため、判定だけを44ptまで広げる。
 * iOSは親ビューの外側へのタッチを子へ届けないため、置く行（親ビュー）の高さも44pt以上にすること。
 *
 * 【押している間の見た目】
 * 指が触れている間は全体を薄くし、押せたことをすぐに示す。ノブが動くのは指を離して切り替えが終わってからで、
 * それまで何も変わらないと押せたか分からず、二度押しで元へ戻ってしまう。
 * 薄さはアプリのトグル（TouchableOpacityの既定値0.2）と揃える。
 *
 * 【ファイル配置について】
 * 新しいSwiftファイルを追加するとproject.pbxprojの更新が必要になるため、
 * KeyboardViewControllerと同じファイルに定義している。
 */
final class ListModeToggle: UIControl {

    /// トラックの幅（pt）
    static let trackWidth: CGFloat = 52

    /// トラックの高さ（pt）
    static let trackHeight: CGFloat = 32

    /// トラックの内側に取るノブの余白（pt）
    private static let knobInset: CGFloat = 2

    /// ノブの直径（pt）
    private static let knobSize: CGFloat = trackHeight - knobInset * 2

    /// ノブの中に置くアイコンの一辺（pt）
    private static let iconSize: CGFloat = 16

    /// トラックの枠線とノブの縁の太さ（pt）。アプリの `UI_CONSTANTS.BORDER_WIDTH.THIN` と同値
    private static let outlineWidth: CGFloat = 1

    /// トラックの枠線とノブの縁の色。アプリのテーマの `textTertiary`（ライト #9CA3AF / ダーク #707070）と同値。
    /// `border`（ライト #E5E7EB）はキーボードの背景（ライト #E2E4E8）とほぼ同じ色で、トラックが見えなくなる
    private static let outlineColor = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0x70 / 255, green: 0x70 / 255, blue: 0x70 / 255, alpha: 1)
            : UIColor(red: 0x9C / 255, green: 0xA3 / 255, blue: 0xAF / 255, alpha: 1)
    }

    /// ノブの中のアイコンの色。アプリのテーマの `textSecondary`（ライト #6B7280 / ダーク #A0A0A0）と同値
    private static let iconColor = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0xA0 / 255, green: 0xA0 / 255, blue: 0xA0 / 255, alpha: 1)
            : UIColor(red: 0x6B / 255, green: 0x72 / 255, blue: 0x80 / 255, alpha: 1)
    }

    /// 確保する最小タップ領域（pt）
    private static let minimumHitSize: CGFloat = 44

    /// 切り替えにかける時間（秒）
    private static let animationDuration: TimeInterval = 0.1

    /// 押している間の不透明度。アプリのトグル（TouchableOpacityの既定値）と同値
    private static let pressedAlpha: CGFloat = 0.2

    /// ショートカットを表示しているか（trueならノブが右）
    private(set) var isShowingShortcuts = false

    private let knobView = UIView()
    private let iconView = UIImageView()

    override init(frame: CGRect) {
        super.init(frame: frame)

        /* トラックは塗りを持たず、ノブが動く範囲を示す枠線だけを引く */
        backgroundColor = .clear
        layer.cornerRadius = Self.trackHeight / 2
        layer.borderWidth = Self.outlineWidth
        clipsToBounds = true

        /* ノブは白。白い背景でも形が分かるよう、トラックと同じ色の縁を付ける */
        knobView.backgroundColor = .white
        knobView.layer.cornerRadius = Self.knobSize / 2
        knobView.layer.borderWidth = Self.outlineWidth
        knobView.isUserInteractionEnabled = false
        addSubview(knobView)
        applyOutlineColor()

        iconView.contentMode = .scaleAspectFit
        iconView.tintColor = Self.iconColor
        iconView.isUserInteractionEnabled = false
        knobView.addSubview(iconView)

        isAccessibilityElement = true
        accessibilityTraits = .button

        /* layer.borderColorはCGColorのため、ライト・ダークが切り替わっても自動では塗り直されない */
        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (toggle: ListModeToggle, _: UITraitCollection) in
            toggle.applyOutlineColor()
        }

        applyAppearance()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var intrinsicContentSize: CGSize {
        CGSize(width: Self.trackWidth, height: Self.trackHeight)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        layoutKnob()
    }

    /// 押している間は全体を薄くする（離す・指が外へ出ると元に戻る）
    override var isHighlighted: Bool {
        didSet {
            alpha = isHighlighted ? Self.pressedAlpha : 1
        }
    }

    /// タップ判定の範囲を最小タップ領域まで広げる
    /// - Parameters:
    ///   - point: 自身の座標系でのタッチ位置
    ///   - event: 対象のイベント
    /// - Returns: タップ領域に含まれる場合はtrue
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        let horizontalInset = min(0, (bounds.width - Self.minimumHitSize) / 2)
        let verticalInset = min(0, (bounds.height - Self.minimumHitSize) / 2)
        return bounds.insetBy(dx: horizontalInset, dy: verticalInset).contains(point)
    }

    /**
     * 表示対象を設定する
     *
     * - Parameters:
     *   - showingShortcuts: ショートカットを表示しているか
     *   - animated: ノブの移動をアニメーションさせるか
     *
     * 値が変わらないときは何もしない。画面状態の適用のたびに呼ばれるため、
     * 毎回アニメーションを起こすと切り替えていないのに動いて見える。
     */
    func setShowingShortcuts(_ showingShortcuts: Bool, animated: Bool) {
        guard showingShortcuts != isShowingShortcuts else { return }
        isShowingShortcuts = showingShortcuts

        guard animated else {
            applyAppearance()
            layoutKnob()
            return
        }

        UIView.animate(withDuration: Self.animationDuration) {
            self.applyAppearance()
            self.layoutKnob()
        }
    }

    /// ノブの中のアイコンを現在の状態に合わせる（色は状態によらず同じ）
    private func applyAppearance() {
        let config = UIImage.SymbolConfiguration(pointSize: 12, weight: .semibold)
        let symbolName = isShowingShortcuts ? "bolt.fill" : "doc.text"
        iconView.image = UIImage(systemName: symbolName, withConfiguration: config)
    }

    /// トラックの枠線とノブの縁の色を現在のライト・ダークに合わせる
    private func applyOutlineColor() {
        let outlineColor = Self.outlineColor.resolvedColor(with: traitCollection).cgColor
        layer.borderColor = outlineColor
        knobView.layer.borderColor = outlineColor
    }

    /// ノブとアイコンの位置を現在の状態に合わせる
    private func layoutKnob() {
        let knobX = isShowingShortcuts
            ? bounds.width - Self.knobSize - Self.knobInset
            : Self.knobInset
        knobView.frame = CGRect(
            x: knobX,
            y: Self.knobInset,
            width: Self.knobSize,
            height: Self.knobSize
        )
        let iconOrigin = (Self.knobSize - Self.iconSize) / 2
        iconView.frame = CGRect(
            x: iconOrigin,
            y: iconOrigin,
            width: Self.iconSize,
            height: Self.iconSize
        )
    }
}
