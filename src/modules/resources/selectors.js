import { get as g, isFunction } from 'lodash';
import invariant from 'invariant';
import hash from 'utils/hash';
import memoize from 'fast-memoize';
import { createSelector } from 'reselect';
import { entityDictionarySelector } from 'modules/entityStorage/selectors';
import denormalizeResource2 from 'modules/resources/utils/denormalizeResource2';
import findRelationLinkName from 'modules/resources/utils/findRelationLinkName';
import getIdPropertyName from 'modules/resources/utils/getIdPropertyName';
import resolveSubschema from 'modules/resources/utils/resolveSubschema';
import normalizeLink from 'modules/resources/utils/normalizeLink';
import type { ResourceLink } from 'modules/resources/types/ResourceLink';
import { INTERNAL_ID_PROPERTY_NAME } from 'modules/resources/constants';
import findResourceSchema from './utils/findResourceSchema';

export const resourcesModuleStateSelector = (state) => g(state, 'resources');
export const resourcesServiceSelector = (state) => g(state, 'resources.service', {});
export const pathsSelector = (state) => g(state, 'resources.paths');
export const definitionsSelector = (state) => g(state, 'resources.definitions');

export const normalizedLinkSelectorFactory = memoize(
	(link = {}) =>
		createSelector(
			(state) => g(state, 'resources.paths'),
			(paths) => {
				return normalizeLink(link, paths);
			}
		)
);

export const resolvedLinkSelectorFactory = memoize(
	(link = {}) =>
		createSelector(
			resourcesServiceSelector,
			(state) => g(state, 'resources'),
			(resourcesService, apiDescription) => {
				const { resolveResourceLink } = resourcesService;
				invariant(isFunction(resolveResourceLink), '`ResourcesService.resolveResourceLink` must be a Function!');
				return resolveResourceLink(link, apiDescription);
			}
		)
);

export const resourceSelectorFactory = memoize(
	(link = {}) => (state) => {
		return g(state, ['resources', 'resources', hash(link)]);
	}
);

export const resourceDataSelectorFactory = memoize(
	(link = {}) => (state) => {
		return g(state, ['entityStorage', 'entities', hash(link)]);
	}
);

export const relatedResourceSelectorFactory = (link = {}, rel) => (state) => {
	const definitions = definitionsSelector(state);
	const { params, resourceSchema } = resolvedLinkSelectorFactory(link)(state);

	let resourceSchemaRef = g(resourceSchema, '$ref', g(resourceSchema, 'items.$ref')); // TODO rename
	resourceSchemaRef = resourceSchemaRef.split('/');
	resourceSchemaRef.shift();
	resourceSchemaRef = resourceSchemaRef.join('.');
	const responseSchema = g(
		{ definitions },
		resourceSchemaRef
	);
	const relatedResourceLinkName = findRelationLinkName(responseSchema, rel);

	const relatedResourceLink = { name: relatedResourceLinkName, params };
	return g(state, ['resources', 'resources', hash(relatedResourceLink)]);
};

export const resourceSchemaSelectorFactory = memoize(
	(link: ResourceLink) =>
		createSelector(
			pathsSelector,
			definitionsSelector,
			(paths, definitions) => {
				if (!link) {
					return undefined;
				}
				return findResourceSchema(
					{
						paths,
						definitions,
						link,
					}
				);
			}
		)
);

export const denormalizedResourceSelectorFactory = memoize(
	(link: ResourceLink, maxLevel = 1) =>
		createSelector(
			pathsSelector,
			definitionsSelector,
			resourceSelectorFactory(link),
			entityDictionarySelector,
			(paths, definitions, resource, entityDictionary) => {
				if (!resource) {
					return undefined;
				}
				const resourceSchema = findResourceSchema(
					{
						paths,
						definitions,
						link,
					}
				);

				const content = denormalizeResource2(
					resourceSchema,
					paths,
					entityDictionary,
					maxLevel,
					link,
				);
				return {
					...resource,
					content,
				};
			}
		)
);
