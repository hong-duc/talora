<script lang="ts">
	import commands from "../../commands/toolbar-commands.js";
	import BubbleMenu from "../../components/BubbleMenu.svelte";
	import type { EdraToolbarProps, ShouldShowProps } from "../../types.js";

	import { isTextSelection } from "@tiptap/core";
	import FontSize from "../components/toolbar/FontSize.svelte";
	import QuickColors from "../components/toolbar/QuickColors.svelte";
	import ToolBarIcon from "../components/ToolBarIcon.svelte";

	const {
		editor,
		class: className,
		excludedCommands = ["undo-redo", "headings", "media", "lists", "table"],
	}: EdraToolbarProps = $props();

	const toolbarCommands = Object.keys(commands).filter(
		(key) => !excludedCommands?.includes(key),
	);

	let isDragging = $state(false);

	// Use $effect so the editor prop is accessed reactively and listeners are
	// properly cleaned up when the component is destroyed.
	$effect(() => {
		const dom = editor.view.dom;

		const handleDragStart = () => {
			isDragging = true;
		};

		const handleDrop = () => {
			isDragging = true;
			// Allow some time for the drop action to complete before re-enabling
			setTimeout(() => {
				isDragging = false;
			}, 100); // Adjust delay if needed
		};

		dom.addEventListener("dragstart", handleDragStart);
		dom.addEventListener("drop", handleDrop);

		return () => {
			dom.removeEventListener("dragstart", handleDragStart);
			dom.removeEventListener("drop", handleDrop);
		};
	});

	function shouldShow(props: ShouldShowProps) {
		if (!props.editor.isEditable) return false;
		const { view, editor } = props;
		if (!view || editor.view.dragging) {
			return false;
		}
		if (editor.isActive("link")) return false;
		if (editor.isActive("codeBlock")) return false;
		if (editor.isActive("image-placeholder")) return false;
		if (editor.isActive("video-placeholder")) return false;
		if (editor.isActive("audio-placeholder")) return false;
		if (editor.isActive("iframe-placeholder")) return false;
		const {
			state: {
				doc,
				selection,
				selection: { empty, from, to },
			},
		} = editor;
		// check if the selection is a table grip
		const domAtPos = view.domAtPos(from || 0).node as HTMLElement;
		const nodeDOM = view.nodeDOM(from || 0) as HTMLElement;
		const node = nodeDOM || domAtPos;

		if (isTableGripSelected(node)) {
			return false;
		}
		// Sometime check for `empty` is not enough.
		// Doubleclick an empty paragraph returns a node size of 2.
		// So we check also for an empty text size.
		const isEmptyTextBlock =
			!doc.textBetween(from, to).length && isTextSelection(selection);
		if (empty || isEmptyTextBlock || !editor.isEditable) {
			return false;
		}
		return !isDragging && !editor.state.selection.empty;
	}

	const isTableGripSelected = (node: HTMLElement) => {
		let container = node;
		while (container && !["TD", "TH"].includes(container.tagName)) {
			container = container.parentElement!;
		}
		const gripColumn =
			container &&
			container.querySelector &&
			container.querySelector("a.grip-column.selected");
		const gripRow =
			container &&
			container.querySelector &&
			container.querySelector("a.grip-row.selected");
		if (gripColumn || gripRow) {
			return true;
		}
		return false;
	};
</script>

<BubbleMenu
	{editor}
	class={className}
	pluginKey="link-bubble-menu"
	{shouldShow}
>
	{#each toolbarCommands.filter((c) => !excludedCommands?.includes(c)) as cmd (cmd)}
		{@const commandGroup = commands[cmd]}
		{#each commandGroup as command (command)}
			<ToolBarIcon {editor} {command} />
		{/each}
	{/each}
	<FontSize {editor} />
	<QuickColors {editor} />
</BubbleMenu>
