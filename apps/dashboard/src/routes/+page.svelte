<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="mx-auto max-w-3xl px-6 py-10">
	<h1 class="text-2xl font-semibold text-foreground">Projects</h1>
	<p class="mt-1 text-sm text-muted-foreground">
		Applications onboarded into the platform.
	</p>

	{#if data.projects.length === 0}
		<p class="mt-8 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
			No projects registered yet.
		</p>
	{:else}
		<ul class="mt-6 divide-y divide-border rounded-lg border border-border">
			{#each data.projects as project (project.id)}
				<li>
					<a
						href="/projects/{project.id}"
						class="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50"
					>
						<span class="font-medium text-foreground">{project.name}</span>
						<span class="text-muted-foreground">View environments &rarr;</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
