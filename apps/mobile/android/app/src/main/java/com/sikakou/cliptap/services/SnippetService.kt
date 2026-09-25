package com.sikakou.cliptap.services

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import android.view.inputmethod.InputConnection
import com.sikakou.cliptap.mappers.SnippetMapper
import com.sikakou.cliptap.mappers.SystemVariableFormatMapper
import com.sikakou.cliptap.models.Snippet
import com.sikakou.cliptap.utils.VariableReplacer

/**
 * スニペット管理サービス
 *
 * 【目的】
 * スニペット（定型文）の取得、表示、挿入を管理するビジネスロジック層。
 * キーボード拡張のスニペット機能の中核を担います。
 *
 * 【役割】
 * - スニペットの取得（全て、カテゴリ別、ID指定）
 * - 変数置換処理（{{name}}などを実際の値に変換）
 * - テキストフィールドへの挿入
 * - 振動フィードバック
 *
 * 【重要な仕組み: 3層アーキテクチャ】
 * UI層（KeyboardService） → ビジネスロジック層（このService） → データアクセス層（Mapper）
 * この分離により、コードの保守性とテスタビリティが向上します。
 *
 * 【対応するiOSファイル】
 * ios/ClipTapKeyboard/Services/SnippetService.swift と同等
 */
class SnippetService private constructor(private val context: Context) {

    private val snippetMapper = SnippetMapper.getInstance(context)
    private val variableReplacer = VariableReplacer()
    private val systemVariableFormatMapper = SystemVariableFormatMapper.getInstance(context)

    companion object {
        private const val TAG = "SnippetService"

        /** 挿入時の振動の長さ（ミリ秒）。定型文とショートカットで手応えを揃える */
        private const val VIBRATION_DURATION_MS = 50L

        @Volatile
        private var INSTANCE: SnippetService? = null

        fun getInstance(context: Context): SnippetService {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: SnippetService(context.applicationContext).also {
                    INSTANCE = it
                }
            }
        }
    }

    /**
     * 全スニペットを取得
     *
     * 【目的】
     * 指定したプロファイルに属する全てのスニペットを取得します。
     *
     * 【何をするか】
     * SnippetMapperのgetAll()を呼んでデータベースから取得します。
     *
     * 【引数】
     * @param profileId プロファイルID（nullの場合はプロファイルフィルタなし）
     * @param sortBy ソート条件（"created", "updated", "title", "usage"）
     *
     * 【戻り値】
     * スニペットのリスト（ソート条件に従って並び替え済み）
     */
    fun getAllSnippets(profileId: String? = null, sortBy: String = "created"): List<Snippet> {
        return snippetMapper.getAll(profileId, sortBy)
    }

    /**
     * カテゴリIDでスニペットを取得
     *
     * 【目的】
     * 指定したカテゴリに属するスニペットのみを取得します。
     *
     * 【何をするか】
     * SnippetMapperのgetByCategoryId()を呼んでカテゴリでフィルタリングします。
     *
     * 【引数】
     * @param categoryId カテゴリID
     * @param profileId プロファイルID（nullの場合はプロファイルフィルタなし）
     * @param sortBy ソート条件（"created", "updated", "title", "usage"）
     *
     * 【戻り値】
     * 指定カテゴリのスニペットリスト（ソート条件に従って並び替え済み）
     */
    fun getSnippetsByCategory(categoryId: String, profileId: String? = null, sortBy: String = "created"): List<Snippet> {
        return snippetMapper.getByCategoryId(categoryId, profileId, sortBy)
    }

    /**
     * IDでスニペットを取得
     */
    fun getSnippet(id: String): Snippet? {
        return snippetMapper.getById(id)
    }

    /**
     * 変数を置換（詳細画面のプレビュー用）
     *
     * 【目的】
     * スニペット本文の変数（{{name}}など）を実際の値に置き換えます。
     *
     * 【何をするか】
     * 1. VariableReplacerを使って変数を置換
     * 2. システム変数（{{today}}など）とカスタム変数の両方を処理
     *
     * 【引数】
     * @param text 置換対象のテキスト
     * @param variablesMap カスタム変数のマップ（変数名 → 値）
     *
     * 【戻り値】
     * 変数が置換されたテキスト
     *
     * 【使用例】
     * replaceVariables("こんにちは、{{name}}さん", mapOf("name" to "田中"))
     * → "こんにちは、田中さん"
     */
    fun replaceVariables(text: String, variablesMap: Map<String, String> = emptyMap()): String {
        return variableReplacer.replace(text, variablesMap, systemVariableFormatMapper.getAll())
    }

    /**
     * スニペットの本文をテキスト入力欄に挿入
     *
     * 【目的】
     * ユーザーが選択したスニペットの本文をテキストフィールドに挿入します。
     *
     * 【何をするか】
     * 1. 本文の変数を置換
     * 2. InputConnectionを使ってテキストを挿入
     * 3. 振動フィードバックを実行
     * 4. 使用回数を加算
     *
     * 【引数】
     * @param snippet 挿入するスニペット
     * @param inputConnection テキストフィールドへの接続
     * @param variablesMap カスタム変数のマップ
     *
     * 【タイトルを含めない理由】
     * メールの件名と本文のように別々の入力欄へ入れられるよう、
     * タイトルはinsertTitle()から個別に挿入します。
     *
     * 【理由】
     * InputConnectionはAndroidのIMEがテキストを挿入するための標準的な方法です。
     * commitText()を使うことで、Undo/Redo履歴にも正しく記録されます。
     */
    fun insertSnippet(
        snippet: Snippet,
        inputConnection: InputConnection,
        variablesMap: Map<String, String> = emptyMap()
    ) {
        val formats = systemVariableFormatMapper.getAll()

        // 本文の変数置換
        val content = variableReplacer.replace(snippet.content, variablesMap, formats)

        /* テキストを挿入（本文のみ） */
        inputConnection.commitText(content, 1)

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Snippet inserted: ${snippet.id}")

        /* 振動フィードバック */
        performHapticFeedback()

        /* 使用頻度（copyCount）をインクリメント
           使用頻度順ソートに反映するため、挿入時にカウントを加算 */
        snippetMapper.incrementCopyCount(snippet.id)
    }

    /**
     * スニペットのタイトルだけをテキスト入力欄に挿入
     *
     * 【目的】
     * メールの件名と本文のように、タイトルと本文を別々の入力欄へ入れられるようにします。
     * 詳細画面のタイトル行にあるボタンから呼び出されます。
     *
     * 【何をするか】
     * 1. copyWithTitleがONかつタイトルが空でないことを確認（それ以外は何もしない）
     * 2. タイトルの変数を置換
     * 3. InputConnectionを使ってタイトルを挿入
     * 4. 振動フィードバックを実行
     *
     * 【引数】
     * @param snippet 挿入するスニペット
     * @param inputConnection テキストフィールドへの接続
     * @param variablesMap カスタム変数のマップ
     *
     * 【改行を付けない理由】
     * 別の入力欄へ入れることが主な用途のため、タイトル末尾に改行は付加しません。
     *
     * 【使用回数を加算しない理由】
     * タイトルと本文を続けて挿入すると1回の利用が2回分として数えられてしまいます。
     * 使用回数は本文挿入（insertSnippet）でのみ加算します。
     */
    fun insertTitle(
        snippet: Snippet,
        inputConnection: InputConnection,
        variablesMap: Map<String, String> = emptyMap()
    ) {
        /* タイトルを持たない、またはタイトルをコピーしない設定のスニペットは何もしない */
        if (!snippet.copyWithTitle || snippet.title.isNullOrEmpty()) {
            if (com.sikakou.cliptap.BuildConfig.DEBUG) {
                Log.d(TAG, "Skipped title insert (no title or copyWithTitle is off)")
            }
            return
        }

        val formats = systemVariableFormatMapper.getAll()

        // タイトルの変数置換（本文と同じルールで展開する）
        val title = variableReplacer.replace(snippet.title, variablesMap, formats)

        /* タイトルを挿入（改行は付けない） */
        inputConnection.commitText(title, 1)

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Title inserted: ${snippet.id}")

        /* 振動フィードバック（本文挿入と同じ） */
        performHapticFeedback()
    }

    /**
     * 改行だけをテキスト入力欄に挿入
     *
     * 【目的】
     * タイトル挿入と本文挿入はどちらも改行を付けないため、同じ入力欄へ
     * 「タイトル → 改行 → 本文」と入れたい場合に標準キーボードへの切り替えが必要でした。
     * 詳細画面の改行ボタンから呼び出すことで、切り替えずに改行を入力できます。
     *
     * 【何をするか】
     * 1. InputConnectionを使って改行を挿入
     * 2. 振動フィードバックを実行
     *
     * 【引数】
     * @param inputConnection テキストフィールドへの接続
     *
     * 【スニペットを引数に取らない理由】
     * 挿入する文字は改行のみで、変数置換もプロファイルも関与しないためです。
     *
     * 【使用回数を加算しない理由】
     * 使用回数は本文挿入（insertSnippet）でのみ加算します。
     * 改行を挟むたびに加算すると、1回の利用が複数回として数えられてしまいます。
     */
    fun insertNewline(inputConnection: InputConnection) {
        /* 改行を挿入 */
        inputConnection.commitText("\n", 1)

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Newline inserted")

        /* 振動フィードバック（本文挿入と同じ） */
        performHapticFeedback()
    }

    /**
     * 振動フィードバック
     *
     * 【目的】
     * スニペット挿入時に触覚フィードバックを提供します。
     *
     * 【何をするか】
     * 1. Vibratorサービスを取得
     * 2. 振動機能が利用可能か確認
     * 3. 50ms間の短い振動を実行
     *
     * 【理由】
     * 触覚フィードバックにより、ユーザーは操作が成功したことを
     * 視覚以外でも認識でき、UXが向上します。
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
