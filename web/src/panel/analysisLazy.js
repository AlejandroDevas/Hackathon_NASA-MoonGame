/**
 * The Analysis window, loaded the first time it is opened. It is a large module that most visits
 * never use, so it stays out of the first download; the API is the one of `createAnalysis`.
 * @param {...unknown} args the arguments of `createAnalysis` (store, siteList, sites)
 */
export function createLazyAnalysis(...args) {
  let window_ = null; // the real analysis, once loaded
  let loading = null;

  function load() {
    loading ??= import('./analysis.js').then((module) => {
      window_ = module.createAnalysis(...args);
      return window_;
    });
    return loading;
  }

  return {
    /** Load the window if needed and open it. Resolves once it is open (and rejects if the module cannot load). */
    open: () => load().then((analysis) => analysis.open()),
    close: () => window_?.close(),
    isOpen: () => window_?.isOpen() ?? false,
    dispose() {
      window_?.dispose();
      window_ = null;
      loading = null;
    },
  };
}
