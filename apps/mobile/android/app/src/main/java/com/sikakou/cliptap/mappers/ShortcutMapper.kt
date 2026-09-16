package com.sikakou.cliptap.mappers

import android.content.Context
import com.sikakou.cliptap.models.Shortcut
import android.util.Log
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * ショートカットのMapper
 * iOS版のShortcutMapper.swift、TypeScript版のShortcutMapper.tsと同等の機能を提供
 */
class ShortcutMapper private constructor(context: Context) : BaseMapper(context) {

    companion object {
        private const val TAG = "ShortcutMapper"

        @Volatile
        private var INSTANCE: ShortcutMapper? = null

        fun getInstance(context: Context): ShortcutMapper {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: ShortcutMapper(context.applicationContext).also {
                    INSTANCE = it
                }
            }
        }

        /**
         * 更新日時の書式（例: 2026-09-10T01:23:45.678Z）
         *
         * 【この書式にする理由】
         * メインアプリはJavaScriptのDate.toISOString()で日時を保存している。
         * 拡張キーボードだけ別書式で書き込むと、同じ列に2種類の表記が混在し、
         * 文字列比較で行っている更新日時順の並べ替えが壊れる。
         *
         * 【java.timeを使わない理由】
         * minSdkは24のため、Instant等（API 26以降）はそのままでは使えない。
         */
        private const val ISO_8601_UTC = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"

        /**
         * 選択中のプロファイルで表示するショートカットの条件（?は選択中のプロファイルID 1個）
         *
         * 【何を出すか】
         * 選択中のプロファイルに紐づくもの（shortcut_profilesに行がある）と、
         * 紐づけが0件のもの（全プロファイル向け）の両方を出す。定型文のsnippet_profilesと同じ扱い。
         *
         * 【紐づけテーブルと結合せず副問い合わせで判定する理由】
         * 1件のショートカットは0件以上のプロファイルに紐づく。紐づけテーブルと結合すると、
         * 0件のものは結合で漏れ、複数に紐づくものは行（と値）が重複する。
         * 副問い合わせならshortcuts 1行につき判定は1回で、行は増えも減りもしない。
         *
         * 【外側の括弧を外さない理由】
         * 後ろにカテゴリの条件（AND s.categoryId = ?）を続けるため。括弧が無いと AND が OR より先に結び付き
         * 「紐づく OR (紐づけ0件 AND カテゴリ一致)」と解釈され、選択中のプロファイルに紐づくものが
         * カテゴリの絞り込みをすり抜けて出る。例外にならないため気付けない。
         *
         * 【文字列を変えるとき】
         * TypeScript版 ShortcutMapper.ts・iOS版 ShortcutMapper.swift の表示条件と1文字違わず同じにしている
         * （共有パッケージのテストが3実装のソースの一致を検査する）。変えるときは3か所を同時に直す。
         */
        private const val VISIBLE_IN_PROFILE_CONDITION = "(s.id IN (SELECT sp.shortcutId FROM shortcut_profiles sp WHERE sp.profileId = ?) OR NOT EXISTS (SELECT 1 FROM shortcut_profiles sp2 WHERE sp2.shortcutId = s.id))"
    }

    /**
     * 指定プロファイル・カテゴリのショートカットを取得
     *
     * 【何をするか】
     * shortcutsを表示条件（選択中のプロファイルに紐づくもの＋全プロファイル向け）とカテゴリで絞り、
     * sortOrder昇順で取得する。挿入する値は同じ行のvalueが持つため、1回のクエリで一覧に必要なものが揃う
     * （値は保存された文字列のまま。変数の展開は表示と挿入の時点で行う）。
     *
     * 【紐づけを表示条件で絞る理由】
     * 1件のショートカットは0件以上のプロファイルに紐づく（0件は全プロファイル向け）。
     * 紐づけテーブルと結合すると0件のものが漏れ、複数に紐づくものが重複するため、
     * 表示条件（companion objectの定数）の副問い合わせで判定する（TypeScript版 ShortcutMapper.ts と同じ条件）。
     *
     * 【カテゴリ未指定を全件にする理由】
     * カテゴリ選択の「すべて」に対応する。カテゴリはあとから付けられるもので、
     * 未分類（categoryIdがNULL）のショートカットも「すべて」では出す必要があるため、
     * 未指定のときは条件そのものを足さない。未分類だけを選ぶ絞り込みは設けていない。
     *
     * 【全件取得の口を残さない理由】
     * プロファイルを指定しない取得は「どの環境のものか分からない一覧」になり、
     * 拡張キーボードでは使い道がない。
     *
     * @param profileId 対象プロファイルのID
     * @param categoryId 対象カテゴリのID（nullは「すべて」＝カテゴリで絞らない）
     * @return ショートカット一覧（sortOrder順）
     */
    fun getAll(profileId: String, categoryId: String?): List<Shortcut> {
        /* WHERE句の?は表示条件の1個（profileId）→カテゴリ（categoryId）の順 */
        val categoryCondition = if (categoryId != null) "AND s.categoryId = ?" else ""
        val queryArgs = if (categoryId != null) arrayOf(profileId, categoryId) else arrayOf(profileId)

        /* 挿入する中身は shortcuts の value が1つの文字列として持つ。
           変数トークン（{{name}}）は展開せず、保存された文字列のまま返す。
           展開は表示と挿入の時点で、選択中のプロファイルと日時で行う
           （ShortcutAdapter の表示、ShortcutService.insertShortcut。定型文と同じ VariableReplacer を使う） */

        val shortcuts = mutableListOf<Shortcut>()

        /* SELECTの列順は iOS版 ShortcutMapper.swift の shortcutQuery と一致させている。
           3実装の並びを揃えておくと、以降の改修は2ファイルの見比べで済む。
           添字は下の読み出しと1対1で対応する（0:id, 1:name, 2:value, 3:useCount, 4:sortOrder,
           5:createdAt, 6:updatedAt, 7:categoryId）。列を足し引きすると以降の添字がすべてずれ、
           ずれてもコンパイルは通り名前の欄に別の値が出るだけで例外にならない。
           SELECTの列順はテーブル定義の列順と一致している必要はない */
        val query = """
            SELECT s.id, s.name, s.value, s.useCount, s.sortOrder, s.createdAt, s.updatedAt, s.categoryId
            FROM shortcuts s
            WHERE $VISIBLE_IN_PROFILE_CONDITION $categoryCondition
            ORDER BY s.sortOrder ASC
        """

        val cursor = executeQuery(query, queryArgs)
        cursor.use {
            while (it.moveToNext()) {
                shortcuts.add(
                    Shortcut(
                        id = it.getString(0),
                        categoryId = it.getStringOrNull(7),
                        name = it.getString(1),
                        value = it.getString(2),
                        useCount = it.getInt(3),
                        sortOrder = it.getInt(4),
                        createdAt = it.getString(5),
                        updatedAt = it.getString(6)
                    )
                )
            }
        }

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "Loaded ${shortcuts.size} shortcuts (profileId: $profileId, categoryId: $categoryId)")
        return shortcuts
    }

    /**
     * ショートカットの使用回数を1加算し、あわせて更新日時を進める
     *
     * 【目的】
     * 拡張キーボードから値を挿入したことを記録し、使用頻度順の一覧へ反映します。
     *
     * 【更新日時も進める理由】
     * メインアプリの一覧は更新日時で並べ替えられるため、使われたショートカットが
     * 古いままにならないようにする。TypeScript版 ShortcutMapper.incrementUseCount() と同じ動作。
     * 使用回数と更新日時が同じ行にあるため、1文のUPDATEで足りる。
     *
     * @param shortcutId 挿入したショートカットのID
     */
    fun incrementUseCount(shortcutId: String) {
        val incrementQuery = """
            UPDATE shortcuts
            SET useCount = useCount + 1, updatedAt = ?
            WHERE id = ?
        """

        executeUpdate(incrementQuery, arrayOf(currentTimestamp(), shortcutId))

        if (com.sikakou.cliptap.BuildConfig.DEBUG) Log.d(TAG, "✅ Incremented useCount for shortcut: $shortcutId")
    }

    /**
     * 現在時刻をメインアプリと同じ書式（UTCのISO 8601）で取得
     *
     * 【Locale.USを指定する理由】
     * 端末の暦がグレゴリオ暦以外（タイ仏暦など）の場合、既定ロケールでは年が変わってしまい、
     * メインアプリが保存した日時と比較できなくなる。
     */
    private fun currentTimestamp(): String {
        val formatter = SimpleDateFormat(ISO_8601_UTC, Locale.US)
        formatter.timeZone = TimeZone.getTimeZone("UTC")
        return formatter.format(Date())
    }
}
