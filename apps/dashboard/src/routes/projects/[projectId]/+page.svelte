<script lang="ts">
	import { shortSha, statusPresentation } from '$lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Newest PRs first; environments without a deployment sort last.
	let environments = $derived(
		[...data.environments].sort(
			(a, b) => (b.latestDeployment?.prNumber ?? -1) - (a.latestDeployment?.prNumber ?? -1)
		)
	);
</script>

<div class="mx-auto max-w-4xl px-6 py-10">
	<a href="/" class="text-sm text-muted-foreground hover:text-foreground">&larr; Projects</a>
	<h1 class="mt-2 text-2xl font-semibold text-foreground">{data.project.name}</h1>
	<p class="mt-1 text-sm text-muted-foreground">Active PR environments.</p>

	{#if environments.length === 0}
		<p
			class="mt-8 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
		>
			No active PR environments.
		</p>
	{:else}
		<ul class="mt-6 space-y-3">
			{#each environments as environment (environment.id)}
				{@const deployment = environment.latestDeployment}
				{@const status = statusPresentation(deployment?.status)}
				<li class="rounded-lg border border-border bg-card p-4">
					<div class="flex items-start justify-between gap-4">
						<div>
							<a
								href="/projects/{data.project.id}/environments/{environment.id}"
								class="font-medium text-foreground hover:underline"
							>
								{deployment?.prNumber != null
									? `PR #${deployment.prNumber}`
									: environment.stageName}
							</a>
							<p class="mt-1 font-mono text-xs text-muted-foreground">
								{deployment ? shortSha(deployment.commitSha) : 'no deployment yet'}
							</p>
						</div>
						<span
							class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {status.badgeClass}"
						>
							{status.label}
						</span>
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
