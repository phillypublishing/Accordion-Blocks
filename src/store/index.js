/**
 * WordPress dependencies
 */
import { createReduxStore, register } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';
import { DEFAULT_SETTINGS, normalizeDefaults } from '../utils/defaults';

const initialState = {
	defaults: DEFAULT_SETTINGS,
};

const actions = {
	setDefaults(defaults) {
		return {
			type: 'SET_DEFAULTS',
			defaults,
		};
	},
	saveDefaultSettings(defaults) {
		return {
			type: 'SAVE_DEFAULTS',
			defaults,
		};
	},
	fetchFromAPI(path) {
		return {
			type: 'FETCH_FROM_API',
			path,
		};
	},
};

const store = createReduxStore('accordion-blocks', {
	reducer(state = initialState, action) {
		switch (action.type) {
			case 'SET_DEFAULTS':
				return Object.assign({}, state, {
					defaults: normalizeDefaults(action.defaults)
				});
			case 'SAVE_DEFAULTS':
				apiFetch({
					path: 'accordion-blocks/v1/defaults',
					data: normalizeDefaults(action.defaults),
					method: 'POST',
				})
				.then((response) => {})
				.catch((error) => {});

				return Object.assign({}, state, {
					defaults: normalizeDefaults(action.defaults)
				});
			default:
				return state;
		}
	},

	actions,

	selectors: {
		getDefaultSettings(state) {
			return state.defaults;
		},
	},

	controls: {
		FETCH_FROM_API(action) {
			return apiFetch({
				path: action.path
			});
		},
	},

	resolvers: {
		* getDefaultSettings() {
			const path = '/accordion-blocks/v1/defaults';
			const defaults = yield actions.fetchFromAPI(path);

			return actions.setDefaults(defaults);
		},
	},
});

register(store);
