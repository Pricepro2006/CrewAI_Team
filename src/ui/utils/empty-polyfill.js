// Empty polyfill for Node.js modules in browser environment
// This prevents "Module has been externalized for browser compatibility" errors

export default {};
export const promises = {};
export const readFile = () => {};
export const writeFile = () => {};
export const mkdir = () => {};
export const existsSync = () => false;
export const createReadStream = () => {};
export const createWriteStream = () => {};
export const join = (...args) => args.join('/');
export const resolve = (...args) => args.join('/');
export const dirname = (path) => path;
export const extname = (path) => '';
export const basename = (path) => path;
export const randomBytes = () => new Uint8Array(0);
export const createHash = () => ({ update: () => {}, digest: () => '' });