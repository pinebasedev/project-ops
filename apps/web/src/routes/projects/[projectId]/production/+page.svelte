<script lang="ts">
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { shortSha } from '$lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let deployment = $derived(data.environment?.latestDeployment ?? null);
</script>

<div class="mx-auto max-w-2xl px-6 py-10">
	<a href="/projects/{data.project.id}" class="text-sm text-muted-foreground hover:text-foreground"
		>&larr; {data.project.name}</a
	>
	<h1 class="mt-2 text-2xl font-semibold text-foreground">Production</h1>
	<p class="mt-1 text-sm text-muted-foreground">
		What commit is currently running in production &mdash; the <span class="font-mono">main</span>
		branch, deployed on merge from <span class="font-mono">staging</span>.
	</p>

	{#if !data.environment || !deployment}
		<p
			class="mt-8 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
		>
			No production deployment yet.
		</p>
	{:else}
		<h2 class="mt-8 text-sm font-medium text-muted-foreground">Current deployment</h2>
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
					<dt class="text-muted-foreground">URL</dt>
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
			<div class="flex justify-between px-4 py-3 text-sm">
				<dt class="text-muted-foreground">Environment</dt>
				<dd>
					<a
						href="/projects/{data.project.id}/environments/{data.environment.id}"
						class="text-primary hover:underline">Deployment history &rarr;</a
					>
				</dd>
			</div>
		</dl>
	{/if}
</div>
