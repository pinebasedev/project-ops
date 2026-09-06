<script lang="ts">
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { environmentTitle, shortSha } from '$lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Most recently deployed first; environments with no deployment sort last.
	let environments = $derived(
		[...data.environments].sort((a, b) =>
			(b.latestDeployment?.createdAt ?? '').localeCompare(a.latestDeployment?.createdAt ?? '')
		)
	);
</script>

<div class="mx-auto max-w-4xl px-6 py-10">
	<a href="/" class="text-sm text-muted-foreground hover:text-foreground">&larr; Projects</a>
	<h1 class="mt-2 text-2xl font-semibold text-foreground">{data.project.name}</h1>
	<div class="mt-1 flex items-center justify-between gap-4">
		<p class="text-sm text-muted-foreground">Ephemeral environments, one per pull request.</p>
		<a
			href="/projects/{data.project.id}/staging"
			class="shrink-0 text-sm text-primary hover:underline">Staging status &rarr;</a
		>
	</div>

	{#if environments.length === 0}
		<p
			class="mt-8 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
		>
			No PR environments.
		</p>
	{:else}
		<ul class="mt-6 space-y-3">
			{#each environments as environment (environment.id)}
				{@const deployment = environment.latestDeployment}
				<li class="rounded-lg border border-border bg-card p-4">
					<div class="flex items-start justify-between gap-4">
						<div>
							<a
								href="/projects/{data.project.id}/environments/{environment.id}"
								class="font-medium text-foreground hover:underline"
							>
								{environmentTitle(environment, deployment)}
							</a>
							<p class="mt-1 font-mono text-xs text-muted-foreground">
								{deployment ? shortSha(deployment.commitSha) : 'no deployment yet'}
							</p>
						</div>
						<StatusPill status={deployment?.status} />
					</div>

					{#if deployment?.previewUrl}
						<a
							href={deployment.previewUrl}
							target="_blank"
							rel="noreferrer"
							class="mt-3 inline-block text-sm text-primary hover:underline"
						>
							{deployment.previewUrl}
						</a>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
