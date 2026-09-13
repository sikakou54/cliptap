package com.sikakou.cliptap.keyboard

import android.graphics.drawable.ColorDrawable
import android.inputmethodservice.InputMethodService
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import android.util.Log
import android.view.LayoutInflater
import android.view.ContextThemeWrapper
import androidx.core.content.ContextCompat
import com.sikakou.cliptap.R
import com.sikakou.cliptap.models.Profile
import com.sikakou.cliptap.models.Category
import com.sikakou.cliptap.models.Shortcut
import com.sikakou.cliptap.models.ShortcutValue
import com.sikakou.cliptap.models.Snippet
import com.sikakou.cliptap.services.ProfileService
import com.sikakou.cliptap.services.CategoryService
import com.sikakou.cliptap.services.ShortcutService
import com.sikakou.cliptap.services.SnippetService
import com.sikakou.cliptap.services.VariableService
import com.sikakou.cliptap.database.Database
import com.sikakou.cliptap.mappers.SystemVariableFormatMapper
import com.sikakou.cliptap.utils.LocalizationHelper

/**
 * ClipTap カスタムキーボードサービス
 *
 * 【目的】
 * AndroidのInputMethodServiceを継承したカスタムキーボード実装。
 * メインアプリと同じデータベースにアクセスし、スニペットをテキストフィールドに挿入します。
 *
 * 【役割】
 * - キーボードUIの作成と管理
 * - 環境（プロファイル）とカテゴリの選択
 * - スニペット一覧の表示とフィルタリング
 * - スニペット詳細表示
 * - スニペットのテキスト挿入（変数置換込み）
 * - 定型文一覧とショートカット一覧の切り替え（フィルター行のトグル）
 * - ショートカット値の挿入（選択中の環境に紐づくショートカットと、全環境向けのショートカットのみを表示）
 *
 * 【重要な仕組み: データの流れ】
 * 1. メインアプリがSharedDBにスニペット・プロファイル・変数を保存
 * 2. キーボード起動時にSharedDBを読み取り専用で開く
 * 3. ユーザーが選択したスニペットをテキストフィールドに挿入
 * 4. 変数（{{name}}など）を実際の値に置換してから挿入
 *
 * 【なぜInputMethodService？】
 * AndroidのカスタムキーボードはInputMethodServiceを継承する必要があります。
 * このサービスがシステムのIME（Input Method Editor）として動作します。
 *
 * 【対応するiOSファイル】
 * ios/ClipTapKeyboard/KeyboardViewController.swift と同等
 */
class ClipTapKeyboardService : InputMethodService() {

    private lateinit var keyboardView: View
    private lateinit var mainView: View
    private lateinit var profileChipGroup: ChipGroup
    private lateinit var categoryChipGroup: ChipGroup
    private lateinit var snippetListContainer: View
    private lateinit var snippetRecyclerView: RecyclerView
    private lateinit var emptyStateTextView: android.widget.TextView
    private lateinit var snippetAdapter: SnippetAdapter
    private lateinit var themedContext: ContextThemeWrapper

    // 詳細画面のビュー
    private lateinit var detailView: View
    private lateinit var detailScrollView: android.widget.ScrollView
    private lateinit var titleRow: View
    private lateinit var detailTitleLabel: android.widget.TextView
    private lateinit var insertTitleButton: View
    private lateinit var titleSeparator: View
    private lateinit var detailContentLabel: android.widget.TextView
    private lateinit var copyButton: View
    private lateinit var insertNewlineButton: View
    private lateinit var closeButton: View

    // ショートカット画面のビュー
    private lateinit var shortcutView: View
    private lateinit var shortcutRecyclerView: RecyclerView
    private lateinit var shortcutEmptyView: View
    private lateinit var shortcutAdapter: ShortcutAdapter
    private lateinit var shortcutValueAdapter: ShortcutValueAdapter

    // 選択中のスニペット
    private var selectedSnippet: Snippet? = null

    // Services
    private lateinit var profileService: ProfileService
    private lateinit var categoryService: CategoryService
    private lateinit var snippetService: SnippetService
    private lateinit var shortcutService: ShortcutService
    private lateinit var variableService: VariableService
    private lateinit var database: Database

    // State
    private var currentProfile: Profile? = null
    private var currentCategory: Category? = null
    private var profiles: List<Profile> = emptyList()
    private var categories: List<Category> = emptyList()
    private var allSnippets: List<Snippet> = emptyList()
    private var variablesMap: Map<String, String> = emptyMap()

    // ソートボタンとソート状態
    private lateinit var sortButton: android.widget.ImageButton
    private lateinit var sortBadge: android.view.View

    /** 定型文一覧の並べ替えの基準 */
    private var currentSortBy: String = DEFAULT_SORT_BY

    /**
     * ショートカット一覧の並べ替えの基準
     *
     * 【定型文と別に持つ理由】
     * 「使用頻度」が指すものが、定型文はコピー回数、ショートカットは値の挿入回数の合計で別物。
     * 1つの設定を共有すると、トグルで表示を入れ替えるたびに、
     * もう一方の一覧の都合で選んだ基準に引きずられてしまう。
     */
    private var currentShortcutSortBy: String = DEFAULT_SORT_BY

    // 定型文／ショートカットの表示切替トグル
    // 定型文／ショートカットの表示切替トグル（トラック・ノブ・ノブの中のアイコン）
    private lateinit var shortcutToggle: android.widget.FrameLayout
    private lateinit var shortcutToggleKnob: android.widget.FrameLayout
    private lateinit var shortcutToggleIcon: android.widget.ImageView

    /** 一覧にショートカットを表示しているかどうか（falseなら定型文を表示している） */
    private var isShortcutMode: Boolean = false

    /** 直前にショートカット行の操作を受け付けた時刻（端末起動からの経過ミリ秒） */
    private var lastShortcutTapAt: Long = 0L

    companion object {
        private const val TAG = "ClipTapKeyboard"
        private const val SORT_PREFS_NAME = "ClipTapKeyboardPrefs"
        private const val SORT_PREFERENCE_KEY = "keyboard_snippet_sort_by"

        /** ショートカット一覧の並べ替えの基準を保存するキー（定型文とは別物のため分けている） */
        private const val SHORTCUT_SORT_PREFERENCE_KEY = "keyboard_shortcut_sort_by"

        /** 並べ替えの既定値（定型文・ショートカットとも作成日時の新しい順） */
        private const val DEFAULT_SORT_BY = "created"

        /** 定型文一覧とショートカット一覧を入れ替えるフェードの長さ（ミリ秒） */
        private const val LIST_SWITCH_DURATION_MS = 200L

        /**
         * ショートカット値を挿入してから、次の挿入を受け付けるまでの間隔（ミリ秒）
         *
         * 【この仕組みが必要な理由】
         * 以前は挿入のたびにショートカット画面を閉じ、その200msのフェードアウトの間に
         * 行へ触れても効かないようフラグ（isClosingShortcutView）で止めていた。
         * トグル化で挿入後もショートカット表示のまま留まるようになり、閉じるフェードが無くなったため、
         * 同じ役目を時間で果たす。これが無いと指が跳ねた二度押しで同じ値が2回入力され、
         * 使用回数も2回加算されてしまう。
         *
         * 【この長さにする理由】
         * 二度押しとして扱われる間隔（およそ300ms）を落とし、
         * 同じ値を続けて入れたい操作は妨げない長さにしている。
         */
        private const val SHORTCUT_TAP_DEBOUNCE_MS = 300L

        /** トグルのノブが左端から右端まで動く距離（dp） */
        private const val TOGGLE_KNOB_TRAVEL_DP = 20f

        /** トグルのノブが動く時間（ミリ秒） */
        private const val TOGGLE_KNOB_ANIMATION_MS = 100L
    }

    /**
     * IMEウィンドウのテーマを差し替える
     * InputMethodService.setThemeはウィンドウ生成前にしか呼べないため、super.onCreate()より前に呼ぶ
     */
    override fun onCreate() {
        setTheme(R.style.ClipTapKeyboardWindowTheme)
        super.onCreate()
    }

    /**
     * キーボードビューを作成
     *
     * 【目的】
     * Androidシステムがキーボードを表示する時に呼ばれるメソッド。
     * キーボードのレイアウトと初期データを設定します。
     *
     * 【何をするか】
     * 1. サービス層を初期化（ProfileService, CategoryService等）
     * 2. サブスクリプション状態を更新（Free/Pro制限を適用）
     * 3. XMLレイアウトをインフレート（keyboard_view.xml）
     * 4. キーボードの高さを360dpに固定
     * 5. ビューの初期化（ChipGroup, RecyclerView等）
     * 6. SharedDBを開く
     * 7. 初期データを読み込み（プロファイル、カテゴリ、スニペット）
     *
     * 【理由】
     * このメソッドはAndroidのライフサイクルで必須です。
     * ここでUIを構築しないとキーボードが表示されません。
     *
     * 【呼び出しタイミング】
     * - ユーザーがテキストフィールドをタップした時
     * - 他のキーボードからClipTapキーボードに切り替えた時
     */
    override fun onCreateInputView(): View {
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "============================================================")
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "🎯🎯🎯 onCreateInputView CALLED 🎯🎯🎯")
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "============================================================")

        // Servicesの初期化
        profileService = ProfileService.getInstance(applicationContext)
        categoryService = CategoryService.getInstance(applicationContext)
        snippetService = SnippetService.getInstance(applicationContext)
        shortcutService = ShortcutService.getInstance(applicationContext)
        variableService = VariableService.getInstance(applicationContext)
        database = Database.getInstance(applicationContext)

        // キャッシュをクリアして最新状態を取得

        // MaterialComponentsテーマでContextThemeWrapperを作成（Chip用）
        themedContext = ContextThemeWrapper(this, R.style.KeyboardTheme)

        // レイアウトをインフレート（テーマ適用済みのコンテキストを使用）
        keyboardView = LayoutInflater.from(themedContext).inflate(
            R.layout.keyboard_view,
            null
        )

        // LayoutParamsを明示的に設定（高さを360dpに固定）
        val density = resources.displayMetrics.density
        val heightInPx = (360 * density).toInt()
        keyboardView.layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            heightInPx
        )

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Keyboard view inflated: ${keyboardView.javaClass.simpleName}")
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Layout params: ${keyboardView.layoutParams}")

        /* 表示モードをレイアウトの初期状態へ戻す。
           Serviceのインスタンスはビューより長生きで、画面回転やダークモード切替などで
           onCreateInputViewだけが呼び直される。インフレートし直したレイアウトは
           shortcut_view.xmlのvisibility="gone"により必ず定型文表示から始まるため、
           このフラグを引き継ぐとフィルター行の見た目だけがショートカット表示のまま残り、
           トグルを1回押しても何も切り替わらないように見える */
        isShortcutMode = false

        // ビューの初期化
        initializeViews()

        // データベースを開く
        openDatabase()

        // データを読み込み
        loadInitialData()

        return keyboardView
    }

    /**
     * ビューの初期化
     *
     * 【目的】
     * XMLレイアウトから各Viewを取得し、イベントリスナーを設定します。
     *
     * 【何をするか】
     * 1. findViewById()でビューを取得
     *    - profileChipGroup: 環境選択ドロップダウン
     *    - categoryChipGroup: カテゴリフィルター
     *    - snippetListContainer: 定型文一覧（一覧エリアの表示物のひとつ）
     *    - shortcutView: ショートカット画面（一覧エリアの表示物のひとつ、初期状態は非表示）
     *    - shortcutToggle: 定型文／ショートカットの表示切替トグル
     *    - detailView: 詳細画面（初期状態は非表示）
     * 2. RecyclerViewの設定
     *    - LinearLayoutManager: 縦スクロール
     *    - SnippetAdapter: スニペットカードを表示
     * 3. ショートカット関連のボタンにリスナーを設定
     *    - shortcutToggle: 一覧に出す対象を切り替える
     * 4. 詳細画面のボタンにリスナーを設定
     *    - copyButton: スニペットを挿入
     *    - insertNewlineButton: 改行を挿入
     *    - closeButton: 詳細画面を閉じる
     *
     * 【理由】
     * Androidでは、XMLで定義したレイアウトをKotlinコードから操作するために
     * findViewById()でビューを取得する必要があります。
     */
    private fun initializeViews() {
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "🔧 initializeViews started")

        mainView = keyboardView.findViewById(R.id.mainView)
        profileChipGroup = keyboardView.findViewById(R.id.profileChipGroup)
        categoryChipGroup = keyboardView.findViewById(R.id.categoryChipGroup)
        snippetListContainer = keyboardView.findViewById(R.id.snippetListContainer)
        snippetRecyclerView = keyboardView.findViewById(R.id.snippetRecyclerView)
        emptyStateTextView = keyboardView.findViewById(R.id.emptyStateTextView)
        sortButton = keyboardView.findViewById(R.id.sortButton)
        sortBadge = keyboardView.findViewById(R.id.sortBadge)
        shortcutToggle = keyboardView.findViewById(R.id.shortcutToggle)
        shortcutToggleKnob = keyboardView.findViewById(R.id.shortcutToggleKnob)
        shortcutToggleIcon = keyboardView.findViewById(R.id.shortcutToggleIcon)

        // ショートカット画面のビューを初期化
        shortcutView = keyboardView.findViewById(R.id.shortcutView)
        shortcutRecyclerView = keyboardView.findViewById(R.id.shortcutRecyclerView)
        shortcutEmptyView = keyboardView.findViewById(R.id.shortcutEmptyView)

        // 詳細画面のビューを初期化
        detailView = keyboardView.findViewById(R.id.detailView)
        detailScrollView = keyboardView.findViewById(R.id.detailScrollView)
        titleRow = keyboardView.findViewById(R.id.titleRow)
        detailTitleLabel = keyboardView.findViewById(R.id.detailTitleLabel)
        insertTitleButton = keyboardView.findViewById(R.id.insertTitleButton)
        titleSeparator = keyboardView.findViewById(R.id.titleSeparator)
        detailContentLabel = keyboardView.findViewById(R.id.detailContentLabel)
        copyButton = keyboardView.findViewById(R.id.copyButton)
        insertNewlineButton = keyboardView.findViewById(R.id.insertNewlineButton)
        closeButton = keyboardView.findViewById(R.id.closeButton)

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Views found - profileChipGroup: $profileChipGroup")
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Views found - categoryChipGroup: $categoryChipGroup")
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Views found - snippetRecyclerView: $snippetRecyclerView")
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Views found - detailView: $detailView")
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Views found - sortButton: $sortButton")

        // RecyclerViewの設定
        snippetRecyclerView.layoutManager = LinearLayoutManager(this)

        /* 一覧の表示枠は固定高さのため、行数が変わってもRecyclerView自体の大きさは変わらない。
           これを伝えることでスクロール中のレイアウト再計算を省ける */
        snippetRecyclerView.setHasFixedSize(true)

        snippetAdapter = SnippetAdapter { snippet ->
            onSnippetClicked(snippet)
        }
        snippetRecyclerView.adapter = snippetAdapter

        // ショートカット画面のRecyclerViewの設定
        shortcutRecyclerView.layoutManager = LinearLayoutManager(this)

        /* 行数が変わってもRecyclerView自体の大きさは変わらない。
           これを伝えることでスクロール中のレイアウト再計算を省ける */
        shortcutRecyclerView.setHasFixedSize(true)

        /* ショートカット一覧と値一覧は1つのRecyclerViewでアダプターを差し替えて表示する。
           差し替えると表示位置が先頭に戻るため、階層を移動するたびに一覧の先頭から読める */
        shortcutAdapter = ShortcutAdapter { shortcut ->
            onShortcutClicked(shortcut)
        }
        shortcutValueAdapter = ShortcutValueAdapter { value ->
            onShortcutValueClicked(value)
        }
        shortcutRecyclerView.adapter = shortcutAdapter

        /* 表示切替トグル: 押すたびに定型文表示とショートカット表示を往復する。
           以前のように別画面へ遷移しないため、ショートカット側に閉じる専用のボタンは置かない */
        shortcutToggle.setOnClickListener {
            toggleListMode()
        }

        // 詳細画面のボタンにクリックリスナーを設定
        copyButton.setOnClickListener {
            onCopyButtonClicked()
        }
        closeButton.setOnClickListener {
            closeDetailView()
        }
        insertTitleButton.setOnClickListener {
            onInsertTitleButtonClicked()
        }
        insertNewlineButton.setOnClickListener {
            onInsertNewlineButtonClicked()
        }

        // ソートボタンの設定
        currentSortBy = loadSortPreference(SORT_PREFERENCE_KEY)
        currentShortcutSortBy = loadSortPreference(SHORTCUT_SORT_PREFERENCE_KEY)
        sortButton.setOnClickListener {
            showSortMenu(it)
        }
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Sort button configured (snippet: $currentSortBy, shortcut: $currentShortcutSortBy)")

        /* 起動直後は定型文表示。トグルのアイコンとフィルター行の見え方（バッジを含む）をその状態に合わせる */
        updateListModeChrome()

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ RecyclerView configured")
    }

    /**
     * データベースを開く
     *
     * 【目的】
     * メインアプリと共有するSharedDBを読み書き可能モードで開きます。
     *
     * 【何をするか】
     * 1. ManageDBとSharedDBのパスをログ出力（デバッグ用）
     * 2. SharedDBファイルの存在とサイズを確認
     * 3. database.initialize()でSharedDBを読み書き可能で開く
     * 4. テーブル一覧を取得して存在確認
     * 5. テーブルが空の場合は警告を表示
     *
     * 【理由】
     * キーボードはメインアプリと同じデータを読む必要があります。
     * Android版では読み書き可能モードで開きます（WALファイルを読むため）。
     *
     * 【注意】
     * メインアプリが一度も起動していない場合、SharedDBは空です。
     * この場合は「メインアプリを起動してください」という警告を表示します。
     */
    private fun openDatabase() {
        try {
            val sharedPath = Database.getSharedDatabasePath(applicationContext)

            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "============================================================")
            // SharedDBファイルの存在とサイズを確認
            val sharedFile = java.io.File(sharedPath)
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "📁 SharedDB exists: ${sharedFile.exists()}")
            if (sharedFile.exists()) {
                if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "📏 SharedDB size: ${sharedFile.length()} bytes")
            }

            // SharedDBを読み書き可能モードで開く（WALファイルを読むため）
            database.initialize()
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ SharedDB opened successfully")

            // テーブルの存在確認
            val tables = database.getTableNames()
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "📋 Available tables: $tables")
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "📊 Number of tables: ${tables.size}")

            if (tables.isEmpty() || !tables.contains("profiles")) {
                Log.w(TAG, "⚠️ SharedDB not initialized by main app yet.")
                Log.w(TAG, "   Please launch the main app first to initialize the database.")
            } else {
                if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ SharedDB initialized and ready")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to open SharedDB", e)
        }
    }

    /**
     * 初期データを読み込み
     *
     * 【目的】
     * キーボード表示に必要な初期データをデータベースから取得します。
     *
     * 【何をするか】
     * 1. サブスクリプション状態をチェック
     * 2. プロファイル一覧を取得（ProfileService経由）
     * 3. アクティブなプロファイルを選択
     * 4. カテゴリ一覧を取得（CategoryService経由）
     * 5. 変数マップを取得（VariableService経由）
     * 6. UIを初期化
     *    - setupProfileChips(): 環境選択ドロップダウン
     *    - setupCategoryChips(): カテゴリフィルター
     *    - reloadSnippets(): スニペット一覧
     *
     * 【理由】
     * データベースが空の場合でもクラッシュしないように、
     * エラーハンドリングを行い、空のUIを表示します。
     *
     * 【呼び出し元】
     * onCreateInputView()から呼ばれます。
     */
    private fun loadInitialData() {
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "🚀 loadInitialData started")

        try {
            // プロファイルを読み込み（Serviceを使用）
            profiles = profileService.getAllProfiles()
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Loaded ${profiles.size} profiles")

            if (profiles.isEmpty()) {
                Log.w(TAG, "⚠️ No profiles found. Database may not be initialized.")
                // 空のデータでUIを初期化（クラッシュを防ぐ）
                setupProfileChips()
                setupCategoryChips()
                snippetAdapter.submitList(emptyList())
                return
            }

            // アクティブなプロファイルを選択
            currentProfile = profileService.getActiveProfile() ?: profiles.firstOrNull()

            if (currentProfile != null) {
                // カテゴリを読み込み（Serviceを使用）
                categories = categoryService.getAll()
                if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Loaded ${categories.size} categories")

                /* 選択中のカテゴリがメインアプリで削除されていたら「すべて」へ戻す。
                   残したままだと、存在しないIDで絞り込み続けて一覧が常に0件になり、
                   チップには消えたカテゴリ名が出たままなので原因に気付けない */
                val selectedCategoryId = currentCategory?.id
                if (selectedCategoryId != null && categories.none { it.id == selectedCategoryId }) {
                    if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "Selected category is gone - falling back to all")
                    currentCategory = null
                }

                // 変数を読み込み（Serviceを使用）
                variablesMap = variableService.getVariablesMap(currentProfile!!.id)
                if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Loaded ${variablesMap.size} variables")

                // UIを更新
                setupProfileChips()
                setupCategoryChips()
                reloadSnippets()
            } else {
                Log.w(TAG, "⚠️ No profiles found")
            }

            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "🏁 loadInitialData completed")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to load data", e)
            // エラーが発生してもUIは空で表示する（クラッシュを防ぐ）
            setupProfileChips()
            setupCategoryChips()
            snippetAdapter.submitList(emptyList())
        }
    }

    /**
     * プロファイルチップを設定
     *
     * 【目的】
     * 環境選択ドロップダウンのUIを構築します。
     *
     * 【何をするか】
     * 1. 既存のチップを全て削除
     * 2. 現在選択中のプロファイル名を表示するチップを1つ作成
     * 3. クリック時にshowProfileSelectionMenu()を呼ぶリスナーを設定
     * 4. シャドー（elevation）を0にして平坦なデザインに
     *
     * 【理由】
     * iOS版と同じように、ドロップダウン風のUIを実現するため、
     * 常に1つのチップのみ表示し、クリック時にPopupMenuで選択肢を表示します。
     */
    private fun setupProfileChips() {
        profileChipGroup.removeAllViews()

        // 最初のプロファイルのみ表示（ドロップダウン的に）
        if (profiles.isNotEmpty()) {
            val profile = currentProfile ?: profiles.first()
            val chip = Chip(themedContext).apply {
                text = profile.name
                isCheckable = false
                isClickable = true

                // シャドー（elevation）を削除
                elevation = 0f

                // クリック時にプロファイル選択メニューを表示
                setOnClickListener {
                    showProfileSelectionMenu(it, profiles)
                }
            }
            profileChipGroup.addView(chip)
        }
    }

    /**
     * プロファイル選択メニューを表示
     *
     * 【目的】
     * クリックされたチップの下にポップアップメニューを表示します。
     *
     * 【何をするか】
     * 1. PopupMenuを作成（アンカービューの下に表示）
     * 2. プロファイル一覧をメニューアイテムとして追加
     * 3. 選択時にonProfileSelected()を呼ぶ
     *
     * 【理由】
     * Androidで標準的なドロップダウンUIを実現する方法です。
     * PopupMenuは自動的に位置調整とタップ外クローズを処理します。
     */
    private fun showProfileSelectionMenu(anchor: android.view.View, profiles: List<Profile>) {
        val popupMenu = android.widget.PopupMenu(this, anchor)

        profiles.forEachIndexed { index, profile ->
            popupMenu.menu.add(0, index, index, profile.name)
        }

        popupMenu.setOnMenuItemClickListener { item ->
            val selectedProfile = profiles[item.itemId]
            onProfileSelected(selectedProfile)
            true
        }

        popupMenu.show()
    }

    /**
     * カテゴリドロップダウンを設定
     *
     * 【目的】
     * カテゴリ選択ドロップダウンのUIを構築します。
     *
     * 【何をするか】
     * 1. 既存のチップを全て削除
     * 2. 現在選択中のカテゴリ名を表示するチップを1つ作成
     *    - 未選択時は「すべて」を表示
     * 3. クリック時にshowCategorySelectionMenu()を呼ぶリスナーを設定
     *
     * 【理由】
     * iOS版と同じように、ドロップダウン風のUIを実現するため、
     * 常に1つのチップのみ表示し、クリック時にPopupMenuで選択肢を表示します。
     */
    private fun setupCategoryChips() {
        categoryChipGroup.removeAllViews()

        // 現在選択中のカテゴリ名（未選択時は「すべて」）
        val categoryName = currentCategory?.name ?: getString(R.string.category_all)
        val chip = Chip(themedContext).apply {
            text = categoryName
            isCheckable = false
            isClickable = true

            // シャドー（elevation）を削除
            elevation = 0f

            // クリック時にカテゴリ選択メニューを表示
            setOnClickListener {
                showCategorySelectionMenu(it)
            }
        }
        categoryChipGroup.addView(chip)
    }

    /**
     * カテゴリ選択メニューを表示
     *
     * 【目的】
     * クリックされたチップの下にポップアップメニューを表示します。
     *
     * 【何をするか】
     * 1. PopupMenuを作成（アンカービューの下に表示）
     * 2. 「すべて」オプションを追加
     * 3. カテゴリ一覧をメニューアイテムとして追加
     * 4. 選択時にonCategorySelected()を呼ぶ
     *
     * 【理由】
     * プロファイル選択と同じUIパターンを使用し、一貫性を保ちます。
     */
    private fun showCategorySelectionMenu(anchor: android.view.View) {
        val popupMenu = android.widget.PopupMenu(this, anchor)

        // 「すべて」オプション
        popupMenu.menu.add(0, -1, 0, getString(R.string.category_all))

        // カテゴリオプション
        categories.forEachIndexed { index, category ->
            popupMenu.menu.add(0, index, index + 1, category.name)
        }

        popupMenu.setOnMenuItemClickListener { item ->
            val selectedCategory = if (item.itemId == -1) {
                null
            } else {
                categories.getOrNull(item.itemId)
            }
            onCategorySelected(selectedCategory)
            true
        }

        popupMenu.show()
    }

    /**
     * カラーコードをパース（#RRGGBB形式）
     *
     * 【目的】
     * カテゴリの色コード文字列をAndroidのColor整数値に変換します。
     *
     * 【何をするか】
     * 1. colorStringが#で始まるか確認
     * 2. Color.parseColor()で16進数カラーを変換
     * 3. 変換失敗時はデフォルト色（青）を返す
     *
     * 【理由】
     * データベースには"#FF5733"のような文字列で保存されていますが、
     * Androidでは整数値（ARGB）が必要なため変換が必要です。
     */
    private fun parseColor(colorString: String?): Int {
        return try {
            if (colorString != null && colorString.startsWith("#")) {
                android.graphics.Color.parseColor(colorString)
            } else {
                resources.getColor(android.R.color.holo_blue_light, null)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse color: $colorString", e)
            resources.getColor(android.R.color.holo_blue_light, null)
        }
    }

    /**
     * プロファイル選択時の処理
     *
     * 【目的】
     * ユーザーが環境を切り替えた時の処理を実行します。
     *
     * 【何をするか】
     * 1. 選択されたプロファイルをcurrentProfileに保存
     * 2. 新しいプロファイルの変数マップを取得
     * 3. プロファイルチップのテキストを更新
     * 4. reloadSnippets()でスニペット一覧を再読み込み
     * 5. ショートカットを表示中なら、その一覧も読み直す
     *
     * 【理由】
     * プロファイルが変わると表示するスニペットと変数が変わるため、
     * UIを全て更新する必要があります。
     */
    private fun onProfileSelected(profile: Profile) {
        if (currentProfile?.id != profile.id) {
            currentProfile = profile
            variablesMap = variableService.getVariablesMap(profile.id)
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Profile selected: ${profile.name}")

            // プロファイルチップのテキストを更新
            if (profileChipGroup.childCount > 0) {
                val chip = profileChipGroup.getChildAt(0) as? Chip
                chip?.text = profile.name
            }

            reloadSnippets()

            /* ショートカットもプロファイルによって出るものと参照値の中身が変わるため、表示中なら読み直す。
               値一覧（2階層目）を開いていた場合、そのショートカットは切り替え後の環境に出るとは限らず、
               値も切り替え前の環境で解決したものなので、1階層目へ戻したうえで新しい環境の一覧を出す */
            if (isShortcutMode) {
                showShortcutList()
            }
        }
    }

    /**
     * カテゴリ選択時の処理
     *
     * 【目的】
     * ユーザーがカテゴリを変更した時の処理を実行します。
     *
     * 【何をするか】
     * 1. 選択されたカテゴリをcurrentCategoryに保存（nullは"すべて"）
     * 2. チップのテキストを更新
     * 3. reloadSnippets()でスニペット一覧を再読み込み
     * 4. ショートカットを表示中なら、その一覧も読み直す
     *
     * 【理由】
     * カテゴリが変わると表示するスニペットが変わるため、
     * フィルタリングして再表示する必要があります。
     */
    private fun onCategorySelected(category: Category?) {
        if (currentCategory?.id != category?.id) {
            currentCategory = category
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Category selected: ${category?.name ?: "all"}")

            // チップのテキストを更新
            if (categoryChipGroup.childCount > 0) {
                val chip = categoryChipGroup.getChildAt(0) as? Chip
                chip?.text = category?.name ?: getString(R.string.category_all)
            }

            reloadSnippets()

            /* ショートカットも定型文と同じカテゴリを持つため、表示中なら読み直す。
               値一覧（2階層目）を開いていた場合、そのショートカットは切り替え前のカテゴリのものなので、
               1階層目へ戻したうえで新しいカテゴリの一覧を出す */
            if (isShortcutMode) {
                showShortcutList()
            }
        }
    }

    /**
     * スニペットを再読み込み（Serviceを使用）
     *
     * 【目的】
     * 現在のプロファイルとカテゴリに基づいてスニペット一覧を取得します。
     *
     * 【何をするか】
     * 1. currentProfileとcurrentCategoryを確認
     * 2. SnippetServiceを使ってスニペットを取得
     *    - カテゴリ選択時: getSnippetsByCategory()
     *    - "すべて"選択時: getAllSnippets()
     * 3. 取得したスニペットをRecyclerViewのアダプターに渡す
     *
     * 【理由】
     * プロファイルやカテゴリが変わるたびに、
     * 表示するスニペットをフィルタリングして更新する必要があります。
     */
    private fun reloadSnippets() {
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "🔄 reloadSnippets started (sortBy: $currentSortBy)")

        val profileId = currentProfile?.id
        if (profileId == null) {
            Log.w(TAG, "⚠️ No profile selected")
            snippetAdapter.submitList(emptyList())
            return
        }

        val categoryId = currentCategory?.id

        // Serviceを使用してスニペットを取得（SQLのORDER BYでソート済み）
        allSnippets = if (categoryId != null) {
            snippetService.getSnippetsByCategory(categoryId, profileId, currentSortBy)
        } else {
            snippetService.getAllSnippets(profileId, currentSortBy)
        }

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Loaded ${allSnippets.size} snippets (sortBy: $currentSortBy)")

        // アダプターに変数マップと書式を設定（タイトルの変数置換に使用）
        // 行の描画ごとにDBを読まないよう、ここでまとめて渡す
        snippetAdapter.variablesMap = variablesMap
        snippetAdapter.systemVariableFormats = SystemVariableFormatMapper.getInstance(this).getAll()

        // アダプターに渡す
        snippetAdapter.submitList(allSnippets)

        // 空の状態表示を制御
        updateEmptyState(allSnippets.isEmpty())
    }

    /**
     * 空の状態表示を更新
     *
     * 【目的】
     * スニペットが空の時に「スニペットがありません」というメッセージを表示します。
     *
     * 【何をするか】
     * スニペットリストが空の場合、emptyStateTextViewを表示し、
     * RecyclerViewを非表示にします。
     *
     * @param isEmpty スニペットが空かどうか
     */
    private fun updateEmptyState(isEmpty: Boolean) {
        if (isEmpty) {
            emptyStateTextView.visibility = View.VISIBLE
            snippetRecyclerView.visibility = View.GONE
        } else {
            emptyStateTextView.visibility = View.GONE
            snippetRecyclerView.visibility = View.VISIBLE
        }
    }

    /**
     * スニペットクリック時の処理（詳細画面を表示）
     *
     * 【目的】
     * ユーザーがスニペットカードをタップした時に詳細画面を表示します。
     *
     * 【何をするか】
     * showSnippetDetail()に処理を委譲します。
     *
     * 【理由】
     * SnippetAdapterからのコールバックとして機能します。
     */
    private fun onSnippetClicked(snippet: Snippet) {
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "Snippet selected")
        showSnippetDetail(snippet)
    }

    /**
     * スニペット詳細画面を表示
     *
     * 【目的】
     * スニペットの内容を詳細画面に表示します。
     *
     * 【何をするか】
     * 1. 選択されたスニペットをselectedSnippetに保存
     * 2. copyWithTitleがtrueの場合、タイトルを変数置換して表示
     * 3. スニペット本文を変数置換して表示
     * 4. 詳細画面をフェードインアニメーションで表示
     *
     * 【理由】
     * 変数（{{name}}など）を実際の値に置換してから表示することで、
     * ユーザーは挿入される最終的なテキストを確認できます。
     */
    private fun showSnippetDetail(snippet: Snippet) {
        selectedSnippet = snippet

        // タイトル行と区切り線の表示/非表示を制御
        if (snippet.copyWithTitle) {
            // タイトルも変数置換する（iOSと同じ動作）
            /* タイトルがNULLでも空文字でもプレースホルダーを表示する */
            val rawTitle = snippet.title?.takeIf { it.isNotEmpty() } ?: getString(R.string.snippet_no_title)
            val replacedTitle = snippetService.replaceVariables(rawTitle, variablesMap)
            detailTitleLabel.text = replacedTitle
            titleRow.visibility = View.VISIBLE
            titleSeparator.visibility = View.VISIBLE
            /* タイトルが未設定のスニペットはプレースホルダー表示のみで、挿入するものがないためボタンは隠す */
            insertTitleButton.visibility = if (snippet.title.isNullOrEmpty()) View.GONE else View.VISIBLE
        } else {
            titleRow.visibility = View.GONE
            titleSeparator.visibility = View.GONE
        }

        // 内容を変数置換して表示
        val replacedContent = snippetService.replaceVariables(snippet.content, variablesMap)
        detailContentLabel.text = replacedContent

        /* ScrollViewはonLayoutで前回のスクロール位置を復元するため、
           別の定型文を開いたときに最上部のタイトル行と挿入ボタンが画面外に残る。毎回先頭へ戻す */
        detailScrollView.scrollTo(0, 0)

        // 詳細画面を表示（フェードインアニメーション）
        mainView.visibility = View.GONE
        detailView.visibility = View.VISIBLE
        detailView.alpha = 0f
        detailView.animate()
            .alpha(1f)
            .setDuration(200)
            .start()

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Detail view shown")
    }

    /**
     * 詳細画面を閉じる
     *
     * 【目的】
     * 詳細画面をフェードアウトして閉じます。
     *
     * 【何をするか】
     * 1. フェードアウトアニメーション（200ms）を実行
     * 2. アニメーション終了後に詳細画面を非表示にする
     * 3. selectedSnippetをnullにクリア
     *
     * 【理由】
     * アニメーションを使うことで、画面遷移が滑らかになり、
     * ユーザー体験が向上します。
     */
    private fun closeDetailView() {
        // フェードアウトアニメーション
        detailView.animate()
            .alpha(0f)
            .setDuration(200)
            .withEndAction {
                detailView.visibility = View.GONE
                mainView.visibility = View.VISIBLE
                selectedSnippet = null
            }
            .start()

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Detail view closed")
    }

    /**
     * コピーボタンクリック時の処理
     *
     * 【目的】
     * スニペットの本文をテキストフィールドに挿入します。
     *
     * 【何をするか】
     * 1. selectedSnippetを取得
     * 2. currentInputConnectionを取得（テキストフィールドへの接続）
     * 3. SnippetService.insertSnippet()を呼んで本文を挿入
     * 4. 挿入成功時は詳細画面を閉じる
     * 5. 挿入失敗時はトーストでエラーを表示
     *
     * 【理由】
     * InputConnectionはAndroidのIMEがテキストフィールドに
     * テキストを挿入するための標準的な方法です。
     * SnippetServiceに処理を委譲することで、変数置換ロジックを再利用できます。
     */
    private fun onCopyButtonClicked() {
        val snippet = selectedSnippet ?: return

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "Snippet insert requested")

        // テキストを挿入（Serviceに委譲）
        val ic = currentInputConnection
        if (ic != null) {
            snippetService.insertSnippet(snippet, ic, variablesMap)
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Text inserted successfully")
            closeDetailView()
        } else {
            Log.e(TAG, "❌ InputConnection is null")
            Toast.makeText(this, R.string.keyboard_insert_failed, Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * タイトル挿入ボタンクリック時の処理
     *
     * 【目的】
     * スニペットのタイトルだけをテキストフィールドに挿入します。
     *
     * 【何をするか】
     * 1. selectedSnippetを取得
     * 2. currentInputConnectionを取得（テキストフィールドへの接続）
     * 3. SnippetService.insertTitle()を呼んでタイトルを挿入
     * 4. 挿入失敗時はトーストでエラーを表示
     *
     * 【詳細画面を閉じない理由】
     * メールの件名を入れたあと、続けて本文を別の欄へ入れられるようにするため、
     * タイトル挿入後も詳細画面は開いたままにします。
     */
    private fun onInsertTitleButtonClicked() {
        val snippet = selectedSnippet ?: return

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "Title insert requested")

        // タイトルを挿入（Serviceに委譲）
        val ic = currentInputConnection
        if (ic != null) {
            snippetService.insertTitle(snippet, ic, variablesMap)
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Title inserted successfully")
        } else {
            Log.e(TAG, "❌ InputConnection is null")
            Toast.makeText(this, R.string.keyboard_insert_failed, Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * 改行ボタンクリック時の処理
     *
     * 【目的】
     * 改行だけをテキストフィールドに挿入します。
     *
     * 【何をするか】
     * 1. currentInputConnectionを取得（テキストフィールドへの接続）
     * 2. SnippetService.insertNewline()を呼んで改行を挿入
     * 3. 挿入失敗時はトーストでエラーを表示
     *
     * 【selectedSnippetを参照しない理由】
     * 挿入するのは改行のみで、変数置換もプロファイルも関与しないため、
     * 選択中のスニペットの有無に関わらず動作します。
     *
     * 【詳細画面を閉じない理由】
     * 「タイトル挿入 → 改行 → 本文挿入」と続けて操作できるようにするため、
     * 改行挿入後も詳細画面は開いたままにします。
     */
    private fun onInsertNewlineButtonClicked() {
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "Newline insert requested")

        // 改行を挿入（Serviceに委譲）
        val ic = currentInputConnection
        if (ic != null) {
            snippetService.insertNewline(ic)
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Newline inserted successfully")
        } else {
            Log.e(TAG, "❌ InputConnection is null")
            Toast.makeText(this, R.string.keyboard_insert_failed, Toast.LENGTH_SHORT).show()
        }
    }

    override fun onStartInputView(info: android.view.inputmethod.EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        applyWindowBackground()
        restoreShortcutViewState()
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "============================================================")
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "👁️ onStartInputView CALLED")
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "   restarting: $restarting")
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "   inputType: ${info?.inputType}")
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "   keyboardView visibility: ${keyboardView.visibility}")
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "   keyboardView height: ${keyboardView.height}")
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "   keyboardView measuredHeight: ${keyboardView.measuredHeight}")
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "   keyboardView layoutParams: ${keyboardView.layoutParams}")
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "============================================================")

        // ビューが測定されるまで待つ
        keyboardView.post {
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "📐 After layout:")
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "   keyboardView height: ${keyboardView.height}")
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "   keyboardView measuredHeight: ${keyboardView.measuredHeight}")
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "   keyboardView width: ${keyboardView.width}")
        }
    }

    /**
     * IMEウィンドウの背景を現在の設定（ライト/ダーク）で再適用する
     * ウィンドウは1度しか生成されないため、表示のたびに適用して切替に追従させる
     */
    private fun applyWindowBackground() {
        val color = ContextCompat.getColor(this, R.color.keyboardWindowBackground)
        window?.window?.setBackgroundDrawable(ColorDrawable(color))
    }

    override fun onDestroy() {
        super.onDestroy()
        database.close()
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "Keyboard service destroyed")
    }

    // MARK: - Shortcut Methods（ショートカット関連メソッド）

    /**
     * 定型文表示とショートカット表示を切り替える
     *
     * 【目的】
     * フィルター行のトグル（shortcutToggle）から、一覧に出す対象を往復で切り替えます。
     *
     * 【別画面への遷移をやめた理由】
     * 以前はショートカットを全画面のビューで出し、専用の閉じるボタンで定型文へ戻していた。
     * トグルにすると同じ位置のボタンで行き来でき、戻る手段を探さずに済む。
     */
    private fun toggleListMode() {
        /* 【カテゴリ選択を「すべて」へ戻す理由】
           カテゴリは定型文とショートカットで共通だが、どちらに何件あるかは別々。
           切り替え先にそのカテゴリのデータが1件も無いと、一覧だけが空になり
           「作成していないのか、絞り込まれているのか」が読み取れない。
           メインアプリのホーム（useHomeScreen.handleToggleListMode）と同じ判断に揃える */
        onCategorySelected(null)

        if (isShortcutMode) {
            showSnippetMode()
        } else {
            showShortcutMode()
        }
    }

    /**
     * 一覧をショートカット表示に切り替える
     *
     * 【何をするか】
     * 1. フィルター行の見え方とトグルのアイコンをショートカット表示に合わせる
     * 2. ショートカット一覧を組み立てる（選んだ基準で並べ替える）
     * 3. 定型文一覧と入れ替えて、ショートカット画面をフェードインで表示する
     *
     * 【切り替えるたびに読み直す理由】
     * メインアプリでの追加・削除・並べ替えを、次に開いたときの一覧へ取り込むため。
     *
     * 【排他表示について】
     * 定型文一覧（snippetListContainer）とショートカット画面（shortcutView）は
     * 同じ一覧エリアに重ねて置いてあり、表示されるのは常にどちらか一方になる。
     * 詳細画面（detailView）はフィルター行ごと覆うため、開いている間はトグルを押せない。
     */
    private fun showShortcutMode() {
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "Shortcut list requested")

        isShortcutMode = true
        updateListModeChrome()
        showShortcutList()

        /* 消える側を先にGONEにしてから、出る側をフェードインする。
           フェードアウトを挟むと、消えかけの一覧に触れて意図しない行を選べる時間が生まれるため
           （以前はその時間をisClosingShortcutViewで塞いでいた） */
        snippetListContainer.visibility = View.GONE
        shortcutView.visibility = View.VISIBLE
        shortcutView.alpha = 0f
        shortcutView.animate()
            .alpha(1f)
            .setDuration(LIST_SWITCH_DURATION_MS)
            .start()

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Shortcut list shown")
    }

    /**
     * 一覧を定型文表示に切り替える
     *
     * 【定型文を読み直さない理由】
     * 定型文の並びは環境・カテゴリ・並べ替えの設定だけで決まる。
     * それらが変わったときは、それぞれの処理がreloadSnippets()を呼んでいる。
     */
    private fun showSnippetMode() {
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "Snippet list requested")

        isShortcutMode = false
        updateListModeChrome()

        /* 入れ替えの作法はshowShortcutMode()と同じ（消える側を先に隠す） */
        shortcutView.visibility = View.GONE
        snippetListContainer.visibility = View.VISIBLE
        snippetListContainer.alpha = 0f
        snippetListContainer.animate()
            .alpha(1f)
            .setDuration(LIST_SWITCH_DURATION_MS)
            .start()

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Snippet list shown")
    }

    /**
     * 表示中の対象に合わせて、フィルター行とトグルの見た目を整える
     *
     * 【環境チップとカテゴリチップを隠さない理由】
     * ショートカットはプロファイル（環境）に紐づき（紐づけ0件は全環境向け）、定型文と同じカテゴリも持つ。
     * どちらの絞り込みで見ている一覧なのかと、切り替える手段がショートカット表示でも要る。
     *
     * 【並べ替えを隠さない理由】
     * 定型文とショートカットのどちらにも並べ替えがあり、基準は別々に保存している。
     * ボタンは出したまま、バッジだけを表示中の一覧の基準に合わせて付け替える。
     *
     * 【トグルの見た目】
     * ノブの位置と中のアイコンの形で、今どちらを見ているかを示す。
     * 左（書類）が定型文、右（稲妻）がショートカット。
     * トラックの枠線とアイコンの色はアプリのホームの切替トグルに揃えてレイアウト側で固定し、表示対象では変えない。
     * 読み上げだけは「押したら何が起きるか」を伝えるため、見た目と逆の側を読ませる。
     */
    private fun updateListModeChrome() {
        /* 並べ替えの基準は定型文とショートカットで別々のため、表示対象が変わるとバッジの要否も変わる */
        updateSortBadgeVisibility()

        shortcutToggle.contentDescription = getString(
            if (isShortcutMode) R.string.accessibility_show_snippets_button
            else R.string.accessibility_show_shortcuts_button
        )

        shortcutToggleIcon.setImageResource(
            if (isShortcutMode) R.drawable.ic_shortcut else R.drawable.ic_snippet
        )

        moveToggleKnob()
    }

    /**
     * トグルのノブを現在の表示対象に合わせて動かす
     *
     * 【translationXで動かす理由】
     * layout_gravityやmarginを付け替えるとレイアウトのやり直しが入る。
     * ノブは描画位置がずれるだけでよいので、再レイアウトの要らないtranslationXを使う。
     *
     * 【移動量】
     * トラック52dp、ノブ28dp、左右の余白2dpずつ。左端から右端までは
     * 52 - 28 - 2 - 2 = 20dp となる。
     *
     * 【ビュー生成直後はアニメーションさせない理由】
     * 初期表示で勝手にノブが滑ると、利用者が触っていないのに切り替わったように見える。
     * 既に同じ位置にいるときは何もしない。
     */
    private fun moveToggleKnob() {
        val target = if (isShortcutMode) {
            TOGGLE_KNOB_TRAVEL_DP * resources.displayMetrics.density
        } else {
            0f
        }

        if (shortcutToggleKnob.translationX == target) return

        /* 表示されていない間はアニメーションの完了が保証されないため、位置だけ合わせる */
        if (!shortcutToggleKnob.isShown) {
            shortcutToggleKnob.translationX = target
            return
        }

        shortcutToggleKnob.animate()
            .translationX(target)
            .setDuration(TOGGLE_KNOB_ANIMATION_MS)
            .start()
    }

    /**
     * 入力欄が切り替わったときにショートカット表示の状態を整える
     *
     * 【目的】
     * ショートカットを表示したままキーボードを閉じても、次に開いたときに
     * 削除済みのショートカットや値が残らないようにします。
     *
     * 【なぜ必要か】
     * AndroidのIMEは onCreateInputView で作ったビューを使い回すため、
     * 何もしないとショートカット一覧と、そこに載っている当時のデータがそのまま残る。
     * その間にメインアプリで削除されていると、存在しない値を挿入できてしまう。
     *
     * 【一覧へ戻す理由】
     * 値一覧を開いていた場合、そのショートカット自体が消えている可能性がある。
     * 一覧から読み直せば、消えたものは並びから外れる。
     * （iOS版の refreshAllData → reloadShortcutScreen と同じ狙い）
     */
    private fun restoreShortcutViewState() {
        if (!::shortcutView.isInitialized) return
        if (!isShortcutMode) return

        showShortcutList()
    }

    /**
     * ショートカット一覧を表示
     *
     * 【目的】
     * ショートカット画面の1階層目（ショートカット名の一覧）を表示します。
     *
     * 【何をするか】
     * 1. 選んだ基準で並べ替えたショートカット一覧を取得
     * 2. 一覧を差し替え、0件なら空状態を表示する
     *
     * 【開くたびに取得し直す理由】
     * メインアプリでの追加・削除・並べ替えを次に開いたときに反映するため。
     */
    private fun showShortcutList() {
        val shortcuts = loadRankedShortcuts()

        shortcutRecyclerView.adapter = shortcutAdapter
        shortcutAdapter.submitList(shortcuts)
        updateShortcutEmptyState(shortcuts.isEmpty())

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Loaded ${shortcuts.size} shortcuts")
    }

    /**
     * ショートカット値の一覧を表示
     *
     * 【目的】
     * ショートカット画面の2階層目（値の一覧）を表示します。
     *
     * 【何をするか】
     * 1. 使用回数の多い順に値を並べ替える
     * 2. 一覧を値用のアダプターへ差し替える
     *
     * 【見出しと戻るボタンを置かない】
     * 値一覧にも見出しの行と戻るボタンは置かない。ショートカット一覧へは、
     * 値を挿入するか、トグルで定型文へ切り替えてから戻すと開き直す。
     *
     * 【一覧の並べ替えを掛けない理由】
     * 値が持つのは名前と使用回数だけで、4種の基準のうち2種が対応しない（ShortcutService.rankedValues）。
     *
     * @param shortcut 選択されたショートカット
     */
    private fun showShortcutValues(shortcut: Shortcut) {
        val values = shortcutService.rankedValues(shortcut.values)

        shortcutRecyclerView.adapter = shortcutValueAdapter
        shortcutValueAdapter.submitList(values)

        /* 値を持つショートカットからしか遷移しないため、この階層で空状態になることはない */
        updateShortcutEmptyState(false)

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Shortcut values shown (${values.size} values)")
    }

    /**
     * ショートカットクリック時の処理
     *
     * 【目的】
     * 選ばれたショートカットの値一覧へ進みます。
     *
     * 【値の件数で動きを変えない理由】
     * 挿入までの道筋が件数によって変わると、同じ行を押しても値一覧が出る場合と
     * 即座に入力される場合があり、押す前に結果を予測できない。
     * 件数にかかわらず「一覧 → 値一覧 → 挿入」に揃える。
     *
     * @param shortcut 選択されたショートカット
     */
    private fun onShortcutClicked(shortcut: Shortcut) {
        /* 階層移動も行の中身が入れ替わる操作のため、挿入と同じ窓で二度押しを塞ぐ */
        if (!acceptShortcutTap()) return

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "Shortcut selected (${shortcut.values.size} values)")

        /* 値を持たないショートカットは挿入するものがないため何もしない */
        if (shortcut.values.isEmpty()) {
            Log.w(TAG, "⚠️ Shortcut has no values")
            return
        }

        showShortcutValues(shortcut)
    }

    /**
     * ショートカット値クリック時の処理
     *
     * 【挿入後にショートカット一覧へ戻す理由】
     * 同じ値を続けて入れる場面は少なく、次は別のショートカットを選ぶことが多いため。
     * 表示対象はショートカットのままで、定型文へは戻さない（戻すかどうかはトグルで決める）。
     *
     * 【挿入できなかったときは戻さない理由】
     * 二度押しとして落とした直後に階層まで戻すと、押したつもりのない移動が起きるため。
     *
     * @param value 選択されたショートカット値
     */
    private fun onShortcutValueClicked(value: ShortcutValue) {
        /* 二度押しの判定は行のタップ1回につき1度だけ行う。
           挿入側（insertShortcutValue）にも置くと同じタップが2回数えられ、
           2度目が必ず落ちて挿入できなくなる */
        if (!acceptShortcutTap()) return

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "Shortcut value selected")

        if (!insertShortcutValue(value)) return

        showShortcutList()
    }

    /**
     * ショートカット値をテキストフィールドへ挿入
     *
     * 【何をするか】
     * 1. currentInputConnectionを取得（テキストフィールドへの接続）
     * 2. ShortcutService.insertValue()で値を挿入（振動と使用回数の加算も行う）
     *
     * 【二重挿入の判定をここに置かない理由】
     * 呼び出し元の行タップ（onShortcutValueClicked）で既に判定している。
     * ここにも置くと、同じタップが2回数えられてしまう。
     *
     * 【挿入してもショートカット表示のままにする理由】
     * 表示対象はトグルで決めるものなので、挿入を理由に勝手に定型文へ戻さない。
     * 続けて別のショートカットを入れられる。
     *
     * @param value 挿入するショートカット値
     * @return 挿入した場合はtrue（挿入先が無い場合はfalse）
     */
    private fun insertShortcutValue(value: ShortcutValue): Boolean {
        val ic = currentInputConnection
        if (ic == null) {
            Log.e(TAG, "❌ InputConnection is null")
            Toast.makeText(this, R.string.keyboard_insert_failed, Toast.LENGTH_SHORT).show()
            return false
        }

        shortcutService.insertValue(value, ic)
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Shortcut value inserted successfully")
        return true
    }

    /**
     * ショートカット値の挿入を受け付けてよいか判定する
     *
     * 【目的】
     * 指が跳ねた二度押しで、同じ値が2回入力され使用回数も2回加算されるのを防ぎます。
     *
     * 【以前の仕組みとの関係】
     * 以前は挿入のたびにショートカット画面を閉じ、その200msのフェードアウト中のタップを
     * フラグ（isClosingShortcutView）で無視していた。
     * トグル化で挿入後も画面が閉じなくなったため、同じ役目を時間で果たす。
     *
     * 【挿入だけでなく階層移動も対象にする理由】
     * 値が複数のショートカットを指が跳ねて二度押しすると、1回目で値一覧へ切り替わり、
     * 2回目が差し替わった直後の値行に当たって、選んだ覚えのない値が挿入されてしまう。
     * 行の中身が入れ替わる操作はすべて同じ窓で塞ぐ。
     *
     * 【elapsedRealtimeを使う理由】
     * 端末の時刻設定や時差の変更に影響されない単調増加の時計のため、
     * 時刻が戻ったときに判定が壊れない。
     *
     * @return 受け付ける場合はtrue（受け付けた時点で次回の判定用に時刻を記録する）
     */
    private fun acceptShortcutTap(): Boolean {
        val now = android.os.SystemClock.elapsedRealtime()
        if (now - lastShortcutTapAt < SHORTCUT_TAP_DEBOUNCE_MS) {
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "Shortcut tap ignored (too soon)")
            return false
        }

        lastShortcutTapAt = now
        return true
    }

    /**
     * 選択中の環境のショートカット一覧を、選んだ基準で並べ替えて取得
     *
     * 【環境が決まらないときに空へ倒す理由】
     * ショートカットは選択中の環境に紐づくものと、全環境向け（紐づけ0件）のものだけを出す。
     * ここで全件表示へ倒すと、選んでいない環境だけに紐づく値まで挿入できてしまうため、
     * 環境が確定できないときは何も出さない。
     *
     * 【カテゴリ未選択を全件にする理由】
     * 環境と違い、カテゴリの「すべて」は利用者が選べる状態のため、
     * 絞らずに出すのが選択どおりの結果になる。未分類のショートカットもここに含まれる。
     *
     * 【例外を握る理由】
     * メインアプリが一度も起動していない、またはメインアプリのDBがまだ古い版で
     * shortcutsテーブルが無い場合、クエリは失敗する。
     * ここで空一覧に倒すことで、定型文の挿入というキーボード本来の機能は使えるままにする。
     *
     * @return 表示順に並べ替えたショートカット一覧（取得できない場合は空）
     */
    private fun loadRankedShortcuts(): List<Shortcut> {
        val profileId = currentProfile?.id
        if (profileId == null) {
            Log.w(TAG, "⚠️ No profile selected")
            return emptyList()
        }

        return try {
            shortcutService.rankedShortcuts(profileId, currentCategory?.id, currentShortcutSortBy)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to load shortcuts", e)
            emptyList()
        }
    }

    /**
     * ショートカット画面の空の状態表示を更新
     *
     * 【目的】
     * ショートカットが0件の時に案内を表示します。
     *
     * @param isEmpty 一覧が空かどうか
     */
    private fun updateShortcutEmptyState(isEmpty: Boolean) {
        if (isEmpty) {
            shortcutEmptyView.visibility = View.VISIBLE
            shortcutRecyclerView.visibility = View.GONE
        } else {
            shortcutEmptyView.visibility = View.GONE
            shortcutRecyclerView.visibility = View.VISIBLE
        }
    }

    // MARK: - Sort Methods（ソート関連メソッド）

    /**
     * ソートメニューを表示
     *
     * 【目的】
     * ソートボタンをタップした時にPopupMenuを表示し、
     * ユーザーがソート順を選択できるようにします。
     */
    private fun showSortMenu(anchor: View) {
        val popupMenu = android.widget.PopupMenu(this, anchor)
        popupMenu.menu.apply {
            add(0, 0, 0, getString(R.string.keyboard_sort_created))
            add(0, 1, 1, getString(R.string.keyboard_sort_updated))
            /* 並べ替えの基準は同じだが、見出しに当たるものが定型文はタイトル、ショートカットは名前のため語を変える */
            add(
                0, 2, 2,
                getString(
                    if (isShortcutMode) R.string.keyboard_sort_name else R.string.keyboard_sort_title
                )
            )
            add(0, 3, 3, getString(R.string.keyboard_sort_usage))
        }

        popupMenu.setOnMenuItemClickListener { item ->
            val newSortBy = when (item.itemId) {
                0 -> "created"
                1 -> "updated"
                2 -> "title"
                3 -> "usage"
                else -> DEFAULT_SORT_BY
            }
            updateSortPreference(newSortBy)
            true
        }

        popupMenu.show()
    }

    /**
     * ソート設定を更新
     *
     * 【表示中の一覧だけに反映する理由】
     * 並べ替えの基準は定型文とショートカットで別々に持つため、
     * 押したときに見えていた一覧の基準だけを変える。
     */
    private fun updateSortPreference(sortBy: String) {
        if (isShortcutMode) {
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "🔄 [Sort] Updating shortcut sort preference: $currentShortcutSortBy → $sortBy")
            currentShortcutSortBy = sortBy
            saveSortPreference(SHORTCUT_SORT_PREFERENCE_KEY, sortBy)

            /* 値一覧（2階層目）を開いていても1階層目へ戻す。
               値一覧は並べ替えの対象外のため、そのままでは選んだ基準がどこにも現れない */
            showShortcutList()
            shortcutRecyclerView.scrollToPosition(0)
        } else {
            if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "🔄 [Sort] Updating snippet sort preference: $currentSortBy → $sortBy")
            currentSortBy = sortBy
            saveSortPreference(SORT_PREFERENCE_KEY, sortBy)

            reloadSnippets()
            snippetRecyclerView.scrollToPosition(0)
        }

        // バッジ表示を更新
        updateSortBadgeVisibility()
    }

    /**
     * ソート設定を保存（SharedPreferences）
     *
     * @param key 保存先のキー（定型文用・ショートカット用）
     * @param sortBy 並べ替えの基準
     */
    private fun saveSortPreference(key: String, sortBy: String) {
        val prefs = getSharedPreferences(SORT_PREFS_NAME, MODE_PRIVATE)
        prefs.edit().putString(key, sortBy).apply()
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "💾 [Sort] Saved sort preference: $key=$sortBy")
    }

    /**
     * ソート設定を読み込み（SharedPreferences）
     *
     * @param key 読み込むキー（定型文用・ショートカット用）
     * @return 並べ替えの基準（未保存なら既定値）
     */
    private fun loadSortPreference(key: String): String {
        val prefs = getSharedPreferences(SORT_PREFS_NAME, MODE_PRIVATE)
        val sortBy = prefs.getString(key, DEFAULT_SORT_BY) ?: DEFAULT_SORT_BY
        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "📂 [Sort] Loaded sort preference: $key=$sortBy")
        return sortBy
    }

    /**
     * ソートバッジの表示/非表示を更新
     * デフォルト（created）以外の時にバッジを表示
     *
     * 【表示中の一覧の基準で判定する理由】
     * 基準は定型文とショートカットで別々に持つため、トグルで表示を入れ替えると
     * バッジを出すかどうかも入れ替わる。
     */
    private fun updateSortBadgeVisibility() {
        val activeSortBy = if (isShortcutMode) currentShortcutSortBy else currentSortBy
        sortBadge.visibility = if (activeSortBy == DEFAULT_SORT_BY) View.GONE else View.VISIBLE
    }

}
