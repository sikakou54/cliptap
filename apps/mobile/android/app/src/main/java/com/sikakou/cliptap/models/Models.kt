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
 * ショートカット
 *
 * 【nameとvalueの違い】
 * nameは一覧で選ぶための名称（例: 携帯番号）で、挿入されるのはvalue（例: 090-0000-0000）のみ。
 * valueは保存された文字列で、変数トークン（{{name}}）は未展開のまま持つ。
 * 定型文と同じく、表示と挿入の時点で選択中のプロファイルの値へ展開する。
 *
 * 【対応するTypeScript型】
 * packages/shared/src/types/shortcut.ts の ShortcutRow と同じ列構成
 */
data class Shortcut(
    val id: String,
    /* 紐づくプロファイル（0件以上。0件は全プロファイル向け）は shortcut_profiles が持つため、この型は持たない。
       キーボードは取得時に選択中のプロファイルで絞り込むだけで、紐づけそのものを参照しない（iOS版のShortcutと同じ構成） */
    val categoryId: String?,  /* 所属するカテゴリID（未分類はnull）。カテゴリは定型文と共用 */
    val name: String,         /* 一覧で選ぶための名称（例: 携帯番号）。挿入されるのはvalueのみ */
    val value: String,        /* 挿入する文字列（例: 090-0000-0000）。変数トークン（{{name}}）は未展開のまま持ち、表示と挿入の時点で展開する */
    val useCount: Int,        /* コピーと拡張キーボードからの挿入の回数（使用頻度順の一覧に使う） */
    val sortOrder: Int,       /* 一覧での並び順（0始まり） */
    val createdAt: String,
    val updatedAt: String
)
