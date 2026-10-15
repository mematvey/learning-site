<script lang="ts">
	import '../app.css';
	import '@fontsource/literata/cyrillic-500.css';
	import '@fontsource/literata/cyrillic-600.css';
	import '@fontsource/literata/cyrillic-700.css';
	import '@fontsource/literata/latin-500.css';
	import '@fontsource/literata/latin-600.css';
	import '@fontsource/literata/latin-700.css';
	import '@fontsource-variable/inter';
	import '@fontsource/jetbrains-mono/400.css';
	import '@fontsource/jetbrains-mono/500.css';

	let { children } = $props();
</script>

{@render children()}
