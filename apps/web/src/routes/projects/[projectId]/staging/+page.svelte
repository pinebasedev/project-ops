<script lang="ts">
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { githubCompareUrl, integrationTestPresentation, shortSha } from '$lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let deployment = $derived(data.environment?.latestDeployment ?? null);
	let integrationTests = $derived(deployment ? integrationTestPresentation(deployment) : null);
	// Reported and at least one test failed — the "don't promote" state.
	let failing = $derived(integrationTests?.failing === true);
	// "What would promoting this ship?" — staging's commit against production's.
	// Null unless the project has a repo slug and both have deployed.
	let compareUrl = $derived(
		githubCompareUrl(
			data.project.githubRepo,
			data.productionDeployment?.commitSha,
			deployment?.commitSha
		)
	);
</script>

<div class="mx-auto max-w-2xl px-6 py-10">
	<a href="/projects/{data.project.id}" class="text-sm text-muted-foreground hover:text-foreground"
		>&larr; {data.project.name}</a
	>
	<h1 class="mt-2 text-2xl font-semibold text-foreground">Staging</h1>
	<p class="mt-1 text-sm text-muted-foreground">
		What's running on <span class="font-mono">staging</span>, and whether its Integration Tests
		passed &mdash; check this before promoting to production.
	</p>

	{#if !data.environment || !deployment}
		<p
			class="mt-8 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
		>
			No staging deployment yet.
		</p>
	{:else}
		<section
			class="mt-8 rounded-lg border p-5"
			class:border-border={!failing}
			class:bg-card={!failing}
			class:border-red-300={failing}
			class:bg-red-50={failing}
			class:dark:border-red-900={failing}
			class:dark:bg-red-950={failing}
		>
			<h2 class="text-sm font-medium text-muted-foreground">Integration Tests</h2>
			<p class="mt-2">
				<span class="rounded-full px-2.5 py-1 text-sm font-medium {integrationTests?.badgeClass}">
					{integrationTests?.label}
				</span>
			</p>
			{#if !integrationTests?.reported}
				<p class="mt-2 text-xs text-muted-foreground">
					The live suite runs once against staging after a merge. No result has been reported for
					this deployment.
				</p>
			{/if}
			{#if deployment.integrationTestsRunUrl}
				<a
					href={deployment.integrationTestsRunUrl}
					target="_blank"
					rel="noreferrer"
					class="mt-3 inline-block text-sm text-primary hover:underline"
				>
					View the Actions run &rarr;
				</a>
			{/if}
		</section>

		{#if compareUrl}
			<a
				href={compareUrl}
				target="_blank"
				rel="noreferrer"
				class="mt-4 inline-block text-sm text-primary hover:underline"
			>
				Compare with production &mdash; what promotion would ship &rarr;
			</a>
		{/if}

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
