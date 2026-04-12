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
		<iframe bind:this={mediaRef} {...node.attrs}> </iframe>
	</MediaExtended>
</NodeViewWrapper>
