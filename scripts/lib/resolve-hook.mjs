// Node resolve hook: lets the TypeScript sources of `src/lib/contracts` be imported
// without the `.ts` extension, the way Vite and Vitest resolve them.
export async function resolve(specifier, context, nextResolve) {
	try {
		return await nextResolve(specifier, context);
	} catch (error) {
		const relative = specifier.startsWith('.') || specifier.startsWith('/');
		if (relative && error?.code === 'ERR_MODULE_NOT_FOUND' && !/\.\w+$/.test(specifier)) {
			return nextResolve(`${specifier}.ts`, context);
		}
		throw error;
	}
}
