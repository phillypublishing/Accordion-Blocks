// Keep the REST boundary aligned with the five settings in block.json.
export const DEFAULT_SETTINGS = {
	initiallyOpen: false,
	clickToClose: true,
	autoClose: true,
	scroll: false,
	scrollOffset: 0,
};

export function normalizeDefaults(value) {
	const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
	return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => {
		const candidate = input[key];
		const valid = typeof fallback === 'boolean'
			? typeof candidate === 'boolean'
			: typeof candidate === 'number' && Number.isFinite(candidate);
		return [key, valid ? candidate : fallback];
	}));
}

export function getNewItemDefaults(initial, current, defaults) {
	const keys = Object.keys(DEFAULT_SETTINGS);
	if (keys.some((key) => current[key] !== initial[key])) {
		return null;
	}
	const settings = normalizeDefaults(defaults);
	for (const key of keys) {
		if (initial[key] !== undefined && initial[key] !== DEFAULT_SETTINGS[key]) {
			settings[key] = initial[key];
		}
	}
	return settings;
}
