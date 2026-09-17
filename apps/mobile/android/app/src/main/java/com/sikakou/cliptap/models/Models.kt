package com.sikakou.cliptap.models

/**
 * プロファイル（環境）
 */
data class Profile(
    val id: String,
    val name: String,
    val isActive: Boolean,
    val isDefault: Boolean,
    val valid: Boolean,
    val sortOrder: Int,
    val createdAt: String,
    val updatedAt: String
)

/**
 * カテゴリ
 */
data class Category(
    val id: String,
    val name: String,
    val color: String?,
    val sortOrder: Int,
    val createdAt: String
)

/**
 * スニペット
 */
data class Snippet(
    val id: String,
    val title: String?,
    val content: String,
    val categoryId: String?,
    val copyWithTitle: Boolean,
    val copyCount: Int,      /* コピー回数（使用頻度ソート用） */
    val createdAt: String,
    val updatedAt: String
)

/**
 * 変数
 */
data class Variable(
    val id: String,
    val name: String,
    val type: String,
    val defaultValue: String?,
    val valid: Boolean,
    val sortOrder: Int,
    val createdAt: String,
    val updatedAt: String
)

/**
 * プロファイル変数
 */
data class ProfileVariable(
    val profileId: String,
    val variableId: String,
    val value: String
)

/**
 * ショートカット値
 *
 * 【値に名前を持たせない理由】
 * 何の値かはショートカット名（例: 携帯番号）が表す。値は登録順に並ぶだけとする。
 * valueは保存された文字列で、変数トークン（{{name}}）は未展開のまま持つ。
 * 定型文と同じく、表示と挿入の時点で選択中のプロファイルの値へ展開する。
 *
 * 【isMaskedについて】
 * 表示だけを伏せる指定。挿入するのは伏せていてもvalueそのもので、隠れるのは画面に出す文字だけ。
 *
 * 【対応するTypeScript型】
 * packages/shared/src/types/shortcut.ts の ShortcutValue と同じ列構成
 */
data class ShortcutValue(
    val id: String,
    val shortcutId: String,
    val value: String,
    val isMasked: Boolean,   /* 表示を伏せるか（SQLiteでは0/1で格納） */
    val useCount: Int,       /* コピーと拡張キーボードからの挿入の回数（使用頻度順の一覧に使う） */
    val sortOrder: Int,      /* 同一ショートカット内での並び順（0始まり） */
    val createdAt: String,
    val updatedAt: String
)

/**
 * マスク表示に使う文字列
 *
 * 値の長さが伝わらないよう、実際の文字数によらず固定長にしてある。
 * アプリ・Web・iOS版と同じ見た目にするため、同じ文字列を持つ
 * （packages/shared/src/shortcuts/display.ts の MASKED_VALUE_TEXT）。
 */
const val MASKED_VALUE_TEXT = "••••••••"

/**
 * ショートカット
 *
 * 【対応するTypeScript型】
 * packages/shared/src/types/shortcut.ts の Shortcut と同じ列構成
 */
data class Shortcut(
    val id: String,
    /* 紐づくプロファイル（0件以上。0件は全プロファイル向け）は shortcut_profiles が持つため、この型は持たない。
       キーボードは取得時に選択中のプロファイルで絞り込むだけで、紐づけそのものを参照しない（iOS版のShortcutと同じ構成） */
    val categoryId: String?,         /* 所属するカテゴリID（未分類はnull）。カテゴリは定型文と共用 */
    val name: String,
    val values: List<ShortcutValue>, /* 所属する値（sortOrder順） */
    val sortOrder: Int,              /* 一覧での並び順（0始まり） */
    val createdAt: String,
    val updatedAt: String
)
