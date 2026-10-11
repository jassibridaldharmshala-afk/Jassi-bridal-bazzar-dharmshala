// CRA's Jest resolver predates this dependency's conditional package exports.
jest.mock('@standard-schema/utils', () => jest.requireActual('../node_modules/@standard-schema/utils/dist/index.cjs'));
