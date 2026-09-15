package com.sikakou.cliptap.keyboard

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.sikakou.cliptap.R
import com.sikakou.cliptap.models.ShortcutValue
import com.sikakou.cliptap.utils.VariableReplacer

/**
 * ショートカット値の一覧を表示するRecyclerView用アダプター
 *
 * 【値名と値を両方出す理由】
 * 挿入されるのは値だけなので、選ぶ前に何が入力されるかを確かめられるようにする。
 * 値名（例: 母）だけでは、どの文字列が入るのか分からない。
 *
 * 【値を展開して表示する理由】
 * 挿入されるのは変数トークン（{{name}}）を展開した文字列のため、表示も選択中のプロファイルで展開する
 * （定型文一覧のタイトルを展開して出す SnippetAdapter と同じ）。
 */
class ShortcutValueAdapter(
    private val onValueClick: (ShortcutValue) -> Unit
) : ListAdapter<ShortcutValue, ShortcutValueAdapter.ShortcutValueViewHolder>(ShortcutValueDiffCallback()) {

    /** 表示用に値の変数トークンを展開する */
    private val variableReplacer = VariableReplacer()

    /**
     * 表示に使う、選択中のプロファイルの変数マップ（変数名 → 値）
     *
     * 一覧を出す直前に呼び出し側が読み直して入れる。
     * 行の表示はバインド時にこの値を読むため、アダプターを付け直す（setAdapter）か submitList より前に入れること。
     */
    var variablesMap: Map<String, String> = emptyMap()

    /** 表示に使う、システム変数の書式（変数キー → パターン） */
    var systemVariableFormats: Map<String, String> = emptyMap()

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ShortcutValueViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_shortcut_value, parent, false)
        return ShortcutValueViewHolder(view, onValueClick)
    }

    override fun onBindViewHolder(holder: ShortcutValueViewHolder, position: Int) {
        val value = getItem(position)
        holder.bind(value, variableReplacer.replace(value.value, variablesMap, systemVariableFormats))
    }

    class ShortcutValueViewHolder(
        itemView: View,
        private val onValueClick: (ShortcutValue) -> Unit
    ) : RecyclerView.ViewHolder(itemView) {

        private val nameTextView: TextView = itemView.findViewById(R.id.shortcutValueName)
        private val valueTextView: TextView = itemView.findViewById(R.id.shortcutValueContent)

        /** 現在この行が表示しているショートカット値 */
        private var currentValue: ShortcutValue? = null

        init {
            /* 行全体を1つのタッチ対象として扱う。
               バインドのたびにリスナーを作り直すとスクロール中に無駄なオブジェクトを生成するため、
               生成時に1回だけ設定して表示中の値を参照する */
            itemView.setOnClickListener {
                currentValue?.let(onValueClick)
            }
        }

        /**
         * 行に値を表示する
         *
         * @param value 表示するショートカット値（タップで挿入する対象。変数トークンは未展開）
         * @param displayValue 選択中のプロファイルで変数トークンを展開した表示用の文字列
         */
        fun bind(value: ShortcutValue, displayValue: String) {
            currentValue = value
            nameTextView.text = value.name
            valueTextView.text = displayValue
        }
    }

    private class ShortcutValueDiffCallback : DiffUtil.ItemCallback<ShortcutValue>() {
        override fun areItemsTheSame(oldItem: ShortcutValue, newItem: ShortcutValue): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: ShortcutValue, newItem: ShortcutValue): Boolean {
            return oldItem == newItem
        }
    }
}
