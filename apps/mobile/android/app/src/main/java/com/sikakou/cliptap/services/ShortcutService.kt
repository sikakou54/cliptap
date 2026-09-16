package com.sikakou.cliptap.services

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import android.view.inputmethod.InputConnection
import com.sikakou.cliptap.mappers.ShortcutMapper
import com.sikakou.cliptap.mappers.SystemVariableFormatMapper
import com.sikakou.cliptap.models.Shortcut
import com.sikakou.cliptap.utils.VariableReplacer

/**
 * ショートカット管理サービス
 *
 * 【目的】
 * ショートカット（値の候補をまとめたグループ）の取得、並べ替え、挿入を管理するビジネスロジック層。
 *
 * 【役割】
 * - ショートカットの取得
 * - ショートカット一覧と値一覧の並べ替え
 * - テキストフィールドへの値の挿入
 * - 振動フィードバックと使用回数の記録
 *
 * 【並べ替えの正本】
 * packages/shared/src/shortcuts/sort.ts の sortShortcuts() と
 * packages/shared/tests/shortcuts/sortShortcuts.test.ts が規則の正本。
 * このクラスはその規則を写したものなので、正本を変更するときは必ずここも同じ変更を行うこと。
 *
 * 【変数の展開】
 * ショートカットの値も定型文と同じく、変数トークン（{{today}}、{{client_name}}など）を
 * 挿入する時点の選択中プロファイルと日時で展開する。
 * 規則は定型文の挿入（SnippetService.insertSnippet）と同じ VariableReplacer に任せる。
 *
 * 【対応するiOSファイル】
 * ios/ClipTapKeyboard/Services/ShortcutService.swift と同等
 */
class ShortcutService private constructor(private val context: Context) {

    private val shortcutMapper = ShortcutMapper.getInstance(context)
    private val variableReplacer = VariableReplacer()
    private val systemVariableFormatMapper = SystemVariableFormatMapper.getInstance(context)

    companion object {
        private const val TAG = "ShortcutService"

        /** 挿入時の振動の長さ（ミリ秒）。定型文とショートカットで手応えを揃える */
        private const val VIBRATION_DURATION_MS = 50L

        @Volatile
        private var INSTANCE: ShortcutService? = null

        fun getInstance(context: Context): ShortcutService {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: ShortcutService(context.applicationContext).also {
                    INSTANCE = it
                }
            }
        }
    }

    /**
     * 指定プロファイル・カテゴリのショートカットを値付きで取得
     *
     * @param profileId 対象プロファイルのID
     * @param categoryId 対象カテゴリのID（nullは「すべて」＝カテゴリで絞らない）
     * @return ショートカット一覧（sortOrder順、値もsortOrder順）
     */
    fun getAll(profileId: String, categoryId: String?): List<Shortcut> {
        return shortcutMapper.getAll(profileId, categoryId)
    }

    /**
     * 指定プロファイル・カテゴリのショートカット一覧を表示順に並べ替えて取得
     *
     * 【何をするか】
     * 1. 保存順（sortOrder順）のショートカットを、そのプロファイルとカテゴリの分だけ取得
     * 2. 利用者が選んだ並べ替えの基準で並べ替える
     *
     * 【プロファイルで絞る理由】
     * ショートカットは選択中のプロファイル（環境）に紐づくものと、全環境向け（紐づけ0件）のものだけを出す。
     * 絞らずに全件を出すと、選んでいる環境と関係のない値を挿入できてしまう。
     *
     * 【カテゴリで絞る理由】
     * ショートカットは定型文と同じカテゴリを持つ。
     * 選んでいるカテゴリと、一覧に出るショートカットが食い違うと、
     * 絞り込んだつもりの利用者に関係のない候補を見せることになる。
     *
     * 【絞り込みを取得段で行う理由】
     * 並べ替えは取得した一覧に対して行うものなので、絞り込みを取得の後に置くと、
     * 並べ替えの規則を絞り込みの都合で書き換えることになる。
     * 取得段で絞れば、正本（sort.ts）と同じ規則のままで済む。
     *
     * @param profileId 対象プロファイルのID
     * @param categoryId 対象カテゴリのID（nullは「すべて」＝カテゴリで絞らない）
     * @param sortBy 並べ替えの基準（"created", "updated", "title", "usage"）
     * @return 表示順に並べ替えたショートカット一覧
     */
    fun rankedShortcuts(profileId: String, categoryId: String?, sortBy: String): List<Shortcut> {
        return sortShortcuts(getAll(profileId, categoryId), sortBy)
    }

    /**
     * ショートカットの値をテキスト入力欄に挿入
     *
     * 【何をするか】
     * 1. 値の変数トークンを、選択中のプロファイルの変数マップと現在の日時で展開する
     * 2. 展開した値を挿入する。ショートカット名は挿入しない
     * 3. 振動フィードバックを実行
     * 4. 使用回数を加算し、あわせて更新日時を進める
     *
     * 【変数マップを引数で受け取る理由】
     * 定型文の挿入（SnippetService.insertSnippet）と同じ形にするため。
     * 呼び出し側は挿入の直前に読み直したマップを渡す。展開できないトークンは元の形のまま挿入する（仕様書 §8.6）。
     *
     * 【iOS版との違い: フルアクセス判定が不要な理由】
     * iOSの拡張キーボードは「フルアクセスを許可」されていないと共有コンテナへ書き込めないため、
     * 使用回数の加算前に許可の有無を確かめる必要がある。
     * Androidの拡張キーボード（IME）はメインアプリと同一パッケージで動作し、
     * SharedDBもDatabase.initialize()で読み書き可能に開かれているため、この判定は存在しない。
     *
     * @param shortcut 挿入するショートカット（変数トークンは未展開）
     * @param inputConnection テキストフィールドへの接続
     * @param variablesMap 選択中のプロファイルの変数マップ（変数名 → 値）
     */
    fun insertShortcut(
        shortcut: Shortcut,
        inputConnection: InputConnection,
        variablesMap: Map<String, String>
    ) {
        val text = variableReplacer.replace(shortcut.value, variablesMap, systemVariableFormatMapper.getAll())

        /* 値だけを挿入（ショートカット名は挿入しない） */
        inputConnection.commitText(text, 1)

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Shortcut value inserted: ${shortcut.id}")

        /* 振動フィードバック */
        performHapticFeedback()

        /* 使用回数を加算（使用頻度順のショートカット一覧に反映するため） */
        shortcutMapper.incrementUseCount(shortcut.id)
    }

    /**
     * ショートカット一覧を並べ替える
     *
     * 【同順位の決着まで揃える理由】
     * 定型文（SnippetMapper.orderClause）と同じ考え方に揃えてあり、
     * 決着の付け方が違うと同じ「作成日時」でも定型文とショートカットで並びの理屈が変わって見える。
     *
     * 【名前を自然順で比べる理由】
     * 定型文はSQLの title ASC（コードポイント順）で並ぶため、同じ規則で比べないと
     * 同じ「名前順」でも定型文とショートカットで並びが食い違って見える。
     *
     * 【日時を文字列のまま比べる理由】
     * 保存しているのはISO8601の文字列で桁が揃っているため、日付に直さなくても大小が一致する。
     *
     * 【未知の基準を作成日時に倒す理由】
     * 設定は端末に文字列で残るため、将来基準を減らしたときに古い値が読み込まれても
     * 既定の並びで表示できるようにする。
     *
     * @param shortcuts 保存順（sortOrder順）のショートカット一覧
     * @param sortBy 並べ替えの基準（"created", "updated", "title", "usage"）
     * @return 並べ替えたショートカット一覧
     */
    private fun sortShortcuts(shortcuts: List<Shortcut>, sortBy: String): List<Shortcut> {
        val comparator = when (sortBy) {
            "updated" -> compareByDescending<Shortcut> { it.updatedAt }.thenBy { it.name }
            "title" -> compareBy<Shortcut> { it.name }.thenByDescending { it.createdAt }
            "usage" -> compareByDescending<Shortcut> { it.useCount }
                .thenByDescending { it.createdAt }
            else -> compareByDescending<Shortcut> { it.createdAt }.thenBy { it.name }
        }

        return shortcuts.sortedWith(comparator)
    }

    /**
     * 振動フィードバック
     *
     * 【SnippetServiceと同じ実装を持つ理由】
     * 定型文の挿入とショートカットの挿入で手応えが変わると、利用者は別の操作だと感じてしまう。
     * 共通化のためにSnippetServiceへ手を入れると既存の定型文挿入の動作にも影響が出るため、
     * ここでは同じ内容（50ms・既定の強さ）を持たせて挙動を揃える。
     */
    private fun performHapticFeedback() {
        try {
            val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            if (vibrator?.hasVibrator() == true) {
                /* VibrationEffectはAPI 26以降にしか存在しない。minSdkは24のため、
                   版を確かめずに触るとAPI 24/25でNoClassDefFoundErrorになる。
                   これはErrorであってExceptionではないので下のcatchでも拾えず、IMEごと落ちる */
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(
                        VibrationEffect.createOneShot(
                            VIBRATION_DURATION_MS,
                            VibrationEffect.DEFAULT_AMPLITUDE
                        )
                    )
                } else {
                    /* API 24/25向けの旧API。強さは指定できないが、長さは同じにする */
                    vibrator.vibrate(VIBRATION_DURATION_MS)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to perform haptic feedback", e)
        }
    }
}
