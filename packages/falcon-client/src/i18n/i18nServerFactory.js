import i18next from 'i18next';
import Backend from 'i18next-sync-fs-backend';

/**
 * @typedef {object} Options
 * @property {string} lng - language
 * @property {string} fallbackLng fallback language
 * @property {string[]} whitelist languages whitelist
 * @property {object} resources Initial internationalization resources
 */

/**
 * i18next instance server side factory
 * @argument {Options} options - options
 * @returns {object} - next middleware or redirect
 */
export default ({ lng = 'en', fallbackLng = 'en', whitelist = ['en'], debug = false, resources } = {}) => {
  const defaultNS = 'translations';

  return i18next.use(Backend).init({
    lng,
    ns: [defaultNS],
    fallbackLng,
    whitelist,
    defaultNS,
    fallbackNS: defaultNS,
    saveMissing: false,
    initImmediate: false,
    resources,
    debug,
    react: {
      wait: true,
      nsMode: 'fallback'
    },
    interpolation: {
      escapeValue: false
    },
    backend: {
      loadPath: 'build/i18n/{{lng}}/{{ns}}.json',
      jsonIndent: 2
    }
  });
};

export function filterResourceStoreByNs(storeData, namespaces) {
  const i18nResourceStore = {};
  Object.keys(storeData).forEach(lng => {
    i18nResourceStore[lng] = Object.keys(storeData[lng])
      .filter(ns => !namespaces.length || namespaces.find(x => x === ns))
      .reduce(
        (result, ns) => ({
          ...result,
          [ns]: storeData[lng][ns]
        }),
        {}
      );
  });

  return i18nResourceStore;
}

export function extractI18nextState(ctx) {
  const { i18nextUsedNamespaces = [] } = ctx.state;

  if (ctx.i18next) {
    const { data } = ctx.i18next.services.resourceStore;

    return {
      language: ctx.i18next.language,
      data: filterResourceStoreByNs(data, i18nextUsedNamespaces)
    };
  }

  return {};
}
