<script lang="ts">
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { environmentTitle, formatEventTimestamp, shortSha } from '$lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let deployment = $derived(data.environment.latestDeployment);
</script>

{#snippet notice(message: string, tone: 'muted' | 'warn' = 'muted')}
	<p
		class="mt-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground {tone ===
		'warn'
			? 'border-amber-300 dark:border-amber-900'
			: 'border-border'}"
	>
		{message}
	</p>
{/snippet}

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
		{@render notice('This environment has no deployments yet.')}
	{/if}

	<h2 class="mt-8 text-sm font-medium text-muted-foreground">Recent errors</h2>
	<p class="mt-1 text-xs text-muted-foreground">
		Error-level logs from this environment's Worker since its latest deployment, read live from
		Cloudflare's observability &mdash; nothing is stored.
	</p>

	{#await data.recentErrors}
		{@render notice('Loading errors…')}
	{:then result}
		{#if result.state === 'not-configured'}
			{@render notice(
				"The control plane has no Cloudflare API credentials configured, so it can't query observability."
			)}
		{:else if result.state === 'unavailable'}
			{@render notice("Couldn't reach Cloudflare's Telemetry API. Try again shortly.", 'warn')}
		{:else if result.since === null}
			{@render notice('No deployment yet — nothing to report.')}
		{:else if result.errors.length === 0}
			<p class="mt-3 rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
				No errors since {formatEventTimestamp(result.since)}.
			</p>
		{:else}
			<p class="mt-3 text-xs text-muted-foreground">
				<span class="font-mono">{result.workerName}</span> &middot; since
				{formatEventTimestamp(result.since)}
			</p>
			<ul class="mt-2 space-y-2">
				{#each result.errors as error, i (i)}
					<li class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950">
						<div class="flex items-baseline justify-between gap-3">
							<span class="font-mono text-xs text-muted-foreground"
								>{formatEventTimestamp(error.timestamp)}</span
							>
							{#if error.requestId}
								<span class="shrink-0 font-mono text-xs text-muted-foreground"
									>req {error.requestId}</span
								>
							{/if}
						</div>
						<p class="mt-1 font-mono text-foreground break-words">{error.message}</p>
					</li>
				{/each}
			</ul>
		{/if}
	{/await}
</div>
