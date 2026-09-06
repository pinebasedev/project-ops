<script lang="ts">
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { environmentTitle, shortSha } from '$lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let deployment = $derived(data.environment.latestDeployment);
</script>

<div class="mx-auto max-w-2xl px-6 py-10">
	<a
		href="/projects/{data.projectId}"
		class="text-sm text-muted-foreground hover:text-foreground">&larr; Environments</a
	>
	<h1 class="mt-2 text-2xl font-semibold text-foreground">
		{environmentTitle(data.environment, deployment)}
	</h1>
	<p class="mt-1 text-sm text-muted-foreground">
		{data.environment.kind} &middot; stage <span class="font-mono">{data.environment.stageName}</span>
	</p>

	<h2 class="mt-8 text-sm font-medium text-muted-foreground">Latest deployment</h2>
	{#if deployment}
		<dl class="mt-3 divide-y divide-border rounded-lg border border-border">
			<div class="flex justify-between px-4 py-3 text-sm">
				<dt class="text-muted-foreground">Status</dt>
				<dd><StatusPill status={deployment.status} /></dd>
			</div>
			<div class="flex justify-between px-4 py-3 text-sm">
				<dt class="text-muted-foreground">Commit</dt>
				<dd class="font-mono text-foreground" title={deployment.commitSha}>
					{shortSha(deployment.commitSha)}
				</dd>
			</div>
			{#if deployment.previewUrl}
				<div class="flex justify-between gap-4 px-4 py-3 text-sm">
					<dt class="text-muted-foreground">Preview</dt>
					<dd class="truncate">
						<a
							href={deployment.previewUrl}
							target="_blank"
							rel="noreferrer"
							class="text-primary hover:underline">{deployment.previewUrl}</a
						>
					</dd>
				</div>
			{/if}
		</dl>
	{:else}
		<p class="mt-3 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
			This environment has no deployments yet.
		</p>
	{/if}
</div>
