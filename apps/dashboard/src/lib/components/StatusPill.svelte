<script lang="ts">
	import { statusPresentation } from '$lib/format';

	let { status }: { status: string | null | undefined } = $props();

	let presentation = $derived(statusPresentation(status));
</script>

<span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {presentation.badgeClass}">
	{presentation.label}
</span>
