<script lang="ts">
	import { NodeViewWrapper } from "svelte-tiptap";
	import type { NodeViewProps } from "@tiptap/core";
	import MediaExtended from "./MediaExtended.svelte";

	const { ...rest }: NodeViewProps = $props();

	let mediaRef = $state<HTMLElement>();
</script>

<NodeViewWrapper>
	<MediaExtended bind:mediaRef {...rest}>
		{@const node = rest.node}
		<img
			bind:this={mediaRef}
			src={node.attrs.src}
			alt={node.attrs.alt}
			title={node.attrs.title}
		/>
	</MediaExtended>
</NodeViewWrapper>
