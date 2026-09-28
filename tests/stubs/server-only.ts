// `server-only` throws outside a React-server environment. Unit tests run plain Node, so the
// module is aliased here (vitest.config.mts). The modules it guards are still server-only: the
// alias exists for the test runner, never for a bundle.
const serverOnly = {};
export default serverOnly;
