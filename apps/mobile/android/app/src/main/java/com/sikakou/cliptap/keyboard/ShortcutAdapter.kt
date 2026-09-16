package com.sikakou.cliptap.keyboard

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.sikakou.cliptap.R
import com.sikakou.cliptap.models.Shortcut
import com.sikakou.cliptap.utils.VariableReplacer

/**
 * ショートカット一覧を表示するRecyclerView用アダプター
 *
 * 【名前と値を両方出す理由】
 * 挿入されるのは値だけなので、選ぶ前に何が入力されるかを確かめられるようにする。
 * 名前（例: 携帯番号）だけでは、どの文字列が入るのか分からない。
 *
 * 【値を展開して表示する理由】
 * 挿入されるのは変数トークン（{{name}}）を展開した文字列のため、表示も選択中のプロファイルで展開する
 * （定型文一覧のタイトルを展開して出す SnippetAdapter と同じ）。
 */
class ShortcutAdapter(
    private val onShortcutClick: (Shortcut) -> Unit
) : ListAdapter<Shortcut, ShortcutAdapter.ShortcutViewHolder>(ShortcutDiffCallback()) {

    /** 表示用に値の変数トークンを展開する */
    private val variableReplacer = VariableReplacer()

    /**
     * 表示に使う、選択中のプロファイルの変数マップ（変数名 → 値）
     *
     * 一覧を出す直前に呼び出し側が読み直して入れる。
     * 行の表示はバインド時にこの値を読むため、submitList より前に入れること。
     */
    var variablesMap: Map<String, String> = emptyMap()

    /** 表示に使う、システム変数の書式（変数キー → パターン） */
    var systemVariableFormats: Map<String, String> = emptyMap()

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ShortcutViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_shortcut, parent, false)
        return ShortcutViewHolder(view, onShortcutClick)
    }

    override fun onBindViewHolder(holder: ShortcutViewHolder, position: Int) {
        val shortcut = getItem(position)
        holder.bind(shortcut, variableReplacer.replace(shortcut.value, variablesMap, systemVariableFormats))
    }

    class ShortcutViewHolder(
        itemView: View,
        private val onShortcutClick: (Shortcut) -> Unit
    ) : RecyclerView.ViewHolder(itemView) {

        private val nameTextView: TextView = itemView.findViewById(R.id.shortcutName)
        private val valueTextView: TextView = itemView.findViewById(R.id.shortcutValue)

        /** 現在この行が表示しているショートカット */
        private var currentShortcut: Shortcut? = null

        init {
            /* 行全体を1つのタッチ対象として扱う。
               バインドのたびにリスナーを作り直すとスクロール中に無駄なオブジェクトを生成するため、
               生成時に1回だけ設定して表示中のショートカットを参照する */
            itemView.setOnClickListener {
                currentShortcut?.let(onShortcutClick)
            }
        }

        /**
         * 行にショートカットを表示する
         *
         * @param shortcut 表示するショートカット
         * @param displayValue 変数トークンを展開した値（挿入されるのは展開前の文字列を挿入時に展開したもの）
         */
        fun bind(shortcut: Shortcut, displayValue: String) {
            currentShortcut = shortcut
            nameTextView.text = shortcut.name
            valueTextView.text = displayValue
        }
    }

    private class ShortcutDiffCallback : DiffUtil.ItemCallback<Shortcut>() {
        override fun areItemsTheSame(oldItem: Shortcut, newItem: Shortcut): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Shortcut, newItem: Shortcut): Boolean {
            return oldItem == newItem
        }
    }
}
