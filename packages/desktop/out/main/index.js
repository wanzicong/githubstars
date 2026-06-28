//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esmMin = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var __toCommonJS = (mod) => __hasOwnProp.call(mod, "module.exports") ? mod["module.exports"] : __copyProps(__defProp({}, "__esModule", { value: true }), mod);
//#endregion
let electron = require("electron");
let node_path = require("node:path");
//#region ../../node_modules/@electron-toolkit/utils/dist/index.mjs
var is = { dev: !electron.app.isPackaged };
var platform = {
	isWindows: process.platform === "win32",
	isMacOS: process.platform === "darwin",
	isLinux: process.platform === "linux"
};
var electronApp = {
	setAppUserModelId(id) {
		if (platform.isWindows) electron.app.setAppUserModelId(is.dev ? process.execPath : id);
	},
	setAutoLaunch(auto) {
		if (platform.isLinux) return false;
		const isOpenAtLogin = () => {
			return electron.app.getLoginItemSettings().openAtLogin;
		};
		if (isOpenAtLogin() !== auto) {
			electron.app.setLoginItemSettings({
				openAtLogin: auto,
				path: process.execPath
			});
			return isOpenAtLogin() === auto;
		} else return true;
	},
	skipProxy() {
		return electron.session.defaultSession.setProxy({ mode: "direct" });
	}
};
var optimizer = {
	watchWindowShortcuts(window, shortcutOptions) {
		if (!window) return;
		const { webContents } = window;
		const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
		webContents.on("before-input-event", (event, input) => {
			if (input.type === "keyDown") {
				if (!is.dev) {
					if (input.code === "KeyR" && (input.control || input.meta)) event.preventDefault();
				} else if (input.code === "F12") if (webContents.isDevToolsOpened()) webContents.closeDevTools();
				else {
					webContents.openDevTools({ mode: "undocked" });
					console.log("Open dev tool...");
				}
				if (escToCloseWindow) {
					if (input.code === "Escape" && input.key !== "Process") {
						window.close();
						event.preventDefault();
					}
				}
				if (!zoom) {
					if (input.code === "Minus" && (input.control || input.meta)) event.preventDefault();
					if (input.code === "Equal" && input.shift && (input.control || input.meta)) event.preventDefault();
				}
			}
		});
	},
	registerFramelessWindowIpc() {
		electron.ipcMain.on("win:invoke", (event, action) => {
			const win = electron.BrowserWindow.fromWebContents(event.sender);
			if (win) {
				if (action === "show") win.show();
				else if (action === "showInactive") win.showInactive();
				else if (action === "min") win.minimize();
				else if (action === "max") if (win.isMaximized()) win.unmaximize();
				else win.maximize();
				else if (action === "close") win.close();
			}
		});
	}
};
//#endregion
//#region ../../node_modules/is-obj/index.js
var require_is_obj = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = (value) => {
		const type = typeof value;
		return value !== null && (type === "object" || type === "function");
	};
}));
//#endregion
//#region ../../node_modules/dot-prop/index.js
var require_dot_prop = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isObj = require_is_obj();
	var disallowedKeys = new Set([
		"__proto__",
		"prototype",
		"constructor"
	]);
	var isValidPath = (pathSegments) => !pathSegments.some((segment) => disallowedKeys.has(segment));
	function getPathSegments(path) {
		const pathArray = path.split(".");
		const parts = [];
		for (let i = 0; i < pathArray.length; i++) {
			let p = pathArray[i];
			while (p[p.length - 1] === "\\" && pathArray[i + 1] !== void 0) {
				p = p.slice(0, -1) + ".";
				p += pathArray[++i];
			}
			parts.push(p);
		}
		if (!isValidPath(parts)) return [];
		return parts;
	}
	module.exports = {
		get(object, path, value) {
			if (!isObj(object) || typeof path !== "string") return value === void 0 ? object : value;
			const pathArray = getPathSegments(path);
			if (pathArray.length === 0) return;
			for (let i = 0; i < pathArray.length; i++) {
				object = object[pathArray[i]];
				if (object === void 0 || object === null) {
					if (i !== pathArray.length - 1) return value;
					break;
				}
			}
			return object === void 0 ? value : object;
		},
		set(object, path, value) {
			if (!isObj(object) || typeof path !== "string") return object;
			const root = object;
			const pathArray = getPathSegments(path);
			for (let i = 0; i < pathArray.length; i++) {
				const p = pathArray[i];
				if (!isObj(object[p])) object[p] = {};
				if (i === pathArray.length - 1) object[p] = value;
				object = object[p];
			}
			return root;
		},
		delete(object, path) {
			if (!isObj(object) || typeof path !== "string") return false;
			const pathArray = getPathSegments(path);
			for (let i = 0; i < pathArray.length; i++) {
				const p = pathArray[i];
				if (i === pathArray.length - 1) {
					delete object[p];
					return true;
				}
				object = object[p];
				if (!isObj(object)) return false;
			}
		},
		has(object, path) {
			if (!isObj(object) || typeof path !== "string") return false;
			const pathArray = getPathSegments(path);
			if (pathArray.length === 0) return false;
			for (let i = 0; i < pathArray.length; i++) if (isObj(object)) {
				if (!(pathArray[i] in object)) return false;
				object = object[pathArray[i]];
			} else return false;
			return true;
		}
	};
}));
//#endregion
//#region ../../node_modules/pkg-up/node_modules/path-exists/index.js
var require_path_exists$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs$8 = require("fs");
	module.exports = (fp) => new Promise((resolve) => {
		fs$8.access(fp, (err) => {
			resolve(!err);
		});
	});
	module.exports.sync = (fp) => {
		try {
			fs$8.accessSync(fp);
			return true;
		} catch (err) {
			return false;
		}
	};
}));
//#endregion
//#region ../../node_modules/p-try/index.js
var require_p_try = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var pTry = (fn, ...arguments_) => new Promise((resolve) => {
		resolve(fn(...arguments_));
	});
	module.exports = pTry;
	module.exports.default = pTry;
}));
//#endregion
//#region ../../node_modules/pkg-up/node_modules/p-limit/index.js
var require_p_limit = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var pTry = require_p_try();
	var pLimit = (concurrency) => {
		if (!((Number.isInteger(concurrency) || concurrency === Infinity) && concurrency > 0)) return Promise.reject(/* @__PURE__ */ new TypeError("Expected `concurrency` to be a number from 1 and up"));
		const queue = [];
		let activeCount = 0;
		const next = () => {
			activeCount--;
			if (queue.length > 0) queue.shift()();
		};
		const run = (fn, resolve, ...args) => {
			activeCount++;
			const result = pTry(fn, ...args);
			resolve(result);
			result.then(next, next);
		};
		const enqueue = (fn, resolve, ...args) => {
			if (activeCount < concurrency) run(fn, resolve, ...args);
			else queue.push(run.bind(null, fn, resolve, ...args));
		};
		const generator = (fn, ...args) => new Promise((resolve) => enqueue(fn, resolve, ...args));
		Object.defineProperties(generator, {
			activeCount: { get: () => activeCount },
			pendingCount: { get: () => queue.length },
			clearQueue: { value: () => {
				queue.length = 0;
			} }
		});
		return generator;
	};
	module.exports = pLimit;
	module.exports.default = pLimit;
}));
//#endregion
//#region ../../node_modules/pkg-up/node_modules/p-locate/index.js
var require_p_locate = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var pLimit = require_p_limit();
	var EndError = class extends Error {
		constructor(value) {
			super();
			this.value = value;
		}
	};
	var testElement = (el, tester) => Promise.resolve(el).then(tester);
	var finder = (el) => Promise.all(el).then((val) => val[1] === true && Promise.reject(new EndError(val[0])));
	module.exports = (iterable, tester, opts) => {
		opts = Object.assign({
			concurrency: Infinity,
			preserveOrder: true
		}, opts);
		const limit = pLimit(opts.concurrency);
		const items = [...iterable].map((el) => [el, limit(testElement, el, tester)]);
		const checkLimit = pLimit(opts.preserveOrder ? 1 : Infinity);
		return Promise.all(items.map((el) => checkLimit(finder, el))).then(() => {}).catch((err) => err instanceof EndError ? err.value : Promise.reject(err));
	};
}));
//#endregion
//#region ../../node_modules/pkg-up/node_modules/locate-path/index.js
var require_locate_path = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var path$36 = require("path");
	var pathExists = require_path_exists$1();
	var pLocate = require_p_locate();
	module.exports = (iterable, options) => {
		options = Object.assign({ cwd: process.cwd() }, options);
		return pLocate(iterable, (el) => pathExists(path$36.resolve(options.cwd, el)), options);
	};
	module.exports.sync = (iterable, options) => {
		options = Object.assign({ cwd: process.cwd() }, options);
		for (const el of iterable) if (pathExists.sync(path$36.resolve(options.cwd, el))) return el;
	};
}));
//#endregion
//#region ../../node_modules/pkg-up/node_modules/find-up/index.js
var require_find_up = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var path$35 = require("path");
	var locatePath = require_locate_path();
	module.exports = (filename, opts = {}) => {
		const startDir = path$35.resolve(opts.cwd || "");
		const { root } = path$35.parse(startDir);
		const filenames = [].concat(filename);
		return new Promise((resolve) => {
			(function find(dir) {
				locatePath(filenames, { cwd: dir }).then((file) => {
					if (file) resolve(path$35.join(dir, file));
					else if (dir === root) resolve(null);
					else find(path$35.dirname(dir));
				});
			})(startDir);
		});
	};
	module.exports.sync = (filename, opts = {}) => {
		let dir = path$35.resolve(opts.cwd || "");
		const { root } = path$35.parse(dir);
		const filenames = [].concat(filename);
		while (true) {
			const file = locatePath.sync(filenames, { cwd: dir });
			if (file) return path$35.join(dir, file);
			if (dir === root) return null;
			dir = path$35.dirname(dir);
		}
	};
}));
//#endregion
//#region ../../node_modules/pkg-up/index.js
var require_pkg_up = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var findUp = require_find_up();
	module.exports = async ({ cwd } = {}) => findUp("package.json", { cwd });
	module.exports.sync = ({ cwd } = {}) => findUp.sync("package.json", { cwd });
}));
//#endregion
//#region ../../node_modules/env-paths/index.js
var require_env_paths = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var path$34 = require("path");
	var os$6 = require("os");
	var homedir = os$6.homedir();
	var tmpdir = os$6.tmpdir();
	var { env } = process;
	var macos = (name) => {
		const library = path$34.join(homedir, "Library");
		return {
			data: path$34.join(library, "Application Support", name),
			config: path$34.join(library, "Preferences", name),
			cache: path$34.join(library, "Caches", name),
			log: path$34.join(library, "Logs", name),
			temp: path$34.join(tmpdir, name)
		};
	};
	var windows = (name) => {
		const appData = env.APPDATA || path$34.join(homedir, "AppData", "Roaming");
		const localAppData = env.LOCALAPPDATA || path$34.join(homedir, "AppData", "Local");
		return {
			data: path$34.join(localAppData, name, "Data"),
			config: path$34.join(appData, name, "Config"),
			cache: path$34.join(localAppData, name, "Cache"),
			log: path$34.join(localAppData, name, "Log"),
			temp: path$34.join(tmpdir, name)
		};
	};
	var linux = (name) => {
		const username = path$34.basename(homedir);
		return {
			data: path$34.join(env.XDG_DATA_HOME || path$34.join(homedir, ".local", "share"), name),
			config: path$34.join(env.XDG_CONFIG_HOME || path$34.join(homedir, ".config"), name),
			cache: path$34.join(env.XDG_CACHE_HOME || path$34.join(homedir, ".cache"), name),
			log: path$34.join(env.XDG_STATE_HOME || path$34.join(homedir, ".local", "state"), name),
			temp: path$34.join(tmpdir, username, name)
		};
	};
	var envPaths = (name, options) => {
		if (typeof name !== "string") throw new TypeError(`Expected string, got ${typeof name}`);
		options = Object.assign({ suffix: "nodejs" }, options);
		if (options.suffix) name += `-${options.suffix}`;
		if (process.platform === "darwin") return macos(name);
		if (process.platform === "win32") return windows(name);
		return linux(name);
	};
	module.exports = envPaths;
	module.exports.default = envPaths;
}));
//#endregion
//#region ../../node_modules/atomically/dist/consts.js
var require_consts = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.NOOP = exports.LIMIT_FILES_DESCRIPTORS = exports.LIMIT_BASENAME_LENGTH = exports.IS_USER_ROOT = exports.IS_POSIX = exports.DEFAULT_TIMEOUT_SYNC = exports.DEFAULT_TIMEOUT_ASYNC = exports.DEFAULT_WRITE_OPTIONS = exports.DEFAULT_READ_OPTIONS = exports.DEFAULT_FOLDER_MODE = exports.DEFAULT_FILE_MODE = exports.DEFAULT_ENCODING = void 0;
	exports.DEFAULT_ENCODING = "utf8";
	exports.DEFAULT_FILE_MODE = 438;
	exports.DEFAULT_FOLDER_MODE = 511;
	exports.DEFAULT_READ_OPTIONS = {};
	exports.DEFAULT_WRITE_OPTIONS = {};
	exports.DEFAULT_TIMEOUT_ASYNC = 5e3;
	exports.DEFAULT_TIMEOUT_SYNC = 100;
	exports.IS_POSIX = !!process.getuid;
	exports.IS_USER_ROOT = process.getuid ? !process.getuid() : false;
	exports.LIMIT_BASENAME_LENGTH = 128;
	exports.LIMIT_FILES_DESCRIPTORS = 1e4;
	var NOOP = () => {};
	exports.NOOP = NOOP;
}));
//#endregion
//#region ../../node_modules/atomically/dist/utils/attemptify.js
var require_attemptify = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.attemptifySync = exports.attemptifyAsync = void 0;
	var consts_1 = require_consts();
	var attemptifyAsync = (fn, onError = consts_1.NOOP) => {
		return function() {
			return fn.apply(void 0, arguments).catch(onError);
		};
	};
	exports.attemptifyAsync = attemptifyAsync;
	var attemptifySync = (fn, onError = consts_1.NOOP) => {
		return function() {
			try {
				return fn.apply(void 0, arguments);
			} catch (error) {
				return onError(error);
			}
		};
	};
	exports.attemptifySync = attemptifySync;
}));
//#endregion
//#region ../../node_modules/atomically/dist/utils/fs_handlers.js
var require_fs_handlers = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var consts_1 = require_consts();
	var Handlers = {
		isChangeErrorOk: (error) => {
			const { code } = error;
			if (code === "ENOSYS") return true;
			if (!consts_1.IS_USER_ROOT && (code === "EINVAL" || code === "EPERM")) return true;
			return false;
		},
		isRetriableError: (error) => {
			const { code } = error;
			if (code === "EMFILE" || code === "ENFILE" || code === "EAGAIN" || code === "EBUSY" || code === "EACCESS" || code === "EACCS" || code === "EPERM") return true;
			return false;
		},
		onChangeError: (error) => {
			if (Handlers.isChangeErrorOk(error)) return;
			throw error;
		}
	};
	exports.default = Handlers;
}));
//#endregion
//#region ../../node_modules/atomically/dist/utils/retryify_queue.js
var require_retryify_queue = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var RetryfyQueue = {
		interval: 25,
		intervalId: void 0,
		limit: require_consts().LIMIT_FILES_DESCRIPTORS,
		queueActive: /* @__PURE__ */ new Set(),
		queueWaiting: /* @__PURE__ */ new Set(),
		init: () => {
			if (RetryfyQueue.intervalId) return;
			RetryfyQueue.intervalId = setInterval(RetryfyQueue.tick, RetryfyQueue.interval);
		},
		reset: () => {
			if (!RetryfyQueue.intervalId) return;
			clearInterval(RetryfyQueue.intervalId);
			delete RetryfyQueue.intervalId;
		},
		add: (fn) => {
			RetryfyQueue.queueWaiting.add(fn);
			if (RetryfyQueue.queueActive.size < RetryfyQueue.limit / 2) RetryfyQueue.tick();
			else RetryfyQueue.init();
		},
		remove: (fn) => {
			RetryfyQueue.queueWaiting.delete(fn);
			RetryfyQueue.queueActive.delete(fn);
		},
		schedule: () => {
			return new Promise((resolve) => {
				const cleanup = () => RetryfyQueue.remove(resolver);
				const resolver = () => resolve(cleanup);
				RetryfyQueue.add(resolver);
			});
		},
		tick: () => {
			if (RetryfyQueue.queueActive.size >= RetryfyQueue.limit) return;
			if (!RetryfyQueue.queueWaiting.size) return RetryfyQueue.reset();
			for (const fn of RetryfyQueue.queueWaiting) {
				if (RetryfyQueue.queueActive.size >= RetryfyQueue.limit) break;
				RetryfyQueue.queueWaiting.delete(fn);
				RetryfyQueue.queueActive.add(fn);
				fn();
			}
		}
	};
	exports.default = RetryfyQueue;
}));
//#endregion
//#region ../../node_modules/atomically/dist/utils/retryify.js
var require_retryify = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.retryifySync = exports.retryifyAsync = void 0;
	var retryify_queue_1 = require_retryify_queue();
	var retryifyAsync = (fn, isRetriableError) => {
		return function(timestamp) {
			return function attempt() {
				return retryify_queue_1.default.schedule().then((cleanup) => {
					return fn.apply(void 0, arguments).then((result) => {
						cleanup();
						return result;
					}, (error) => {
						cleanup();
						if (Date.now() >= timestamp) throw error;
						if (isRetriableError(error)) {
							const delay = Math.round(100 + 400 * Math.random());
							return new Promise((resolve) => setTimeout(resolve, delay)).then(() => attempt.apply(void 0, arguments));
						}
						throw error;
					});
				});
			};
		};
	};
	exports.retryifyAsync = retryifyAsync;
	var retryifySync = (fn, isRetriableError) => {
		return function(timestamp) {
			return function attempt() {
				try {
					return fn.apply(void 0, arguments);
				} catch (error) {
					if (Date.now() > timestamp) throw error;
					if (isRetriableError(error)) return attempt.apply(void 0, arguments);
					throw error;
				}
			};
		};
	};
	exports.retryifySync = retryifySync;
}));
//#endregion
//#region ../../node_modules/atomically/dist/utils/fs.js
var require_fs$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var fs$7 = require("fs");
	var util_1$1 = require("util");
	var attemptify_1 = require_attemptify();
	var fs_handlers_1 = require_fs_handlers();
	var retryify_1 = require_retryify();
	exports.default = {
		chmodAttempt: attemptify_1.attemptifyAsync(util_1$1.promisify(fs$7.chmod), fs_handlers_1.default.onChangeError),
		chownAttempt: attemptify_1.attemptifyAsync(util_1$1.promisify(fs$7.chown), fs_handlers_1.default.onChangeError),
		closeAttempt: attemptify_1.attemptifyAsync(util_1$1.promisify(fs$7.close)),
		fsyncAttempt: attemptify_1.attemptifyAsync(util_1$1.promisify(fs$7.fsync)),
		mkdirAttempt: attemptify_1.attemptifyAsync(util_1$1.promisify(fs$7.mkdir)),
		realpathAttempt: attemptify_1.attemptifyAsync(util_1$1.promisify(fs$7.realpath)),
		statAttempt: attemptify_1.attemptifyAsync(util_1$1.promisify(fs$7.stat)),
		unlinkAttempt: attemptify_1.attemptifyAsync(util_1$1.promisify(fs$7.unlink)),
		closeRetry: retryify_1.retryifyAsync(util_1$1.promisify(fs$7.close), fs_handlers_1.default.isRetriableError),
		fsyncRetry: retryify_1.retryifyAsync(util_1$1.promisify(fs$7.fsync), fs_handlers_1.default.isRetriableError),
		openRetry: retryify_1.retryifyAsync(util_1$1.promisify(fs$7.open), fs_handlers_1.default.isRetriableError),
		readFileRetry: retryify_1.retryifyAsync(util_1$1.promisify(fs$7.readFile), fs_handlers_1.default.isRetriableError),
		renameRetry: retryify_1.retryifyAsync(util_1$1.promisify(fs$7.rename), fs_handlers_1.default.isRetriableError),
		statRetry: retryify_1.retryifyAsync(util_1$1.promisify(fs$7.stat), fs_handlers_1.default.isRetriableError),
		writeRetry: retryify_1.retryifyAsync(util_1$1.promisify(fs$7.write), fs_handlers_1.default.isRetriableError),
		chmodSyncAttempt: attemptify_1.attemptifySync(fs$7.chmodSync, fs_handlers_1.default.onChangeError),
		chownSyncAttempt: attemptify_1.attemptifySync(fs$7.chownSync, fs_handlers_1.default.onChangeError),
		closeSyncAttempt: attemptify_1.attemptifySync(fs$7.closeSync),
		mkdirSyncAttempt: attemptify_1.attemptifySync(fs$7.mkdirSync),
		realpathSyncAttempt: attemptify_1.attemptifySync(fs$7.realpathSync),
		statSyncAttempt: attemptify_1.attemptifySync(fs$7.statSync),
		unlinkSyncAttempt: attemptify_1.attemptifySync(fs$7.unlinkSync),
		closeSyncRetry: retryify_1.retryifySync(fs$7.closeSync, fs_handlers_1.default.isRetriableError),
		fsyncSyncRetry: retryify_1.retryifySync(fs$7.fsyncSync, fs_handlers_1.default.isRetriableError),
		openSyncRetry: retryify_1.retryifySync(fs$7.openSync, fs_handlers_1.default.isRetriableError),
		readFileSyncRetry: retryify_1.retryifySync(fs$7.readFileSync, fs_handlers_1.default.isRetriableError),
		renameSyncRetry: retryify_1.retryifySync(fs$7.renameSync, fs_handlers_1.default.isRetriableError),
		statSyncRetry: retryify_1.retryifySync(fs$7.statSync, fs_handlers_1.default.isRetriableError),
		writeSyncRetry: retryify_1.retryifySync(fs$7.writeSync, fs_handlers_1.default.isRetriableError)
	};
}));
//#endregion
//#region ../../node_modules/atomically/dist/utils/lang.js
var require_lang = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = {
		isFunction: (x) => {
			return typeof x === "function";
		},
		isString: (x) => {
			return typeof x === "string";
		},
		isUndefined: (x) => {
			return typeof x === "undefined";
		}
	};
}));
//#endregion
//#region ../../node_modules/atomically/dist/utils/scheduler.js
var require_scheduler = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var Queues = {};
	var Scheduler = {
		next: (id) => {
			const queue = Queues[id];
			if (!queue) return;
			queue.shift();
			const job = queue[0];
			if (job) job(() => Scheduler.next(id));
			else delete Queues[id];
		},
		schedule: (id) => {
			return new Promise((resolve) => {
				let queue = Queues[id];
				if (!queue) queue = Queues[id] = [];
				queue.push(resolve);
				if (queue.length > 1) return;
				resolve(() => Scheduler.next(id));
			});
		}
	};
	exports.default = Scheduler;
}));
//#endregion
//#region ../../node_modules/atomically/dist/utils/temp.js
var require_temp = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var path$33 = require("path");
	var consts_1 = require_consts();
	var fs_1 = require_fs$1();
	var Temp = {
		store: {},
		create: (filePath) => {
			const randomness = `000000${Math.floor(Math.random() * 16777215).toString(16)}`.slice(-6);
			return `${filePath}${`.tmp-${Date.now().toString().slice(-10)}${randomness}`}`;
		},
		get: (filePath, creator, purge = true) => {
			const tempPath = Temp.truncate(creator(filePath));
			if (tempPath in Temp.store) return Temp.get(filePath, creator, purge);
			Temp.store[tempPath] = purge;
			const disposer = () => delete Temp.store[tempPath];
			return [tempPath, disposer];
		},
		purge: (filePath) => {
			if (!Temp.store[filePath]) return;
			delete Temp.store[filePath];
			fs_1.default.unlinkAttempt(filePath);
		},
		purgeSync: (filePath) => {
			if (!Temp.store[filePath]) return;
			delete Temp.store[filePath];
			fs_1.default.unlinkSyncAttempt(filePath);
		},
		purgeSyncAll: () => {
			for (const filePath in Temp.store) Temp.purgeSync(filePath);
		},
		truncate: (filePath) => {
			const basename = path$33.basename(filePath);
			if (basename.length <= consts_1.LIMIT_BASENAME_LENGTH) return filePath;
			const truncable = /^(\.?)(.*?)((?:\.[^.]+)?(?:\.tmp-\d{10}[a-f0-9]{6})?)$/.exec(basename);
			if (!truncable) return filePath;
			const truncationLength = basename.length - consts_1.LIMIT_BASENAME_LENGTH;
			return `${filePath.slice(0, -basename.length)}${truncable[1]}${truncable[2].slice(0, -truncationLength)}${truncable[3]}`;
		}
	};
	process.on("exit", Temp.purgeSyncAll);
	exports.default = Temp;
}));
//#endregion
//#region ../../node_modules/atomically/dist/index.js
var require_dist$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.writeFileSync = exports.writeFile = exports.readFileSync = exports.readFile = void 0;
	var path$32 = require("path");
	var consts_1 = require_consts();
	var fs_1 = require_fs$1();
	var lang_1 = require_lang();
	var scheduler_1 = require_scheduler();
	var temp_1 = require_temp();
	function readFile(filePath, options = consts_1.DEFAULT_READ_OPTIONS) {
		var _a;
		if (lang_1.default.isString(options)) return readFile(filePath, { encoding: options });
		const timeout = Date.now() + ((_a = options.timeout) !== null && _a !== void 0 ? _a : consts_1.DEFAULT_TIMEOUT_ASYNC);
		return fs_1.default.readFileRetry(timeout)(filePath, options);
	}
	exports.readFile = readFile;
	function readFileSync(filePath, options = consts_1.DEFAULT_READ_OPTIONS) {
		var _a;
		if (lang_1.default.isString(options)) return readFileSync(filePath, { encoding: options });
		const timeout = Date.now() + ((_a = options.timeout) !== null && _a !== void 0 ? _a : consts_1.DEFAULT_TIMEOUT_SYNC);
		return fs_1.default.readFileSyncRetry(timeout)(filePath, options);
	}
	exports.readFileSync = readFileSync;
	var writeFile = (filePath, data, options, callback) => {
		if (lang_1.default.isFunction(options)) return writeFile(filePath, data, consts_1.DEFAULT_WRITE_OPTIONS, options);
		const promise = writeFileAsync(filePath, data, options);
		if (callback) promise.then(callback, callback);
		return promise;
	};
	exports.writeFile = writeFile;
	var writeFileAsync = async (filePath, data, options = consts_1.DEFAULT_WRITE_OPTIONS) => {
		var _a;
		if (lang_1.default.isString(options)) return writeFileAsync(filePath, data, { encoding: options });
		const timeout = Date.now() + ((_a = options.timeout) !== null && _a !== void 0 ? _a : consts_1.DEFAULT_TIMEOUT_ASYNC);
		let schedulerCustomDisposer = null, schedulerDisposer = null, tempDisposer = null, tempPath = null, fd = null;
		try {
			if (options.schedule) schedulerCustomDisposer = await options.schedule(filePath);
			schedulerDisposer = await scheduler_1.default.schedule(filePath);
			filePath = await fs_1.default.realpathAttempt(filePath) || filePath;
			[tempPath, tempDisposer] = temp_1.default.get(filePath, options.tmpCreate || temp_1.default.create, !(options.tmpPurge === false));
			const useStatChown = consts_1.IS_POSIX && lang_1.default.isUndefined(options.chown), useStatMode = lang_1.default.isUndefined(options.mode);
			if (useStatChown || useStatMode) {
				const stat = await fs_1.default.statAttempt(filePath);
				if (stat) {
					options = { ...options };
					if (useStatChown) options.chown = {
						uid: stat.uid,
						gid: stat.gid
					};
					if (useStatMode) options.mode = stat.mode;
				}
			}
			const parentPath = path$32.dirname(filePath);
			await fs_1.default.mkdirAttempt(parentPath, {
				mode: consts_1.DEFAULT_FOLDER_MODE,
				recursive: true
			});
			fd = await fs_1.default.openRetry(timeout)(tempPath, "w", options.mode || consts_1.DEFAULT_FILE_MODE);
			if (options.tmpCreated) options.tmpCreated(tempPath);
			if (lang_1.default.isString(data)) await fs_1.default.writeRetry(timeout)(fd, data, 0, options.encoding || consts_1.DEFAULT_ENCODING);
			else if (!lang_1.default.isUndefined(data)) await fs_1.default.writeRetry(timeout)(fd, data, 0, data.length, 0);
			if (options.fsync !== false) if (options.fsyncWait !== false) await fs_1.default.fsyncRetry(timeout)(fd);
			else fs_1.default.fsyncAttempt(fd);
			await fs_1.default.closeRetry(timeout)(fd);
			fd = null;
			if (options.chown) await fs_1.default.chownAttempt(tempPath, options.chown.uid, options.chown.gid);
			if (options.mode) await fs_1.default.chmodAttempt(tempPath, options.mode);
			try {
				await fs_1.default.renameRetry(timeout)(tempPath, filePath);
			} catch (error) {
				if (error.code !== "ENAMETOOLONG") throw error;
				await fs_1.default.renameRetry(timeout)(tempPath, temp_1.default.truncate(filePath));
			}
			tempDisposer();
			tempPath = null;
		} finally {
			if (fd) await fs_1.default.closeAttempt(fd);
			if (tempPath) temp_1.default.purge(tempPath);
			if (schedulerCustomDisposer) schedulerCustomDisposer();
			if (schedulerDisposer) schedulerDisposer();
		}
	};
	var writeFileSync = (filePath, data, options = consts_1.DEFAULT_WRITE_OPTIONS) => {
		var _a;
		if (lang_1.default.isString(options)) return writeFileSync(filePath, data, { encoding: options });
		const timeout = Date.now() + ((_a = options.timeout) !== null && _a !== void 0 ? _a : consts_1.DEFAULT_TIMEOUT_SYNC);
		let tempDisposer = null, tempPath = null, fd = null;
		try {
			filePath = fs_1.default.realpathSyncAttempt(filePath) || filePath;
			[tempPath, tempDisposer] = temp_1.default.get(filePath, options.tmpCreate || temp_1.default.create, !(options.tmpPurge === false));
			const useStatChown = consts_1.IS_POSIX && lang_1.default.isUndefined(options.chown), useStatMode = lang_1.default.isUndefined(options.mode);
			if (useStatChown || useStatMode) {
				const stat = fs_1.default.statSyncAttempt(filePath);
				if (stat) {
					options = { ...options };
					if (useStatChown) options.chown = {
						uid: stat.uid,
						gid: stat.gid
					};
					if (useStatMode) options.mode = stat.mode;
				}
			}
			const parentPath = path$32.dirname(filePath);
			fs_1.default.mkdirSyncAttempt(parentPath, {
				mode: consts_1.DEFAULT_FOLDER_MODE,
				recursive: true
			});
			fd = fs_1.default.openSyncRetry(timeout)(tempPath, "w", options.mode || consts_1.DEFAULT_FILE_MODE);
			if (options.tmpCreated) options.tmpCreated(tempPath);
			if (lang_1.default.isString(data)) fs_1.default.writeSyncRetry(timeout)(fd, data, 0, options.encoding || consts_1.DEFAULT_ENCODING);
			else if (!lang_1.default.isUndefined(data)) fs_1.default.writeSyncRetry(timeout)(fd, data, 0, data.length, 0);
			if (options.fsync !== false) if (options.fsyncWait !== false) fs_1.default.fsyncSyncRetry(timeout)(fd);
			else fs_1.default.fsyncAttempt(fd);
			fs_1.default.closeSyncRetry(timeout)(fd);
			fd = null;
			if (options.chown) fs_1.default.chownSyncAttempt(tempPath, options.chown.uid, options.chown.gid);
			if (options.mode) fs_1.default.chmodSyncAttempt(tempPath, options.mode);
			try {
				fs_1.default.renameSyncRetry(timeout)(tempPath, filePath);
			} catch (error) {
				if (error.code !== "ENAMETOOLONG") throw error;
				fs_1.default.renameSyncRetry(timeout)(tempPath, temp_1.default.truncate(filePath));
			}
			tempDisposer();
			tempPath = null;
		} finally {
			if (fd) fs_1.default.closeSyncAttempt(fd);
			if (tempPath) temp_1.default.purge(tempPath);
		}
	};
	exports.writeFileSync = writeFileSync;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/codegen/code.js
var require_code$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = void 0;
	var _CodeOrName = class {};
	exports._CodeOrName = _CodeOrName;
	exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
	var Name = class extends _CodeOrName {
		constructor(s) {
			super();
			if (!exports.IDENTIFIER.test(s)) throw new Error("CodeGen: name must be a valid identifier");
			this.str = s;
		}
		toString() {
			return this.str;
		}
		emptyStr() {
			return false;
		}
		get names() {
			return { [this.str]: 1 };
		}
	};
	exports.Name = Name;
	var _Code = class extends _CodeOrName {
		constructor(code) {
			super();
			this._items = typeof code === "string" ? [code] : code;
		}
		toString() {
			return this.str;
		}
		emptyStr() {
			if (this._items.length > 1) return false;
			const item = this._items[0];
			return item === "" || item === "\"\"";
		}
		get str() {
			var _a;
			return (_a = this._str) !== null && _a !== void 0 ? _a : this._str = this._items.reduce((s, c) => `${s}${c}`, "");
		}
		get names() {
			var _a;
			return (_a = this._names) !== null && _a !== void 0 ? _a : this._names = this._items.reduce((names, c) => {
				if (c instanceof Name) names[c.str] = (names[c.str] || 0) + 1;
				return names;
			}, {});
		}
	};
	exports._Code = _Code;
	exports.nil = new _Code("");
	function _(strs, ...args) {
		const code = [strs[0]];
		let i = 0;
		while (i < args.length) {
			addCodeArg(code, args[i]);
			code.push(strs[++i]);
		}
		return new _Code(code);
	}
	exports._ = _;
	var plus = new _Code("+");
	function str(strs, ...args) {
		const expr = [safeStringify(strs[0])];
		let i = 0;
		while (i < args.length) {
			expr.push(plus);
			addCodeArg(expr, args[i]);
			expr.push(plus, safeStringify(strs[++i]));
		}
		optimize(expr);
		return new _Code(expr);
	}
	exports.str = str;
	function addCodeArg(code, arg) {
		if (arg instanceof _Code) code.push(...arg._items);
		else if (arg instanceof Name) code.push(arg);
		else code.push(interpolate(arg));
	}
	exports.addCodeArg = addCodeArg;
	function optimize(expr) {
		let i = 1;
		while (i < expr.length - 1) {
			if (expr[i] === plus) {
				const res = mergeExprItems(expr[i - 1], expr[i + 1]);
				if (res !== void 0) {
					expr.splice(i - 1, 3, res);
					continue;
				}
				expr[i++] = "+";
			}
			i++;
		}
	}
	function mergeExprItems(a, b) {
		if (b === "\"\"") return a;
		if (a === "\"\"") return b;
		if (typeof a == "string") {
			if (b instanceof Name || a[a.length - 1] !== "\"") return;
			if (typeof b != "string") return `${a.slice(0, -1)}${b}"`;
			if (b[0] === "\"") return a.slice(0, -1) + b.slice(1);
			return;
		}
		if (typeof b == "string" && b[0] === "\"" && !(a instanceof Name)) return `"${a}${b.slice(1)}`;
	}
	function strConcat(c1, c2) {
		return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str`${c1}${c2}`;
	}
	exports.strConcat = strConcat;
	function interpolate(x) {
		return typeof x == "number" || typeof x == "boolean" || x === null ? x : safeStringify(Array.isArray(x) ? x.join(",") : x);
	}
	function stringify(x) {
		return new _Code(safeStringify(x));
	}
	exports.stringify = stringify;
	function safeStringify(x) {
		return JSON.stringify(x).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
	}
	exports.safeStringify = safeStringify;
	function getProperty(key) {
		return typeof key == "string" && exports.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _`[${key}]`;
	}
	exports.getProperty = getProperty;
	function getEsmExportName(key) {
		if (typeof key == "string" && exports.IDENTIFIER.test(key)) return new _Code(`${key}`);
		throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
	}
	exports.getEsmExportName = getEsmExportName;
	function regexpCode(rx) {
		return new _Code(rx.toString());
	}
	exports.regexpCode = regexpCode;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/codegen/scope.js
var require_scope$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = void 0;
	var code_1 = require_code$1();
	var ValueError = class extends Error {
		constructor(name) {
			super(`CodeGen: "code" for ${name} not defined`);
			this.value = name.value;
		}
	};
	var UsedValueState;
	(function(UsedValueState) {
		UsedValueState[UsedValueState["Started"] = 0] = "Started";
		UsedValueState[UsedValueState["Completed"] = 1] = "Completed";
	})(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
	exports.varKinds = {
		const: new code_1.Name("const"),
		let: new code_1.Name("let"),
		var: new code_1.Name("var")
	};
	var Scope = class {
		constructor({ prefixes, parent } = {}) {
			this._names = {};
			this._prefixes = prefixes;
			this._parent = parent;
		}
		toName(nameOrPrefix) {
			return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
		}
		name(prefix) {
			return new code_1.Name(this._newName(prefix));
		}
		_newName(prefix) {
			const ng = this._names[prefix] || this._nameGroup(prefix);
			return `${prefix}${ng.index++}`;
		}
		_nameGroup(prefix) {
			var _a, _b;
			if (((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0 ? void 0 : _b.has(prefix)) || this._prefixes && !this._prefixes.has(prefix)) throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
			return this._names[prefix] = {
				prefix,
				index: 0
			};
		}
	};
	exports.Scope = Scope;
	var ValueScopeName = class extends code_1.Name {
		constructor(prefix, nameStr) {
			super(nameStr);
			this.prefix = prefix;
		}
		setValue(value, { property, itemIndex }) {
			this.value = value;
			this.scopePath = (0, code_1._)`.${new code_1.Name(property)}[${itemIndex}]`;
		}
	};
	exports.ValueScopeName = ValueScopeName;
	var line = (0, code_1._)`\n`;
	var ValueScope = class extends Scope {
		constructor(opts) {
			super(opts);
			this._values = {};
			this._scope = opts.scope;
			this.opts = {
				...opts,
				_n: opts.lines ? line : code_1.nil
			};
		}
		get() {
			return this._scope;
		}
		name(prefix) {
			return new ValueScopeName(prefix, this._newName(prefix));
		}
		value(nameOrPrefix, value) {
			var _a;
			if (value.ref === void 0) throw new Error("CodeGen: ref must be passed in value");
			const name = this.toName(nameOrPrefix);
			const { prefix } = name;
			const valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref;
			let vs = this._values[prefix];
			if (vs) {
				const _name = vs.get(valueKey);
				if (_name) return _name;
			} else vs = this._values[prefix] = /* @__PURE__ */ new Map();
			vs.set(valueKey, name);
			const s = this._scope[prefix] || (this._scope[prefix] = []);
			const itemIndex = s.length;
			s[itemIndex] = value.ref;
			name.setValue(value, {
				property: prefix,
				itemIndex
			});
			return name;
		}
		getValue(prefix, keyOrRef) {
			const vs = this._values[prefix];
			if (!vs) return;
			return vs.get(keyOrRef);
		}
		scopeRefs(scopeName, values = this._values) {
			return this._reduceValues(values, (name) => {
				if (name.scopePath === void 0) throw new Error(`CodeGen: name "${name}" has no value`);
				return (0, code_1._)`${scopeName}${name.scopePath}`;
			});
		}
		scopeCode(values = this._values, usedValues, getCode) {
			return this._reduceValues(values, (name) => {
				if (name.value === void 0) throw new Error(`CodeGen: name "${name}" has no value`);
				return name.value.code;
			}, usedValues, getCode);
		}
		_reduceValues(values, valueCode, usedValues = {}, getCode) {
			let code = code_1.nil;
			for (const prefix in values) {
				const vs = values[prefix];
				if (!vs) continue;
				const nameSet = usedValues[prefix] = usedValues[prefix] || /* @__PURE__ */ new Map();
				vs.forEach((name) => {
					if (nameSet.has(name)) return;
					nameSet.set(name, UsedValueState.Started);
					let c = valueCode(name);
					if (c) {
						const def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
						code = (0, code_1._)`${code}${def} ${name} = ${c};${this.opts._n}`;
					} else if (c = getCode === null || getCode === void 0 ? void 0 : getCode(name)) code = (0, code_1._)`${code}${c}${this.opts._n}`;
					else throw new ValueError(name);
					nameSet.set(name, UsedValueState.Completed);
				});
			}
			return code;
		}
	};
	exports.ValueScope = ValueScope;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/codegen/index.js
var require_codegen = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = void 0;
	var code_1 = require_code$1();
	var scope_1 = require_scope$1();
	var code_2 = require_code$1();
	Object.defineProperty(exports, "_", {
		enumerable: true,
		get: function() {
			return code_2._;
		}
	});
	Object.defineProperty(exports, "str", {
		enumerable: true,
		get: function() {
			return code_2.str;
		}
	});
	Object.defineProperty(exports, "strConcat", {
		enumerable: true,
		get: function() {
			return code_2.strConcat;
		}
	});
	Object.defineProperty(exports, "nil", {
		enumerable: true,
		get: function() {
			return code_2.nil;
		}
	});
	Object.defineProperty(exports, "getProperty", {
		enumerable: true,
		get: function() {
			return code_2.getProperty;
		}
	});
	Object.defineProperty(exports, "stringify", {
		enumerable: true,
		get: function() {
			return code_2.stringify;
		}
	});
	Object.defineProperty(exports, "regexpCode", {
		enumerable: true,
		get: function() {
			return code_2.regexpCode;
		}
	});
	Object.defineProperty(exports, "Name", {
		enumerable: true,
		get: function() {
			return code_2.Name;
		}
	});
	var scope_2 = require_scope$1();
	Object.defineProperty(exports, "Scope", {
		enumerable: true,
		get: function() {
			return scope_2.Scope;
		}
	});
	Object.defineProperty(exports, "ValueScope", {
		enumerable: true,
		get: function() {
			return scope_2.ValueScope;
		}
	});
	Object.defineProperty(exports, "ValueScopeName", {
		enumerable: true,
		get: function() {
			return scope_2.ValueScopeName;
		}
	});
	Object.defineProperty(exports, "varKinds", {
		enumerable: true,
		get: function() {
			return scope_2.varKinds;
		}
	});
	exports.operators = {
		GT: new code_1._Code(">"),
		GTE: new code_1._Code(">="),
		LT: new code_1._Code("<"),
		LTE: new code_1._Code("<="),
		EQ: new code_1._Code("==="),
		NEQ: new code_1._Code("!=="),
		NOT: new code_1._Code("!"),
		OR: new code_1._Code("||"),
		AND: new code_1._Code("&&"),
		ADD: new code_1._Code("+")
	};
	var Node = class {
		optimizeNodes() {
			return this;
		}
		optimizeNames(_names, _constants) {
			return this;
		}
	};
	var Def = class extends Node {
		constructor(varKind, name, rhs) {
			super();
			this.varKind = varKind;
			this.name = name;
			this.rhs = rhs;
		}
		render({ es5, _n }) {
			const varKind = es5 ? scope_1.varKinds.var : this.varKind;
			const rhs = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
			return `${varKind} ${this.name}${rhs};` + _n;
		}
		optimizeNames(names, constants) {
			if (!names[this.name.str]) return;
			if (this.rhs) this.rhs = optimizeExpr(this.rhs, names, constants);
			return this;
		}
		get names() {
			return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
		}
	};
	var Assign = class extends Node {
		constructor(lhs, rhs, sideEffects) {
			super();
			this.lhs = lhs;
			this.rhs = rhs;
			this.sideEffects = sideEffects;
		}
		render({ _n }) {
			return `${this.lhs} = ${this.rhs};` + _n;
		}
		optimizeNames(names, constants) {
			if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects) return;
			this.rhs = optimizeExpr(this.rhs, names, constants);
			return this;
		}
		get names() {
			return addExprNames(this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names }, this.rhs);
		}
	};
	var AssignOp = class extends Assign {
		constructor(lhs, op, rhs, sideEffects) {
			super(lhs, rhs, sideEffects);
			this.op = op;
		}
		render({ _n }) {
			return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
		}
	};
	var Label = class extends Node {
		constructor(label) {
			super();
			this.label = label;
			this.names = {};
		}
		render({ _n }) {
			return `${this.label}:` + _n;
		}
	};
	var Break = class extends Node {
		constructor(label) {
			super();
			this.label = label;
			this.names = {};
		}
		render({ _n }) {
			return `break${this.label ? ` ${this.label}` : ""};` + _n;
		}
	};
	var Throw = class extends Node {
		constructor(error) {
			super();
			this.error = error;
		}
		render({ _n }) {
			return `throw ${this.error};` + _n;
		}
		get names() {
			return this.error.names;
		}
	};
	var AnyCode = class extends Node {
		constructor(code) {
			super();
			this.code = code;
		}
		render({ _n }) {
			return `${this.code};` + _n;
		}
		optimizeNodes() {
			return `${this.code}` ? this : void 0;
		}
		optimizeNames(names, constants) {
			this.code = optimizeExpr(this.code, names, constants);
			return this;
		}
		get names() {
			return this.code instanceof code_1._CodeOrName ? this.code.names : {};
		}
	};
	var ParentNode = class extends Node {
		constructor(nodes = []) {
			super();
			this.nodes = nodes;
		}
		render(opts) {
			return this.nodes.reduce((code, n) => code + n.render(opts), "");
		}
		optimizeNodes() {
			const { nodes } = this;
			let i = nodes.length;
			while (i--) {
				const n = nodes[i].optimizeNodes();
				if (Array.isArray(n)) nodes.splice(i, 1, ...n);
				else if (n) nodes[i] = n;
				else nodes.splice(i, 1);
			}
			return nodes.length > 0 ? this : void 0;
		}
		optimizeNames(names, constants) {
			const { nodes } = this;
			let i = nodes.length;
			while (i--) {
				const n = nodes[i];
				if (n.optimizeNames(names, constants)) continue;
				subtractNames(names, n.names);
				nodes.splice(i, 1);
			}
			return nodes.length > 0 ? this : void 0;
		}
		get names() {
			return this.nodes.reduce((names, n) => addNames(names, n.names), {});
		}
	};
	var BlockNode = class extends ParentNode {
		render(opts) {
			return "{" + opts._n + super.render(opts) + "}" + opts._n;
		}
	};
	var Root = class extends ParentNode {};
	var Else = class extends BlockNode {};
	Else.kind = "else";
	var If = class If extends BlockNode {
		constructor(condition, nodes) {
			super(nodes);
			this.condition = condition;
		}
		render(opts) {
			let code = `if(${this.condition})` + super.render(opts);
			if (this.else) code += "else " + this.else.render(opts);
			return code;
		}
		optimizeNodes() {
			super.optimizeNodes();
			const cond = this.condition;
			if (cond === true) return this.nodes;
			let e = this.else;
			if (e) {
				const ns = e.optimizeNodes();
				e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
			}
			if (e) {
				if (cond === false) return e instanceof If ? e : e.nodes;
				if (this.nodes.length) return this;
				return new If(not(cond), e instanceof If ? [e] : e.nodes);
			}
			if (cond === false || !this.nodes.length) return void 0;
			return this;
		}
		optimizeNames(names, constants) {
			var _a;
			this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
			if (!(super.optimizeNames(names, constants) || this.else)) return;
			this.condition = optimizeExpr(this.condition, names, constants);
			return this;
		}
		get names() {
			const names = super.names;
			addExprNames(names, this.condition);
			if (this.else) addNames(names, this.else.names);
			return names;
		}
	};
	If.kind = "if";
	var For = class extends BlockNode {};
	For.kind = "for";
	var ForLoop = class extends For {
		constructor(iteration) {
			super();
			this.iteration = iteration;
		}
		render(opts) {
			return `for(${this.iteration})` + super.render(opts);
		}
		optimizeNames(names, constants) {
			if (!super.optimizeNames(names, constants)) return;
			this.iteration = optimizeExpr(this.iteration, names, constants);
			return this;
		}
		get names() {
			return addNames(super.names, this.iteration.names);
		}
	};
	var ForRange = class extends For {
		constructor(varKind, name, from, to) {
			super();
			this.varKind = varKind;
			this.name = name;
			this.from = from;
			this.to = to;
		}
		render(opts) {
			const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
			const { name, from, to } = this;
			return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
		}
		get names() {
			return addExprNames(addExprNames(super.names, this.from), this.to);
		}
	};
	var ForIter = class extends For {
		constructor(loop, varKind, name, iterable) {
			super();
			this.loop = loop;
			this.varKind = varKind;
			this.name = name;
			this.iterable = iterable;
		}
		render(opts) {
			return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
		}
		optimizeNames(names, constants) {
			if (!super.optimizeNames(names, constants)) return;
			this.iterable = optimizeExpr(this.iterable, names, constants);
			return this;
		}
		get names() {
			return addNames(super.names, this.iterable.names);
		}
	};
	var Func = class extends BlockNode {
		constructor(name, args, async) {
			super();
			this.name = name;
			this.args = args;
			this.async = async;
		}
		render(opts) {
			return `${this.async ? "async " : ""}function ${this.name}(${this.args})` + super.render(opts);
		}
	};
	Func.kind = "func";
	var Return = class extends ParentNode {
		render(opts) {
			return "return " + super.render(opts);
		}
	};
	Return.kind = "return";
	var Try = class extends BlockNode {
		render(opts) {
			let code = "try" + super.render(opts);
			if (this.catch) code += this.catch.render(opts);
			if (this.finally) code += this.finally.render(opts);
			return code;
		}
		optimizeNodes() {
			var _a, _b;
			super.optimizeNodes();
			(_a = this.catch) === null || _a === void 0 || _a.optimizeNodes();
			(_b = this.finally) === null || _b === void 0 || _b.optimizeNodes();
			return this;
		}
		optimizeNames(names, constants) {
			var _a, _b;
			super.optimizeNames(names, constants);
			(_a = this.catch) === null || _a === void 0 || _a.optimizeNames(names, constants);
			(_b = this.finally) === null || _b === void 0 || _b.optimizeNames(names, constants);
			return this;
		}
		get names() {
			const names = super.names;
			if (this.catch) addNames(names, this.catch.names);
			if (this.finally) addNames(names, this.finally.names);
			return names;
		}
	};
	var Catch = class extends BlockNode {
		constructor(error) {
			super();
			this.error = error;
		}
		render(opts) {
			return `catch(${this.error})` + super.render(opts);
		}
	};
	Catch.kind = "catch";
	var Finally = class extends BlockNode {
		render(opts) {
			return "finally" + super.render(opts);
		}
	};
	Finally.kind = "finally";
	var CodeGen = class {
		constructor(extScope, opts = {}) {
			this._values = {};
			this._blockStarts = [];
			this._constants = {};
			this.opts = {
				...opts,
				_n: opts.lines ? "\n" : ""
			};
			this._extScope = extScope;
			this._scope = new scope_1.Scope({ parent: extScope });
			this._nodes = [new Root()];
		}
		toString() {
			return this._root.render(this.opts);
		}
		name(prefix) {
			return this._scope.name(prefix);
		}
		scopeName(prefix) {
			return this._extScope.name(prefix);
		}
		scopeValue(prefixOrName, value) {
			const name = this._extScope.value(prefixOrName, value);
			(this._values[name.prefix] || (this._values[name.prefix] = /* @__PURE__ */ new Set())).add(name);
			return name;
		}
		getScopeValue(prefix, keyOrRef) {
			return this._extScope.getValue(prefix, keyOrRef);
		}
		scopeRefs(scopeName) {
			return this._extScope.scopeRefs(scopeName, this._values);
		}
		scopeCode() {
			return this._extScope.scopeCode(this._values);
		}
		_def(varKind, nameOrPrefix, rhs, constant) {
			const name = this._scope.toName(nameOrPrefix);
			if (rhs !== void 0 && constant) this._constants[name.str] = rhs;
			this._leafNode(new Def(varKind, name, rhs));
			return name;
		}
		const(nameOrPrefix, rhs, _constant) {
			return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
		}
		let(nameOrPrefix, rhs, _constant) {
			return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
		}
		var(nameOrPrefix, rhs, _constant) {
			return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
		}
		assign(lhs, rhs, sideEffects) {
			return this._leafNode(new Assign(lhs, rhs, sideEffects));
		}
		add(lhs, rhs) {
			return this._leafNode(new AssignOp(lhs, exports.operators.ADD, rhs));
		}
		code(c) {
			if (typeof c == "function") c();
			else if (c !== code_1.nil) this._leafNode(new AnyCode(c));
			return this;
		}
		object(...keyValues) {
			const code = ["{"];
			for (const [key, value] of keyValues) {
				if (code.length > 1) code.push(",");
				code.push(key);
				if (key !== value || this.opts.es5) {
					code.push(":");
					(0, code_1.addCodeArg)(code, value);
				}
			}
			code.push("}");
			return new code_1._Code(code);
		}
		if(condition, thenBody, elseBody) {
			this._blockNode(new If(condition));
			if (thenBody && elseBody) this.code(thenBody).else().code(elseBody).endIf();
			else if (thenBody) this.code(thenBody).endIf();
			else if (elseBody) throw new Error("CodeGen: \"else\" body without \"then\" body");
			return this;
		}
		elseIf(condition) {
			return this._elseNode(new If(condition));
		}
		else() {
			return this._elseNode(new Else());
		}
		endIf() {
			return this._endBlockNode(If, Else);
		}
		_for(node, forBody) {
			this._blockNode(node);
			if (forBody) this.code(forBody).endFor();
			return this;
		}
		for(iteration, forBody) {
			return this._for(new ForLoop(iteration), forBody);
		}
		forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
			const name = this._scope.toName(nameOrPrefix);
			return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
		}
		forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
			const name = this._scope.toName(nameOrPrefix);
			if (this.opts.es5) {
				const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
				return this.forRange("_i", 0, (0, code_1._)`${arr}.length`, (i) => {
					this.var(name, (0, code_1._)`${arr}[${i}]`);
					forBody(name);
				});
			}
			return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
		}
		forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
			if (this.opts.ownProperties) return this.forOf(nameOrPrefix, (0, code_1._)`Object.keys(${obj})`, forBody);
			const name = this._scope.toName(nameOrPrefix);
			return this._for(new ForIter("in", varKind, name, obj), () => forBody(name));
		}
		endFor() {
			return this._endBlockNode(For);
		}
		label(label) {
			return this._leafNode(new Label(label));
		}
		break(label) {
			return this._leafNode(new Break(label));
		}
		return(value) {
			const node = new Return();
			this._blockNode(node);
			this.code(value);
			if (node.nodes.length !== 1) throw new Error("CodeGen: \"return\" should have one node");
			return this._endBlockNode(Return);
		}
		try(tryBody, catchCode, finallyCode) {
			if (!catchCode && !finallyCode) throw new Error("CodeGen: \"try\" without \"catch\" and \"finally\"");
			const node = new Try();
			this._blockNode(node);
			this.code(tryBody);
			if (catchCode) {
				const error = this.name("e");
				this._currNode = node.catch = new Catch(error);
				catchCode(error);
			}
			if (finallyCode) {
				this._currNode = node.finally = new Finally();
				this.code(finallyCode);
			}
			return this._endBlockNode(Catch, Finally);
		}
		throw(error) {
			return this._leafNode(new Throw(error));
		}
		block(body, nodeCount) {
			this._blockStarts.push(this._nodes.length);
			if (body) this.code(body).endBlock(nodeCount);
			return this;
		}
		endBlock(nodeCount) {
			const len = this._blockStarts.pop();
			if (len === void 0) throw new Error("CodeGen: not in self-balancing block");
			const toClose = this._nodes.length - len;
			if (toClose < 0 || nodeCount !== void 0 && toClose !== nodeCount) throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
			this._nodes.length = len;
			return this;
		}
		func(name, args = code_1.nil, async, funcBody) {
			this._blockNode(new Func(name, args, async));
			if (funcBody) this.code(funcBody).endFunc();
			return this;
		}
		endFunc() {
			return this._endBlockNode(Func);
		}
		optimize(n = 1) {
			while (n-- > 0) {
				this._root.optimizeNodes();
				this._root.optimizeNames(this._root.names, this._constants);
			}
		}
		_leafNode(node) {
			this._currNode.nodes.push(node);
			return this;
		}
		_blockNode(node) {
			this._currNode.nodes.push(node);
			this._nodes.push(node);
		}
		_endBlockNode(N1, N2) {
			const n = this._currNode;
			if (n instanceof N1 || N2 && n instanceof N2) {
				this._nodes.pop();
				return this;
			}
			throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
		}
		_elseNode(node) {
			const n = this._currNode;
			if (!(n instanceof If)) throw new Error("CodeGen: \"else\" without \"if\"");
			this._currNode = n.else = node;
			return this;
		}
		get _root() {
			return this._nodes[0];
		}
		get _currNode() {
			const ns = this._nodes;
			return ns[ns.length - 1];
		}
		set _currNode(node) {
			const ns = this._nodes;
			ns[ns.length - 1] = node;
		}
	};
	exports.CodeGen = CodeGen;
	function addNames(names, from) {
		for (const n in from) names[n] = (names[n] || 0) + (from[n] || 0);
		return names;
	}
	function addExprNames(names, from) {
		return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
	}
	function optimizeExpr(expr, names, constants) {
		if (expr instanceof code_1.Name) return replaceName(expr);
		if (!canOptimize(expr)) return expr;
		return new code_1._Code(expr._items.reduce((items, c) => {
			if (c instanceof code_1.Name) c = replaceName(c);
			if (c instanceof code_1._Code) items.push(...c._items);
			else items.push(c);
			return items;
		}, []));
		function replaceName(n) {
			const c = constants[n.str];
			if (c === void 0 || names[n.str] !== 1) return n;
			delete names[n.str];
			return c;
		}
		function canOptimize(e) {
			return e instanceof code_1._Code && e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants[c.str] !== void 0);
		}
	}
	function subtractNames(names, from) {
		for (const n in from) names[n] = (names[n] || 0) - (from[n] || 0);
	}
	function not(x) {
		return typeof x == "boolean" || typeof x == "number" || x === null ? !x : (0, code_1._)`!${par(x)}`;
	}
	exports.not = not;
	var andCode = mappend(exports.operators.AND);
	function and(...args) {
		return args.reduce(andCode);
	}
	exports.and = and;
	var orCode = mappend(exports.operators.OR);
	function or(...args) {
		return args.reduce(orCode);
	}
	exports.or = or;
	function mappend(op) {
		return (x, y) => x === code_1.nil ? y : y === code_1.nil ? x : (0, code_1._)`${par(x)} ${op} ${par(y)}`;
	}
	function par(x) {
		return x instanceof code_1.Name ? x : (0, code_1._)`(${x})`;
	}
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/util.js
var require_util$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.checkStrictMode = exports.getErrorPath = exports.Type = exports.useFunc = exports.setEvaluated = exports.evaluatedPropsToName = exports.mergeEvaluated = exports.eachItem = exports.unescapeJsonPointer = exports.escapeJsonPointer = exports.escapeFragment = exports.unescapeFragment = exports.schemaRefOrVal = exports.schemaHasRulesButRef = exports.schemaHasRules = exports.checkUnknownRules = exports.alwaysValidSchema = exports.toHash = void 0;
	var codegen_1 = require_codegen();
	var code_1 = require_code$1();
	function toHash(arr) {
		const hash = {};
		for (const item of arr) hash[item] = true;
		return hash;
	}
	exports.toHash = toHash;
	function alwaysValidSchema(it, schema) {
		if (typeof schema == "boolean") return schema;
		if (Object.keys(schema).length === 0) return true;
		checkUnknownRules(it, schema);
		return !schemaHasRules(schema, it.self.RULES.all);
	}
	exports.alwaysValidSchema = alwaysValidSchema;
	function checkUnknownRules(it, schema = it.schema) {
		const { opts, self } = it;
		if (!opts.strictSchema) return;
		if (typeof schema === "boolean") return;
		const rules = self.RULES.keywords;
		for (const key in schema) if (!rules[key]) checkStrictMode(it, `unknown keyword: "${key}"`);
	}
	exports.checkUnknownRules = checkUnknownRules;
	function schemaHasRules(schema, rules) {
		if (typeof schema == "boolean") return !schema;
		for (const key in schema) if (rules[key]) return true;
		return false;
	}
	exports.schemaHasRules = schemaHasRules;
	function schemaHasRulesButRef(schema, RULES) {
		if (typeof schema == "boolean") return !schema;
		for (const key in schema) if (key !== "$ref" && RULES.all[key]) return true;
		return false;
	}
	exports.schemaHasRulesButRef = schemaHasRulesButRef;
	function schemaRefOrVal({ topSchemaRef, schemaPath }, schema, keyword, $data) {
		if (!$data) {
			if (typeof schema == "number" || typeof schema == "boolean") return schema;
			if (typeof schema == "string") return (0, codegen_1._)`${schema}`;
		}
		return (0, codegen_1._)`${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
	}
	exports.schemaRefOrVal = schemaRefOrVal;
	function unescapeFragment(str) {
		return unescapeJsonPointer(decodeURIComponent(str));
	}
	exports.unescapeFragment = unescapeFragment;
	function escapeFragment(str) {
		return encodeURIComponent(escapeJsonPointer(str));
	}
	exports.escapeFragment = escapeFragment;
	function escapeJsonPointer(str) {
		if (typeof str == "number") return `${str}`;
		return str.replace(/~/g, "~0").replace(/\//g, "~1");
	}
	exports.escapeJsonPointer = escapeJsonPointer;
	function unescapeJsonPointer(str) {
		return str.replace(/~1/g, "/").replace(/~0/g, "~");
	}
	exports.unescapeJsonPointer = unescapeJsonPointer;
	function eachItem(xs, f) {
		if (Array.isArray(xs)) for (const x of xs) f(x);
		else f(xs);
	}
	exports.eachItem = eachItem;
	function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName }) {
		return (gen, from, to, toName) => {
			const res = to === void 0 ? from : to instanceof codegen_1.Name ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to) : from instanceof codegen_1.Name ? (mergeToName(gen, to, from), from) : mergeValues(from, to);
			return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
		};
	}
	exports.mergeEvaluated = {
		props: makeMergeEvaluated({
			mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => {
				gen.if((0, codegen_1._)`${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._)`${to} || {}`).code((0, codegen_1._)`Object.assign(${to}, ${from})`));
			}),
			mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => {
				if (from === true) gen.assign(to, true);
				else {
					gen.assign(to, (0, codegen_1._)`${to} || {}`);
					setEvaluated(gen, to, from);
				}
			}),
			mergeValues: (from, to) => from === true ? true : {
				...from,
				...to
			},
			resultToName: evaluatedPropsToName
		}),
		items: makeMergeEvaluated({
			mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
			mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._)`${to} > ${from} ? ${to} : ${from}`)),
			mergeValues: (from, to) => from === true ? true : Math.max(from, to),
			resultToName: (gen, items) => gen.var("items", items)
		})
	};
	function evaluatedPropsToName(gen, ps) {
		if (ps === true) return gen.var("props", true);
		const props = gen.var("props", (0, codegen_1._)`{}`);
		if (ps !== void 0) setEvaluated(gen, props, ps);
		return props;
	}
	exports.evaluatedPropsToName = evaluatedPropsToName;
	function setEvaluated(gen, props, ps) {
		Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`, true));
	}
	exports.setEvaluated = setEvaluated;
	var snippets = {};
	function useFunc(gen, f) {
		return gen.scopeValue("func", {
			ref: f,
			code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code))
		});
	}
	exports.useFunc = useFunc;
	var Type;
	(function(Type) {
		Type[Type["Num"] = 0] = "Num";
		Type[Type["Str"] = 1] = "Str";
	})(Type || (exports.Type = Type = {}));
	function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
		if (dataProp instanceof codegen_1.Name) {
			const isNumber = dataPropType === Type.Num;
			return jsPropertySyntax ? isNumber ? (0, codegen_1._)`"[" + ${dataProp} + "]"` : (0, codegen_1._)`"['" + ${dataProp} + "']"` : isNumber ? (0, codegen_1._)`"/" + ${dataProp}` : (0, codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
		}
		return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
	}
	exports.getErrorPath = getErrorPath;
	function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
		if (!mode) return;
		msg = `strict mode: ${msg}`;
		if (mode === true) throw new Error(msg);
		it.self.logger.warn(msg);
	}
	exports.checkStrictMode = checkStrictMode;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/names.js
var require_names = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var codegen_1 = require_codegen();
	exports.default = {
		data: new codegen_1.Name("data"),
		valCxt: new codegen_1.Name("valCxt"),
		instancePath: new codegen_1.Name("instancePath"),
		parentData: new codegen_1.Name("parentData"),
		parentDataProperty: new codegen_1.Name("parentDataProperty"),
		rootData: new codegen_1.Name("rootData"),
		dynamicAnchors: new codegen_1.Name("dynamicAnchors"),
		vErrors: new codegen_1.Name("vErrors"),
		errors: new codegen_1.Name("errors"),
		this: new codegen_1.Name("this"),
		self: new codegen_1.Name("self"),
		scope: new codegen_1.Name("scope"),
		json: new codegen_1.Name("json"),
		jsonPos: new codegen_1.Name("jsonPos"),
		jsonLen: new codegen_1.Name("jsonLen"),
		jsonPart: new codegen_1.Name("jsonPart")
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/errors.js
var require_errors = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = void 0;
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	var names_1 = require_names();
	exports.keywordError = { message: ({ keyword }) => (0, codegen_1.str)`must pass "${keyword}" keyword validation` };
	exports.keyword$DataError = { message: ({ keyword, schemaType }) => schemaType ? (0, codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)` : (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)` };
	function reportError(cxt, error = exports.keywordError, errorPaths, overrideAllErrors) {
		const { it } = cxt;
		const { gen, compositeRule, allErrors } = it;
		const errObj = errorObjectCode(cxt, error, errorPaths);
		if (overrideAllErrors !== null && overrideAllErrors !== void 0 ? overrideAllErrors : compositeRule || allErrors) addError(gen, errObj);
		else returnErrors(it, (0, codegen_1._)`[${errObj}]`);
	}
	exports.reportError = reportError;
	function reportExtraError(cxt, error = exports.keywordError, errorPaths) {
		const { it } = cxt;
		const { gen, compositeRule, allErrors } = it;
		addError(gen, errorObjectCode(cxt, error, errorPaths));
		if (!(compositeRule || allErrors)) returnErrors(it, names_1.default.vErrors);
	}
	exports.reportExtraError = reportExtraError;
	function resetErrorsCount(gen, errsCount) {
		gen.assign(names_1.default.errors, errsCount);
		gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._)`${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
	}
	exports.resetErrorsCount = resetErrorsCount;
	function extendErrors({ gen, keyword, schemaValue, data, errsCount, it }) {
		/* istanbul ignore if */
		if (errsCount === void 0) throw new Error("ajv implementation error");
		const err = gen.name("err");
		gen.forRange("i", errsCount, names_1.default.errors, (i) => {
			gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`);
			gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._)`${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath)));
			gen.assign((0, codegen_1._)`${err}.schemaPath`, (0, codegen_1.str)`${it.errSchemaPath}/${keyword}`);
			if (it.opts.verbose) {
				gen.assign((0, codegen_1._)`${err}.schema`, schemaValue);
				gen.assign((0, codegen_1._)`${err}.data`, data);
			}
		});
	}
	exports.extendErrors = extendErrors;
	function addError(gen, errObj) {
		const err = gen.const("err", errObj);
		gen.if((0, codegen_1._)`${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`), (0, codegen_1._)`${names_1.default.vErrors}.push(${err})`);
		gen.code((0, codegen_1._)`${names_1.default.errors}++`);
	}
	function returnErrors(it, errs) {
		const { gen, validateName, schemaEnv } = it;
		if (schemaEnv.$async) gen.throw((0, codegen_1._)`new ${it.ValidationError}(${errs})`);
		else {
			gen.assign((0, codegen_1._)`${validateName}.errors`, errs);
			gen.return(false);
		}
	}
	var E = {
		keyword: new codegen_1.Name("keyword"),
		schemaPath: new codegen_1.Name("schemaPath"),
		params: new codegen_1.Name("params"),
		propertyName: new codegen_1.Name("propertyName"),
		message: new codegen_1.Name("message"),
		schema: new codegen_1.Name("schema"),
		parentSchema: new codegen_1.Name("parentSchema")
	};
	function errorObjectCode(cxt, error, errorPaths) {
		const { createErrors } = cxt.it;
		if (createErrors === false) return (0, codegen_1._)`{}`;
		return errorObject(cxt, error, errorPaths);
	}
	function errorObject(cxt, error, errorPaths = {}) {
		const { gen, it } = cxt;
		const keyValues = [errorInstancePath(it, errorPaths), errorSchemaPath(cxt, errorPaths)];
		extraErrorProps(cxt, error, keyValues);
		return gen.object(...keyValues);
	}
	function errorInstancePath({ errorPath }, { instancePath }) {
		const instPath = instancePath ? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}` : errorPath;
		return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
	}
	function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
		let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
		if (schemaPath) schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
		return [E.schemaPath, schPath];
	}
	function extraErrorProps(cxt, { params, message }, keyValues) {
		const { keyword, data, schemaValue, it } = cxt;
		const { opts, propertyName, topSchemaRef, schemaPath } = it;
		keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._)`{}`]);
		if (opts.messages) keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
		if (opts.verbose) keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._)`${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
		if (propertyName) keyValues.push([E.propertyName, propertyName]);
	}
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = void 0;
	var errors_1 = require_errors();
	var codegen_1 = require_codegen();
	var names_1 = require_names();
	var boolError = { message: "boolean schema is false" };
	function topBoolOrEmptySchema(it) {
		const { gen, schema, validateName } = it;
		if (schema === false) falseSchemaError(it, false);
		else if (typeof schema == "object" && schema.$async === true) gen.return(names_1.default.data);
		else {
			gen.assign((0, codegen_1._)`${validateName}.errors`, null);
			gen.return(true);
		}
	}
	exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
	function boolOrEmptySchema(it, valid) {
		const { gen, schema } = it;
		if (schema === false) {
			gen.var(valid, false);
			falseSchemaError(it);
		} else gen.var(valid, true);
	}
	exports.boolOrEmptySchema = boolOrEmptySchema;
	function falseSchemaError(it, overrideAllErrors) {
		const { gen, data } = it;
		const cxt = {
			gen,
			keyword: "false schema",
			data,
			schema: false,
			schemaCode: false,
			schemaValue: false,
			params: {},
			it
		};
		(0, errors_1.reportError)(cxt, boolError, void 0, overrideAllErrors);
	}
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/rules.js
var require_rules = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.getRules = exports.isJSONType = void 0;
	var jsonTypes = new Set([
		"string",
		"number",
		"integer",
		"boolean",
		"null",
		"object",
		"array"
	]);
	function isJSONType(x) {
		return typeof x == "string" && jsonTypes.has(x);
	}
	exports.isJSONType = isJSONType;
	function getRules() {
		const groups = {
			number: {
				type: "number",
				rules: []
			},
			string: {
				type: "string",
				rules: []
			},
			array: {
				type: "array",
				rules: []
			},
			object: {
				type: "object",
				rules: []
			}
		};
		return {
			types: {
				...groups,
				integer: true,
				boolean: true,
				null: true
			},
			rules: [
				{ rules: [] },
				groups.number,
				groups.string,
				groups.array,
				groups.object
			],
			post: { rules: [] },
			all: {},
			keywords: {}
		};
	}
	exports.getRules = getRules;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/validate/applicability.js
var require_applicability = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.shouldUseRule = exports.shouldUseGroup = exports.schemaHasRulesForType = void 0;
	function schemaHasRulesForType({ schema, self }, type) {
		const group = self.RULES.types[type];
		return group && group !== true && shouldUseGroup(schema, group);
	}
	exports.schemaHasRulesForType = schemaHasRulesForType;
	function shouldUseGroup(schema, group) {
		return group.rules.some((rule) => shouldUseRule(schema, rule));
	}
	exports.shouldUseGroup = shouldUseGroup;
	function shouldUseRule(schema, rule) {
		var _a;
		return schema[rule.keyword] !== void 0 || ((_a = rule.definition.implements) === null || _a === void 0 ? void 0 : _a.some((kwd) => schema[kwd] !== void 0));
	}
	exports.shouldUseRule = shouldUseRule;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/validate/dataType.js
var require_dataType = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.reportTypeError = exports.checkDataTypes = exports.checkDataType = exports.coerceAndCheckDataType = exports.getJSONTypes = exports.getSchemaTypes = exports.DataType = void 0;
	var rules_1 = require_rules();
	var applicability_1 = require_applicability();
	var errors_1 = require_errors();
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	var DataType;
	(function(DataType) {
		DataType[DataType["Correct"] = 0] = "Correct";
		DataType[DataType["Wrong"] = 1] = "Wrong";
	})(DataType || (exports.DataType = DataType = {}));
	function getSchemaTypes(schema) {
		const types = getJSONTypes(schema.type);
		if (types.includes("null")) {
			if (schema.nullable === false) throw new Error("type: null contradicts nullable: false");
		} else {
			if (!types.length && schema.nullable !== void 0) throw new Error("\"nullable\" cannot be used without \"type\"");
			if (schema.nullable === true) types.push("null");
		}
		return types;
	}
	exports.getSchemaTypes = getSchemaTypes;
	function getJSONTypes(ts) {
		const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
		if (types.every(rules_1.isJSONType)) return types;
		throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
	}
	exports.getJSONTypes = getJSONTypes;
	function coerceAndCheckDataType(it, types) {
		const { gen, data, opts } = it;
		const coerceTo = coerceToTypes(types, opts.coerceTypes);
		const checkTypes = types.length > 0 && !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
		if (checkTypes) {
			const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
			gen.if(wrongType, () => {
				if (coerceTo.length) coerceData(it, types, coerceTo);
				else reportTypeError(it);
			});
		}
		return checkTypes;
	}
	exports.coerceAndCheckDataType = coerceAndCheckDataType;
	var COERCIBLE = new Set([
		"string",
		"number",
		"integer",
		"boolean",
		"null"
	]);
	function coerceToTypes(types, coerceTypes) {
		return coerceTypes ? types.filter((t) => COERCIBLE.has(t) || coerceTypes === "array" && t === "array") : [];
	}
	function coerceData(it, types, coerceTo) {
		const { gen, data, opts } = it;
		const dataType = gen.let("dataType", (0, codegen_1._)`typeof ${data}`);
		const coerced = gen.let("coerced", (0, codegen_1._)`undefined`);
		if (opts.coerceTypes === "array") gen.if((0, codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen.assign(data, (0, codegen_1._)`${data}[0]`).assign(dataType, (0, codegen_1._)`typeof ${data}`).if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
		gen.if((0, codegen_1._)`${coerced} !== undefined`);
		for (const t of coerceTo) if (COERCIBLE.has(t) || t === "array" && opts.coerceTypes === "array") coerceSpecificType(t);
		gen.else();
		reportTypeError(it);
		gen.endIf();
		gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
			gen.assign(data, coerced);
			assignParentData(it, coerced);
		});
		function coerceSpecificType(t) {
			switch (t) {
				case "string":
					gen.elseIf((0, codegen_1._)`${dataType} == "number" || ${dataType} == "boolean"`).assign(coerced, (0, codegen_1._)`"" + ${data}`).elseIf((0, codegen_1._)`${data} === null`).assign(coerced, (0, codegen_1._)`""`);
					return;
				case "number":
					gen.elseIf((0, codegen_1._)`${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`).assign(coerced, (0, codegen_1._)`+${data}`);
					return;
				case "integer":
					gen.elseIf((0, codegen_1._)`${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`).assign(coerced, (0, codegen_1._)`+${data}`);
					return;
				case "boolean":
					gen.elseIf((0, codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`).assign(coerced, false).elseIf((0, codegen_1._)`${data} === "true" || ${data} === 1`).assign(coerced, true);
					return;
				case "null":
					gen.elseIf((0, codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`);
					gen.assign(coerced, null);
					return;
				case "array": gen.elseIf((0, codegen_1._)`${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`).assign(coerced, (0, codegen_1._)`[${data}]`);
			}
		}
	}
	function assignParentData({ gen, parentData, parentDataProperty }, expr) {
		gen.if((0, codegen_1._)`${parentData} !== undefined`, () => gen.assign((0, codegen_1._)`${parentData}[${parentDataProperty}]`, expr));
	}
	function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
		const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
		let cond;
		switch (dataType) {
			case "null": return (0, codegen_1._)`${data} ${EQ} null`;
			case "array":
				cond = (0, codegen_1._)`Array.isArray(${data})`;
				break;
			case "object":
				cond = (0, codegen_1._)`${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
				break;
			case "integer":
				cond = numCond((0, codegen_1._)`!(${data} % 1) && !isNaN(${data})`);
				break;
			case "number":
				cond = numCond();
				break;
			default: return (0, codegen_1._)`typeof ${data} ${EQ} ${dataType}`;
		}
		return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
		function numCond(_cond = codegen_1.nil) {
			return (0, codegen_1.and)((0, codegen_1._)`typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._)`isFinite(${data})` : codegen_1.nil);
		}
	}
	exports.checkDataType = checkDataType;
	function checkDataTypes(dataTypes, data, strictNums, correct) {
		if (dataTypes.length === 1) return checkDataType(dataTypes[0], data, strictNums, correct);
		let cond;
		const types = (0, util_1.toHash)(dataTypes);
		if (types.array && types.object) {
			const notObj = (0, codegen_1._)`typeof ${data} != "object"`;
			cond = types.null ? notObj : (0, codegen_1._)`!${data} || ${notObj}`;
			delete types.null;
			delete types.array;
			delete types.object;
		} else cond = codegen_1.nil;
		if (types.number) delete types.integer;
		for (const t in types) cond = (0, codegen_1.and)(cond, checkDataType(t, data, strictNums, correct));
		return cond;
	}
	exports.checkDataTypes = checkDataTypes;
	var typeError = {
		message: ({ schema }) => `must be ${schema}`,
		params: ({ schema, schemaValue }) => typeof schema == "string" ? (0, codegen_1._)`{type: ${schema}}` : (0, codegen_1._)`{type: ${schemaValue}}`
	};
	function reportTypeError(it) {
		const cxt = getTypeErrorContext(it);
		(0, errors_1.reportError)(cxt, typeError);
	}
	exports.reportTypeError = reportTypeError;
	function getTypeErrorContext(it) {
		const { gen, data, schema } = it;
		const schemaCode = (0, util_1.schemaRefOrVal)(it, schema, "type");
		return {
			gen,
			keyword: "type",
			data,
			schema: schema.type,
			schemaCode,
			schemaValue: schemaCode,
			parentSchema: schema,
			params: {},
			it
		};
	}
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/validate/defaults.js
var require_defaults = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.assignDefaults = void 0;
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	function assignDefaults(it, ty) {
		const { properties, items } = it.schema;
		if (ty === "object" && properties) for (const key in properties) assignDefault(it, key, properties[key].default);
		else if (ty === "array" && Array.isArray(items)) items.forEach((sch, i) => assignDefault(it, i, sch.default));
	}
	exports.assignDefaults = assignDefaults;
	function assignDefault(it, prop, defaultValue) {
		const { gen, compositeRule, data, opts } = it;
		if (defaultValue === void 0) return;
		const childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(prop)}`;
		if (compositeRule) {
			(0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
			return;
		}
		let condition = (0, codegen_1._)`${childData} === undefined`;
		if (opts.useDefaults === "empty") condition = (0, codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`;
		gen.if(condition, (0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
	}
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/code.js
var require_code = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.validateUnion = exports.validateArray = exports.usePattern = exports.callValidateCode = exports.schemaProperties = exports.allSchemaProperties = exports.noPropertyInData = exports.propertyInData = exports.isOwnProperty = exports.hasPropFunc = exports.reportMissingProp = exports.checkMissingProp = exports.checkReportMissingProp = void 0;
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	var names_1 = require_names();
	var util_2 = require_util$1();
	function checkReportMissingProp(cxt, prop) {
		const { gen, data, it } = cxt;
		gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
			cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, true);
			cxt.error();
		});
	}
	exports.checkReportMissingProp = checkReportMissingProp;
	function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
		return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._)`${missing} = ${prop}`)));
	}
	exports.checkMissingProp = checkMissingProp;
	function reportMissingProp(cxt, missing) {
		cxt.setParams({ missingProperty: missing }, true);
		cxt.error();
	}
	exports.reportMissingProp = reportMissingProp;
	function hasPropFunc(gen) {
		return gen.scopeValue("func", {
			ref: Object.prototype.hasOwnProperty,
			code: (0, codegen_1._)`Object.prototype.hasOwnProperty`
		});
	}
	exports.hasPropFunc = hasPropFunc;
	function isOwnProperty(gen, data, property) {
		return (0, codegen_1._)`${hasPropFunc(gen)}.call(${data}, ${property})`;
	}
	exports.isOwnProperty = isOwnProperty;
	function propertyInData(gen, data, property, ownProperties) {
		const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
		return ownProperties ? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}` : cond;
	}
	exports.propertyInData = propertyInData;
	function noPropertyInData(gen, data, property, ownProperties) {
		const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} === undefined`;
		return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
	}
	exports.noPropertyInData = noPropertyInData;
	function allSchemaProperties(schemaMap) {
		return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
	}
	exports.allSchemaProperties = allSchemaProperties;
	function schemaProperties(it, schemaMap) {
		return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p]));
	}
	exports.schemaProperties = schemaProperties;
	function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it }, func, context, passSchema) {
		const dataAndSchema = passSchema ? (0, codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
		const valCxt = [
			[names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
			[names_1.default.parentData, it.parentData],
			[names_1.default.parentDataProperty, it.parentDataProperty],
			[names_1.default.rootData, names_1.default.rootData]
		];
		if (it.opts.dynamicRef) valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
		const args = (0, codegen_1._)`${dataAndSchema}, ${gen.object(...valCxt)}`;
		return context !== codegen_1.nil ? (0, codegen_1._)`${func}.call(${context}, ${args})` : (0, codegen_1._)`${func}(${args})`;
	}
	exports.callValidateCode = callValidateCode;
	var newRegExp = (0, codegen_1._)`new RegExp`;
	function usePattern({ gen, it: { opts } }, pattern) {
		const u = opts.unicodeRegExp ? "u" : "";
		const { regExp } = opts.code;
		const rx = regExp(pattern, u);
		return gen.scopeValue("pattern", {
			key: rx.toString(),
			ref: rx,
			code: (0, codegen_1._)`${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`
		});
	}
	exports.usePattern = usePattern;
	function validateArray(cxt) {
		const { gen, data, keyword, it } = cxt;
		const valid = gen.name("valid");
		if (it.allErrors) {
			const validArr = gen.let("valid", true);
			validateItems(() => gen.assign(validArr, false));
			return validArr;
		}
		gen.var(valid, true);
		validateItems(() => gen.break());
		return valid;
		function validateItems(notValid) {
			const len = gen.const("len", (0, codegen_1._)`${data}.length`);
			gen.forRange("i", 0, len, (i) => {
				cxt.subschema({
					keyword,
					dataProp: i,
					dataPropType: util_1.Type.Num
				}, valid);
				gen.if((0, codegen_1.not)(valid), notValid);
			});
		}
	}
	exports.validateArray = validateArray;
	function validateUnion(cxt) {
		const { gen, schema, keyword, it } = cxt;
		/* istanbul ignore if */
		if (!Array.isArray(schema)) throw new Error("ajv implementation error");
		if (schema.some((sch) => (0, util_1.alwaysValidSchema)(it, sch)) && !it.opts.unevaluated) return;
		const valid = gen.let("valid", false);
		const schValid = gen.name("_valid");
		gen.block(() => schema.forEach((_sch, i) => {
			const schCxt = cxt.subschema({
				keyword,
				schemaProp: i,
				compositeRule: true
			}, schValid);
			gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`);
			if (!cxt.mergeValidEvaluated(schCxt, schValid)) gen.if((0, codegen_1.not)(valid));
		}));
		cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
	}
	exports.validateUnion = validateUnion;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.validateKeywordUsage = exports.validSchemaType = exports.funcKeywordCode = exports.macroKeywordCode = void 0;
	var codegen_1 = require_codegen();
	var names_1 = require_names();
	var code_1 = require_code();
	var errors_1 = require_errors();
	function macroKeywordCode(cxt, def) {
		const { gen, keyword, schema, parentSchema, it } = cxt;
		const macroSchema = def.macro.call(it.self, schema, parentSchema, it);
		const schemaRef = useKeyword(gen, keyword, macroSchema);
		if (it.opts.validateSchema !== false) it.self.validateSchema(macroSchema, true);
		const valid = gen.name("valid");
		cxt.subschema({
			schema: macroSchema,
			schemaPath: codegen_1.nil,
			errSchemaPath: `${it.errSchemaPath}/${keyword}`,
			topSchemaRef: schemaRef,
			compositeRule: true
		}, valid);
		cxt.pass(valid, () => cxt.error(true));
	}
	exports.macroKeywordCode = macroKeywordCode;
	function funcKeywordCode(cxt, def) {
		var _a;
		const { gen, keyword, schema, parentSchema, $data, it } = cxt;
		checkAsyncKeyword(it, def);
		const validateRef = useKeyword(gen, keyword, !$data && def.compile ? def.compile.call(it.self, schema, parentSchema, it) : def.validate);
		const valid = gen.let("valid");
		cxt.block$data(valid, validateKeyword);
		cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
		function validateKeyword() {
			if (def.errors === false) {
				assignValid();
				if (def.modifying) modifyData(cxt);
				reportErrs(() => cxt.error());
			} else {
				const ruleErrs = def.async ? validateAsync() : validateSync();
				if (def.modifying) modifyData(cxt);
				reportErrs(() => addErrs(cxt, ruleErrs));
			}
		}
		function validateAsync() {
			const ruleErrs = gen.let("ruleErrs", null);
			gen.try(() => assignValid((0, codegen_1._)`await `), (e) => gen.assign(valid, false).if((0, codegen_1._)`${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`), () => gen.throw(e)));
			return ruleErrs;
		}
		function validateSync() {
			const validateErrs = (0, codegen_1._)`${validateRef}.errors`;
			gen.assign(validateErrs, null);
			assignValid(codegen_1.nil);
			return validateErrs;
		}
		function assignValid(_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil) {
			const passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self;
			const passSchema = !("compile" in def && !$data || def.schema === false);
			gen.assign(valid, (0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
		}
		function reportErrs(errors) {
			var _a;
			gen.if((0, codegen_1.not)((_a = def.valid) !== null && _a !== void 0 ? _a : valid), errors);
		}
	}
	exports.funcKeywordCode = funcKeywordCode;
	function modifyData(cxt) {
		const { gen, data, it } = cxt;
		gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._)`${it.parentData}[${it.parentDataProperty}]`));
	}
	function addErrs(cxt, errs) {
		const { gen } = cxt;
		gen.if((0, codegen_1._)`Array.isArray(${errs})`, () => {
			gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`).assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
			(0, errors_1.extendErrors)(cxt);
		}, () => cxt.error());
	}
	function checkAsyncKeyword({ schemaEnv }, def) {
		if (def.async && !schemaEnv.$async) throw new Error("async keyword in sync schema");
	}
	function useKeyword(gen, keyword, result) {
		if (result === void 0) throw new Error(`keyword "${keyword}" failed to compile`);
		return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : {
			ref: result,
			code: (0, codegen_1.stringify)(result)
		});
	}
	function validSchemaType(schema, schemaType, allowUndefined = false) {
		return !schemaType.length || schemaType.some((st) => st === "array" ? Array.isArray(schema) : st === "object" ? schema && typeof schema == "object" && !Array.isArray(schema) : typeof schema == st || allowUndefined && typeof schema == "undefined");
	}
	exports.validSchemaType = validSchemaType;
	function validateKeywordUsage({ schema, opts, self, errSchemaPath }, def, keyword) {
		/* istanbul ignore if */
		if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) throw new Error("ajv implementation error");
		const deps = def.dependencies;
		if (deps === null || deps === void 0 ? void 0 : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema, kwd))) throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
		if (def.validateSchema) {
			if (!def.validateSchema(schema[keyword])) {
				const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` + self.errorsText(def.validateSchema.errors);
				if (opts.validateSchema === "log") self.logger.error(msg);
				else throw new Error(msg);
			}
		}
	}
	exports.validateKeywordUsage = validateKeywordUsage;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.extendSubschemaMode = exports.extendSubschemaData = exports.getSubschema = void 0;
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	function getSubschema(it, { keyword, schemaProp, schema, schemaPath, errSchemaPath, topSchemaRef }) {
		if (keyword !== void 0 && schema !== void 0) throw new Error("both \"keyword\" and \"schema\" passed, only one allowed");
		if (keyword !== void 0) {
			const sch = it.schema[keyword];
			return schemaProp === void 0 ? {
				schema: sch,
				schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
				errSchemaPath: `${it.errSchemaPath}/${keyword}`
			} : {
				schema: sch[schemaProp],
				schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
				errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`
			};
		}
		if (schema !== void 0) {
			if (schemaPath === void 0 || errSchemaPath === void 0 || topSchemaRef === void 0) throw new Error("\"schemaPath\", \"errSchemaPath\" and \"topSchemaRef\" are required with \"schema\"");
			return {
				schema,
				schemaPath,
				topSchemaRef,
				errSchemaPath
			};
		}
		throw new Error("either \"keyword\" or \"schema\" must be passed");
	}
	exports.getSubschema = getSubschema;
	function extendSubschemaData(subschema, it, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
		if (data !== void 0 && dataProp !== void 0) throw new Error("both \"data\" and \"dataProp\" passed, only one allowed");
		const { gen } = it;
		if (dataProp !== void 0) {
			const { errorPath, dataPathArr, opts } = it;
			dataContextProps(gen.let("data", (0, codegen_1._)`${it.data}${(0, codegen_1.getProperty)(dataProp)}`, true));
			subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
			subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`;
			subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
		}
		if (data !== void 0) {
			dataContextProps(data instanceof codegen_1.Name ? data : gen.let("data", data, true));
			if (propertyName !== void 0) subschema.propertyName = propertyName;
		}
		if (dataTypes) subschema.dataTypes = dataTypes;
		function dataContextProps(_nextData) {
			subschema.data = _nextData;
			subschema.dataLevel = it.dataLevel + 1;
			subschema.dataTypes = [];
			it.definedProperties = /* @__PURE__ */ new Set();
			subschema.parentData = it.data;
			subschema.dataNames = [...it.dataNames, _nextData];
		}
	}
	exports.extendSubschemaData = extendSubschemaData;
	function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
		if (compositeRule !== void 0) subschema.compositeRule = compositeRule;
		if (createErrors !== void 0) subschema.createErrors = createErrors;
		if (allErrors !== void 0) subschema.allErrors = allErrors;
		subschema.jtdDiscriminator = jtdDiscriminator;
		subschema.jtdMetadata = jtdMetadata;
	}
	exports.extendSubschemaMode = extendSubschemaMode;
}));
//#endregion
//#region ../../node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = function equal(a, b) {
		if (a === b) return true;
		if (a && b && typeof a == "object" && typeof b == "object") {
			if (a.constructor !== b.constructor) return false;
			var length, i, keys;
			if (Array.isArray(a)) {
				length = a.length;
				if (length != b.length) return false;
				for (i = length; i-- !== 0;) if (!equal(a[i], b[i])) return false;
				return true;
			}
			if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
			if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
			if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
			keys = Object.keys(a);
			length = keys.length;
			if (length !== Object.keys(b).length) return false;
			for (i = length; i-- !== 0;) if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
			for (i = length; i-- !== 0;) {
				var key = keys[i];
				if (!equal(a[key], b[key])) return false;
			}
			return true;
		}
		return a !== a && b !== b;
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var traverse = module.exports = function(schema, opts, cb) {
		if (typeof opts == "function") {
			cb = opts;
			opts = {};
		}
		cb = opts.cb || cb;
		var pre = typeof cb == "function" ? cb : cb.pre || function() {};
		var post = cb.post || function() {};
		_traverse(opts, pre, post, schema, "", schema);
	};
	traverse.keywords = {
		additionalItems: true,
		items: true,
		contains: true,
		additionalProperties: true,
		propertyNames: true,
		not: true,
		if: true,
		then: true,
		else: true
	};
	traverse.arrayKeywords = {
		items: true,
		allOf: true,
		anyOf: true,
		oneOf: true
	};
	traverse.propsKeywords = {
		$defs: true,
		definitions: true,
		properties: true,
		patternProperties: true,
		dependencies: true
	};
	traverse.skipKeywords = {
		default: true,
		enum: true,
		const: true,
		required: true,
		maximum: true,
		minimum: true,
		exclusiveMaximum: true,
		exclusiveMinimum: true,
		multipleOf: true,
		maxLength: true,
		minLength: true,
		pattern: true,
		format: true,
		maxItems: true,
		minItems: true,
		uniqueItems: true,
		maxProperties: true,
		minProperties: true
	};
	function _traverse(opts, pre, post, schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
		if (schema && typeof schema == "object" && !Array.isArray(schema)) {
			pre(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
			for (var key in schema) {
				var sch = schema[key];
				if (Array.isArray(sch)) {
					if (key in traverse.arrayKeywords) for (var i = 0; i < sch.length; i++) _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema, i);
				} else if (key in traverse.propsKeywords) {
					if (sch && typeof sch == "object") for (var prop in sch) _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema, prop);
				} else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema);
			}
			post(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
		}
	}
	function escapeJsonPtr(str) {
		return str.replace(/~/g, "~0").replace(/\//g, "~1");
	}
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/resolve.js
var require_resolve = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.getSchemaRefs = exports.resolveUrl = exports.normalizeId = exports._getFullPath = exports.getFullPath = exports.inlineRef = void 0;
	var util_1 = require_util$1();
	var equal = require_fast_deep_equal();
	var traverse = require_json_schema_traverse();
	var SIMPLE_INLINED = new Set([
		"type",
		"format",
		"pattern",
		"maxLength",
		"minLength",
		"maxProperties",
		"minProperties",
		"maxItems",
		"minItems",
		"maximum",
		"minimum",
		"uniqueItems",
		"multipleOf",
		"required",
		"enum",
		"const"
	]);
	function inlineRef(schema, limit = true) {
		if (typeof schema == "boolean") return true;
		if (limit === true) return !hasRef(schema);
		if (!limit) return false;
		return countKeys(schema) <= limit;
	}
	exports.inlineRef = inlineRef;
	var REF_KEYWORDS = new Set([
		"$ref",
		"$recursiveRef",
		"$recursiveAnchor",
		"$dynamicRef",
		"$dynamicAnchor"
	]);
	function hasRef(schema) {
		for (const key in schema) {
			if (REF_KEYWORDS.has(key)) return true;
			const sch = schema[key];
			if (Array.isArray(sch) && sch.some(hasRef)) return true;
			if (typeof sch == "object" && hasRef(sch)) return true;
		}
		return false;
	}
	function countKeys(schema) {
		let count = 0;
		for (const key in schema) {
			if (key === "$ref") return Infinity;
			count++;
			if (SIMPLE_INLINED.has(key)) continue;
			if (typeof schema[key] == "object") (0, util_1.eachItem)(schema[key], (sch) => count += countKeys(sch));
			if (count === Infinity) return Infinity;
		}
		return count;
	}
	function getFullPath(resolver, id = "", normalize) {
		if (normalize !== false) id = normalizeId(id);
		return _getFullPath(resolver, resolver.parse(id));
	}
	exports.getFullPath = getFullPath;
	function _getFullPath(resolver, p) {
		return resolver.serialize(p).split("#")[0] + "#";
	}
	exports._getFullPath = _getFullPath;
	var TRAILING_SLASH_HASH = /#\/?$/;
	function normalizeId(id) {
		return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
	}
	exports.normalizeId = normalizeId;
	function resolveUrl(resolver, baseId, id) {
		id = normalizeId(id);
		return resolver.resolve(baseId, id);
	}
	exports.resolveUrl = resolveUrl;
	var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
	function getSchemaRefs(schema, baseId) {
		if (typeof schema == "boolean") return {};
		const { schemaId, uriResolver } = this.opts;
		const schId = normalizeId(schema[schemaId] || baseId);
		const baseIds = { "": schId };
		const pathPrefix = getFullPath(uriResolver, schId, false);
		const localRefs = {};
		const schemaRefs = /* @__PURE__ */ new Set();
		traverse(schema, { allKeys: true }, (sch, jsonPtr, _, parentJsonPtr) => {
			if (parentJsonPtr === void 0) return;
			const fullPath = pathPrefix + jsonPtr;
			let innerBaseId = baseIds[parentJsonPtr];
			if (typeof sch[schemaId] == "string") innerBaseId = addRef.call(this, sch[schemaId]);
			addAnchor.call(this, sch.$anchor);
			addAnchor.call(this, sch.$dynamicAnchor);
			baseIds[jsonPtr] = innerBaseId;
			function addRef(ref) {
				const _resolve = this.opts.uriResolver.resolve;
				ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
				if (schemaRefs.has(ref)) throw ambiguos(ref);
				schemaRefs.add(ref);
				let schOrRef = this.refs[ref];
				if (typeof schOrRef == "string") schOrRef = this.refs[schOrRef];
				if (typeof schOrRef == "object") checkAmbiguosRef(sch, schOrRef.schema, ref);
				else if (ref !== normalizeId(fullPath)) if (ref[0] === "#") {
					checkAmbiguosRef(sch, localRefs[ref], ref);
					localRefs[ref] = sch;
				} else this.refs[ref] = fullPath;
				return ref;
			}
			function addAnchor(anchor) {
				if (typeof anchor == "string") {
					if (!ANCHOR.test(anchor)) throw new Error(`invalid anchor "${anchor}"`);
					addRef.call(this, `#${anchor}`);
				}
			}
		});
		return localRefs;
		function checkAmbiguosRef(sch1, sch2, ref) {
			if (sch2 !== void 0 && !equal(sch1, sch2)) throw ambiguos(ref);
		}
		function ambiguos(ref) {
			return /* @__PURE__ */ new Error(`reference "${ref}" resolves to more than one schema`);
		}
	}
	exports.getSchemaRefs = getSchemaRefs;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/validate/index.js
var require_validate = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.getData = exports.KeywordCxt = exports.validateFunctionCode = void 0;
	var boolSchema_1 = require_boolSchema();
	var dataType_1 = require_dataType();
	var applicability_1 = require_applicability();
	var dataType_2 = require_dataType();
	var defaults_1 = require_defaults();
	var keyword_1 = require_keyword();
	var subschema_1 = require_subschema();
	var codegen_1 = require_codegen();
	var names_1 = require_names();
	var resolve_1 = require_resolve();
	var util_1 = require_util$1();
	var errors_1 = require_errors();
	function validateFunctionCode(it) {
		if (isSchemaObj(it)) {
			checkKeywords(it);
			if (schemaCxtHasRules(it)) {
				topSchemaObjCode(it);
				return;
			}
		}
		validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
	}
	exports.validateFunctionCode = validateFunctionCode;
	function validateFunction({ gen, validateName, schema, schemaEnv, opts }, body) {
		if (opts.code.es5) gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
			gen.code((0, codegen_1._)`"use strict"; ${funcSourceUrl(schema, opts)}`);
			destructureValCxtES5(gen, opts);
			gen.code(body);
		});
		else gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema, opts)).code(body));
	}
	function destructureValCxt(opts) {
		return (0, codegen_1._)`{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
	}
	function destructureValCxtES5(gen, opts) {
		gen.if(names_1.default.valCxt, () => {
			gen.var(names_1.default.instancePath, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`);
			gen.var(names_1.default.parentData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`);
			gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
			gen.var(names_1.default.rootData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`);
			if (opts.dynamicRef) gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
		}, () => {
			gen.var(names_1.default.instancePath, (0, codegen_1._)`""`);
			gen.var(names_1.default.parentData, (0, codegen_1._)`undefined`);
			gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`undefined`);
			gen.var(names_1.default.rootData, names_1.default.data);
			if (opts.dynamicRef) gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`{}`);
		});
	}
	function topSchemaObjCode(it) {
		const { schema, opts, gen } = it;
		validateFunction(it, () => {
			if (opts.$comment && schema.$comment) commentKeyword(it);
			checkNoDefault(it);
			gen.let(names_1.default.vErrors, null);
			gen.let(names_1.default.errors, 0);
			if (opts.unevaluated) resetEvaluated(it);
			typeAndKeywords(it);
			returnResults(it);
		});
	}
	function resetEvaluated(it) {
		const { gen, validateName } = it;
		it.evaluated = gen.const("evaluated", (0, codegen_1._)`${validateName}.evaluated`);
		gen.if((0, codegen_1._)`${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._)`${it.evaluated}.props`, (0, codegen_1._)`undefined`));
		gen.if((0, codegen_1._)`${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._)`${it.evaluated}.items`, (0, codegen_1._)`undefined`));
	}
	function funcSourceUrl(schema, opts) {
		const schId = typeof schema == "object" && schema[opts.schemaId];
		return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._)`/*# sourceURL=${schId} */` : codegen_1.nil;
	}
	function subschemaCode(it, valid) {
		if (isSchemaObj(it)) {
			checkKeywords(it);
			if (schemaCxtHasRules(it)) {
				subSchemaObjCode(it, valid);
				return;
			}
		}
		(0, boolSchema_1.boolOrEmptySchema)(it, valid);
	}
	function schemaCxtHasRules({ schema, self }) {
		if (typeof schema == "boolean") return !schema;
		for (const key in schema) if (self.RULES.all[key]) return true;
		return false;
	}
	function isSchemaObj(it) {
		return typeof it.schema != "boolean";
	}
	function subSchemaObjCode(it, valid) {
		const { schema, gen, opts } = it;
		if (opts.$comment && schema.$comment) commentKeyword(it);
		updateContext(it);
		checkAsyncSchema(it);
		const errsCount = gen.const("_errs", names_1.default.errors);
		typeAndKeywords(it, errsCount);
		gen.var(valid, (0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
	}
	function checkKeywords(it) {
		(0, util_1.checkUnknownRules)(it);
		checkRefsAndKeywords(it);
	}
	function typeAndKeywords(it, errsCount) {
		if (it.opts.jtd) return schemaKeywords(it, [], false, errsCount);
		const types = (0, dataType_1.getSchemaTypes)(it.schema);
		schemaKeywords(it, types, !(0, dataType_1.coerceAndCheckDataType)(it, types), errsCount);
	}
	function checkRefsAndKeywords(it) {
		const { schema, errSchemaPath, opts, self } = it;
		if (schema.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema, self.RULES)) self.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
	}
	function checkNoDefault(it) {
		const { schema, opts } = it;
		if (schema.default !== void 0 && opts.useDefaults && opts.strictSchema) (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
	}
	function updateContext(it) {
		const schId = it.schema[it.opts.schemaId];
		if (schId) it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId);
	}
	function checkAsyncSchema(it) {
		if (it.schema.$async && !it.schemaEnv.$async) throw new Error("async schema in sync schema");
	}
	function commentKeyword({ gen, schemaEnv, schema, errSchemaPath, opts }) {
		const msg = schema.$comment;
		if (opts.$comment === true) gen.code((0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`);
		else if (typeof opts.$comment == "function") {
			const schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`;
			const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
			gen.code((0, codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
		}
	}
	function returnResults(it) {
		const { gen, schemaEnv, validateName, ValidationError, opts } = it;
		if (schemaEnv.$async) gen.if((0, codegen_1._)`${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`));
		else {
			gen.assign((0, codegen_1._)`${validateName}.errors`, names_1.default.vErrors);
			if (opts.unevaluated) assignEvaluated(it);
			gen.return((0, codegen_1._)`${names_1.default.errors} === 0`);
		}
	}
	function assignEvaluated({ gen, evaluated, props, items }) {
		if (props instanceof codegen_1.Name) gen.assign((0, codegen_1._)`${evaluated}.props`, props);
		if (items instanceof codegen_1.Name) gen.assign((0, codegen_1._)`${evaluated}.items`, items);
	}
	function schemaKeywords(it, types, typeErrors, errsCount) {
		const { gen, schema, data, allErrors, opts, self } = it;
		const { RULES } = self;
		if (schema.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema, RULES))) {
			gen.block(() => keywordCode(it, "$ref", RULES.all.$ref.definition));
			return;
		}
		if (!opts.jtd) checkStrictTypes(it, types);
		gen.block(() => {
			for (const group of RULES.rules) groupKeywords(group);
			groupKeywords(RULES.post);
		});
		function groupKeywords(group) {
			if (!(0, applicability_1.shouldUseGroup)(schema, group)) return;
			if (group.type) {
				gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
				iterateKeywords(it, group);
				if (types.length === 1 && types[0] === group.type && typeErrors) {
					gen.else();
					(0, dataType_2.reportTypeError)(it);
				}
				gen.endIf();
			} else iterateKeywords(it, group);
			if (!allErrors) gen.if((0, codegen_1._)`${names_1.default.errors} === ${errsCount || 0}`);
		}
	}
	function iterateKeywords(it, group) {
		const { gen, schema, opts: { useDefaults } } = it;
		if (useDefaults) (0, defaults_1.assignDefaults)(it, group.type);
		gen.block(() => {
			for (const rule of group.rules) if ((0, applicability_1.shouldUseRule)(schema, rule)) keywordCode(it, rule.keyword, rule.definition, group.type);
		});
	}
	function checkStrictTypes(it, types) {
		if (it.schemaEnv.meta || !it.opts.strictTypes) return;
		checkContextTypes(it, types);
		if (!it.opts.allowUnionTypes) checkMultipleTypes(it, types);
		checkKeywordTypes(it, it.dataTypes);
	}
	function checkContextTypes(it, types) {
		if (!types.length) return;
		if (!it.dataTypes.length) {
			it.dataTypes = types;
			return;
		}
		types.forEach((t) => {
			if (!includesType(it.dataTypes, t)) strictTypesError(it, `type "${t}" not allowed by context "${it.dataTypes.join(",")}"`);
		});
		narrowSchemaTypes(it, types);
	}
	function checkMultipleTypes(it, ts) {
		if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) strictTypesError(it, "use allowUnionTypes to allow union type keyword");
	}
	function checkKeywordTypes(it, ts) {
		const rules = it.self.RULES.all;
		for (const keyword in rules) {
			const rule = rules[keyword];
			if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
				const { type } = rule.definition;
				if (type.length && !type.some((t) => hasApplicableType(ts, t))) strictTypesError(it, `missing type "${type.join(",")}" for keyword "${keyword}"`);
			}
		}
	}
	function hasApplicableType(schTs, kwdT) {
		return schTs.includes(kwdT) || kwdT === "number" && schTs.includes("integer");
	}
	function includesType(ts, t) {
		return ts.includes(t) || t === "integer" && ts.includes("number");
	}
	function narrowSchemaTypes(it, withTypes) {
		const ts = [];
		for (const t of it.dataTypes) if (includesType(withTypes, t)) ts.push(t);
		else if (withTypes.includes("integer") && t === "number") ts.push("integer");
		it.dataTypes = ts;
	}
	function strictTypesError(it, msg) {
		const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
		msg += ` at "${schemaPath}" (strictTypes)`;
		(0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
	}
	var KeywordCxt = class {
		constructor(it, def, keyword) {
			(0, keyword_1.validateKeywordUsage)(it, def, keyword);
			this.gen = it.gen;
			this.allErrors = it.allErrors;
			this.keyword = keyword;
			this.data = it.data;
			this.schema = it.schema[keyword];
			this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data;
			this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data);
			this.schemaType = def.schemaType;
			this.parentSchema = it.schema;
			this.params = {};
			this.it = it;
			this.def = def;
			if (this.$data) this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
			else {
				this.schemaCode = this.schemaValue;
				if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
			}
			if ("code" in def ? def.trackErrors : def.errors !== false) this.errsCount = it.gen.const("_errs", names_1.default.errors);
		}
		result(condition, successAction, failAction) {
			this.failResult((0, codegen_1.not)(condition), successAction, failAction);
		}
		failResult(condition, successAction, failAction) {
			this.gen.if(condition);
			if (failAction) failAction();
			else this.error();
			if (successAction) {
				this.gen.else();
				successAction();
				if (this.allErrors) this.gen.endIf();
			} else if (this.allErrors) this.gen.endIf();
			else this.gen.else();
		}
		pass(condition, failAction) {
			this.failResult((0, codegen_1.not)(condition), void 0, failAction);
		}
		fail(condition) {
			if (condition === void 0) {
				this.error();
				if (!this.allErrors) this.gen.if(false);
				return;
			}
			this.gen.if(condition);
			this.error();
			if (this.allErrors) this.gen.endIf();
			else this.gen.else();
		}
		fail$data(condition) {
			if (!this.$data) return this.fail(condition);
			const { schemaCode } = this;
			this.fail((0, codegen_1._)`${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
		}
		error(append, errorParams, errorPaths) {
			if (errorParams) {
				this.setParams(errorParams);
				this._error(append, errorPaths);
				this.setParams({});
				return;
			}
			this._error(append, errorPaths);
		}
		_error(append, errorPaths) {
			(append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
		}
		$dataError() {
			(0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
		}
		reset() {
			if (this.errsCount === void 0) throw new Error("add \"trackErrors\" to keyword definition");
			(0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
		}
		ok(cond) {
			if (!this.allErrors) this.gen.if(cond);
		}
		setParams(obj, assign) {
			if (assign) Object.assign(this.params, obj);
			else this.params = obj;
		}
		block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
			this.gen.block(() => {
				this.check$data(valid, $dataValid);
				codeBlock();
			});
		}
		check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
			if (!this.$data) return;
			const { gen, schemaCode, schemaType, def } = this;
			gen.if((0, codegen_1.or)((0, codegen_1._)`${schemaCode} === undefined`, $dataValid));
			if (valid !== codegen_1.nil) gen.assign(valid, true);
			if (schemaType.length || def.validateSchema) {
				gen.elseIf(this.invalid$data());
				this.$dataError();
				if (valid !== codegen_1.nil) gen.assign(valid, false);
			}
			gen.else();
		}
		invalid$data() {
			const { gen, schemaCode, schemaType, def, it } = this;
			return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
			function wrong$DataType() {
				if (schemaType.length) {
					/* istanbul ignore if */
					if (!(schemaCode instanceof codegen_1.Name)) throw new Error("ajv implementation error");
					const st = Array.isArray(schemaType) ? schemaType : [schemaType];
					return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
				}
				return codegen_1.nil;
			}
			function invalid$DataSchema() {
				if (def.validateSchema) {
					const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema });
					return (0, codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
				}
				return codegen_1.nil;
			}
		}
		subschema(appl, valid) {
			const subschema = (0, subschema_1.getSubschema)(this.it, appl);
			(0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
			(0, subschema_1.extendSubschemaMode)(subschema, appl);
			const nextContext = {
				...this.it,
				...subschema,
				items: void 0,
				props: void 0
			};
			subschemaCode(nextContext, valid);
			return nextContext;
		}
		mergeEvaluated(schemaCxt, toName) {
			const { it, gen } = this;
			if (!it.opts.unevaluated) return;
			if (it.props !== true && schemaCxt.props !== void 0) it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName);
			if (it.items !== true && schemaCxt.items !== void 0) it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName);
		}
		mergeValidEvaluated(schemaCxt, valid) {
			const { it, gen } = this;
			if (it.opts.unevaluated && (it.props !== true || it.items !== true)) {
				gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
				return true;
			}
		}
	};
	exports.KeywordCxt = KeywordCxt;
	function keywordCode(it, keyword, def, ruleType) {
		const cxt = new KeywordCxt(it, def, keyword);
		if ("code" in def) def.code(cxt, ruleType);
		else if (cxt.$data && def.validate) (0, keyword_1.funcKeywordCode)(cxt, def);
		else if ("macro" in def) (0, keyword_1.macroKeywordCode)(cxt, def);
		else if (def.compile || def.validate) (0, keyword_1.funcKeywordCode)(cxt, def);
	}
	var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
	var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
	function getData($data, { dataLevel, dataNames, dataPathArr }) {
		let jsonPointer;
		let data;
		if ($data === "") return names_1.default.rootData;
		if ($data[0] === "/") {
			if (!JSON_POINTER.test($data)) throw new Error(`Invalid JSON-pointer: ${$data}`);
			jsonPointer = $data;
			data = names_1.default.rootData;
		} else {
			const matches = RELATIVE_JSON_POINTER.exec($data);
			if (!matches) throw new Error(`Invalid JSON-pointer: ${$data}`);
			const up = +matches[1];
			jsonPointer = matches[2];
			if (jsonPointer === "#") {
				if (up >= dataLevel) throw new Error(errorMsg("property/index", up));
				return dataPathArr[dataLevel - up];
			}
			if (up > dataLevel) throw new Error(errorMsg("data", up));
			data = dataNames[dataLevel - up];
			if (!jsonPointer) return data;
		}
		let expr = data;
		const segments = jsonPointer.split("/");
		for (const segment of segments) if (segment) {
			data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
			expr = (0, codegen_1._)`${expr} && ${data}`;
		}
		return expr;
		function errorMsg(pointerType, up) {
			return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
		}
	}
	exports.getData = getData;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/runtime/validation_error.js
var require_validation_error = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var ValidationError = class extends Error {
		constructor(errors) {
			super("validation failed");
			this.errors = errors;
			this.ajv = this.validation = true;
		}
	};
	exports.default = ValidationError;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var resolve_1 = require_resolve();
	var MissingRefError = class extends Error {
		constructor(resolver, baseId, ref, msg) {
			super(msg || `can't resolve reference ${ref} from id ${baseId}`);
			this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
			this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
		}
	};
	exports.default = MissingRefError;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/compile/index.js
var require_compile = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.resolveSchema = exports.getCompilingSchema = exports.resolveRef = exports.compileSchema = exports.SchemaEnv = void 0;
	var codegen_1 = require_codegen();
	var validation_error_1 = require_validation_error();
	var names_1 = require_names();
	var resolve_1 = require_resolve();
	var util_1 = require_util$1();
	var validate_1 = require_validate();
	var SchemaEnv = class {
		constructor(env) {
			var _a;
			this.refs = {};
			this.dynamicAnchors = {};
			let schema;
			if (typeof env.schema == "object") schema = env.schema;
			this.schema = env.schema;
			this.schemaId = env.schemaId;
			this.root = env.root || this;
			this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema === null || schema === void 0 ? void 0 : schema[env.schemaId || "$id"]);
			this.schemaPath = env.schemaPath;
			this.localRefs = env.localRefs;
			this.meta = env.meta;
			this.$async = schema === null || schema === void 0 ? void 0 : schema.$async;
			this.refs = {};
		}
	};
	exports.SchemaEnv = SchemaEnv;
	function compileSchema(sch) {
		const _sch = getCompilingSchema.call(this, sch);
		if (_sch) return _sch;
		const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId);
		const { es5, lines } = this.opts.code;
		const { ownProperties } = this.opts;
		const gen = new codegen_1.CodeGen(this.scope, {
			es5,
			lines,
			ownProperties
		});
		let _ValidationError;
		if (sch.$async) _ValidationError = gen.scopeValue("Error", {
			ref: validation_error_1.default,
			code: (0, codegen_1._)`require("ajv/dist/runtime/validation_error").default`
		});
		const validateName = gen.scopeName("validate");
		sch.validateName = validateName;
		const schemaCxt = {
			gen,
			allErrors: this.opts.allErrors,
			data: names_1.default.data,
			parentData: names_1.default.parentData,
			parentDataProperty: names_1.default.parentDataProperty,
			dataNames: [names_1.default.data],
			dataPathArr: [codegen_1.nil],
			dataLevel: 0,
			dataTypes: [],
			definedProperties: /* @__PURE__ */ new Set(),
			topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true ? {
				ref: sch.schema,
				code: (0, codegen_1.stringify)(sch.schema)
			} : { ref: sch.schema }),
			validateName,
			ValidationError: _ValidationError,
			schema: sch.schema,
			schemaEnv: sch,
			rootId,
			baseId: sch.baseId || rootId,
			schemaPath: codegen_1.nil,
			errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
			errorPath: (0, codegen_1._)`""`,
			opts: this.opts,
			self: this
		};
		let sourceCode;
		try {
			this._compilations.add(sch);
			(0, validate_1.validateFunctionCode)(schemaCxt);
			gen.optimize(this.opts.code.optimize);
			const validateCode = gen.toString();
			sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
			if (this.opts.code.process) sourceCode = this.opts.code.process(sourceCode, sch);
			const validate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode)(this, this.scope.get());
			this.scope.value(validateName, { ref: validate });
			validate.errors = null;
			validate.schema = sch.schema;
			validate.schemaEnv = sch;
			if (sch.$async) validate.$async = true;
			if (this.opts.code.source === true) validate.source = {
				validateName,
				validateCode,
				scopeValues: gen._values
			};
			if (this.opts.unevaluated) {
				const { props, items } = schemaCxt;
				validate.evaluated = {
					props: props instanceof codegen_1.Name ? void 0 : props,
					items: items instanceof codegen_1.Name ? void 0 : items,
					dynamicProps: props instanceof codegen_1.Name,
					dynamicItems: items instanceof codegen_1.Name
				};
				if (validate.source) validate.source.evaluated = (0, codegen_1.stringify)(validate.evaluated);
			}
			sch.validate = validate;
			return sch;
		} catch (e) {
			delete sch.validate;
			delete sch.validateName;
			if (sourceCode) this.logger.error("Error compiling schema, function code:", sourceCode);
			throw e;
		} finally {
			this._compilations.delete(sch);
		}
	}
	exports.compileSchema = compileSchema;
	function resolveRef(root, baseId, ref) {
		var _a;
		ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
		const schOrFunc = root.refs[ref];
		if (schOrFunc) return schOrFunc;
		let _sch = resolve.call(this, root, ref);
		if (_sch === void 0) {
			const schema = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref];
			const { schemaId } = this.opts;
			if (schema) _sch = new SchemaEnv({
				schema,
				schemaId,
				root,
				baseId
			});
		}
		if (_sch === void 0) return;
		return root.refs[ref] = inlineOrCompile.call(this, _sch);
	}
	exports.resolveRef = resolveRef;
	function inlineOrCompile(sch) {
		if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs)) return sch.schema;
		return sch.validate ? sch : compileSchema.call(this, sch);
	}
	function getCompilingSchema(schEnv) {
		for (const sch of this._compilations) if (sameSchemaEnv(sch, schEnv)) return sch;
	}
	exports.getCompilingSchema = getCompilingSchema;
	function sameSchemaEnv(s1, s2) {
		return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
	}
	function resolve(root, ref) {
		let sch;
		while (typeof (sch = this.refs[ref]) == "string") ref = sch;
		return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
	}
	function resolveSchema(root, ref) {
		const p = this.opts.uriResolver.parse(ref);
		const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
		let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, void 0);
		if (Object.keys(root.schema).length > 0 && refPath === baseId) return getJsonPointer.call(this, p, root);
		const id = (0, resolve_1.normalizeId)(refPath);
		const schOrRef = this.refs[id] || this.schemas[id];
		if (typeof schOrRef == "string") {
			const sch = resolveSchema.call(this, root, schOrRef);
			if (typeof (sch === null || sch === void 0 ? void 0 : sch.schema) !== "object") return;
			return getJsonPointer.call(this, p, sch);
		}
		if (typeof (schOrRef === null || schOrRef === void 0 ? void 0 : schOrRef.schema) !== "object") return;
		if (!schOrRef.validate) compileSchema.call(this, schOrRef);
		if (id === (0, resolve_1.normalizeId)(ref)) {
			const { schema } = schOrRef;
			const { schemaId } = this.opts;
			const schId = schema[schemaId];
			if (schId) baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
			return new SchemaEnv({
				schema,
				schemaId,
				root,
				baseId
			});
		}
		return getJsonPointer.call(this, p, schOrRef);
	}
	exports.resolveSchema = resolveSchema;
	var PREVENT_SCOPE_CHANGE = new Set([
		"properties",
		"patternProperties",
		"enum",
		"dependencies",
		"definitions"
	]);
	function getJsonPointer(parsedRef, { baseId, schema, root }) {
		var _a;
		if (((_a = parsedRef.fragment) === null || _a === void 0 ? void 0 : _a[0]) !== "/") return;
		for (const part of parsedRef.fragment.slice(1).split("/")) {
			if (typeof schema === "boolean") return;
			const partSchema = schema[(0, util_1.unescapeFragment)(part)];
			if (partSchema === void 0) return;
			schema = partSchema;
			const schId = typeof schema === "object" && schema[this.opts.schemaId];
			if (!PREVENT_SCOPE_CHANGE.has(part) && schId) baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
		}
		let env;
		if (typeof schema != "boolean" && schema.$ref && !(0, util_1.schemaHasRulesButRef)(schema, this.RULES)) {
			const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema.$ref);
			env = resolveSchema.call(this, root, $ref);
		}
		const { schemaId } = this.opts;
		env = env || new SchemaEnv({
			schema,
			schemaId,
			root,
			baseId
		});
		if (env.schema !== env.root.schema) return env;
	}
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/refs/data.json
var data_exports = /* @__PURE__ */ __exportAll({
	$id: () => $id$1,
	additionalProperties: () => false,
	default: () => data_default,
	description: () => description,
	properties: () => properties$1,
	required: () => required,
	type: () => type$1
}), $id$1, description, type$1, required, properties$1, data_default;
var init_data = __esmMin((() => {
	$id$1 = "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#";
	description = "Meta-schema for $data reference (JSON AnySchema extension proposal)";
	type$1 = "object";
	required = ["$data"];
	properties$1 = { "$data": {
		"type": "string",
		"anyOf": [{ "format": "relative-json-pointer" }, { "format": "json-pointer" }]
	} };
	data_default = {
		$id: $id$1,
		description,
		type: type$1,
		required,
		properties: properties$1,
		additionalProperties: false
	};
}));
//#endregion
//#region ../../node_modules/fast-uri/lib/utils.js
var require_utils$2 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/** @type {(value: string) => boolean} */
	var isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);
	/** @type {(value: string) => boolean} */
	var isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u);
	/** @type {(value: string) => boolean} */
	var isHexPair = RegExp.prototype.test.bind(/^[\da-f]{2}$/iu);
	/** @type {(value: string) => boolean} */
	var isUnreserved = RegExp.prototype.test.bind(/^[\da-z\-._~]$/iu);
	/** @type {(value: string) => boolean} */
	var isPathCharacter = RegExp.prototype.test.bind(/^[\da-z\-._~!$&'()*+,;=:@/]$/iu);
	/**
	* @param {Array<string>} input
	* @returns {string}
	*/
	function stringArrayToHexStripped(input) {
		let acc = "";
		let code = 0;
		let i = 0;
		for (i = 0; i < input.length; i++) {
			code = input[i].charCodeAt(0);
			if (code === 48) continue;
			if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) return "";
			acc += input[i];
			break;
		}
		for (i += 1; i < input.length; i++) {
			code = input[i].charCodeAt(0);
			if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) return "";
			acc += input[i];
		}
		return acc;
	}
	/**
	* @typedef {Object} GetIPV6Result
	* @property {boolean} error - Indicates if there was an error parsing the IPv6 address.
	* @property {string} address - The parsed IPv6 address.
	* @property {string} [zone] - The zone identifier, if present.
	*/
	/**
	* @param {string} value
	* @returns {boolean}
	*/
	var nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
	/**
	* @param {Array<string>} buffer
	* @returns {boolean}
	*/
	function consumeIsZone(buffer) {
		buffer.length = 0;
		return true;
	}
	/**
	* @param {Array<string>} buffer
	* @param {Array<string>} address
	* @param {GetIPV6Result} output
	* @returns {boolean}
	*/
	function consumeHextets(buffer, address, output) {
		if (buffer.length) {
			const hex = stringArrayToHexStripped(buffer);
			if (hex !== "") address.push(hex);
			else {
				output.error = true;
				return false;
			}
			buffer.length = 0;
		}
		return true;
	}
	/**
	* @param {string} input
	* @returns {GetIPV6Result}
	*/
	function getIPV6(input) {
		let tokenCount = 0;
		const output = {
			error: false,
			address: "",
			zone: ""
		};
		/** @type {Array<string>} */
		const address = [];
		/** @type {Array<string>} */
		const buffer = [];
		let endipv6Encountered = false;
		let endIpv6 = false;
		let consume = consumeHextets;
		for (let i = 0; i < input.length; i++) {
			const cursor = input[i];
			if (cursor === "[" || cursor === "]") continue;
			if (cursor === ":") {
				if (endipv6Encountered === true) endIpv6 = true;
				if (!consume(buffer, address, output)) break;
				if (++tokenCount > 7) {
					output.error = true;
					break;
				}
				if (i > 0 && input[i - 1] === ":") endipv6Encountered = true;
				address.push(":");
				continue;
			} else if (cursor === "%") {
				if (!consume(buffer, address, output)) break;
				consume = consumeIsZone;
			} else {
				buffer.push(cursor);
				continue;
			}
		}
		if (buffer.length) if (consume === consumeIsZone) output.zone = buffer.join("");
		else if (endIpv6) address.push(buffer.join(""));
		else address.push(stringArrayToHexStripped(buffer));
		output.address = address.join("");
		return output;
	}
	/**
	* @typedef {Object} NormalizeIPv6Result
	* @property {string} host - The normalized host.
	* @property {string} [escapedHost] - The escaped host.
	* @property {boolean} isIPV6 - Indicates if the host is an IPv6 address.
	*/
	/**
	* @param {string} host
	* @returns {NormalizeIPv6Result}
	*/
	function normalizeIPv6(host) {
		if (findToken(host, ":") < 2) return {
			host,
			isIPV6: false
		};
		const ipv6 = getIPV6(host);
		if (!ipv6.error) {
			let newHost = ipv6.address;
			let escapedHost = ipv6.address;
			if (ipv6.zone) {
				newHost += "%" + ipv6.zone;
				escapedHost += "%25" + ipv6.zone;
			}
			return {
				host: newHost,
				isIPV6: true,
				escapedHost
			};
		} else return {
			host,
			isIPV6: false
		};
	}
	/**
	* @param {string} str
	* @param {string} token
	* @returns {number}
	*/
	function findToken(str, token) {
		let ind = 0;
		for (let i = 0; i < str.length; i++) if (str[i] === token) ind++;
		return ind;
	}
	/**
	* @param {string} path
	* @returns {string}
	*
	* @see https://datatracker.ietf.org/doc/html/rfc3986#section-5.2.4
	*/
	function removeDotSegments(path) {
		let input = path;
		const output = [];
		let nextSlash = -1;
		let len = 0;
		while (len = input.length) {
			if (len === 1) if (input === ".") break;
			else if (input === "/") {
				output.push("/");
				break;
			} else {
				output.push(input);
				break;
			}
			else if (len === 2) {
				if (input[0] === ".") {
					if (input[1] === ".") break;
					else if (input[1] === "/") {
						input = input.slice(2);
						continue;
					}
				} else if (input[0] === "/") {
					if (input[1] === "." || input[1] === "/") {
						output.push("/");
						break;
					}
				}
			} else if (len === 3) {
				if (input === "/..") {
					if (output.length !== 0) output.pop();
					output.push("/");
					break;
				}
			}
			if (input[0] === ".") {
				if (input[1] === ".") {
					if (input[2] === "/") {
						input = input.slice(3);
						continue;
					}
				} else if (input[1] === "/") {
					input = input.slice(2);
					continue;
				}
			} else if (input[0] === "/") {
				if (input[1] === ".") {
					if (input[2] === "/") {
						input = input.slice(2);
						continue;
					} else if (input[2] === ".") {
						if (input[3] === "/") {
							input = input.slice(3);
							if (output.length !== 0) output.pop();
							continue;
						}
					}
				}
			}
			if ((nextSlash = input.indexOf("/", 1)) === -1) {
				output.push(input);
				break;
			} else {
				output.push(input.slice(0, nextSlash));
				input = input.slice(nextSlash);
			}
		}
		return output.join("");
	}
	/**
	* Re-escape RFC 3986 gen-delims that must not appear literally in the host.
	* After the URI regex parses, these characters cannot be literal in the host
	* field, so any that appear after decoding came from percent-encoding and
	* must be restored to prevent authority structure changes.
	*
	* @param {string} host
	* @param {boolean} isIP - true for IPv4/IPv6 hosts (skip colon re-escaping)
	* @returns {string}
	*/
	var HOST_DELIMS = {
		"@": "%40",
		"/": "%2F",
		"?": "%3F",
		"#": "%23",
		":": "%3A"
	};
	var HOST_DELIM_RE = /[@/?#:]/g;
	var HOST_DELIM_NO_COLON_RE = /[@/?#]/g;
	function reescapeHostDelimiters(host, isIP) {
		const re = isIP ? HOST_DELIM_NO_COLON_RE : HOST_DELIM_RE;
		re.lastIndex = 0;
		return host.replace(re, (ch) => HOST_DELIMS[ch]);
	}
	/**
	* Normalizes percent escapes and optionally decodes only unreserved ASCII bytes.
	* Reserved delimiters such as `%2F` and `%2E` stay escaped.
	*
	* @param {string} input
	* @param {boolean} [decodeUnreserved=false]
	* @returns {string}
	*/
	function normalizePercentEncoding(input, decodeUnreserved = false) {
		if (input.indexOf("%") === -1) return input;
		let output = "";
		for (let i = 0; i < input.length; i++) {
			if (input[i] === "%" && i + 2 < input.length) {
				const hex = input.slice(i + 1, i + 3);
				if (isHexPair(hex)) {
					const normalizedHex = hex.toUpperCase();
					const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
					if (decodeUnreserved && isUnreserved(decoded)) output += decoded;
					else output += "%" + normalizedHex;
					i += 2;
					continue;
				}
			}
			output += input[i];
		}
		return output;
	}
	/**
	* Normalizes path data without turning reserved escapes into live path syntax.
	* Valid escapes are uppercased, raw unsafe characters are escaped, and only
	* unreserved bytes that are not `.` are decoded.
	*
	* @param {string} input
	* @returns {string}
	*/
	function normalizePathEncoding(input) {
		let output = "";
		for (let i = 0; i < input.length; i++) {
			if (input[i] === "%" && i + 2 < input.length) {
				const hex = input.slice(i + 1, i + 3);
				if (isHexPair(hex)) {
					const normalizedHex = hex.toUpperCase();
					const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
					if (decoded !== "." && isUnreserved(decoded)) output += decoded;
					else output += "%" + normalizedHex;
					i += 2;
					continue;
				}
			}
			if (isPathCharacter(input[i])) output += input[i];
			else output += escape(input[i]);
		}
		return output;
	}
	/**
	* Escapes a component while preserving existing valid percent escapes.
	*
	* @param {string} input
	* @returns {string}
	*/
	function escapePreservingEscapes(input) {
		let output = "";
		for (let i = 0; i < input.length; i++) {
			if (input[i] === "%" && i + 2 < input.length) {
				const hex = input.slice(i + 1, i + 3);
				if (isHexPair(hex)) {
					output += "%" + hex.toUpperCase();
					i += 2;
					continue;
				}
			}
			output += escape(input[i]);
		}
		return output;
	}
	/**
	* @param {import('../types/index').URIComponent} component
	* @returns {string|undefined}
	*/
	function recomposeAuthority(component) {
		const uriTokens = [];
		if (component.userinfo !== void 0) {
			uriTokens.push(component.userinfo);
			uriTokens.push("@");
		}
		if (component.host !== void 0) {
			let host = unescape(component.host);
			if (!isIPv4(host)) {
				const ipV6res = normalizeIPv6(host);
				if (ipV6res.isIPV6 === true) host = `[${ipV6res.escapedHost}]`;
				else host = reescapeHostDelimiters(host, false);
			}
			uriTokens.push(host);
		}
		if (typeof component.port === "number" || typeof component.port === "string") {
			uriTokens.push(":");
			uriTokens.push(String(component.port));
		}
		return uriTokens.length ? uriTokens.join("") : void 0;
	}
	module.exports = {
		nonSimpleDomain,
		recomposeAuthority,
		reescapeHostDelimiters,
		normalizePercentEncoding,
		normalizePathEncoding,
		escapePreservingEscapes,
		removeDotSegments,
		isIPv4,
		isUUID,
		normalizeIPv6,
		stringArrayToHexStripped
	};
}));
//#endregion
//#region ../../node_modules/fast-uri/lib/schemes.js
var require_schemes = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { isUUID } = require_utils$2();
	var URN_REG = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu;
	var supportedSchemeNames = [
		"http",
		"https",
		"ws",
		"wss",
		"urn",
		"urn:uuid"
	];
	/** @typedef {supportedSchemeNames[number]} SchemeName */
	/**
	* @param {string} name
	* @returns {name is SchemeName}
	*/
	function isValidSchemeName(name) {
		return supportedSchemeNames.indexOf(name) !== -1;
	}
	/**
	* @callback SchemeFn
	* @param {import('../types/index').URIComponent} component
	* @param {import('../types/index').Options} options
	* @returns {import('../types/index').URIComponent}
	*/
	/**
	* @typedef {Object} SchemeHandler
	* @property {SchemeName} scheme - The scheme name.
	* @property {boolean} [domainHost] - Indicates if the scheme supports domain hosts.
	* @property {SchemeFn} parse - Function to parse the URI component for this scheme.
	* @property {SchemeFn} serialize - Function to serialize the URI component for this scheme.
	* @property {boolean} [skipNormalize] - Indicates if normalization should be skipped for this scheme.
	* @property {boolean} [absolutePath] - Indicates if the scheme uses absolute paths.
	* @property {boolean} [unicodeSupport] - Indicates if the scheme supports Unicode.
	*/
	/**
	* @param {import('../types/index').URIComponent} wsComponent
	* @returns {boolean}
	*/
	function wsIsSecure(wsComponent) {
		if (wsComponent.secure === true) return true;
		else if (wsComponent.secure === false) return false;
		else if (wsComponent.scheme) return wsComponent.scheme.length === 3 && (wsComponent.scheme[0] === "w" || wsComponent.scheme[0] === "W") && (wsComponent.scheme[1] === "s" || wsComponent.scheme[1] === "S") && (wsComponent.scheme[2] === "s" || wsComponent.scheme[2] === "S");
		else return false;
	}
	/** @type {SchemeFn} */
	function httpParse(component) {
		if (!component.host) component.error = component.error || "HTTP URIs must have a host.";
		return component;
	}
	/** @type {SchemeFn} */
	function httpSerialize(component) {
		const secure = String(component.scheme).toLowerCase() === "https";
		if (component.port === (secure ? 443 : 80) || component.port === "") component.port = void 0;
		if (!component.path) component.path = "/";
		return component;
	}
	/** @type {SchemeFn} */
	function wsParse(wsComponent) {
		wsComponent.secure = wsIsSecure(wsComponent);
		wsComponent.resourceName = (wsComponent.path || "/") + (wsComponent.query ? "?" + wsComponent.query : "");
		wsComponent.path = void 0;
		wsComponent.query = void 0;
		return wsComponent;
	}
	/** @type {SchemeFn} */
	function wsSerialize(wsComponent) {
		if (wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === "") wsComponent.port = void 0;
		if (typeof wsComponent.secure === "boolean") {
			wsComponent.scheme = wsComponent.secure ? "wss" : "ws";
			wsComponent.secure = void 0;
		}
		if (wsComponent.resourceName) {
			const [path, query] = wsComponent.resourceName.split("?");
			wsComponent.path = path && path !== "/" ? path : void 0;
			wsComponent.query = query;
			wsComponent.resourceName = void 0;
		}
		wsComponent.fragment = void 0;
		return wsComponent;
	}
	/** @type {SchemeFn} */
	function urnParse(urnComponent, options) {
		if (!urnComponent.path) {
			urnComponent.error = "URN can not be parsed";
			return urnComponent;
		}
		const matches = urnComponent.path.match(URN_REG);
		if (matches) {
			const scheme = options.scheme || urnComponent.scheme || "urn";
			urnComponent.nid = matches[1].toLowerCase();
			urnComponent.nss = matches[2];
			const schemeHandler = getSchemeHandler(`${scheme}:${options.nid || urnComponent.nid}`);
			urnComponent.path = void 0;
			if (schemeHandler) urnComponent = schemeHandler.parse(urnComponent, options);
		} else urnComponent.error = urnComponent.error || "URN can not be parsed.";
		return urnComponent;
	}
	/** @type {SchemeFn} */
	function urnSerialize(urnComponent, options) {
		if (urnComponent.nid === void 0) throw new Error("URN without nid cannot be serialized");
		const scheme = options.scheme || urnComponent.scheme || "urn";
		const nid = urnComponent.nid.toLowerCase();
		const schemeHandler = getSchemeHandler(`${scheme}:${options.nid || nid}`);
		if (schemeHandler) urnComponent = schemeHandler.serialize(urnComponent, options);
		const uriComponent = urnComponent;
		const nss = urnComponent.nss;
		uriComponent.path = `${nid || options.nid}:${nss}`;
		options.skipEscape = true;
		return uriComponent;
	}
	/** @type {SchemeFn} */
	function urnuuidParse(urnComponent, options) {
		const uuidComponent = urnComponent;
		uuidComponent.uuid = uuidComponent.nss;
		uuidComponent.nss = void 0;
		if (!options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid))) uuidComponent.error = uuidComponent.error || "UUID is not valid.";
		return uuidComponent;
	}
	/** @type {SchemeFn} */
	function urnuuidSerialize(uuidComponent) {
		const urnComponent = uuidComponent;
		urnComponent.nss = (uuidComponent.uuid || "").toLowerCase();
		return urnComponent;
	}
	var http = {
		scheme: "http",
		domainHost: true,
		parse: httpParse,
		serialize: httpSerialize
	};
	var https = {
		scheme: "https",
		domainHost: http.domainHost,
		parse: httpParse,
		serialize: httpSerialize
	};
	var ws = {
		scheme: "ws",
		domainHost: true,
		parse: wsParse,
		serialize: wsSerialize
	};
	var SCHEMES = {
		http,
		https,
		ws,
		wss: {
			scheme: "wss",
			domainHost: ws.domainHost,
			parse: ws.parse,
			serialize: ws.serialize
		},
		urn: {
			scheme: "urn",
			parse: urnParse,
			serialize: urnSerialize,
			skipNormalize: true
		},
		"urn:uuid": {
			scheme: "urn:uuid",
			parse: urnuuidParse,
			serialize: urnuuidSerialize,
			skipNormalize: true
		}
	};
	Object.setPrototypeOf(SCHEMES, null);
	/**
	* @param {string|undefined} scheme
	* @returns {SchemeHandler|undefined}
	*/
	function getSchemeHandler(scheme) {
		return scheme && (SCHEMES[scheme] || SCHEMES[scheme.toLowerCase()]) || void 0;
	}
	module.exports = {
		wsIsSecure,
		SCHEMES,
		isValidSchemeName,
		getSchemeHandler
	};
}));
//#endregion
//#region ../../node_modules/fast-uri/index.js
var require_fast_uri = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { normalizeIPv6, removeDotSegments, recomposeAuthority, normalizePercentEncoding, normalizePathEncoding, escapePreservingEscapes, reescapeHostDelimiters, isIPv4, nonSimpleDomain } = require_utils$2();
	var { SCHEMES, getSchemeHandler } = require_schemes();
	/**
	* @template {import('./types/index').URIComponent|string} T
	* @param {T} uri
	* @param {import('./types/index').Options} [options]
	* @returns {T}
	*/
	function normalize(uri, options) {
		if (typeof uri === "string") uri = normalizeString(uri, options);
		else if (typeof uri === "object") uri = parse(serialize(uri, options), options);
		return uri;
	}
	/**
	* @param {string} baseURI
	* @param {string} relativeURI
	* @param {import('./types/index').Options} [options]
	* @returns {string}
	*/
	function resolve(baseURI, relativeURI, options) {
		const schemelessOptions = options ? Object.assign({ scheme: "null" }, options) : { scheme: "null" };
		const resolved = resolveComponent(parse(baseURI, schemelessOptions), parse(relativeURI, schemelessOptions), schemelessOptions, true);
		schemelessOptions.skipEscape = true;
		return serialize(resolved, schemelessOptions);
	}
	/**
	* @param {import ('./types/index').URIComponent} base
	* @param {import ('./types/index').URIComponent} relative
	* @param {import('./types/index').Options} [options]
	* @param {boolean} [skipNormalization=false]
	* @returns {import ('./types/index').URIComponent}
	*/
	function resolveComponent(base, relative, options, skipNormalization) {
		/** @type {import('./types/index').URIComponent} */
		const target = {};
		if (!skipNormalization) {
			base = parse(serialize(base, options), options);
			relative = parse(serialize(relative, options), options);
		}
		options = options || {};
		if (!options.tolerant && relative.scheme) {
			target.scheme = relative.scheme;
			target.userinfo = relative.userinfo;
			target.host = relative.host;
			target.port = relative.port;
			target.path = removeDotSegments(relative.path || "");
			target.query = relative.query;
		} else {
			if (relative.userinfo !== void 0 || relative.host !== void 0 || relative.port !== void 0) {
				target.userinfo = relative.userinfo;
				target.host = relative.host;
				target.port = relative.port;
				target.path = removeDotSegments(relative.path || "");
				target.query = relative.query;
			} else {
				if (!relative.path) {
					target.path = base.path;
					if (relative.query !== void 0) target.query = relative.query;
					else target.query = base.query;
				} else {
					if (relative.path[0] === "/") target.path = removeDotSegments(relative.path);
					else {
						if ((base.userinfo !== void 0 || base.host !== void 0 || base.port !== void 0) && !base.path) target.path = "/" + relative.path;
						else if (!base.path) target.path = relative.path;
						else target.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative.path;
						target.path = removeDotSegments(target.path);
					}
					target.query = relative.query;
				}
				target.userinfo = base.userinfo;
				target.host = base.host;
				target.port = base.port;
			}
			target.scheme = base.scheme;
		}
		target.fragment = relative.fragment;
		return target;
	}
	/**
	* @param {import ('./types/index').URIComponent|string} uriA
	* @param {import ('./types/index').URIComponent|string} uriB
	* @param {import ('./types/index').Options} options
	* @returns {boolean}
	*/
	function equal(uriA, uriB, options) {
		const normalizedA = normalizeComparableURI(uriA, options);
		const normalizedB = normalizeComparableURI(uriB, options);
		return normalizedA !== void 0 && normalizedB !== void 0 && normalizedA.toLowerCase() === normalizedB.toLowerCase();
	}
	/**
	* @param {Readonly<import('./types/index').URIComponent>} cmpts
	* @param {import('./types/index').Options} [opts]
	* @returns {string}
	*/
	function serialize(cmpts, opts) {
		const component = {
			host: cmpts.host,
			scheme: cmpts.scheme,
			userinfo: cmpts.userinfo,
			port: cmpts.port,
			path: cmpts.path,
			query: cmpts.query,
			nid: cmpts.nid,
			nss: cmpts.nss,
			uuid: cmpts.uuid,
			fragment: cmpts.fragment,
			reference: cmpts.reference,
			resourceName: cmpts.resourceName,
			secure: cmpts.secure,
			error: ""
		};
		const options = Object.assign({}, opts);
		const uriTokens = [];
		const schemeHandler = getSchemeHandler(options.scheme || component.scheme);
		if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(component, options);
		if (component.path !== void 0) if (!options.skipEscape) {
			component.path = escapePreservingEscapes(component.path);
			if (component.scheme !== void 0) component.path = component.path.split("%3A").join(":");
		} else component.path = normalizePercentEncoding(component.path);
		if (options.reference !== "suffix" && component.scheme) uriTokens.push(component.scheme, ":");
		const authority = recomposeAuthority(component);
		if (authority !== void 0) {
			if (options.reference !== "suffix") uriTokens.push("//");
			uriTokens.push(authority);
			if (component.path && component.path[0] !== "/") uriTokens.push("/");
		}
		if (component.path !== void 0) {
			let s = component.path;
			if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) s = removeDotSegments(s);
			if (authority === void 0 && s[0] === "/" && s[1] === "/") s = "/%2F" + s.slice(2);
			uriTokens.push(s);
		}
		if (component.query !== void 0) uriTokens.push("?", component.query);
		if (component.fragment !== void 0) uriTokens.push("#", component.fragment);
		return uriTokens.join("");
	}
	var URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;
	/**
	* @param {import('./types/index').URIComponent} parsed
	* @param {RegExpMatchArray} matches
	* @returns {string|undefined}
	*/
	function getParseError(parsed, matches) {
		if (matches[2] !== void 0 && parsed.path && parsed.path[0] !== "/") return "URI path must start with \"/\" when authority is present.";
		if (typeof parsed.port === "number" && (parsed.port < 0 || parsed.port > 65535)) return "URI port is malformed.";
	}
	/**
	* @param {string} uri
	* @param {import('./types/index').Options} [opts]
	* @returns {{ parsed: import('./types/index').URIComponent, malformedAuthorityOrPort: boolean }}
	*/
	function parseWithStatus(uri, opts) {
		const options = Object.assign({}, opts);
		/** @type {import('./types/index').URIComponent} */
		const parsed = {
			scheme: void 0,
			userinfo: void 0,
			host: "",
			port: void 0,
			path: "",
			query: void 0,
			fragment: void 0
		};
		let malformedAuthorityOrPort = false;
		let isIP = false;
		if (options.reference === "suffix") if (options.scheme) uri = options.scheme + ":" + uri;
		else uri = "//" + uri;
		const matches = uri.match(URI_PARSE);
		if (matches) {
			parsed.scheme = matches[1];
			parsed.userinfo = matches[3];
			parsed.host = matches[4];
			parsed.port = parseInt(matches[5], 10);
			parsed.path = matches[6] || "";
			parsed.query = matches[7];
			parsed.fragment = matches[8];
			if (isNaN(parsed.port)) parsed.port = matches[5];
			const parseError = getParseError(parsed, matches);
			if (parseError !== void 0) {
				parsed.error = parsed.error || parseError;
				malformedAuthorityOrPort = true;
			}
			if (parsed.host) if (isIPv4(parsed.host) === false) {
				const ipv6result = normalizeIPv6(parsed.host);
				parsed.host = ipv6result.host.toLowerCase();
				isIP = ipv6result.isIPV6;
			} else isIP = true;
			if (parsed.scheme === void 0 && parsed.userinfo === void 0 && parsed.host === void 0 && parsed.port === void 0 && parsed.query === void 0 && !parsed.path) parsed.reference = "same-document";
			else if (parsed.scheme === void 0) parsed.reference = "relative";
			else if (parsed.fragment === void 0) parsed.reference = "absolute";
			else parsed.reference = "uri";
			if (options.reference && options.reference !== "suffix" && options.reference !== parsed.reference) parsed.error = parsed.error || "URI is not a " + options.reference + " reference.";
			const schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);
			if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport)) {
				if (parsed.host && (options.domainHost || schemeHandler && schemeHandler.domainHost) && isIP === false && nonSimpleDomain(parsed.host)) try {
					parsed.host = URL.domainToASCII(parsed.host.toLowerCase());
				} catch (e) {
					parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
				}
			}
			if (!schemeHandler || schemeHandler && !schemeHandler.skipNormalize) {
				if (uri.indexOf("%") !== -1) {
					if (parsed.scheme !== void 0) parsed.scheme = unescape(parsed.scheme);
					if (parsed.host !== void 0) parsed.host = reescapeHostDelimiters(unescape(parsed.host), isIP);
				}
				if (parsed.path) parsed.path = normalizePathEncoding(parsed.path);
				if (parsed.fragment) try {
					parsed.fragment = encodeURI(decodeURIComponent(parsed.fragment));
				} catch {
					parsed.error = parsed.error || "URI malformed";
				}
			}
			if (schemeHandler && schemeHandler.parse) schemeHandler.parse(parsed, options);
		} else parsed.error = parsed.error || "URI can not be parsed.";
		return {
			parsed,
			malformedAuthorityOrPort
		};
	}
	/**
	* @param {string} uri
	* @param {import('./types/index').Options} [opts]
	* @returns
	*/
	function parse(uri, opts) {
		return parseWithStatus(uri, opts).parsed;
	}
	/**
	* @param {string} uri
	* @param {import('./types/index').Options} [opts]
	* @returns {string}
	*/
	function normalizeString(uri, opts) {
		return normalizeStringWithStatus(uri, opts).normalized;
	}
	/**
	* @param {string} uri
	* @param {import('./types/index').Options} [opts]
	* @returns {{ normalized: string, malformedAuthorityOrPort: boolean }}
	*/
	function normalizeStringWithStatus(uri, opts) {
		const { parsed, malformedAuthorityOrPort } = parseWithStatus(uri, opts);
		return {
			normalized: malformedAuthorityOrPort ? uri : serialize(parsed, opts),
			malformedAuthorityOrPort
		};
	}
	/**
	* @param {import ('./types/index').URIComponent|string} uri
	* @param {import('./types/index').Options} [opts]
	* @returns {string|undefined}
	*/
	function normalizeComparableURI(uri, opts) {
		if (typeof uri === "string") {
			const { normalized, malformedAuthorityOrPort } = normalizeStringWithStatus(uri, opts);
			return malformedAuthorityOrPort ? void 0 : normalized;
		}
		if (typeof uri === "object") return serialize(uri, opts);
	}
	var fastUri = {
		SCHEMES,
		normalize,
		resolve,
		resolveComponent,
		equal,
		serialize,
		parse
	};
	module.exports = fastUri;
	module.exports.default = fastUri;
	module.exports.fastUri = fastUri;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/runtime/uri.js
var require_uri = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var uri = require_fast_uri();
	uri.code = "require(\"ajv/dist/runtime/uri\").default";
	exports.default = uri;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/core.js
var require_core$2 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = void 0;
	var validate_1 = require_validate();
	Object.defineProperty(exports, "KeywordCxt", {
		enumerable: true,
		get: function() {
			return validate_1.KeywordCxt;
		}
	});
	var codegen_1 = require_codegen();
	Object.defineProperty(exports, "_", {
		enumerable: true,
		get: function() {
			return codegen_1._;
		}
	});
	Object.defineProperty(exports, "str", {
		enumerable: true,
		get: function() {
			return codegen_1.str;
		}
	});
	Object.defineProperty(exports, "stringify", {
		enumerable: true,
		get: function() {
			return codegen_1.stringify;
		}
	});
	Object.defineProperty(exports, "nil", {
		enumerable: true,
		get: function() {
			return codegen_1.nil;
		}
	});
	Object.defineProperty(exports, "Name", {
		enumerable: true,
		get: function() {
			return codegen_1.Name;
		}
	});
	Object.defineProperty(exports, "CodeGen", {
		enumerable: true,
		get: function() {
			return codegen_1.CodeGen;
		}
	});
	var validation_error_1 = require_validation_error();
	var ref_error_1 = require_ref_error();
	var rules_1 = require_rules();
	var compile_1 = require_compile();
	var codegen_2 = require_codegen();
	var resolve_1 = require_resolve();
	var dataType_1 = require_dataType();
	var util_1 = require_util$1();
	var $dataRefSchema = (init_data(), __toCommonJS(data_exports).default);
	var uri_1 = require_uri();
	var defaultRegExp = (str, flags) => new RegExp(str, flags);
	defaultRegExp.code = "new RegExp";
	var META_IGNORE_OPTIONS = [
		"removeAdditional",
		"useDefaults",
		"coerceTypes"
	];
	var EXT_SCOPE_NAMES = new Set([
		"validate",
		"serialize",
		"parse",
		"wrapper",
		"root",
		"schema",
		"keyword",
		"pattern",
		"formats",
		"validate$data",
		"func",
		"obj",
		"Error"
	]);
	var removedOptions = {
		errorDataPath: "",
		format: "`validateFormats: false` can be used instead.",
		nullable: "\"nullable\" keyword is supported by default.",
		jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
		extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
		missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
		processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
		sourceCode: "Use option `code: {source: true}`",
		strictDefaults: "It is default now, see option `strict`.",
		strictKeywords: "It is default now, see option `strict`.",
		uniqueItems: "\"uniqueItems\" keyword is always validated.",
		unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
		cache: "Map is used as cache, schema object as key.",
		serialize: "Map is used as cache, schema object as key.",
		ajvErrors: "It is default now."
	};
	var deprecatedOptions = {
		ignoreKeywordsWithRef: "",
		jsPropertySyntax: "",
		unicode: "\"minLength\"/\"maxLength\" account for unicode characters by default."
	};
	var MAX_EXPRESSION = 200;
	function requiredOptions(o) {
		var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
		const s = o.strict;
		const _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize;
		const optimize = _optz === true || _optz === void 0 ? 1 : _optz || 0;
		const regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp;
		const uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
		return {
			strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== void 0 ? _e : s) !== null && _f !== void 0 ? _f : true,
			strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : true,
			strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
			strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
			strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : false,
			code: o.code ? {
				...o.code,
				optimize,
				regExp
			} : {
				optimize,
				regExp
			},
			loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
			loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
			meta: (_s = o.meta) !== null && _s !== void 0 ? _s : true,
			messages: (_t = o.messages) !== null && _t !== void 0 ? _t : true,
			inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : true,
			schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
			addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : true,
			validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : true,
			validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : true,
			unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : true,
			int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : true,
			uriResolver
		};
	}
	var Ajv = class {
		constructor(opts = {}) {
			this.schemas = {};
			this.refs = {};
			this.formats = Object.create(null);
			this._compilations = /* @__PURE__ */ new Set();
			this._loading = {};
			this._cache = /* @__PURE__ */ new Map();
			opts = this.opts = {
				...opts,
				...requiredOptions(opts)
			};
			const { es5, lines } = this.opts.code;
			this.scope = new codegen_2.ValueScope({
				scope: {},
				prefixes: EXT_SCOPE_NAMES,
				es5,
				lines
			});
			this.logger = getLogger(opts.logger);
			const formatOpt = opts.validateFormats;
			opts.validateFormats = false;
			this.RULES = (0, rules_1.getRules)();
			checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
			checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
			this._metaOpts = getMetaSchemaOptions.call(this);
			if (opts.formats) addInitialFormats.call(this);
			this._addVocabularies();
			this._addDefaultMetaSchema();
			if (opts.keywords) addInitialKeywords.call(this, opts.keywords);
			if (typeof opts.meta == "object") this.addMetaSchema(opts.meta);
			addInitialSchemas.call(this);
			opts.validateFormats = formatOpt;
		}
		_addVocabularies() {
			this.addKeyword("$async");
		}
		_addDefaultMetaSchema() {
			const { $data, meta, schemaId } = this.opts;
			let _dataRefSchema = $dataRefSchema;
			if (schemaId === "id") {
				_dataRefSchema = { ...$dataRefSchema };
				_dataRefSchema.id = _dataRefSchema.$id;
				delete _dataRefSchema.$id;
			}
			if (meta && $data) this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], false);
		}
		defaultMeta() {
			const { meta, schemaId } = this.opts;
			return this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : void 0;
		}
		validate(schemaKeyRef, data) {
			let v;
			if (typeof schemaKeyRef == "string") {
				v = this.getSchema(schemaKeyRef);
				if (!v) throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
			} else v = this.compile(schemaKeyRef);
			const valid = v(data);
			if (!("$async" in v)) this.errors = v.errors;
			return valid;
		}
		compile(schema, _meta) {
			const sch = this._addSchema(schema, _meta);
			return sch.validate || this._compileSchemaEnv(sch);
		}
		compileAsync(schema, meta) {
			if (typeof this.opts.loadSchema != "function") throw new Error("options.loadSchema should be a function");
			const { loadSchema } = this.opts;
			return runCompileAsync.call(this, schema, meta);
			async function runCompileAsync(_schema, _meta) {
				await loadMetaSchema.call(this, _schema.$schema);
				const sch = this._addSchema(_schema, _meta);
				return sch.validate || _compileAsync.call(this, sch);
			}
			async function loadMetaSchema($ref) {
				if ($ref && !this.getSchema($ref)) await runCompileAsync.call(this, { $ref }, true);
			}
			async function _compileAsync(sch) {
				try {
					return this._compileSchemaEnv(sch);
				} catch (e) {
					if (!(e instanceof ref_error_1.default)) throw e;
					checkLoaded.call(this, e);
					await loadMissingSchema.call(this, e.missingSchema);
					return _compileAsync.call(this, sch);
				}
			}
			function checkLoaded({ missingSchema: ref, missingRef }) {
				if (this.refs[ref]) throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
			}
			async function loadMissingSchema(ref) {
				const _schema = await _loadSchema.call(this, ref);
				if (!this.refs[ref]) await loadMetaSchema.call(this, _schema.$schema);
				if (!this.refs[ref]) this.addSchema(_schema, ref, meta);
			}
			async function _loadSchema(ref) {
				const p = this._loading[ref];
				if (p) return p;
				try {
					return await (this._loading[ref] = loadSchema(ref));
				} finally {
					delete this._loading[ref];
				}
			}
		}
		addSchema(schema, key, _meta, _validateSchema = this.opts.validateSchema) {
			if (Array.isArray(schema)) {
				for (const sch of schema) this.addSchema(sch, void 0, _meta, _validateSchema);
				return this;
			}
			let id;
			if (typeof schema === "object") {
				const { schemaId } = this.opts;
				id = schema[schemaId];
				if (id !== void 0 && typeof id != "string") throw new Error(`schema ${schemaId} must be string`);
			}
			key = (0, resolve_1.normalizeId)(key || id);
			this._checkUnique(key);
			this.schemas[key] = this._addSchema(schema, _meta, key, _validateSchema, true);
			return this;
		}
		addMetaSchema(schema, key, _validateSchema = this.opts.validateSchema) {
			this.addSchema(schema, key, true, _validateSchema);
			return this;
		}
		validateSchema(schema, throwOrLogError) {
			if (typeof schema == "boolean") return true;
			let $schema;
			$schema = schema.$schema;
			if ($schema !== void 0 && typeof $schema != "string") throw new Error("$schema must be a string");
			$schema = $schema || this.opts.defaultMeta || this.defaultMeta();
			if (!$schema) {
				this.logger.warn("meta-schema not available");
				this.errors = null;
				return true;
			}
			const valid = this.validate($schema, schema);
			if (!valid && throwOrLogError) {
				const message = "schema is invalid: " + this.errorsText();
				if (this.opts.validateSchema === "log") this.logger.error(message);
				else throw new Error(message);
			}
			return valid;
		}
		getSchema(keyRef) {
			let sch;
			while (typeof (sch = getSchEnv.call(this, keyRef)) == "string") keyRef = sch;
			if (sch === void 0) {
				const { schemaId } = this.opts;
				const root = new compile_1.SchemaEnv({
					schema: {},
					schemaId
				});
				sch = compile_1.resolveSchema.call(this, root, keyRef);
				if (!sch) return;
				this.refs[keyRef] = sch;
			}
			return sch.validate || this._compileSchemaEnv(sch);
		}
		removeSchema(schemaKeyRef) {
			if (schemaKeyRef instanceof RegExp) {
				this._removeAllSchemas(this.schemas, schemaKeyRef);
				this._removeAllSchemas(this.refs, schemaKeyRef);
				return this;
			}
			switch (typeof schemaKeyRef) {
				case "undefined":
					this._removeAllSchemas(this.schemas);
					this._removeAllSchemas(this.refs);
					this._cache.clear();
					return this;
				case "string": {
					const sch = getSchEnv.call(this, schemaKeyRef);
					if (typeof sch == "object") this._cache.delete(sch.schema);
					delete this.schemas[schemaKeyRef];
					delete this.refs[schemaKeyRef];
					return this;
				}
				case "object": {
					const cacheKey = schemaKeyRef;
					this._cache.delete(cacheKey);
					let id = schemaKeyRef[this.opts.schemaId];
					if (id) {
						id = (0, resolve_1.normalizeId)(id);
						delete this.schemas[id];
						delete this.refs[id];
					}
					return this;
				}
				default: throw new Error("ajv.removeSchema: invalid parameter");
			}
		}
		addVocabulary(definitions) {
			for (const def of definitions) this.addKeyword(def);
			return this;
		}
		addKeyword(kwdOrDef, def) {
			let keyword;
			if (typeof kwdOrDef == "string") {
				keyword = kwdOrDef;
				if (typeof def == "object") {
					this.logger.warn("these parameters are deprecated, see docs for addKeyword");
					def.keyword = keyword;
				}
			} else if (typeof kwdOrDef == "object" && def === void 0) {
				def = kwdOrDef;
				keyword = def.keyword;
				if (Array.isArray(keyword) && !keyword.length) throw new Error("addKeywords: keyword must be string or non-empty array");
			} else throw new Error("invalid addKeywords parameters");
			checkKeyword.call(this, keyword, def);
			if (!def) {
				(0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
				return this;
			}
			keywordMetaschema.call(this, def);
			const definition = {
				...def,
				type: (0, dataType_1.getJSONTypes)(def.type),
				schemaType: (0, dataType_1.getJSONTypes)(def.schemaType)
			};
			(0, util_1.eachItem)(keyword, definition.type.length === 0 ? (k) => addRule.call(this, k, definition) : (k) => definition.type.forEach((t) => addRule.call(this, k, definition, t)));
			return this;
		}
		getKeyword(keyword) {
			const rule = this.RULES.all[keyword];
			return typeof rule == "object" ? rule.definition : !!rule;
		}
		removeKeyword(keyword) {
			const { RULES } = this;
			delete RULES.keywords[keyword];
			delete RULES.all[keyword];
			for (const group of RULES.rules) {
				const i = group.rules.findIndex((rule) => rule.keyword === keyword);
				if (i >= 0) group.rules.splice(i, 1);
			}
			return this;
		}
		addFormat(name, format) {
			if (typeof format == "string") format = new RegExp(format);
			this.formats[name] = format;
			return this;
		}
		errorsText(errors = this.errors, { separator = ", ", dataVar = "data" } = {}) {
			if (!errors || errors.length === 0) return "No errors";
			return errors.map((e) => `${dataVar}${e.instancePath} ${e.message}`).reduce((text, msg) => text + separator + msg);
		}
		$dataMetaSchema(metaSchema, keywordsJsonPointers) {
			const rules = this.RULES.all;
			metaSchema = JSON.parse(JSON.stringify(metaSchema));
			for (const jsonPointer of keywordsJsonPointers) {
				const segments = jsonPointer.split("/").slice(1);
				let keywords = metaSchema;
				for (const seg of segments) keywords = keywords[seg];
				for (const key in rules) {
					const rule = rules[key];
					if (typeof rule != "object") continue;
					const { $data } = rule.definition;
					const schema = keywords[key];
					if ($data && schema) keywords[key] = schemaOrData(schema);
				}
			}
			return metaSchema;
		}
		_removeAllSchemas(schemas, regex) {
			for (const keyRef in schemas) {
				const sch = schemas[keyRef];
				if (!regex || regex.test(keyRef)) {
					if (typeof sch == "string") delete schemas[keyRef];
					else if (sch && !sch.meta) {
						this._cache.delete(sch.schema);
						delete schemas[keyRef];
					}
				}
			}
		}
		_addSchema(schema, meta, baseId, validateSchema = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
			let id;
			const { schemaId } = this.opts;
			if (typeof schema == "object") id = schema[schemaId];
			else if (this.opts.jtd) throw new Error("schema must be object");
			else if (typeof schema != "boolean") throw new Error("schema must be object or boolean");
			let sch = this._cache.get(schema);
			if (sch !== void 0) return sch;
			baseId = (0, resolve_1.normalizeId)(id || baseId);
			const localRefs = resolve_1.getSchemaRefs.call(this, schema, baseId);
			sch = new compile_1.SchemaEnv({
				schema,
				schemaId,
				meta,
				baseId,
				localRefs
			});
			this._cache.set(sch.schema, sch);
			if (addSchema && !baseId.startsWith("#")) {
				if (baseId) this._checkUnique(baseId);
				this.refs[baseId] = sch;
			}
			if (validateSchema) this.validateSchema(schema, true);
			return sch;
		}
		_checkUnique(id) {
			if (this.schemas[id] || this.refs[id]) throw new Error(`schema with key or id "${id}" already exists`);
		}
		_compileSchemaEnv(sch) {
			if (sch.meta) this._compileMetaSchema(sch);
			else compile_1.compileSchema.call(this, sch);
			/* istanbul ignore if */
			if (!sch.validate) throw new Error("ajv implementation error");
			return sch.validate;
		}
		_compileMetaSchema(sch) {
			const currentOpts = this.opts;
			this.opts = this._metaOpts;
			try {
				compile_1.compileSchema.call(this, sch);
			} finally {
				this.opts = currentOpts;
			}
		}
	};
	Ajv.ValidationError = validation_error_1.default;
	Ajv.MissingRefError = ref_error_1.default;
	exports.default = Ajv;
	function checkOptions(checkOpts, options, msg, log = "error") {
		for (const key in checkOpts) {
			const opt = key;
			if (opt in options) this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
		}
	}
	function getSchEnv(keyRef) {
		keyRef = (0, resolve_1.normalizeId)(keyRef);
		return this.schemas[keyRef] || this.refs[keyRef];
	}
	function addInitialSchemas() {
		const optsSchemas = this.opts.schemas;
		if (!optsSchemas) return;
		if (Array.isArray(optsSchemas)) this.addSchema(optsSchemas);
		else for (const key in optsSchemas) this.addSchema(optsSchemas[key], key);
	}
	function addInitialFormats() {
		for (const name in this.opts.formats) {
			const format = this.opts.formats[name];
			if (format) this.addFormat(name, format);
		}
	}
	function addInitialKeywords(defs) {
		if (Array.isArray(defs)) {
			this.addVocabulary(defs);
			return;
		}
		this.logger.warn("keywords option as map is deprecated, pass array");
		for (const keyword in defs) {
			const def = defs[keyword];
			if (!def.keyword) def.keyword = keyword;
			this.addKeyword(def);
		}
	}
	function getMetaSchemaOptions() {
		const metaOpts = { ...this.opts };
		for (const opt of META_IGNORE_OPTIONS) delete metaOpts[opt];
		return metaOpts;
	}
	var noLogs = {
		log() {},
		warn() {},
		error() {}
	};
	function getLogger(logger) {
		if (logger === false) return noLogs;
		if (logger === void 0) return console;
		if (logger.log && logger.warn && logger.error) return logger;
		throw new Error("logger must implement log, warn and error methods");
	}
	var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
	function checkKeyword(keyword, def) {
		const { RULES } = this;
		(0, util_1.eachItem)(keyword, (kwd) => {
			if (RULES.keywords[kwd]) throw new Error(`Keyword ${kwd} is already defined`);
			if (!KEYWORD_NAME.test(kwd)) throw new Error(`Keyword ${kwd} has invalid name`);
		});
		if (!def) return;
		if (def.$data && !("code" in def || "validate" in def)) throw new Error("$data keyword must have \"code\" or \"validate\" function");
	}
	function addRule(keyword, definition, dataType) {
		var _a;
		const post = definition === null || definition === void 0 ? void 0 : definition.post;
		if (dataType && post) throw new Error("keyword with \"post\" flag cannot have \"type\"");
		const { RULES } = this;
		let ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t }) => t === dataType);
		if (!ruleGroup) {
			ruleGroup = {
				type: dataType,
				rules: []
			};
			RULES.rules.push(ruleGroup);
		}
		RULES.keywords[keyword] = true;
		if (!definition) return;
		const rule = {
			keyword,
			definition: {
				...definition,
				type: (0, dataType_1.getJSONTypes)(definition.type),
				schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType)
			}
		};
		if (definition.before) addBeforeRule.call(this, ruleGroup, rule, definition.before);
		else ruleGroup.rules.push(rule);
		RULES.all[keyword] = rule;
		(_a = definition.implements) === null || _a === void 0 || _a.forEach((kwd) => this.addKeyword(kwd));
	}
	function addBeforeRule(ruleGroup, rule, before) {
		const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
		if (i >= 0) ruleGroup.rules.splice(i, 0, rule);
		else {
			ruleGroup.rules.push(rule);
			this.logger.warn(`rule ${before} is not defined`);
		}
	}
	function keywordMetaschema(def) {
		let { metaSchema } = def;
		if (metaSchema === void 0) return;
		if (def.$data && this.opts.$data) metaSchema = schemaOrData(metaSchema);
		def.validateSchema = this.compile(metaSchema, true);
	}
	var $dataRef = { $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#" };
	function schemaOrData(schema) {
		return { anyOf: [schema, $dataRef] };
	}
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/core/id.js
var require_id = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = {
		keyword: "id",
		code() {
			throw new Error("NOT SUPPORTED: keyword \"id\", use \"$id\" for schema ID");
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/core/ref.js
var require_ref = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.callRef = exports.getValidate = void 0;
	var ref_error_1 = require_ref_error();
	var code_1 = require_code();
	var codegen_1 = require_codegen();
	var names_1 = require_names();
	var compile_1 = require_compile();
	var util_1 = require_util$1();
	var def = {
		keyword: "$ref",
		schemaType: "string",
		code(cxt) {
			const { gen, schema: $ref, it } = cxt;
			const { baseId, schemaEnv: env, validateName, opts, self } = it;
			const { root } = env;
			if (($ref === "#" || $ref === "#/") && baseId === root.baseId) return callRootRef();
			const schOrEnv = compile_1.resolveRef.call(self, root, baseId, $ref);
			if (schOrEnv === void 0) throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
			if (schOrEnv instanceof compile_1.SchemaEnv) return callValidate(schOrEnv);
			return inlineRefSchema(schOrEnv);
			function callRootRef() {
				if (env === root) return callRef(cxt, validateName, env, env.$async);
				const rootName = gen.scopeValue("root", { ref: root });
				return callRef(cxt, (0, codegen_1._)`${rootName}.validate`, root, root.$async);
			}
			function callValidate(sch) {
				callRef(cxt, getValidate(cxt, sch), sch, sch.$async);
			}
			function inlineRefSchema(sch) {
				const schName = gen.scopeValue("schema", opts.code.source === true ? {
					ref: sch,
					code: (0, codegen_1.stringify)(sch)
				} : { ref: sch });
				const valid = gen.name("valid");
				const schCxt = cxt.subschema({
					schema: sch,
					dataTypes: [],
					schemaPath: codegen_1.nil,
					topSchemaRef: schName,
					errSchemaPath: $ref
				}, valid);
				cxt.mergeEvaluated(schCxt);
				cxt.ok(valid);
			}
		}
	};
	function getValidate(cxt, sch) {
		const { gen } = cxt;
		return sch.validate ? gen.scopeValue("validate", { ref: sch.validate }) : (0, codegen_1._)`${gen.scopeValue("wrapper", { ref: sch })}.validate`;
	}
	exports.getValidate = getValidate;
	function callRef(cxt, v, sch, $async) {
		const { gen, it } = cxt;
		const { allErrors, schemaEnv: env, opts } = it;
		const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
		if ($async) callAsyncRef();
		else callSyncRef();
		function callAsyncRef() {
			if (!env.$async) throw new Error("async schema referenced by sync schema");
			const valid = gen.let("valid");
			gen.try(() => {
				gen.code((0, codegen_1._)`await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`);
				addEvaluatedFrom(v);
				if (!allErrors) gen.assign(valid, true);
			}, (e) => {
				gen.if((0, codegen_1._)`!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e));
				addErrorsFrom(e);
				if (!allErrors) gen.assign(valid, false);
			});
			cxt.ok(valid);
		}
		function callSyncRef() {
			cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
		}
		function addErrorsFrom(source) {
			const errs = (0, codegen_1._)`${source}.errors`;
			gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`);
			gen.assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
		}
		function addEvaluatedFrom(source) {
			var _a;
			if (!it.opts.unevaluated) return;
			const schEvaluated = (_a = sch === null || sch === void 0 ? void 0 : sch.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
			if (it.props !== true) if (schEvaluated && !schEvaluated.dynamicProps) {
				if (schEvaluated.props !== void 0) it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props);
			} else {
				const props = gen.var("props", (0, codegen_1._)`${source}.evaluated.props`);
				it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
			}
			if (it.items !== true) if (schEvaluated && !schEvaluated.dynamicItems) {
				if (schEvaluated.items !== void 0) it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items);
			} else {
				const items = gen.var("items", (0, codegen_1._)`${source}.evaluated.items`);
				it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
			}
		}
	}
	exports.callRef = callRef;
	exports.default = def;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/core/index.js
var require_core$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var id_1 = require_id();
	var ref_1 = require_ref();
	exports.default = [
		"$schema",
		"$id",
		"$defs",
		"$vocabulary",
		{ keyword: "$comment" },
		"definitions",
		id_1.default,
		ref_1.default
	];
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/validation/limitNumber.js
var require_limitNumber = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var codegen_1 = require_codegen();
	var ops = codegen_1.operators;
	var KWDs = {
		maximum: {
			okStr: "<=",
			ok: ops.LTE,
			fail: ops.GT
		},
		minimum: {
			okStr: ">=",
			ok: ops.GTE,
			fail: ops.LT
		},
		exclusiveMaximum: {
			okStr: "<",
			ok: ops.LT,
			fail: ops.GTE
		},
		exclusiveMinimum: {
			okStr: ">",
			ok: ops.GT,
			fail: ops.LTE
		}
	};
	exports.default = {
		keyword: Object.keys(KWDs),
		type: "number",
		schemaType: "number",
		$data: true,
		error: {
			message: ({ keyword, schemaCode }) => (0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
			params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
		},
		code(cxt) {
			const { keyword, data, schemaCode } = cxt;
			cxt.fail$data((0, codegen_1._)`${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/validation/multipleOf.js
var require_multipleOf = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var codegen_1 = require_codegen();
	exports.default = {
		keyword: "multipleOf",
		type: "number",
		schemaType: "number",
		$data: true,
		error: {
			message: ({ schemaCode }) => (0, codegen_1.str)`must be multiple of ${schemaCode}`,
			params: ({ schemaCode }) => (0, codegen_1._)`{multipleOf: ${schemaCode}}`
		},
		code(cxt) {
			const { gen, data, schemaCode, it } = cxt;
			const prec = it.opts.multipleOfPrecision;
			const res = gen.let("res");
			const invalid = prec ? (0, codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}` : (0, codegen_1._)`${res} !== parseInt(${res})`;
			cxt.fail$data((0, codegen_1._)`(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid}))`);
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	function ucs2length(str) {
		const len = str.length;
		let length = 0;
		let pos = 0;
		let value;
		while (pos < len) {
			length++;
			value = str.charCodeAt(pos++);
			if (value >= 55296 && value <= 56319 && pos < len) {
				value = str.charCodeAt(pos);
				if ((value & 64512) === 56320) pos++;
			}
		}
		return length;
	}
	exports.default = ucs2length;
	ucs2length.code = "require(\"ajv/dist/runtime/ucs2length\").default";
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/validation/limitLength.js
var require_limitLength = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	var ucs2length_1 = require_ucs2length();
	exports.default = {
		keyword: ["maxLength", "minLength"],
		type: "string",
		schemaType: "number",
		$data: true,
		error: {
			message({ keyword, schemaCode }) {
				const comp = keyword === "maxLength" ? "more" : "fewer";
				return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
			},
			params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
		},
		code(cxt) {
			const { keyword, data, schemaCode, it } = cxt;
			const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
			const len = it.opts.unicode === false ? (0, codegen_1._)`${data}.length` : (0, codegen_1._)`${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
			cxt.fail$data((0, codegen_1._)`${len} ${op} ${schemaCode}`);
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/validation/pattern.js
var require_pattern = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var code_1 = require_code();
	var util_1 = require_util$1();
	var codegen_1 = require_codegen();
	exports.default = {
		keyword: "pattern",
		type: "string",
		schemaType: "string",
		$data: true,
		error: {
			message: ({ schemaCode }) => (0, codegen_1.str)`must match pattern "${schemaCode}"`,
			params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`
		},
		code(cxt) {
			const { gen, data, $data, schema, schemaCode, it } = cxt;
			const u = it.opts.unicodeRegExp ? "u" : "";
			if ($data) {
				const { regExp } = it.opts.code;
				const regExpCode = regExp.code === "new RegExp" ? (0, codegen_1._)`new RegExp` : (0, util_1.useFunc)(gen, regExp);
				const valid = gen.let("valid");
				gen.try(() => gen.assign(valid, (0, codegen_1._)`${regExpCode}(${schemaCode}, ${u}).test(${data})`), () => gen.assign(valid, false));
				cxt.fail$data((0, codegen_1._)`!${valid}`);
			} else {
				const regExp = (0, code_1.usePattern)(cxt, schema);
				cxt.fail$data((0, codegen_1._)`!${regExp}.test(${data})`);
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/validation/limitProperties.js
var require_limitProperties = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var codegen_1 = require_codegen();
	exports.default = {
		keyword: ["maxProperties", "minProperties"],
		type: "object",
		schemaType: "number",
		$data: true,
		error: {
			message({ keyword, schemaCode }) {
				const comp = keyword === "maxProperties" ? "more" : "fewer";
				return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
			},
			params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
		},
		code(cxt) {
			const { keyword, data, schemaCode } = cxt;
			const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
			cxt.fail$data((0, codegen_1._)`Object.keys(${data}).length ${op} ${schemaCode}`);
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/validation/required.js
var require_required = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var code_1 = require_code();
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	exports.default = {
		keyword: "required",
		type: "object",
		schemaType: "array",
		$data: true,
		error: {
			message: ({ params: { missingProperty } }) => (0, codegen_1.str)`must have required property '${missingProperty}'`,
			params: ({ params: { missingProperty } }) => (0, codegen_1._)`{missingProperty: ${missingProperty}}`
		},
		code(cxt) {
			const { gen, schema, schemaCode, data, $data, it } = cxt;
			const { opts } = it;
			if (!$data && schema.length === 0) return;
			const useLoop = schema.length >= opts.loopRequired;
			if (it.allErrors) allErrorsMode();
			else exitOnErrorMode();
			if (opts.strictRequired) {
				const props = cxt.parentSchema.properties;
				const { definedProperties } = cxt.it;
				for (const requiredKey of schema) if ((props === null || props === void 0 ? void 0 : props[requiredKey]) === void 0 && !definedProperties.has(requiredKey)) {
					const msg = `required property "${requiredKey}" is not defined at "${it.schemaEnv.baseId + it.errSchemaPath}" (strictRequired)`;
					(0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
				}
			}
			function allErrorsMode() {
				if (useLoop || $data) cxt.block$data(codegen_1.nil, loopAllRequired);
				else for (const prop of schema) (0, code_1.checkReportMissingProp)(cxt, prop);
			}
			function exitOnErrorMode() {
				const missing = gen.let("missing");
				if (useLoop || $data) {
					const valid = gen.let("valid", true);
					cxt.block$data(valid, () => loopUntilMissing(missing, valid));
					cxt.ok(valid);
				} else {
					gen.if((0, code_1.checkMissingProp)(cxt, schema, missing));
					(0, code_1.reportMissingProp)(cxt, missing);
					gen.else();
				}
			}
			function loopAllRequired() {
				gen.forOf("prop", schemaCode, (prop) => {
					cxt.setParams({ missingProperty: prop });
					gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
				});
			}
			function loopUntilMissing(missing, valid) {
				cxt.setParams({ missingProperty: missing });
				gen.forOf(missing, schemaCode, () => {
					gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
					gen.if((0, codegen_1.not)(valid), () => {
						cxt.error();
						gen.break();
					});
				}, codegen_1.nil);
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/validation/limitItems.js
var require_limitItems = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var codegen_1 = require_codegen();
	exports.default = {
		keyword: ["maxItems", "minItems"],
		type: "array",
		schemaType: "number",
		$data: true,
		error: {
			message({ keyword, schemaCode }) {
				const comp = keyword === "maxItems" ? "more" : "fewer";
				return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
			},
			params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
		},
		code(cxt) {
			const { keyword, data, schemaCode } = cxt;
			const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
			cxt.fail$data((0, codegen_1._)`${data}.length ${op} ${schemaCode}`);
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/runtime/equal.js
var require_equal = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var equal = require_fast_deep_equal();
	equal.code = "require(\"ajv/dist/runtime/equal\").default";
	exports.default = equal;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var dataType_1 = require_dataType();
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	var equal_1 = require_equal();
	exports.default = {
		keyword: "uniqueItems",
		type: "array",
		schemaType: "boolean",
		$data: true,
		error: {
			message: ({ params: { i, j } }) => (0, codegen_1.str)`must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
			params: ({ params: { i, j } }) => (0, codegen_1._)`{i: ${i}, j: ${j}}`
		},
		code(cxt) {
			const { gen, data, $data, schema, parentSchema, schemaCode, it } = cxt;
			if (!$data && !schema) return;
			const valid = gen.let("valid");
			const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
			cxt.block$data(valid, validateUniqueItems, (0, codegen_1._)`${schemaCode} === false`);
			cxt.ok(valid);
			function validateUniqueItems() {
				const i = gen.let("i", (0, codegen_1._)`${data}.length`);
				const j = gen.let("j");
				cxt.setParams({
					i,
					j
				});
				gen.assign(valid, true);
				gen.if((0, codegen_1._)`${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
			}
			function canOptimize() {
				return itemTypes.length > 0 && !itemTypes.some((t) => t === "object" || t === "array");
			}
			function loopN(i, j) {
				const item = gen.name("item");
				const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong);
				const indices = gen.const("indices", (0, codegen_1._)`{}`);
				gen.for((0, codegen_1._)`;${i}--;`, () => {
					gen.let(item, (0, codegen_1._)`${data}[${i}]`);
					gen.if(wrongType, (0, codegen_1._)`continue`);
					if (itemTypes.length > 1) gen.if((0, codegen_1._)`typeof ${item} == "string"`, (0, codegen_1._)`${item} += "_"`);
					gen.if((0, codegen_1._)`typeof ${indices}[${item}] == "number"`, () => {
						gen.assign(j, (0, codegen_1._)`${indices}[${item}]`);
						cxt.error();
						gen.assign(valid, false).break();
					}).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
				});
			}
			function loopN2(i, j) {
				const eql = (0, util_1.useFunc)(gen, equal_1.default);
				const outer = gen.name("outer");
				gen.label(outer).for((0, codegen_1._)`;${i}--;`, () => gen.for((0, codegen_1._)`${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._)`${eql}(${data}[${i}], ${data}[${j}])`, () => {
					cxt.error();
					gen.assign(valid, false).break(outer);
				})));
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/validation/const.js
var require_const = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	var equal_1 = require_equal();
	exports.default = {
		keyword: "const",
		$data: true,
		error: {
			message: "must be equal to constant",
			params: ({ schemaCode }) => (0, codegen_1._)`{allowedValue: ${schemaCode}}`
		},
		code(cxt) {
			const { gen, data, $data, schemaCode, schema } = cxt;
			if ($data || schema && typeof schema == "object") cxt.fail$data((0, codegen_1._)`!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
			else cxt.fail((0, codegen_1._)`${schema} !== ${data}`);
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	var equal_1 = require_equal();
	exports.default = {
		keyword: "enum",
		schemaType: "array",
		$data: true,
		error: {
			message: "must be equal to one of the allowed values",
			params: ({ schemaCode }) => (0, codegen_1._)`{allowedValues: ${schemaCode}}`
		},
		code(cxt) {
			const { gen, data, $data, schema, schemaCode, it } = cxt;
			if (!$data && schema.length === 0) throw new Error("enum must have non-empty array");
			const useLoop = schema.length >= it.opts.loopEnum;
			let eql;
			const getEql = () => eql !== null && eql !== void 0 ? eql : eql = (0, util_1.useFunc)(gen, equal_1.default);
			let valid;
			if (useLoop || $data) {
				valid = gen.let("valid");
				cxt.block$data(valid, loopEnum);
			} else {
				/* istanbul ignore if */
				if (!Array.isArray(schema)) throw new Error("ajv implementation error");
				const vSchema = gen.const("vSchema", schemaCode);
				valid = (0, codegen_1.or)(...schema.map((_x, i) => equalCode(vSchema, i)));
			}
			cxt.pass(valid);
			function loopEnum() {
				gen.assign(valid, false);
				gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._)`${getEql()}(${data}, ${v})`, () => gen.assign(valid, true).break()));
			}
			function equalCode(vSchema, i) {
				const sch = schema[i];
				return typeof sch === "object" && sch !== null ? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])` : (0, codegen_1._)`${data} === ${sch}`;
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/validation/index.js
var require_validation = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var limitNumber_1 = require_limitNumber();
	var multipleOf_1 = require_multipleOf();
	var limitLength_1 = require_limitLength();
	var pattern_1 = require_pattern();
	var limitProperties_1 = require_limitProperties();
	var required_1 = require_required();
	var limitItems_1 = require_limitItems();
	var uniqueItems_1 = require_uniqueItems();
	var const_1 = require_const();
	var enum_1 = require_enum();
	exports.default = [
		limitNumber_1.default,
		multipleOf_1.default,
		limitLength_1.default,
		pattern_1.default,
		limitProperties_1.default,
		required_1.default,
		limitItems_1.default,
		uniqueItems_1.default,
		{
			keyword: "type",
			schemaType: ["string", "array"]
		},
		{
			keyword: "nullable",
			schemaType: "boolean"
		},
		const_1.default,
		enum_1.default
	];
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/additionalItems.js
var require_additionalItems = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.validateAdditionalItems = void 0;
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	var def = {
		keyword: "additionalItems",
		type: "array",
		schemaType: ["boolean", "object"],
		before: "uniqueItems",
		error: {
			message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
			params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
		},
		code(cxt) {
			const { parentSchema, it } = cxt;
			const { items } = parentSchema;
			if (!Array.isArray(items)) {
				(0, util_1.checkStrictMode)(it, "\"additionalItems\" is ignored when \"items\" is not an array of schemas");
				return;
			}
			validateAdditionalItems(cxt, items);
		}
	};
	function validateAdditionalItems(cxt, items) {
		const { gen, schema, data, keyword, it } = cxt;
		it.items = true;
		const len = gen.const("len", (0, codegen_1._)`${data}.length`);
		if (schema === false) {
			cxt.setParams({ len: items.length });
			cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
		} else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
			const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items.length}`);
			gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
			cxt.ok(valid);
		}
		function validateItems(valid) {
			gen.forRange("i", items.length, len, (i) => {
				cxt.subschema({
					keyword,
					dataProp: i,
					dataPropType: util_1.Type.Num
				}, valid);
				if (!it.allErrors) gen.if((0, codegen_1.not)(valid), () => gen.break());
			});
		}
	}
	exports.validateAdditionalItems = validateAdditionalItems;
	exports.default = def;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/items.js
var require_items = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.validateTuple = void 0;
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	var code_1 = require_code();
	var def = {
		keyword: "items",
		type: "array",
		schemaType: [
			"object",
			"array",
			"boolean"
		],
		before: "uniqueItems",
		code(cxt) {
			const { schema, it } = cxt;
			if (Array.isArray(schema)) return validateTuple(cxt, "additionalItems", schema);
			it.items = true;
			if ((0, util_1.alwaysValidSchema)(it, schema)) return;
			cxt.ok((0, code_1.validateArray)(cxt));
		}
	};
	function validateTuple(cxt, extraItems, schArr = cxt.schema) {
		const { gen, parentSchema, data, keyword, it } = cxt;
		checkStrictTuple(parentSchema);
		if (it.opts.unevaluated && schArr.length && it.items !== true) it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items);
		const valid = gen.name("valid");
		const len = gen.const("len", (0, codegen_1._)`${data}.length`);
		schArr.forEach((sch, i) => {
			if ((0, util_1.alwaysValidSchema)(it, sch)) return;
			gen.if((0, codegen_1._)`${len} > ${i}`, () => cxt.subschema({
				keyword,
				schemaProp: i,
				dataProp: i
			}, valid));
			cxt.ok(valid);
		});
		function checkStrictTuple(sch) {
			const { opts, errSchemaPath } = it;
			const l = schArr.length;
			const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
			if (opts.strictTuples && !fullTuple) {
				const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
				(0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
			}
		}
	}
	exports.validateTuple = validateTuple;
	exports.default = def;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/prefixItems.js
var require_prefixItems = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var items_1 = require_items();
	exports.default = {
		keyword: "prefixItems",
		type: "array",
		schemaType: ["array"],
		before: "uniqueItems",
		code: (cxt) => (0, items_1.validateTuple)(cxt, "items")
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/items2020.js
var require_items2020 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	var code_1 = require_code();
	var additionalItems_1 = require_additionalItems();
	exports.default = {
		keyword: "items",
		type: "array",
		schemaType: ["object", "boolean"],
		before: "uniqueItems",
		error: {
			message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
			params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
		},
		code(cxt) {
			const { schema, parentSchema, it } = cxt;
			const { prefixItems } = parentSchema;
			it.items = true;
			if ((0, util_1.alwaysValidSchema)(it, schema)) return;
			if (prefixItems) (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
			else cxt.ok((0, code_1.validateArray)(cxt));
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	exports.default = {
		keyword: "contains",
		type: "array",
		schemaType: ["object", "boolean"],
		before: "uniqueItems",
		trackErrors: true,
		error: {
			message: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1.str)`must contain at least ${min} valid item(s)` : (0, codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
			params: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1._)`{minContains: ${min}}` : (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`
		},
		code(cxt) {
			const { gen, schema, parentSchema, data, it } = cxt;
			let min;
			let max;
			const { minContains, maxContains } = parentSchema;
			if (it.opts.next) {
				min = minContains === void 0 ? 1 : minContains;
				max = maxContains;
			} else min = 1;
			const len = gen.const("len", (0, codegen_1._)`${data}.length`);
			cxt.setParams({
				min,
				max
			});
			if (max === void 0 && min === 0) {
				(0, util_1.checkStrictMode)(it, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
				return;
			}
			if (max !== void 0 && min > max) {
				(0, util_1.checkStrictMode)(it, `"minContains" > "maxContains" is always invalid`);
				cxt.fail();
				return;
			}
			if ((0, util_1.alwaysValidSchema)(it, schema)) {
				let cond = (0, codegen_1._)`${len} >= ${min}`;
				if (max !== void 0) cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`;
				cxt.pass(cond);
				return;
			}
			it.items = true;
			const valid = gen.name("valid");
			if (max === void 0 && min === 1) validateItems(valid, () => gen.if(valid, () => gen.break()));
			else if (min === 0) {
				gen.let(valid, true);
				if (max !== void 0) gen.if((0, codegen_1._)`${data}.length > 0`, validateItemsWithCount);
			} else {
				gen.let(valid, false);
				validateItemsWithCount();
			}
			cxt.result(valid, () => cxt.reset());
			function validateItemsWithCount() {
				const schValid = gen.name("_valid");
				const count = gen.let("count", 0);
				validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
			}
			function validateItems(_valid, block) {
				gen.forRange("i", 0, len, (i) => {
					cxt.subschema({
						keyword: "contains",
						dataProp: i,
						dataPropType: util_1.Type.Num,
						compositeRule: true
					}, _valid);
					block();
				});
			}
			function checkLimits(count) {
				gen.code((0, codegen_1._)`${count}++`);
				if (max === void 0) gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true).break());
				else {
					gen.if((0, codegen_1._)`${count} > ${max}`, () => gen.assign(valid, false).break());
					if (min === 1) gen.assign(valid, true);
					else gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true));
				}
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/dependencies.js
var require_dependencies = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = void 0;
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	var code_1 = require_code();
	exports.error = {
		message: ({ params: { property, depsCount, deps } }) => {
			const property_ies = depsCount === 1 ? "property" : "properties";
			return (0, codegen_1.str)`must have ${property_ies} ${deps} when property ${property} is present`;
		},
		params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._)`{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`
	};
	var def = {
		keyword: "dependencies",
		type: "object",
		schemaType: "object",
		error: exports.error,
		code(cxt) {
			const [propDeps, schDeps] = splitDependencies(cxt);
			validatePropertyDeps(cxt, propDeps);
			validateSchemaDeps(cxt, schDeps);
		}
	};
	function splitDependencies({ schema }) {
		const propertyDeps = {};
		const schemaDeps = {};
		for (const key in schema) {
			if (key === "__proto__") continue;
			const deps = Array.isArray(schema[key]) ? propertyDeps : schemaDeps;
			deps[key] = schema[key];
		}
		return [propertyDeps, schemaDeps];
	}
	function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
		const { gen, data, it } = cxt;
		if (Object.keys(propertyDeps).length === 0) return;
		const missing = gen.let("missing");
		for (const prop in propertyDeps) {
			const deps = propertyDeps[prop];
			if (deps.length === 0) continue;
			const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
			cxt.setParams({
				property: prop,
				depsCount: deps.length,
				deps: deps.join(", ")
			});
			if (it.allErrors) gen.if(hasProperty, () => {
				for (const depProp of deps) (0, code_1.checkReportMissingProp)(cxt, depProp);
			});
			else {
				gen.if((0, codegen_1._)`${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
				(0, code_1.reportMissingProp)(cxt, missing);
				gen.else();
			}
		}
	}
	exports.validatePropertyDeps = validatePropertyDeps;
	function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
		const { gen, data, keyword, it } = cxt;
		const valid = gen.name("valid");
		for (const prop in schemaDeps) {
			if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop])) continue;
			gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties), () => {
				const schCxt = cxt.subschema({
					keyword,
					schemaProp: prop
				}, valid);
				cxt.mergeValidEvaluated(schCxt, valid);
			}, () => gen.var(valid, true));
			cxt.ok(valid);
		}
	}
	exports.validateSchemaDeps = validateSchemaDeps;
	exports.default = def;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	exports.default = {
		keyword: "propertyNames",
		type: "object",
		schemaType: ["object", "boolean"],
		error: {
			message: "property name must be valid",
			params: ({ params }) => (0, codegen_1._)`{propertyName: ${params.propertyName}}`
		},
		code(cxt) {
			const { gen, schema, data, it } = cxt;
			if ((0, util_1.alwaysValidSchema)(it, schema)) return;
			const valid = gen.name("valid");
			gen.forIn("key", data, (key) => {
				cxt.setParams({ propertyName: key });
				cxt.subschema({
					keyword: "propertyNames",
					data: key,
					dataTypes: ["string"],
					propertyName: key,
					compositeRule: true
				}, valid);
				gen.if((0, codegen_1.not)(valid), () => {
					cxt.error(true);
					if (!it.allErrors) gen.break();
				});
			});
			cxt.ok(valid);
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var code_1 = require_code();
	var codegen_1 = require_codegen();
	var names_1 = require_names();
	var util_1 = require_util$1();
	exports.default = {
		keyword: "additionalProperties",
		type: ["object"],
		schemaType: ["boolean", "object"],
		allowUndefined: true,
		trackErrors: true,
		error: {
			message: "must NOT have additional properties",
			params: ({ params }) => (0, codegen_1._)`{additionalProperty: ${params.additionalProperty}}`
		},
		code(cxt) {
			const { gen, schema, parentSchema, data, errsCount, it } = cxt;
			/* istanbul ignore if */
			if (!errsCount) throw new Error("ajv implementation error");
			const { allErrors, opts } = it;
			it.props = true;
			if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema)) return;
			const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
			const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
			checkAdditionalProperties();
			cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
			function checkAdditionalProperties() {
				gen.forIn("key", data, (key) => {
					if (!props.length && !patProps.length) additionalPropertyCode(key);
					else gen.if(isAdditional(key), () => additionalPropertyCode(key));
				});
			}
			function isAdditional(key) {
				let definedProp;
				if (props.length > 8) {
					const propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
					definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
				} else if (props.length) definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._)`${key} === ${p}`));
				else definedProp = codegen_1.nil;
				if (patProps.length) definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._)`${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
				return (0, codegen_1.not)(definedProp);
			}
			function deleteAdditional(key) {
				gen.code((0, codegen_1._)`delete ${data}[${key}]`);
			}
			function additionalPropertyCode(key) {
				if (opts.removeAdditional === "all" || opts.removeAdditional && schema === false) {
					deleteAdditional(key);
					return;
				}
				if (schema === false) {
					cxt.setParams({ additionalProperty: key });
					cxt.error();
					if (!allErrors) gen.break();
					return;
				}
				if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
					const valid = gen.name("valid");
					if (opts.removeAdditional === "failing") {
						applyAdditionalSchema(key, valid, false);
						gen.if((0, codegen_1.not)(valid), () => {
							cxt.reset();
							deleteAdditional(key);
						});
					} else {
						applyAdditionalSchema(key, valid);
						if (!allErrors) gen.if((0, codegen_1.not)(valid), () => gen.break());
					}
				}
			}
			function applyAdditionalSchema(key, valid, errors) {
				const subschema = {
					keyword: "additionalProperties",
					dataProp: key,
					dataPropType: util_1.Type.Str
				};
				if (errors === false) Object.assign(subschema, {
					compositeRule: true,
					createErrors: false,
					allErrors: false
				});
				cxt.subschema(subschema, valid);
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/properties.js
var require_properties = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var validate_1 = require_validate();
	var code_1 = require_code();
	var util_1 = require_util$1();
	var additionalProperties_1 = require_additionalProperties();
	exports.default = {
		keyword: "properties",
		type: "object",
		schemaType: "object",
		code(cxt) {
			const { gen, schema, parentSchema, data, it } = cxt;
			if (it.opts.removeAdditional === "all" && parentSchema.additionalProperties === void 0) additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
			const allProps = (0, code_1.allSchemaProperties)(schema);
			for (const prop of allProps) it.definedProperties.add(prop);
			if (it.opts.unevaluated && allProps.length && it.props !== true) it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props);
			const properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema[p]));
			if (properties.length === 0) return;
			const valid = gen.name("valid");
			for (const prop of properties) {
				if (hasDefault(prop)) applyPropertySchema(prop);
				else {
					gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties));
					applyPropertySchema(prop);
					if (!it.allErrors) gen.else().var(valid, true);
					gen.endIf();
				}
				cxt.it.definedProperties.add(prop);
				cxt.ok(valid);
			}
			function hasDefault(prop) {
				return it.opts.useDefaults && !it.compositeRule && schema[prop].default !== void 0;
			}
			function applyPropertySchema(prop) {
				cxt.subschema({
					keyword: "properties",
					schemaProp: prop,
					dataProp: prop
				}, valid);
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/patternProperties.js
var require_patternProperties = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var code_1 = require_code();
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	var util_2 = require_util$1();
	exports.default = {
		keyword: "patternProperties",
		type: "object",
		schemaType: "object",
		code(cxt) {
			const { gen, schema, data, parentSchema, it } = cxt;
			const { opts } = it;
			const patterns = (0, code_1.allSchemaProperties)(schema);
			const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema[p]));
			if (patterns.length === 0 || alwaysValidPatterns.length === patterns.length && (!it.opts.unevaluated || it.props === true)) return;
			const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
			const valid = gen.name("valid");
			if (it.props !== true && !(it.props instanceof codegen_1.Name)) it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
			const { props } = it;
			validatePatternProperties();
			function validatePatternProperties() {
				for (const pat of patterns) {
					if (checkProperties) checkMatchingProperties(pat);
					if (it.allErrors) validateProperties(pat);
					else {
						gen.var(valid, true);
						validateProperties(pat);
						gen.if(valid);
					}
				}
			}
			function checkMatchingProperties(pat) {
				for (const prop in checkProperties) if (new RegExp(pat).test(prop)) (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
			}
			function validateProperties(pat) {
				gen.forIn("key", data, (key) => {
					gen.if((0, codegen_1._)`${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
						const alwaysValid = alwaysValidPatterns.includes(pat);
						if (!alwaysValid) cxt.subschema({
							keyword: "patternProperties",
							schemaProp: pat,
							dataProp: key,
							dataPropType: util_2.Type.Str
						}, valid);
						if (it.opts.unevaluated && props !== true) gen.assign((0, codegen_1._)`${props}[${key}]`, true);
						else if (!alwaysValid && !it.allErrors) gen.if((0, codegen_1.not)(valid), () => gen.break());
					});
				});
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/not.js
var require_not = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var util_1 = require_util$1();
	exports.default = {
		keyword: "not",
		schemaType: ["object", "boolean"],
		trackErrors: true,
		code(cxt) {
			const { gen, schema, it } = cxt;
			if ((0, util_1.alwaysValidSchema)(it, schema)) {
				cxt.fail();
				return;
			}
			const valid = gen.name("valid");
			cxt.subschema({
				keyword: "not",
				compositeRule: true,
				createErrors: false,
				allErrors: false
			}, valid);
			cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
		},
		error: { message: "must NOT be valid" }
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/anyOf.js
var require_anyOf = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = {
		keyword: "anyOf",
		schemaType: "array",
		trackErrors: true,
		code: require_code().validateUnion,
		error: { message: "must match a schema in anyOf" }
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/oneOf.js
var require_oneOf = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	exports.default = {
		keyword: "oneOf",
		schemaType: "array",
		trackErrors: true,
		error: {
			message: "must match exactly one schema in oneOf",
			params: ({ params }) => (0, codegen_1._)`{passingSchemas: ${params.passing}}`
		},
		code(cxt) {
			const { gen, schema, parentSchema, it } = cxt;
			/* istanbul ignore if */
			if (!Array.isArray(schema)) throw new Error("ajv implementation error");
			if (it.opts.discriminator && parentSchema.discriminator) return;
			const schArr = schema;
			const valid = gen.let("valid", false);
			const passing = gen.let("passing", null);
			const schValid = gen.name("_valid");
			cxt.setParams({ passing });
			gen.block(validateOneOf);
			cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
			function validateOneOf() {
				schArr.forEach((sch, i) => {
					let schCxt;
					if ((0, util_1.alwaysValidSchema)(it, sch)) gen.var(schValid, true);
					else schCxt = cxt.subschema({
						keyword: "oneOf",
						schemaProp: i,
						compositeRule: true
					}, schValid);
					if (i > 0) gen.if((0, codegen_1._)`${schValid} && ${valid}`).assign(valid, false).assign(passing, (0, codegen_1._)`[${passing}, ${i}]`).else();
					gen.if(schValid, () => {
						gen.assign(valid, true);
						gen.assign(passing, i);
						if (schCxt) cxt.mergeEvaluated(schCxt, codegen_1.Name);
					});
				});
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/allOf.js
var require_allOf = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var util_1 = require_util$1();
	exports.default = {
		keyword: "allOf",
		schemaType: "array",
		code(cxt) {
			const { gen, schema, it } = cxt;
			/* istanbul ignore if */
			if (!Array.isArray(schema)) throw new Error("ajv implementation error");
			const valid = gen.name("valid");
			schema.forEach((sch, i) => {
				if ((0, util_1.alwaysValidSchema)(it, sch)) return;
				const schCxt = cxt.subschema({
					keyword: "allOf",
					schemaProp: i
				}, valid);
				cxt.ok(valid);
				cxt.mergeEvaluated(schCxt);
			});
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/if.js
var require_if = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util$1();
	var def = {
		keyword: "if",
		schemaType: ["object", "boolean"],
		trackErrors: true,
		error: {
			message: ({ params }) => (0, codegen_1.str)`must match "${params.ifClause}" schema`,
			params: ({ params }) => (0, codegen_1._)`{failingKeyword: ${params.ifClause}}`
		},
		code(cxt) {
			const { gen, parentSchema, it } = cxt;
			if (parentSchema.then === void 0 && parentSchema.else === void 0) (0, util_1.checkStrictMode)(it, "\"if\" without \"then\" and \"else\" is ignored");
			const hasThen = hasSchema(it, "then");
			const hasElse = hasSchema(it, "else");
			if (!hasThen && !hasElse) return;
			const valid = gen.let("valid", true);
			const schValid = gen.name("_valid");
			validateIf();
			cxt.reset();
			if (hasThen && hasElse) {
				const ifClause = gen.let("ifClause");
				cxt.setParams({ ifClause });
				gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
			} else if (hasThen) gen.if(schValid, validateClause("then"));
			else gen.if((0, codegen_1.not)(schValid), validateClause("else"));
			cxt.pass(valid, () => cxt.error(true));
			function validateIf() {
				const schCxt = cxt.subschema({
					keyword: "if",
					compositeRule: true,
					createErrors: false,
					allErrors: false
				}, schValid);
				cxt.mergeEvaluated(schCxt);
			}
			function validateClause(keyword, ifClause) {
				return () => {
					const schCxt = cxt.subschema({ keyword }, schValid);
					gen.assign(valid, schValid);
					cxt.mergeValidEvaluated(schCxt, valid);
					if (ifClause) gen.assign(ifClause, (0, codegen_1._)`${keyword}`);
					else cxt.setParams({ ifClause: keyword });
				};
			}
		}
	};
	function hasSchema(it, keyword) {
		const schema = it.schema[keyword];
		return schema !== void 0 && !(0, util_1.alwaysValidSchema)(it, schema);
	}
	exports.default = def;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var util_1 = require_util$1();
	exports.default = {
		keyword: ["then", "else"],
		schemaType: ["object", "boolean"],
		code({ keyword, parentSchema, it }) {
			if (parentSchema.if === void 0) (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var additionalItems_1 = require_additionalItems();
	var prefixItems_1 = require_prefixItems();
	var items_1 = require_items();
	var items2020_1 = require_items2020();
	var contains_1 = require_contains();
	var dependencies_1 = require_dependencies();
	var propertyNames_1 = require_propertyNames();
	var additionalProperties_1 = require_additionalProperties();
	var properties_1 = require_properties();
	var patternProperties_1 = require_patternProperties();
	var not_1 = require_not();
	var anyOf_1 = require_anyOf();
	var oneOf_1 = require_oneOf();
	var allOf_1 = require_allOf();
	var if_1 = require_if();
	var thenElse_1 = require_thenElse();
	function getApplicator(draft2020 = false) {
		const applicator = [
			not_1.default,
			anyOf_1.default,
			oneOf_1.default,
			allOf_1.default,
			if_1.default,
			thenElse_1.default,
			propertyNames_1.default,
			additionalProperties_1.default,
			dependencies_1.default,
			properties_1.default,
			patternProperties_1.default
		];
		if (draft2020) applicator.push(prefixItems_1.default, items2020_1.default);
		else applicator.push(additionalItems_1.default, items_1.default);
		applicator.push(contains_1.default);
		return applicator;
	}
	exports.default = getApplicator;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/format/format.js
var require_format$2 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var codegen_1 = require_codegen();
	exports.default = {
		keyword: "format",
		type: ["number", "string"],
		schemaType: "string",
		$data: true,
		error: {
			message: ({ schemaCode }) => (0, codegen_1.str)`must match format "${schemaCode}"`,
			params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
		},
		code(cxt, ruleType) {
			const { gen, data, $data, schema, schemaCode, it } = cxt;
			const { opts, errSchemaPath, schemaEnv, self } = it;
			if (!opts.validateFormats) return;
			if ($data) validate$DataFormat();
			else validateFormat();
			function validate$DataFormat() {
				const fmts = gen.scopeValue("formats", {
					ref: self.formats,
					code: opts.code.formats
				});
				const fDef = gen.const("fDef", (0, codegen_1._)`${fmts}[${schemaCode}]`);
				const fType = gen.let("fType");
				const format = gen.let("format");
				gen.if((0, codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._)`${fDef}.type || "string"`).assign(format, (0, codegen_1._)`${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._)`"string"`).assign(format, fDef));
				cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
				function unknownFmt() {
					if (opts.strictSchema === false) return codegen_1.nil;
					return (0, codegen_1._)`${schemaCode} && !${format}`;
				}
				function invalidFmt() {
					const callFormat = schemaEnv.$async ? (0, codegen_1._)`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))` : (0, codegen_1._)`${format}(${data})`;
					const validData = (0, codegen_1._)`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
					return (0, codegen_1._)`${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
				}
			}
			function validateFormat() {
				const formatDef = self.formats[schema];
				if (!formatDef) {
					unknownFormat();
					return;
				}
				if (formatDef === true) return;
				const [fmtType, format, fmtRef] = getFormat(formatDef);
				if (fmtType === ruleType) cxt.pass(validCondition());
				function unknownFormat() {
					if (opts.strictSchema === false) {
						self.logger.warn(unknownMsg());
						return;
					}
					throw new Error(unknownMsg());
					function unknownMsg() {
						return `unknown format "${schema}" ignored in schema at path "${errSchemaPath}"`;
					}
				}
				function getFormat(fmtDef) {
					const code = fmtDef instanceof RegExp ? (0, codegen_1.regexpCode)(fmtDef) : opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(schema)}` : void 0;
					const fmt = gen.scopeValue("formats", {
						key: schema,
						ref: fmtDef,
						code
					});
					if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) return [
						fmtDef.type || "string",
						fmtDef.validate,
						(0, codegen_1._)`${fmt}.validate`
					];
					return [
						"string",
						fmtDef,
						fmt
					];
				}
				function validCondition() {
					if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
						if (!schemaEnv.$async) throw new Error("async format in sync schema");
						return (0, codegen_1._)`await ${fmtRef}(${data})`;
					}
					return typeof format == "function" ? (0, codegen_1._)`${fmtRef}(${data})` : (0, codegen_1._)`${fmtRef}.test(${data})`;
				}
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/format/index.js
var require_format$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = [require_format$2().default];
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.contentVocabulary = exports.metadataVocabulary = void 0;
	exports.metadataVocabulary = [
		"title",
		"description",
		"default",
		"deprecated",
		"readOnly",
		"writeOnly",
		"examples"
	];
	exports.contentVocabulary = [
		"contentMediaType",
		"contentEncoding",
		"contentSchema"
	];
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/draft7.js
var require_draft7 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var core_1 = require_core$1();
	var validation_1 = require_validation();
	var applicator_1 = require_applicator();
	var format_1 = require_format$1();
	var metadata_1 = require_metadata();
	exports.default = [
		core_1.default,
		validation_1.default,
		(0, applicator_1.default)(),
		format_1.default,
		metadata_1.metadataVocabulary,
		metadata_1.contentVocabulary
	];
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/discriminator/types.js
var require_types$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.DiscrError = void 0;
	var DiscrError;
	(function(DiscrError) {
		DiscrError["Tag"] = "tag";
		DiscrError["Mapping"] = "mapping";
	})(DiscrError || (exports.DiscrError = DiscrError = {}));
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var codegen_1 = require_codegen();
	var types_1 = require_types$1();
	var compile_1 = require_compile();
	var ref_error_1 = require_ref_error();
	var util_1 = require_util$1();
	exports.default = {
		keyword: "discriminator",
		type: "object",
		schemaType: "object",
		error: {
			message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag ? `tag "${tagName}" must be string` : `value of tag "${tagName}" must be in oneOf`,
			params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`
		},
		code(cxt) {
			const { gen, data, schema, parentSchema, it } = cxt;
			const { oneOf } = parentSchema;
			if (!it.opts.discriminator) throw new Error("discriminator: requires discriminator option");
			const tagName = schema.propertyName;
			if (typeof tagName != "string") throw new Error("discriminator: requires propertyName");
			if (schema.mapping) throw new Error("discriminator: mapping is not supported");
			if (!oneOf) throw new Error("discriminator: requires oneOf keyword");
			const valid = gen.let("valid", false);
			const tag = gen.const("tag", (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`);
			gen.if((0, codegen_1._)`typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, {
				discrError: types_1.DiscrError.Tag,
				tag,
				tagName
			}));
			cxt.ok(valid);
			function validateMapping() {
				const mapping = getMapping();
				gen.if(false);
				for (const tagValue in mapping) {
					gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`);
					gen.assign(valid, applyTagSchema(mapping[tagValue]));
				}
				gen.else();
				cxt.error(false, {
					discrError: types_1.DiscrError.Mapping,
					tag,
					tagName
				});
				gen.endIf();
			}
			function applyTagSchema(schemaProp) {
				const _valid = gen.name("valid");
				const schCxt = cxt.subschema({
					keyword: "oneOf",
					schemaProp
				}, _valid);
				cxt.mergeEvaluated(schCxt, codegen_1.Name);
				return _valid;
			}
			function getMapping() {
				var _a;
				const oneOfMapping = {};
				const topRequired = hasRequired(parentSchema);
				let tagRequired = true;
				for (let i = 0; i < oneOf.length; i++) {
					let sch = oneOf[i];
					if ((sch === null || sch === void 0 ? void 0 : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
						const ref = sch.$ref;
						sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref);
						if (sch instanceof compile_1.SchemaEnv) sch = sch.schema;
						if (sch === void 0) throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
					}
					const propSch = (_a = sch === null || sch === void 0 ? void 0 : sch.properties) === null || _a === void 0 ? void 0 : _a[tagName];
					if (typeof propSch != "object") throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
					tagRequired = tagRequired && (topRequired || hasRequired(sch));
					addMappings(propSch, i);
				}
				if (!tagRequired) throw new Error(`discriminator: "${tagName}" must be required`);
				return oneOfMapping;
				function hasRequired({ required }) {
					return Array.isArray(required) && required.includes(tagName);
				}
				function addMappings(sch, i) {
					if (sch.const) addMapping(sch.const, i);
					else if (sch.enum) for (const tagValue of sch.enum) addMapping(tagValue, i);
					else throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
				}
				function addMapping(tagValue, i) {
					if (typeof tagValue != "string" || tagValue in oneOfMapping) throw new Error(`discriminator: "${tagName}" values must be unique strings`);
					oneOfMapping[tagValue] = i;
				}
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/refs/json-schema-draft-07.json
var json_schema_draft_07_exports = /* @__PURE__ */ __exportAll({
	$id: () => $id,
	$schema: () => $schema,
	default: () => json_schema_draft_07_default,
	definitions: () => definitions,
	properties: () => properties,
	title: () => title,
	type: () => type
});
var $schema, $id, title, definitions, type, properties, json_schema_draft_07_default;
var init_json_schema_draft_07 = __esmMin((() => {
	$schema = "http://json-schema.org/draft-07/schema#";
	$id = "http://json-schema.org/draft-07/schema#";
	title = "Core schema meta-schema";
	definitions = {
		"schemaArray": {
			"type": "array",
			"minItems": 1,
			"items": { "$ref": "#" }
		},
		"nonNegativeInteger": {
			"type": "integer",
			"minimum": 0
		},
		"nonNegativeIntegerDefault0": { "allOf": [{ "$ref": "#/definitions/nonNegativeInteger" }, { "default": 0 }] },
		"simpleTypes": { "enum": [
			"array",
			"boolean",
			"integer",
			"null",
			"number",
			"object",
			"string"
		] },
		"stringArray": {
			"type": "array",
			"items": { "type": "string" },
			"uniqueItems": true,
			"default": []
		}
	};
	type = ["object", "boolean"];
	properties = {
		"$id": {
			"type": "string",
			"format": "uri-reference"
		},
		"$schema": {
			"type": "string",
			"format": "uri"
		},
		"$ref": {
			"type": "string",
			"format": "uri-reference"
		},
		"$comment": { "type": "string" },
		"title": { "type": "string" },
		"description": { "type": "string" },
		"default": true,
		"readOnly": {
			"type": "boolean",
			"default": false
		},
		"examples": {
			"type": "array",
			"items": true
		},
		"multipleOf": {
			"type": "number",
			"exclusiveMinimum": 0
		},
		"maximum": { "type": "number" },
		"exclusiveMaximum": { "type": "number" },
		"minimum": { "type": "number" },
		"exclusiveMinimum": { "type": "number" },
		"maxLength": { "$ref": "#/definitions/nonNegativeInteger" },
		"minLength": { "$ref": "#/definitions/nonNegativeIntegerDefault0" },
		"pattern": {
			"type": "string",
			"format": "regex"
		},
		"additionalItems": { "$ref": "#" },
		"items": {
			"anyOf": [{ "$ref": "#" }, { "$ref": "#/definitions/schemaArray" }],
			"default": true
		},
		"maxItems": { "$ref": "#/definitions/nonNegativeInteger" },
		"minItems": { "$ref": "#/definitions/nonNegativeIntegerDefault0" },
		"uniqueItems": {
			"type": "boolean",
			"default": false
		},
		"contains": { "$ref": "#" },
		"maxProperties": { "$ref": "#/definitions/nonNegativeInteger" },
		"minProperties": { "$ref": "#/definitions/nonNegativeIntegerDefault0" },
		"required": { "$ref": "#/definitions/stringArray" },
		"additionalProperties": { "$ref": "#" },
		"definitions": {
			"type": "object",
			"additionalProperties": { "$ref": "#" },
			"default": {}
		},
		"properties": {
			"type": "object",
			"additionalProperties": { "$ref": "#" },
			"default": {}
		},
		"patternProperties": {
			"type": "object",
			"additionalProperties": { "$ref": "#" },
			"propertyNames": { "format": "regex" },
			"default": {}
		},
		"dependencies": {
			"type": "object",
			"additionalProperties": { "anyOf": [{ "$ref": "#" }, { "$ref": "#/definitions/stringArray" }] }
		},
		"propertyNames": { "$ref": "#" },
		"const": true,
		"enum": {
			"type": "array",
			"items": true,
			"minItems": 1,
			"uniqueItems": true
		},
		"type": { "anyOf": [{ "$ref": "#/definitions/simpleTypes" }, {
			"type": "array",
			"items": { "$ref": "#/definitions/simpleTypes" },
			"minItems": 1,
			"uniqueItems": true
		}] },
		"format": { "type": "string" },
		"contentMediaType": { "type": "string" },
		"contentEncoding": { "type": "string" },
		"if": { "$ref": "#" },
		"then": { "$ref": "#" },
		"else": { "$ref": "#" },
		"allOf": { "$ref": "#/definitions/schemaArray" },
		"anyOf": { "$ref": "#/definitions/schemaArray" },
		"oneOf": { "$ref": "#/definitions/schemaArray" },
		"not": { "$ref": "#" }
	};
	json_schema_draft_07_default = {
		$schema,
		$id,
		title,
		definitions,
		type,
		properties,
		"default": true
	};
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv/dist/ajv.js
var require_ajv = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv = void 0;
	var core_1 = require_core$2();
	var draft7_1 = require_draft7();
	var discriminator_1 = require_discriminator();
	var draft7MetaSchema = (init_json_schema_draft_07(), __toCommonJS(json_schema_draft_07_exports).default);
	var META_SUPPORT_DATA = ["/properties"];
	var META_SCHEMA_ID = "http://json-schema.org/draft-07/schema";
	var Ajv = class extends core_1.default {
		_addVocabularies() {
			super._addVocabularies();
			draft7_1.default.forEach((v) => this.addVocabulary(v));
			if (this.opts.discriminator) this.addKeyword(discriminator_1.default);
		}
		_addDefaultMetaSchema() {
			super._addDefaultMetaSchema();
			if (!this.opts.meta) return;
			const metaSchema = this.opts.$data ? this.$dataMetaSchema(draft7MetaSchema, META_SUPPORT_DATA) : draft7MetaSchema;
			this.addMetaSchema(metaSchema, META_SCHEMA_ID, false);
			this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
		}
		defaultMeta() {
			return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
		}
	};
	exports.Ajv = Ajv;
	module.exports = exports = Ajv;
	module.exports.Ajv = Ajv;
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = Ajv;
	var validate_1 = require_validate();
	Object.defineProperty(exports, "KeywordCxt", {
		enumerable: true,
		get: function() {
			return validate_1.KeywordCxt;
		}
	});
	var codegen_1 = require_codegen();
	Object.defineProperty(exports, "_", {
		enumerable: true,
		get: function() {
			return codegen_1._;
		}
	});
	Object.defineProperty(exports, "str", {
		enumerable: true,
		get: function() {
			return codegen_1.str;
		}
	});
	Object.defineProperty(exports, "stringify", {
		enumerable: true,
		get: function() {
			return codegen_1.stringify;
		}
	});
	Object.defineProperty(exports, "nil", {
		enumerable: true,
		get: function() {
			return codegen_1.nil;
		}
	});
	Object.defineProperty(exports, "Name", {
		enumerable: true,
		get: function() {
			return codegen_1.Name;
		}
	});
	Object.defineProperty(exports, "CodeGen", {
		enumerable: true,
		get: function() {
			return codegen_1.CodeGen;
		}
	});
	var validation_error_1 = require_validation_error();
	Object.defineProperty(exports, "ValidationError", {
		enumerable: true,
		get: function() {
			return validation_error_1.default;
		}
	});
	var ref_error_1 = require_ref_error();
	Object.defineProperty(exports, "MissingRefError", {
		enumerable: true,
		get: function() {
			return ref_error_1.default;
		}
	});
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv-formats/dist/formats.js
var require_formats = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.formatNames = exports.fastFormats = exports.fullFormats = void 0;
	function fmtDef(validate, compare) {
		return {
			validate,
			compare
		};
	}
	exports.fullFormats = {
		date: fmtDef(date, compareDate),
		time: fmtDef(time, compareTime),
		"date-time": fmtDef(date_time, compareDateTime),
		duration: /^P(?!$)((\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?|(\d+W)?)$/,
		uri,
		"uri-reference": /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i,
		"uri-template": /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i,
		url: /^(?:https?|ftp):\/\/(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)(?:\.(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)*(?:\.(?:[a-z\u{00a1}-\u{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/iu,
		email: /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
		hostname: /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i,
		ipv4: /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
		ipv6: /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i,
		regex,
		uuid: /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
		"json-pointer": /^(?:\/(?:[^~/]|~0|~1)*)*$/,
		"json-pointer-uri-fragment": /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i,
		"relative-json-pointer": /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/,
		byte,
		int32: {
			type: "number",
			validate: validateInt32
		},
		int64: {
			type: "number",
			validate: validateInt64
		},
		float: {
			type: "number",
			validate: validateNumber
		},
		double: {
			type: "number",
			validate: validateNumber
		},
		password: true,
		binary: true
	};
	exports.fastFormats = {
		...exports.fullFormats,
		date: fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d$/, compareDate),
		time: fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareTime),
		"date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareDateTime),
		uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
		"uri-reference": /^(?:(?:[a-z][a-z0-9+\-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
		email: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i
	};
	exports.formatNames = Object.keys(exports.fullFormats);
	function isLeapYear(year) {
		return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	}
	var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
	var DAYS = [
		0,
		31,
		28,
		31,
		30,
		31,
		30,
		31,
		31,
		30,
		31,
		30,
		31
	];
	function date(str) {
		const matches = DATE.exec(str);
		if (!matches) return false;
		const year = +matches[1];
		const month = +matches[2];
		const day = +matches[3];
		return month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && isLeapYear(year) ? 29 : DAYS[month]);
	}
	function compareDate(d1, d2) {
		if (!(d1 && d2)) return void 0;
		if (d1 > d2) return 1;
		if (d1 < d2) return -1;
		return 0;
	}
	var TIME = /^(\d\d):(\d\d):(\d\d)(\.\d+)?(z|[+-]\d\d(?::?\d\d)?)?$/i;
	function time(str, withTimeZone) {
		const matches = TIME.exec(str);
		if (!matches) return false;
		const hour = +matches[1];
		const minute = +matches[2];
		const second = +matches[3];
		const timeZone = matches[5];
		return (hour <= 23 && minute <= 59 && second <= 59 || hour === 23 && minute === 59 && second === 60) && (!withTimeZone || timeZone !== "");
	}
	function compareTime(t1, t2) {
		if (!(t1 && t2)) return void 0;
		const a1 = TIME.exec(t1);
		const a2 = TIME.exec(t2);
		if (!(a1 && a2)) return void 0;
		t1 = a1[1] + a1[2] + a1[3] + (a1[4] || "");
		t2 = a2[1] + a2[2] + a2[3] + (a2[4] || "");
		if (t1 > t2) return 1;
		if (t1 < t2) return -1;
		return 0;
	}
	var DATE_TIME_SEPARATOR = /t|\s/i;
	function date_time(str) {
		const dateTime = str.split(DATE_TIME_SEPARATOR);
		return dateTime.length === 2 && date(dateTime[0]) && time(dateTime[1], true);
	}
	function compareDateTime(dt1, dt2) {
		if (!(dt1 && dt2)) return void 0;
		const [d1, t1] = dt1.split(DATE_TIME_SEPARATOR);
		const [d2, t2] = dt2.split(DATE_TIME_SEPARATOR);
		const res = compareDate(d1, d2);
		if (res === void 0) return void 0;
		return res || compareTime(t1, t2);
	}
	var NOT_URI_FRAGMENT = /\/|:/;
	var URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
	function uri(str) {
		return NOT_URI_FRAGMENT.test(str) && URI.test(str);
	}
	var BYTE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/gm;
	function byte(str) {
		BYTE.lastIndex = 0;
		return BYTE.test(str);
	}
	var MIN_INT32 = -(2 ** 31);
	var MAX_INT32 = 2 ** 31 - 1;
	function validateInt32(value) {
		return Number.isInteger(value) && value <= MAX_INT32 && value >= MIN_INT32;
	}
	function validateInt64(value) {
		return Number.isInteger(value);
	}
	function validateNumber() {
		return true;
	}
	var Z_ANCHOR = /[^\\]\\Z/;
	function regex(str) {
		if (Z_ANCHOR.test(str)) return false;
		try {
			new RegExp(str);
			return true;
		} catch (e) {
			return false;
		}
	}
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv-formats/dist/limit.js
var require_limit = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.formatLimitDefinition = void 0;
	var ajv_1 = require_ajv();
	var codegen_1 = require_codegen();
	var ops = codegen_1.operators;
	var KWDs = {
		formatMaximum: {
			okStr: "<=",
			ok: ops.LTE,
			fail: ops.GT
		},
		formatMinimum: {
			okStr: ">=",
			ok: ops.GTE,
			fail: ops.LT
		},
		formatExclusiveMaximum: {
			okStr: "<",
			ok: ops.LT,
			fail: ops.GTE
		},
		formatExclusiveMinimum: {
			okStr: ">",
			ok: ops.GT,
			fail: ops.LTE
		}
	};
	exports.formatLimitDefinition = {
		keyword: Object.keys(KWDs),
		type: "string",
		schemaType: "string",
		$data: true,
		error: {
			message: ({ keyword, schemaCode }) => codegen_1.str`should be ${KWDs[keyword].okStr} ${schemaCode}`,
			params: ({ keyword, schemaCode }) => codegen_1._`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
		},
		code(cxt) {
			const { gen, data, schemaCode, keyword, it } = cxt;
			const { opts, self } = it;
			if (!opts.validateFormats) return;
			const fCxt = new ajv_1.KeywordCxt(it, self.RULES.all.format.definition, "format");
			if (fCxt.$data) validate$DataFormat();
			else validateFormat();
			function validate$DataFormat() {
				const fmts = gen.scopeValue("formats", {
					ref: self.formats,
					code: opts.code.formats
				});
				const fmt = gen.const("fmt", codegen_1._`${fmts}[${fCxt.schemaCode}]`);
				cxt.fail$data(codegen_1.or(codegen_1._`typeof ${fmt} != "object"`, codegen_1._`${fmt} instanceof RegExp`, codegen_1._`typeof ${fmt}.compare != "function"`, compareCode(fmt)));
			}
			function validateFormat() {
				const format = fCxt.schema;
				const fmtDef = self.formats[format];
				if (!fmtDef || fmtDef === true) return;
				if (typeof fmtDef != "object" || fmtDef instanceof RegExp || typeof fmtDef.compare != "function") throw new Error(`"${keyword}": format "${format}" does not define "compare" function`);
				const fmt = gen.scopeValue("formats", {
					key: format,
					ref: fmtDef,
					code: opts.code.formats ? codegen_1._`${opts.code.formats}${codegen_1.getProperty(format)}` : void 0
				});
				cxt.fail$data(compareCode(fmt));
			}
			function compareCode(fmt) {
				return codegen_1._`${fmt}.compare(${data}, ${schemaCode}) ${KWDs[keyword].fail} 0`;
			}
		},
		dependencies: ["format"]
	};
	var formatLimitPlugin = (ajv) => {
		ajv.addKeyword(exports.formatLimitDefinition);
		return ajv;
	};
	exports.default = formatLimitPlugin;
}));
//#endregion
//#region ../../node_modules/conf/node_modules/ajv-formats/dist/index.js
var require_dist = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	var formats_1 = require_formats();
	var limit_1 = require_limit();
	var codegen_1 = require_codegen();
	var fullName = new codegen_1.Name("fullFormats");
	var fastName = new codegen_1.Name("fastFormats");
	var formatsPlugin = (ajv, opts = { keywords: true }) => {
		if (Array.isArray(opts)) {
			addFormats(ajv, opts, formats_1.fullFormats, fullName);
			return ajv;
		}
		const [formats, exportName] = opts.mode === "fast" ? [formats_1.fastFormats, fastName] : [formats_1.fullFormats, fullName];
		addFormats(ajv, opts.formats || formats_1.formatNames, formats, exportName);
		if (opts.keywords) limit_1.default(ajv);
		return ajv;
	};
	formatsPlugin.get = (name, mode = "full") => {
		const f = (mode === "fast" ? formats_1.fastFormats : formats_1.fullFormats)[name];
		if (!f) throw new Error(`Unknown format "${name}"`);
		return f;
	};
	function addFormats(ajv, list, fs, exportName) {
		var _a;
		var _b;
		(_a = (_b = ajv.opts.code).formats) !== null && _a !== void 0 || (_b.formats = codegen_1._`require("ajv-formats/dist/formats").${exportName}`);
		for (const f of list) ajv.addFormat(f, fs[f]);
	}
	module.exports = exports = formatsPlugin;
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = formatsPlugin;
}));
//#endregion
//#region ../../node_modules/debounce-fn/node_modules/mimic-fn/index.js
var require_mimic_fn$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var copyProperty = (to, from, property, ignoreNonConfigurable) => {
		if (property === "length" || property === "prototype") return;
		if (property === "arguments" || property === "caller") return;
		const toDescriptor = Object.getOwnPropertyDescriptor(to, property);
		const fromDescriptor = Object.getOwnPropertyDescriptor(from, property);
		if (!canCopyProperty(toDescriptor, fromDescriptor) && ignoreNonConfigurable) return;
		Object.defineProperty(to, property, fromDescriptor);
	};
	var canCopyProperty = function(toDescriptor, fromDescriptor) {
		return toDescriptor === void 0 || toDescriptor.configurable || toDescriptor.writable === fromDescriptor.writable && toDescriptor.enumerable === fromDescriptor.enumerable && toDescriptor.configurable === fromDescriptor.configurable && (toDescriptor.writable || toDescriptor.value === fromDescriptor.value);
	};
	var changePrototype = (to, from) => {
		const fromPrototype = Object.getPrototypeOf(from);
		if (fromPrototype === Object.getPrototypeOf(to)) return;
		Object.setPrototypeOf(to, fromPrototype);
	};
	var wrappedToString = (withName, fromBody) => `/* Wrapped ${withName}*/\n${fromBody}`;
	var toStringDescriptor = Object.getOwnPropertyDescriptor(Function.prototype, "toString");
	var toStringName = Object.getOwnPropertyDescriptor(Function.prototype.toString, "name");
	var changeToString = (to, from, name) => {
		const withName = name === "" ? "" : `with ${name.trim()}() `;
		const newToString = wrappedToString.bind(null, withName, from.toString());
		Object.defineProperty(newToString, "name", toStringName);
		Object.defineProperty(to, "toString", {
			...toStringDescriptor,
			value: newToString
		});
	};
	var mimicFn = (to, from, { ignoreNonConfigurable = false } = {}) => {
		const { name } = to;
		for (const property of Reflect.ownKeys(from)) copyProperty(to, from, property, ignoreNonConfigurable);
		changePrototype(to, from);
		changeToString(to, from, name);
		return to;
	};
	module.exports = mimicFn;
}));
//#endregion
//#region ../../node_modules/debounce-fn/index.js
var require_debounce_fn = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var mimicFn = require_mimic_fn$1();
	module.exports = (inputFunction, options = {}) => {
		if (typeof inputFunction !== "function") throw new TypeError(`Expected the first argument to be a function, got \`${typeof inputFunction}\``);
		const { wait = 0, before = false, after = true } = options;
		if (!before && !after) throw new Error("Both `before` and `after` are false, function wouldn't be called.");
		let timeout;
		let result;
		const debouncedFunction = function(...arguments_) {
			const context = this;
			const later = () => {
				timeout = void 0;
				if (after) result = inputFunction.apply(context, arguments_);
			};
			const shouldCallNow = before && !timeout;
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
			if (shouldCallNow) result = inputFunction.apply(context, arguments_);
			return result;
		};
		mimicFn(debouncedFunction, inputFunction);
		debouncedFunction.cancel = () => {
			if (timeout) {
				clearTimeout(timeout);
				timeout = void 0;
			}
		};
		return debouncedFunction;
	};
}));
//#endregion
//#region ../../node_modules/semver/internal/constants.js
var require_constants$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SEMVER_SPEC_VERSION = "2.0.0";
	var MAX_LENGTH = 256;
	var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
	module.exports = {
		MAX_LENGTH,
		MAX_SAFE_COMPONENT_LENGTH: 16,
		MAX_SAFE_BUILD_LENGTH: MAX_LENGTH - 6,
		MAX_SAFE_INTEGER,
		RELEASE_TYPES: [
			"major",
			"premajor",
			"minor",
			"preminor",
			"patch",
			"prepatch",
			"prerelease"
		],
		SEMVER_SPEC_VERSION,
		FLAG_INCLUDE_PRERELEASE: 1,
		FLAG_LOOSE: 2
	};
}));
//#endregion
//#region ../../node_modules/semver/internal/debug.js
var require_debug$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {};
}));
//#endregion
//#region ../../node_modules/semver/internal/re.js
var require_re$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { MAX_SAFE_COMPONENT_LENGTH, MAX_SAFE_BUILD_LENGTH, MAX_LENGTH } = require_constants$1();
	var debug = require_debug$1();
	exports = module.exports = {};
	var re = exports.re = [];
	var safeRe = exports.safeRe = [];
	var src = exports.src = [];
	var safeSrc = exports.safeSrc = [];
	var t = exports.t = {};
	var R = 0;
	var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
	var safeRegexReplacements = [
		["\\s", 1],
		["\\d", MAX_LENGTH],
		[LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
	];
	var makeSafeRegex = (value) => {
		for (const [token, max] of safeRegexReplacements) value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
		return value;
	};
	var createToken = (name, value, isGlobal) => {
		const safe = makeSafeRegex(value);
		const index = R++;
		debug(name, index, value);
		t[name] = index;
		src[index] = value;
		safeSrc[index] = safe;
		re[index] = new RegExp(value, isGlobal ? "g" : void 0);
		safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
	};
	createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
	createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
	createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
	createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
	createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
	createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
	createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
	createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
	createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
	createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
	createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
	createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
	createToken("FULL", `^${src[t.FULLPLAIN]}$`);
	createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
	createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
	createToken("GTLT", "((?:<|>)?=?)");
	createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
	createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
	createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
	createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
	createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
	createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("COERCEPLAIN", `(^|[^\\d])(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
	createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
	createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
	createToken("COERCERTL", src[t.COERCE], true);
	createToken("COERCERTLFULL", src[t.COERCEFULL], true);
	createToken("LONETILDE", "(?:~>?)");
	createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
	exports.tildeTrimReplace = "$1~";
	createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
	createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("LONECARET", "(?:\\^)");
	createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
	exports.caretTrimReplace = "$1^";
	createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
	createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
	createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
	createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
	exports.comparatorTrimReplace = "$1$2$3";
	createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
	createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
	createToken("STAR", "(<|>)?=?\\s*\\*");
	createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
	createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
}));
//#endregion
//#region ../../node_modules/semver/internal/parse-options.js
var require_parse_options$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var looseOption = Object.freeze({ loose: true });
	var emptyOpts = Object.freeze({});
	var parseOptions = (options) => {
		if (!options) return emptyOpts;
		if (typeof options !== "object") return looseOption;
		return options;
	};
	module.exports = parseOptions;
}));
//#endregion
//#region ../../node_modules/semver/internal/identifiers.js
var require_identifiers$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var numeric = /^[0-9]+$/;
	var compareIdentifiers = (a, b) => {
		if (typeof a === "number" && typeof b === "number") return a === b ? 0 : a < b ? -1 : 1;
		const anum = numeric.test(a);
		const bnum = numeric.test(b);
		if (anum && bnum) {
			a = +a;
			b = +b;
		}
		return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
	};
	var rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
	module.exports = {
		compareIdentifiers,
		rcompareIdentifiers
	};
}));
//#endregion
//#region ../../node_modules/semver/classes/semver.js
var require_semver$3 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var debug = require_debug$1();
	var { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants$1();
	var { safeRe: re, t } = require_re$1();
	var parseOptions = require_parse_options$1();
	var { compareIdentifiers } = require_identifiers$1();
	var isPrereleaseIdentifier = (prerelease, identifier) => {
		const identifiers = identifier.split(".");
		if (identifiers.length > prerelease.length) return false;
		for (let i = 0; i < identifiers.length; i++) if (compareIdentifiers(prerelease[i], identifiers[i]) !== 0) return false;
		return true;
	};
	module.exports = class SemVer {
		constructor(version, options) {
			options = parseOptions(options);
			if (version instanceof SemVer) if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) return version;
			else version = version.version;
			else if (typeof version !== "string") throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
			if (version.length > MAX_LENGTH) throw new TypeError(`version is longer than ${MAX_LENGTH} characters`);
			debug("SemVer", version, options);
			this.options = options;
			this.loose = !!options.loose;
			this.includePrerelease = !!options.includePrerelease;
			const m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
			if (!m) throw new TypeError(`Invalid Version: ${version}`);
			this.raw = version;
			this.major = +m[1];
			this.minor = +m[2];
			this.patch = +m[3];
			if (this.major > MAX_SAFE_INTEGER || this.major < 0) throw new TypeError("Invalid major version");
			if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) throw new TypeError("Invalid minor version");
			if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) throw new TypeError("Invalid patch version");
			if (!m[4]) this.prerelease = [];
			else this.prerelease = m[4].split(".").map((id) => {
				if (/^[0-9]+$/.test(id)) {
					const num = +id;
					if (num >= 0 && num < MAX_SAFE_INTEGER) return num;
				}
				return id;
			});
			this.build = m[5] ? m[5].split(".") : [];
			this.format();
		}
		format() {
			this.version = `${this.major}.${this.minor}.${this.patch}`;
			if (this.prerelease.length) this.version += `-${this.prerelease.join(".")}`;
			return this.version;
		}
		toString() {
			return this.version;
		}
		compare(other) {
			debug("SemVer.compare", this.version, this.options, other);
			if (!(other instanceof SemVer)) {
				if (typeof other === "string" && other === this.version) return 0;
				other = new SemVer(other, this.options);
			}
			if (other.version === this.version) return 0;
			return this.compareMain(other) || this.comparePre(other);
		}
		compareMain(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			if (this.major < other.major) return -1;
			if (this.major > other.major) return 1;
			if (this.minor < other.minor) return -1;
			if (this.minor > other.minor) return 1;
			if (this.patch < other.patch) return -1;
			if (this.patch > other.patch) return 1;
			return 0;
		}
		comparePre(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			if (this.prerelease.length && !other.prerelease.length) return -1;
			else if (!this.prerelease.length && other.prerelease.length) return 1;
			else if (!this.prerelease.length && !other.prerelease.length) return 0;
			let i = 0;
			do {
				const a = this.prerelease[i];
				const b = other.prerelease[i];
				debug("prerelease compare", i, a, b);
				if (a === void 0 && b === void 0) return 0;
				else if (b === void 0) return 1;
				else if (a === void 0) return -1;
				else if (a === b) continue;
				else return compareIdentifiers(a, b);
			} while (++i);
		}
		compareBuild(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			let i = 0;
			do {
				const a = this.build[i];
				const b = other.build[i];
				debug("build compare", i, a, b);
				if (a === void 0 && b === void 0) return 0;
				else if (b === void 0) return 1;
				else if (a === void 0) return -1;
				else if (a === b) continue;
				else return compareIdentifiers(a, b);
			} while (++i);
		}
		inc(release, identifier, identifierBase) {
			if (release.startsWith("pre")) {
				if (!identifier && identifierBase === false) throw new Error("invalid increment argument: identifier is empty");
				if (identifier) {
					const match = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
					if (!match || match[1] !== identifier) throw new Error(`invalid identifier: ${identifier}`);
				}
			}
			switch (release) {
				case "premajor":
					this.prerelease.length = 0;
					this.patch = 0;
					this.minor = 0;
					this.major++;
					this.inc("pre", identifier, identifierBase);
					break;
				case "preminor":
					this.prerelease.length = 0;
					this.patch = 0;
					this.minor++;
					this.inc("pre", identifier, identifierBase);
					break;
				case "prepatch":
					this.prerelease.length = 0;
					this.inc("patch", identifier, identifierBase);
					this.inc("pre", identifier, identifierBase);
					break;
				case "prerelease":
					if (this.prerelease.length === 0) this.inc("patch", identifier, identifierBase);
					this.inc("pre", identifier, identifierBase);
					break;
				case "release":
					if (this.prerelease.length === 0) throw new Error(`version ${this.raw} is not a prerelease`);
					this.prerelease.length = 0;
					break;
				case "major":
					if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) this.major++;
					this.minor = 0;
					this.patch = 0;
					this.prerelease = [];
					break;
				case "minor":
					if (this.patch !== 0 || this.prerelease.length === 0) this.minor++;
					this.patch = 0;
					this.prerelease = [];
					break;
				case "patch":
					if (this.prerelease.length === 0) this.patch++;
					this.prerelease = [];
					break;
				case "pre": {
					const base = Number(identifierBase) ? 1 : 0;
					if (this.prerelease.length === 0) this.prerelease = [base];
					else {
						let i = this.prerelease.length;
						while (--i >= 0) if (typeof this.prerelease[i] === "number") {
							this.prerelease[i]++;
							i = -2;
						}
						if (i === -1) {
							if (identifier === this.prerelease.join(".") && identifierBase === false) throw new Error("invalid increment argument: identifier already exists");
							this.prerelease.push(base);
						}
					}
					if (identifier) {
						let prerelease = [identifier, base];
						if (identifierBase === false) prerelease = [identifier];
						if (isPrereleaseIdentifier(this.prerelease, identifier)) {
							const prereleaseBase = this.prerelease[identifier.split(".").length];
							if (isNaN(prereleaseBase)) this.prerelease = prerelease;
						} else this.prerelease = prerelease;
					}
					break;
				}
				default: throw new Error(`invalid increment argument: ${release}`);
			}
			this.raw = this.format();
			if (this.build.length) this.raw += `+${this.build.join(".")}`;
			return this;
		}
	};
}));
//#endregion
//#region ../../node_modules/semver/functions/parse.js
var require_parse$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$3();
	var parse = (version, options, throwErrors = false) => {
		if (version instanceof SemVer) return version;
		try {
			return new SemVer(version, options);
		} catch (er) {
			if (!throwErrors) return null;
			throw er;
		}
	};
	module.exports = parse;
}));
//#endregion
//#region ../../node_modules/semver/functions/valid.js
var require_valid$3 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parse = require_parse$1();
	var valid = (version, options) => {
		const v = parse(version, options);
		return v ? v.version : null;
	};
	module.exports = valid;
}));
//#endregion
//#region ../../node_modules/semver/functions/clean.js
var require_clean$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parse = require_parse$1();
	var clean = (version, options) => {
		const s = parse(version.trim().replace(/^[=v]+/, ""), options);
		return s ? s.version : null;
	};
	module.exports = clean;
}));
//#endregion
//#region ../../node_modules/semver/functions/inc.js
var require_inc$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$3();
	var inc = (version, release, options, identifier, identifierBase) => {
		if (typeof options === "string") {
			identifierBase = identifier;
			identifier = options;
			options = void 0;
		}
		try {
			return new SemVer(version instanceof SemVer ? version.version : version, options).inc(release, identifier, identifierBase).version;
		} catch (er) {
			return null;
		}
	};
	module.exports = inc;
}));
//#endregion
//#region ../../node_modules/semver/functions/diff.js
var require_diff$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parse = require_parse$1();
	var diff = (version1, version2) => {
		const v1 = parse(version1, null, true);
		const v2 = parse(version2, null, true);
		const comparison = v1.compare(v2);
		if (comparison === 0) return null;
		const v1Higher = comparison > 0;
		const highVersion = v1Higher ? v1 : v2;
		const lowVersion = v1Higher ? v2 : v1;
		const highHasPre = !!highVersion.prerelease.length;
		if (!!lowVersion.prerelease.length && !highHasPre) {
			if (!lowVersion.patch && !lowVersion.minor) return "major";
			if (lowVersion.compareMain(highVersion) === 0) {
				if (lowVersion.minor && !lowVersion.patch) return "minor";
				return "patch";
			}
		}
		const prefix = highHasPre ? "pre" : "";
		if (v1.major !== v2.major) return prefix + "major";
		if (v1.minor !== v2.minor) return prefix + "minor";
		if (v1.patch !== v2.patch) return prefix + "patch";
		return "prerelease";
	};
	module.exports = diff;
}));
//#endregion
//#region ../../node_modules/semver/functions/major.js
var require_major$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$3();
	var major = (a, loose) => new SemVer(a, loose).major;
	module.exports = major;
}));
//#endregion
//#region ../../node_modules/semver/functions/minor.js
var require_minor$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$3();
	var minor = (a, loose) => new SemVer(a, loose).minor;
	module.exports = minor;
}));
//#endregion
//#region ../../node_modules/semver/functions/patch.js
var require_patch$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$3();
	var patch = (a, loose) => new SemVer(a, loose).patch;
	module.exports = patch;
}));
//#endregion
//#region ../../node_modules/semver/functions/prerelease.js
var require_prerelease$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parse = require_parse$1();
	var prerelease = (version, options) => {
		const parsed = parse(version, options);
		return parsed && parsed.prerelease.length ? parsed.prerelease : null;
	};
	module.exports = prerelease;
}));
//#endregion
//#region ../../node_modules/semver/functions/compare.js
var require_compare$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$3();
	var compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
	module.exports = compare;
}));
//#endregion
//#region ../../node_modules/semver/functions/rcompare.js
var require_rcompare$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare$1();
	var rcompare = (a, b, loose) => compare(b, a, loose);
	module.exports = rcompare;
}));
//#endregion
//#region ../../node_modules/semver/functions/compare-loose.js
var require_compare_loose$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare$1();
	var compareLoose = (a, b) => compare(a, b, true);
	module.exports = compareLoose;
}));
//#endregion
//#region ../../node_modules/semver/functions/compare-build.js
var require_compare_build$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$3();
	var compareBuild = (a, b, loose) => {
		const versionA = new SemVer(a, loose);
		const versionB = new SemVer(b, loose);
		return versionA.compare(versionB) || versionA.compareBuild(versionB);
	};
	module.exports = compareBuild;
}));
//#endregion
//#region ../../node_modules/semver/functions/sort.js
var require_sort$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compareBuild = require_compare_build$1();
	var sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
	module.exports = sort;
}));
//#endregion
//#region ../../node_modules/semver/functions/rsort.js
var require_rsort$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compareBuild = require_compare_build$1();
	var rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
	module.exports = rsort;
}));
//#endregion
//#region ../../node_modules/semver/functions/gt.js
var require_gt$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare$1();
	var gt = (a, b, loose) => compare(a, b, loose) > 0;
	module.exports = gt;
}));
//#endregion
//#region ../../node_modules/semver/functions/lt.js
var require_lt$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare$1();
	var lt = (a, b, loose) => compare(a, b, loose) < 0;
	module.exports = lt;
}));
//#endregion
//#region ../../node_modules/semver/functions/eq.js
var require_eq$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare$1();
	var eq = (a, b, loose) => compare(a, b, loose) === 0;
	module.exports = eq;
}));
//#endregion
//#region ../../node_modules/semver/functions/neq.js
var require_neq$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare$1();
	var neq = (a, b, loose) => compare(a, b, loose) !== 0;
	module.exports = neq;
}));
//#endregion
//#region ../../node_modules/semver/functions/gte.js
var require_gte$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare$1();
	var gte = (a, b, loose) => compare(a, b, loose) >= 0;
	module.exports = gte;
}));
//#endregion
//#region ../../node_modules/semver/functions/lte.js
var require_lte$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare$1();
	var lte = (a, b, loose) => compare(a, b, loose) <= 0;
	module.exports = lte;
}));
//#endregion
//#region ../../node_modules/semver/functions/cmp.js
var require_cmp$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var eq = require_eq$1();
	var neq = require_neq$1();
	var gt = require_gt$1();
	var gte = require_gte$1();
	var lt = require_lt$1();
	var lte = require_lte$1();
	var cmp = (a, op, b, loose) => {
		switch (op) {
			case "===":
				if (typeof a === "object") a = a.version;
				if (typeof b === "object") b = b.version;
				return a === b;
			case "!==":
				if (typeof a === "object") a = a.version;
				if (typeof b === "object") b = b.version;
				return a !== b;
			case "":
			case "=":
			case "==": return eq(a, b, loose);
			case "!=": return neq(a, b, loose);
			case ">": return gt(a, b, loose);
			case ">=": return gte(a, b, loose);
			case "<": return lt(a, b, loose);
			case "<=": return lte(a, b, loose);
			default: throw new TypeError(`Invalid operator: ${op}`);
		}
	};
	module.exports = cmp;
}));
//#endregion
//#region ../../node_modules/semver/functions/coerce.js
var require_coerce$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$3();
	var parse = require_parse$1();
	var { safeRe: re, t } = require_re$1();
	var coerce = (version, options) => {
		if (version instanceof SemVer) return version;
		if (typeof version === "number") version = String(version);
		if (typeof version !== "string") return null;
		options = options || {};
		let match = null;
		if (!options.rtl) match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
		else {
			const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
			let next;
			while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
				if (!match || next.index + next[0].length !== match.index + match[0].length) match = next;
				coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
			}
			coerceRtlRegex.lastIndex = -1;
		}
		if (match === null) return null;
		const major = match[2];
		return parse(`${major}.${match[3] || "0"}.${match[4] || "0"}${options.includePrerelease && match[5] ? `-${match[5]}` : ""}${options.includePrerelease && match[6] ? `+${match[6]}` : ""}`, options);
	};
	module.exports = coerce;
}));
//#endregion
//#region ../../node_modules/semver/functions/truncate.js
var require_truncate = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parse = require_parse$1();
	var constants = require_constants$1();
	var SemVer = require_semver$3();
	var truncate = (version, truncation, options) => {
		if (!constants.RELEASE_TYPES.includes(truncation)) return null;
		const clonedVersion = cloneInputVersion(version, options);
		return clonedVersion && doTruncation(clonedVersion, truncation);
	};
	var cloneInputVersion = (version, options) => {
		return parse(version instanceof SemVer ? version.version : version, options);
	};
	var doTruncation = (version, truncation) => {
		if (isPrerelease(truncation)) return version.version;
		version.prerelease = [];
		switch (truncation) {
			case "major":
				version.minor = 0;
				version.patch = 0;
				break;
			case "minor":
				version.patch = 0;
				break;
		}
		return version.format();
	};
	var isPrerelease = (type) => {
		return type.startsWith("pre");
	};
	module.exports = truncate;
}));
//#endregion
//#region ../../node_modules/semver/internal/lrucache.js
var require_lrucache$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var LRUCache = class {
		constructor() {
			this.max = 1e3;
			this.map = /* @__PURE__ */ new Map();
		}
		get(key) {
			const value = this.map.get(key);
			if (value === void 0) return;
			else {
				this.map.delete(key);
				this.map.set(key, value);
				return value;
			}
		}
		delete(key) {
			return this.map.delete(key);
		}
		set(key, value) {
			if (!this.delete(key) && value !== void 0) {
				if (this.map.size >= this.max) {
					const firstKey = this.map.keys().next().value;
					this.delete(firstKey);
				}
				this.map.set(key, value);
			}
			return this;
		}
	};
	module.exports = LRUCache;
}));
//#endregion
//#region ../../node_modules/semver/classes/range.js
var require_range$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SPACE_CHARACTERS = /\s+/g;
	module.exports = class Range {
		constructor(range, options) {
			options = parseOptions(options);
			if (range instanceof Range) if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) return range;
			else return new Range(range.raw, options);
			if (range instanceof Comparator) {
				this.raw = range.value;
				this.set = [[range]];
				this.formatted = void 0;
				return this;
			}
			this.options = options;
			this.loose = !!options.loose;
			this.includePrerelease = !!options.includePrerelease;
			this.raw = range.trim().replace(SPACE_CHARACTERS, " ");
			this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
			if (!this.set.length) throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
			if (this.set.length > 1) {
				const first = this.set[0];
				this.set = this.set.filter((c) => !isNullSet(c[0]));
				if (this.set.length === 0) this.set = [first];
				else if (this.set.length > 1) {
					for (const c of this.set) if (c.length === 1 && isAny(c[0])) {
						this.set = [c];
						break;
					}
				}
			}
			this.formatted = void 0;
		}
		get range() {
			if (this.formatted === void 0) {
				this.formatted = "";
				for (let i = 0; i < this.set.length; i++) {
					if (i > 0) this.formatted += "||";
					const comps = this.set[i];
					for (let k = 0; k < comps.length; k++) {
						if (k > 0) this.formatted += " ";
						this.formatted += comps[k].toString().trim();
					}
				}
			}
			return this.formatted;
		}
		format() {
			return this.range;
		}
		toString() {
			return this.range;
		}
		parseRange(range) {
			range = range.replace(BUILDSTRIPRE, "");
			const memoKey = ((this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE)) + ":" + range;
			const cached = cache.get(memoKey);
			if (cached) return cached;
			const loose = this.options.loose;
			const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
			range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
			debug("hyphen replace", range);
			range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
			debug("comparator trim", range);
			range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
			debug("tilde trim", range);
			range = range.replace(re[t.CARETTRIM], caretTrimReplace);
			debug("caret trim", range);
			let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
			if (loose) rangeList = rangeList.filter((comp) => {
				debug("loose invalid filter", comp, this.options);
				return !!comp.match(re[t.COMPARATORLOOSE]);
			});
			debug("range list", rangeList);
			const rangeMap = /* @__PURE__ */ new Map();
			const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
			for (const comp of comparators) {
				if (isNullSet(comp)) return [comp];
				rangeMap.set(comp.value, comp);
			}
			if (rangeMap.size > 1 && rangeMap.has("")) rangeMap.delete("");
			const result = [...rangeMap.values()];
			cache.set(memoKey, result);
			return result;
		}
		intersects(range, options) {
			if (!(range instanceof Range)) throw new TypeError("a Range is required");
			return this.set.some((thisComparators) => {
				return isSatisfiable(thisComparators, options) && range.set.some((rangeComparators) => {
					return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
						return rangeComparators.every((rangeComparator) => {
							return thisComparator.intersects(rangeComparator, options);
						});
					});
				});
			});
		}
		test(version) {
			if (!version) return false;
			if (typeof version === "string") try {
				version = new SemVer(version, this.options);
			} catch (er) {
				return false;
			}
			for (let i = 0; i < this.set.length; i++) if (testSet(this.set[i], version, this.options)) return true;
			return false;
		}
	};
	var cache = new (require_lrucache$1())();
	var parseOptions = require_parse_options$1();
	var Comparator = require_comparator$1();
	var debug = require_debug$1();
	var SemVer = require_semver$3();
	var { safeRe: re, src, t, comparatorTrimReplace, tildeTrimReplace, caretTrimReplace } = require_re$1();
	var { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants$1();
	var BUILDSTRIPRE = new RegExp(src[t.BUILD], "g");
	var isNullSet = (c) => c.value === "<0.0.0-0";
	var isAny = (c) => c.value === "";
	var isSatisfiable = (comparators, options) => {
		let result = true;
		const remainingComparators = comparators.slice();
		let testComparator = remainingComparators.pop();
		while (result && remainingComparators.length) {
			result = remainingComparators.every((otherComparator) => {
				return testComparator.intersects(otherComparator, options);
			});
			testComparator = remainingComparators.pop();
		}
		return result;
	};
	var parseComparator = (comp, options) => {
		comp = comp.replace(re[t.BUILD], "");
		debug("comp", comp, options);
		comp = replaceCarets(comp, options);
		debug("caret", comp);
		comp = replaceTildes(comp, options);
		debug("tildes", comp);
		comp = replaceXRanges(comp, options);
		debug("xrange", comp);
		comp = replaceStars(comp, options);
		debug("stars", comp);
		return comp;
	};
	var isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
	var invalidXRangeOrder = (M, m, p) => isX(M) && !isX(m) || isX(m) && p && !isX(p);
	var replaceTildes = (comp, options) => {
		return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
	};
	var replaceTilde = (comp, options) => {
		const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
		return comp.replace(r, (_, M, m, p, pr) => {
			debug("tilde", comp, _, M, m, p, pr);
			let ret;
			if (isX(M)) ret = "";
			else if (isX(m)) ret = `>=${M}.0.0 <${+M + 1}.0.0-0`;
			else if (isX(p)) ret = `>=${M}.${m}.0 <${M}.${+m + 1}.0-0`;
			else if (pr) {
				debug("replaceTilde pr", pr);
				ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
			} else ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
			debug("tilde return", ret);
			return ret;
		});
	};
	var replaceCarets = (comp, options) => {
		return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
	};
	var replaceCaret = (comp, options) => {
		debug("caret", comp, options);
		const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
		const z = options.includePrerelease ? "-0" : "";
		return comp.replace(r, (_, M, m, p, pr) => {
			debug("caret", comp, _, M, m, p, pr);
			let ret;
			if (isX(M)) ret = "";
			else if (isX(m)) ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
			else if (isX(p)) if (M === "0") ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
			else ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
			else if (pr) {
				debug("replaceCaret pr", pr);
				if (M === "0") if (m === "0") ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
				else ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
				else ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
			} else {
				debug("no pr");
				if (M === "0") if (m === "0") ret = `>=${M}.${m}.${p} <${M}.${m}.${+p + 1}-0`;
				else ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
				else ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
			}
			debug("caret return", ret);
			return ret;
		});
	};
	var replaceXRanges = (comp, options) => {
		debug("replaceXRanges", comp, options);
		return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
	};
	var replaceXRange = (comp, options) => {
		comp = comp.trim();
		const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
		return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
			debug("xRange", comp, ret, gtlt, M, m, p, pr);
			if (invalidXRangeOrder(M, m, p)) return comp;
			const xM = isX(M);
			const xm = xM || isX(m);
			const xp = xm || isX(p);
			const anyX = xp;
			if (gtlt === "=" && anyX) gtlt = "";
			pr = options.includePrerelease ? "-0" : "";
			if (xM) if (gtlt === ">" || gtlt === "<") ret = "<0.0.0-0";
			else ret = "*";
			else if (gtlt && anyX) {
				if (xm) m = 0;
				p = 0;
				if (gtlt === ">") {
					gtlt = ">=";
					if (xm) {
						M = +M + 1;
						m = 0;
						p = 0;
					} else {
						m = +m + 1;
						p = 0;
					}
				} else if (gtlt === "<=") {
					gtlt = "<";
					if (xm) M = +M + 1;
					else m = +m + 1;
				}
				if (gtlt === "<") pr = "-0";
				ret = `${gtlt + M}.${m}.${p}${pr}`;
			} else if (xm) ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
			else if (xp) ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
			debug("xRange return", ret);
			return ret;
		});
	};
	var replaceStars = (comp, options) => {
		debug("replaceStars", comp, options);
		return comp.trim().replace(re[t.STAR], "");
	};
	var replaceGTE0 = (comp, options) => {
		debug("replaceGTE0", comp, options);
		return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
	};
	var hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
		if (isX(fM)) from = "";
		else if (isX(fm)) from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
		else if (isX(fp)) from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
		else if (fpr) from = `>=${from}`;
		else from = `>=${from}${incPr ? "-0" : ""}`;
		if (isX(tM)) to = "";
		else if (isX(tm)) to = `<${+tM + 1}.0.0-0`;
		else if (isX(tp)) to = `<${tM}.${+tm + 1}.0-0`;
		else if (tpr) to = `<=${tM}.${tm}.${tp}-${tpr}`;
		else if (incPr) to = `<${tM}.${tm}.${+tp + 1}-0`;
		else to = `<=${to}`;
		return `${from} ${to}`.trim();
	};
	var testSet = (set, version, options) => {
		for (let i = 0; i < set.length; i++) if (!set[i].test(version)) return false;
		if (version.prerelease.length && !options.includePrerelease) {
			for (let i = 0; i < set.length; i++) {
				debug(set[i].semver);
				if (set[i].semver === Comparator.ANY) continue;
				if (set[i].semver.prerelease.length > 0) {
					const allowed = set[i].semver;
					if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) return true;
				}
			}
			return false;
		}
		return true;
	};
}));
//#endregion
//#region ../../node_modules/semver/classes/comparator.js
var require_comparator$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var ANY = Symbol("SemVer ANY");
	module.exports = class Comparator {
		static get ANY() {
			return ANY;
		}
		constructor(comp, options) {
			options = parseOptions(options);
			if (comp instanceof Comparator) if (comp.loose === !!options.loose) return comp;
			else comp = comp.value;
			comp = comp.trim().split(/\s+/).join(" ");
			debug("comparator", comp, options);
			this.options = options;
			this.loose = !!options.loose;
			this.parse(comp);
			if (this.semver === ANY) this.value = "";
			else this.value = this.operator + this.semver.version;
			debug("comp", this);
		}
		parse(comp) {
			const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
			const m = comp.match(r);
			if (!m) throw new TypeError(`Invalid comparator: ${comp}`);
			this.operator = m[1] !== void 0 ? m[1] : "";
			if (this.operator === "=") this.operator = "";
			if (!m[2]) this.semver = ANY;
			else this.semver = new SemVer(m[2], this.options.loose);
		}
		toString() {
			return this.value;
		}
		test(version) {
			debug("Comparator.test", version, this.options.loose);
			if (this.semver === ANY || version === ANY) return true;
			if (typeof version === "string") try {
				version = new SemVer(version, this.options);
			} catch (er) {
				return false;
			}
			return cmp(version, this.operator, this.semver, this.options);
		}
		intersects(comp, options) {
			if (!(comp instanceof Comparator)) throw new TypeError("a Comparator is required");
			if (this.operator === "") {
				if (this.value === "") return true;
				return new Range(comp.value, options).test(this.value);
			} else if (comp.operator === "") {
				if (comp.value === "") return true;
				return new Range(this.value, options).test(comp.semver);
			}
			options = parseOptions(options);
			if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) return false;
			if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) return false;
			if (this.operator.startsWith(">") && comp.operator.startsWith(">")) return true;
			if (this.operator.startsWith("<") && comp.operator.startsWith("<")) return true;
			if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) return true;
			if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) return true;
			if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) return true;
			return false;
		}
	};
	var parseOptions = require_parse_options$1();
	var { safeRe: re, t } = require_re$1();
	var cmp = require_cmp$1();
	var debug = require_debug$1();
	var SemVer = require_semver$3();
	var Range = require_range$1();
}));
//#endregion
//#region ../../node_modules/semver/functions/satisfies.js
var require_satisfies$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Range = require_range$1();
	var satisfies = (version, range, options) => {
		try {
			range = new Range(range, options);
		} catch (er) {
			return false;
		}
		return range.test(version);
	};
	module.exports = satisfies;
}));
//#endregion
//#region ../../node_modules/semver/ranges/to-comparators.js
var require_to_comparators$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Range = require_range$1();
	var toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
	module.exports = toComparators;
}));
//#endregion
//#region ../../node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$3();
	var Range = require_range$1();
	var maxSatisfying = (versions, range, options) => {
		let max = null;
		let maxSV = null;
		let rangeObj = null;
		try {
			rangeObj = new Range(range, options);
		} catch (er) {
			return null;
		}
		versions.forEach((v) => {
			if (rangeObj.test(v)) {
				if (!max || maxSV.compare(v) === -1) {
					max = v;
					maxSV = new SemVer(max, options);
				}
			}
		});
		return max;
	};
	module.exports = maxSatisfying;
}));
//#endregion
//#region ../../node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$3();
	var Range = require_range$1();
	var minSatisfying = (versions, range, options) => {
		let min = null;
		let minSV = null;
		let rangeObj = null;
		try {
			rangeObj = new Range(range, options);
		} catch (er) {
			return null;
		}
		versions.forEach((v) => {
			if (rangeObj.test(v)) {
				if (!min || minSV.compare(v) === 1) {
					min = v;
					minSV = new SemVer(min, options);
				}
			}
		});
		return min;
	};
	module.exports = minSatisfying;
}));
//#endregion
//#region ../../node_modules/semver/ranges/min-version.js
var require_min_version$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$3();
	var Range = require_range$1();
	var gt = require_gt$1();
	var minVersion = (range, loose) => {
		range = new Range(range, loose);
		let minver = new SemVer("0.0.0");
		if (range.test(minver)) return minver;
		minver = new SemVer("0.0.0-0");
		if (range.test(minver)) return minver;
		minver = null;
		for (let i = 0; i < range.set.length; ++i) {
			const comparators = range.set[i];
			let setMin = null;
			comparators.forEach((comparator) => {
				const compver = new SemVer(comparator.semver.version);
				switch (comparator.operator) {
					case ">":
						if (compver.prerelease.length === 0) compver.patch++;
						else compver.prerelease.push(0);
						compver.raw = compver.format();
					case "":
					case ">=":
						if (!setMin || gt(compver, setMin)) setMin = compver;
						break;
					case "<":
					case "<=": break;
					/* istanbul ignore next */
					default: throw new Error(`Unexpected operation: ${comparator.operator}`);
				}
			});
			if (setMin && (!minver || gt(minver, setMin))) minver = setMin;
		}
		if (minver && range.test(minver)) return minver;
		return null;
	};
	module.exports = minVersion;
}));
//#endregion
//#region ../../node_modules/semver/ranges/valid.js
var require_valid$2 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Range = require_range$1();
	var validRange = (range, options) => {
		try {
			return new Range(range, options).range || "*";
		} catch (er) {
			return null;
		}
	};
	module.exports = validRange;
}));
//#endregion
//#region ../../node_modules/semver/ranges/outside.js
var require_outside$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$3();
	var Comparator = require_comparator$1();
	var { ANY } = Comparator;
	var Range = require_range$1();
	var satisfies = require_satisfies$1();
	var gt = require_gt$1();
	var lt = require_lt$1();
	var lte = require_lte$1();
	var gte = require_gte$1();
	var outside = (version, range, hilo, options) => {
		version = new SemVer(version, options);
		range = new Range(range, options);
		let gtfn, ltefn, ltfn, comp, ecomp;
		switch (hilo) {
			case ">":
				gtfn = gt;
				ltefn = lte;
				ltfn = lt;
				comp = ">";
				ecomp = ">=";
				break;
			case "<":
				gtfn = lt;
				ltefn = gte;
				ltfn = gt;
				comp = "<";
				ecomp = "<=";
				break;
			default: throw new TypeError("Must provide a hilo val of \"<\" or \">\"");
		}
		if (satisfies(version, range, options)) return false;
		for (let i = 0; i < range.set.length; ++i) {
			const comparators = range.set[i];
			let high = null;
			let low = null;
			comparators.forEach((comparator) => {
				if (comparator.semver === ANY) comparator = new Comparator(">=0.0.0");
				high = high || comparator;
				low = low || comparator;
				if (gtfn(comparator.semver, high.semver, options)) high = comparator;
				else if (ltfn(comparator.semver, low.semver, options)) low = comparator;
			});
			if (high.operator === comp || high.operator === ecomp) return false;
			if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) return false;
			else if (low.operator === ecomp && ltfn(version, low.semver)) return false;
		}
		return true;
	};
	module.exports = outside;
}));
//#endregion
//#region ../../node_modules/semver/ranges/gtr.js
var require_gtr$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var outside = require_outside$1();
	var gtr = (version, range, options) => outside(version, range, ">", options);
	module.exports = gtr;
}));
//#endregion
//#region ../../node_modules/semver/ranges/ltr.js
var require_ltr$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var outside = require_outside$1();
	var ltr = (version, range, options) => outside(version, range, "<", options);
	module.exports = ltr;
}));
//#endregion
//#region ../../node_modules/semver/ranges/intersects.js
var require_intersects$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Range = require_range$1();
	var intersects = (r1, r2, options) => {
		r1 = new Range(r1, options);
		r2 = new Range(r2, options);
		return r1.intersects(r2, options);
	};
	module.exports = intersects;
}));
//#endregion
//#region ../../node_modules/semver/ranges/simplify.js
var require_simplify$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var satisfies = require_satisfies$1();
	var compare = require_compare$1();
	module.exports = (versions, range, options) => {
		const set = [];
		let first = null;
		let prev = null;
		const v = versions.sort((a, b) => compare(a, b, options));
		for (const version of v) if (satisfies(version, range, options)) {
			prev = version;
			if (!first) first = version;
		} else {
			if (prev) set.push([first, prev]);
			prev = null;
			first = null;
		}
		if (first) set.push([first, null]);
		const ranges = [];
		for (const [min, max] of set) if (min === max) ranges.push(min);
		else if (!max && min === v[0]) ranges.push("*");
		else if (!max) ranges.push(`>=${min}`);
		else if (min === v[0]) ranges.push(`<=${max}`);
		else ranges.push(`${min} - ${max}`);
		const simplified = ranges.join(" || ");
		const original = typeof range.raw === "string" ? range.raw : String(range);
		return simplified.length < original.length ? simplified : range;
	};
}));
//#endregion
//#region ../../node_modules/semver/ranges/subset.js
var require_subset$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Range = require_range$1();
	var Comparator = require_comparator$1();
	var { ANY } = Comparator;
	var satisfies = require_satisfies$1();
	var compare = require_compare$1();
	var subset = (sub, dom, options = {}) => {
		if (sub === dom) return true;
		sub = new Range(sub, options);
		dom = new Range(dom, options);
		let sawNonNull = false;
		OUTER: for (const simpleSub of sub.set) {
			for (const simpleDom of dom.set) {
				const isSub = simpleSubset(simpleSub, simpleDom, options);
				sawNonNull = sawNonNull || isSub !== null;
				if (isSub) continue OUTER;
			}
			if (sawNonNull) return false;
		}
		return true;
	};
	var minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
	var minimumVersion = [new Comparator(">=0.0.0")];
	var simpleSubset = (sub, dom, options) => {
		if (sub === dom) return true;
		if (sub.length === 1 && sub[0].semver === ANY) if (dom.length === 1 && dom[0].semver === ANY) return true;
		else if (options.includePrerelease) sub = minimumVersionWithPreRelease;
		else sub = minimumVersion;
		if (dom.length === 1 && dom[0].semver === ANY) if (options.includePrerelease) return true;
		else dom = minimumVersion;
		const eqSet = /* @__PURE__ */ new Set();
		let gt, lt;
		for (const c of sub) if (c.operator === ">" || c.operator === ">=") gt = higherGT(gt, c, options);
		else if (c.operator === "<" || c.operator === "<=") lt = lowerLT(lt, c, options);
		else eqSet.add(c.semver);
		if (eqSet.size > 1) return null;
		let gtltComp;
		if (gt && lt) {
			gtltComp = compare(gt.semver, lt.semver, options);
			if (gtltComp > 0) return null;
			else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) return null;
		}
		for (const eq of eqSet) {
			if (gt && !satisfies(eq, String(gt), options)) return null;
			if (lt && !satisfies(eq, String(lt), options)) return null;
			for (const c of dom) if (!satisfies(eq, String(c), options)) return false;
			return true;
		}
		let higher, lower;
		let hasDomLT, hasDomGT;
		let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
		let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
		if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) needDomLTPre = false;
		for (const c of dom) {
			hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
			hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
			if (gt) {
				if (needDomGTPre) {
					if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) needDomGTPre = false;
				}
				if (c.operator === ">" || c.operator === ">=") {
					higher = higherGT(gt, c, options);
					if (higher === c && higher !== gt) return false;
				} else if (gt.operator === ">=" && !c.test(gt.semver)) return false;
			}
			if (lt) {
				if (needDomLTPre) {
					if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) needDomLTPre = false;
				}
				if (c.operator === "<" || c.operator === "<=") {
					lower = lowerLT(lt, c, options);
					if (lower === c && lower !== lt) return false;
				} else if (lt.operator === "<=" && !c.test(lt.semver)) return false;
			}
			if (!c.operator && (lt || gt) && gtltComp !== 0) return false;
		}
		if (gt && hasDomLT && !lt && gtltComp !== 0) return false;
		if (lt && hasDomGT && !gt && gtltComp !== 0) return false;
		if (needDomGTPre || needDomLTPre) return false;
		return true;
	};
	var higherGT = (a, b, options) => {
		if (!a) return b;
		const comp = compare(a.semver, b.semver, options);
		return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
	};
	var lowerLT = (a, b, options) => {
		if (!a) return b;
		const comp = compare(a.semver, b.semver, options);
		return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
	};
	module.exports = subset;
}));
//#endregion
//#region ../../node_modules/semver/index.js
var require_semver$2 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var internalRe = require_re$1();
	var constants = require_constants$1();
	var SemVer = require_semver$3();
	var identifiers = require_identifiers$1();
	module.exports = {
		parse: require_parse$1(),
		valid: require_valid$3(),
		clean: require_clean$1(),
		inc: require_inc$1(),
		diff: require_diff$1(),
		major: require_major$1(),
		minor: require_minor$1(),
		patch: require_patch$1(),
		prerelease: require_prerelease$1(),
		compare: require_compare$1(),
		rcompare: require_rcompare$1(),
		compareLoose: require_compare_loose$1(),
		compareBuild: require_compare_build$1(),
		sort: require_sort$1(),
		rsort: require_rsort$1(),
		gt: require_gt$1(),
		lt: require_lt$1(),
		eq: require_eq$1(),
		neq: require_neq$1(),
		gte: require_gte$1(),
		lte: require_lte$1(),
		cmp: require_cmp$1(),
		coerce: require_coerce$1(),
		truncate: require_truncate(),
		Comparator: require_comparator$1(),
		Range: require_range$1(),
		satisfies: require_satisfies$1(),
		toComparators: require_to_comparators$1(),
		maxSatisfying: require_max_satisfying$1(),
		minSatisfying: require_min_satisfying$1(),
		minVersion: require_min_version$1(),
		validRange: require_valid$2(),
		outside: require_outside$1(),
		gtr: require_gtr$1(),
		ltr: require_ltr$1(),
		intersects: require_intersects$1(),
		simplifyRange: require_simplify$1(),
		subset: require_subset$1(),
		SemVer,
		re: internalRe.re,
		src: internalRe.src,
		tokens: internalRe.t,
		SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
		RELEASE_TYPES: constants.RELEASE_TYPES,
		compareIdentifiers: identifiers.compareIdentifiers,
		rcompareIdentifiers: identifiers.rcompareIdentifiers
	};
}));
//#endregion
//#region ../../node_modules/mimic-fn/index.js
var require_mimic_fn = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var mimicFn = (to, from) => {
		for (const prop of Reflect.ownKeys(from)) Object.defineProperty(to, prop, Object.getOwnPropertyDescriptor(from, prop));
		return to;
	};
	module.exports = mimicFn;
	module.exports.default = mimicFn;
}));
//#endregion
//#region ../../node_modules/onetime/index.js
var require_onetime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var mimicFn = require_mimic_fn();
	var calledFunctions = /* @__PURE__ */ new WeakMap();
	var onetime = (function_, options = {}) => {
		if (typeof function_ !== "function") throw new TypeError("Expected a function");
		let returnValue;
		let callCount = 0;
		const functionName = function_.displayName || function_.name || "<anonymous>";
		const onetime = function(...arguments_) {
			calledFunctions.set(onetime, ++callCount);
			if (callCount === 1) {
				returnValue = function_.apply(this, arguments_);
				function_ = null;
			} else if (options.throw === true) throw new Error(`Function \`${functionName}\` can only be called once`);
			return returnValue;
		};
		mimicFn(onetime, function_);
		calledFunctions.set(onetime, callCount);
		return onetime;
	};
	module.exports = onetime;
	module.exports.default = onetime;
	module.exports.callCount = (function_) => {
		if (!calledFunctions.has(function_)) throw new Error(`The given function \`${function_.name}\` is not wrapped by the \`onetime\` package`);
		return calledFunctions.get(function_);
	};
}));
//#endregion
//#region ../../node_modules/conf/dist/source/index.js
var require_source = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __classPrivateFieldSet = exports && exports.__classPrivateFieldSet || function(receiver, state, value, kind, f) {
		if (kind === "m") throw new TypeError("Private method is not writable");
		if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
		if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
		return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
	};
	var __classPrivateFieldGet = exports && exports.__classPrivateFieldGet || function(receiver, state, kind, f) {
		if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
		if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
		return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
	};
	var _a, _b;
	var _Conf_validator, _Conf_encryptionKey, _Conf_options, _Conf_defaultValues;
	Object.defineProperty(exports, "__esModule", { value: true });
	var util_1 = require("util");
	var fs$6 = require("fs");
	var path$31 = require("path");
	var crypto = require("crypto");
	var assert$1 = require("assert");
	var events_1$2 = require("events");
	var dotProp = require_dot_prop();
	var pkgUp = require_pkg_up();
	var envPaths = require_env_paths();
	var atomically = require_dist$1();
	var ajv_1 = require_ajv();
	var ajv_formats_1 = require_dist();
	var debounceFn = require_debounce_fn();
	var semver = require_semver$2();
	var onetime = require_onetime();
	var encryptionAlgorithm = "aes-256-cbc";
	var createPlainObject = () => {
		return Object.create(null);
	};
	var isExist = (data) => {
		return data !== void 0 && data !== null;
	};
	var parentDir = "";
	try {
		delete require.cache[__filename];
		parentDir = path$31.dirname((_b = (_a = module.parent) === null || _a === void 0 ? void 0 : _a.filename) !== null && _b !== void 0 ? _b : ".");
	} catch (_c) {}
	var checkValueType = (key, value) => {
		const nonJsonTypes = new Set([
			"undefined",
			"symbol",
			"function"
		]);
		const type = typeof value;
		if (nonJsonTypes.has(type)) throw new TypeError(`Setting a value of type \`${type}\` for key \`${key}\` is not allowed as it's not supported by JSON`);
	};
	var INTERNAL_KEY = "__internal__";
	var MIGRATION_KEY = `${INTERNAL_KEY}.migrations.version`;
	var Conf = class {
		constructor(partialOptions = {}) {
			var _a;
			_Conf_validator.set(this, void 0);
			_Conf_encryptionKey.set(this, void 0);
			_Conf_options.set(this, void 0);
			_Conf_defaultValues.set(this, {});
			this._deserialize = (value) => JSON.parse(value);
			this._serialize = (value) => JSON.stringify(value, void 0, "	");
			const options = {
				configName: "config",
				fileExtension: "json",
				projectSuffix: "nodejs",
				clearInvalidConfig: false,
				accessPropertiesByDotNotation: true,
				configFileMode: 438,
				...partialOptions
			};
			const getPackageData = onetime(() => {
				const packagePath = pkgUp.sync({ cwd: parentDir });
				const packageData = packagePath && JSON.parse(fs$6.readFileSync(packagePath, "utf8"));
				return packageData !== null && packageData !== void 0 ? packageData : {};
			});
			if (!options.cwd) {
				if (!options.projectName) options.projectName = getPackageData().name;
				if (!options.projectName) throw new Error("Project name could not be inferred. Please specify the `projectName` option.");
				options.cwd = envPaths(options.projectName, { suffix: options.projectSuffix }).config;
			}
			__classPrivateFieldSet(this, _Conf_options, options, "f");
			if (options.schema) {
				if (typeof options.schema !== "object") throw new TypeError("The `schema` option must be an object.");
				const ajv = new ajv_1.default({
					allErrors: true,
					useDefaults: true
				});
				(0, ajv_formats_1.default)(ajv);
				const schema = {
					type: "object",
					properties: options.schema
				};
				__classPrivateFieldSet(this, _Conf_validator, ajv.compile(schema), "f");
				for (const [key, value] of Object.entries(options.schema)) if (value === null || value === void 0 ? void 0 : value.default) __classPrivateFieldGet(this, _Conf_defaultValues, "f")[key] = value.default;
			}
			if (options.defaults) __classPrivateFieldSet(this, _Conf_defaultValues, {
				...__classPrivateFieldGet(this, _Conf_defaultValues, "f"),
				...options.defaults
			}, "f");
			if (options.serialize) this._serialize = options.serialize;
			if (options.deserialize) this._deserialize = options.deserialize;
			this.events = new events_1$2.EventEmitter();
			__classPrivateFieldSet(this, _Conf_encryptionKey, options.encryptionKey, "f");
			const fileExtension = options.fileExtension ? `.${options.fileExtension}` : "";
			this.path = path$31.resolve(options.cwd, `${(_a = options.configName) !== null && _a !== void 0 ? _a : "config"}${fileExtension}`);
			const fileStore = this.store;
			const store = Object.assign(createPlainObject(), options.defaults, fileStore);
			this._validate(store);
			try {
				assert$1.deepEqual(fileStore, store);
			} catch (_b) {
				this.store = store;
			}
			if (options.watch) this._watch();
			if (options.migrations) {
				if (!options.projectVersion) options.projectVersion = getPackageData().version;
				if (!options.projectVersion) throw new Error("Project version could not be inferred. Please specify the `projectVersion` option.");
				this._migrate(options.migrations, options.projectVersion, options.beforeEachMigration);
			}
		}
		get(key, defaultValue) {
			if (__classPrivateFieldGet(this, _Conf_options, "f").accessPropertiesByDotNotation) return this._get(key, defaultValue);
			const { store } = this;
			return key in store ? store[key] : defaultValue;
		}
		set(key, value) {
			if (typeof key !== "string" && typeof key !== "object") throw new TypeError(`Expected \`key\` to be of type \`string\` or \`object\`, got ${typeof key}`);
			if (typeof key !== "object" && value === void 0) throw new TypeError("Use `delete()` to clear values");
			if (this._containsReservedKey(key)) throw new TypeError(`Please don't use the ${INTERNAL_KEY} key, as it's used to manage this module internal operations.`);
			const { store } = this;
			const set = (key, value) => {
				checkValueType(key, value);
				if (__classPrivateFieldGet(this, _Conf_options, "f").accessPropertiesByDotNotation) dotProp.set(store, key, value);
				else store[key] = value;
			};
			if (typeof key === "object") {
				const object = key;
				for (const [key, value] of Object.entries(object)) set(key, value);
			} else set(key, value);
			this.store = store;
		}
		/**
		Check if an item exists.
		
		@param key - The key of the item to check.
		*/
		has(key) {
			if (__classPrivateFieldGet(this, _Conf_options, "f").accessPropertiesByDotNotation) return dotProp.has(this.store, key);
			return key in this.store;
		}
		/**
		Reset items to their default values, as defined by the `defaults` or `schema` option.
		
		@see `clear()` to reset all items.
		
		@param keys - The keys of the items to reset.
		*/
		reset(...keys) {
			for (const key of keys) if (isExist(__classPrivateFieldGet(this, _Conf_defaultValues, "f")[key])) this.set(key, __classPrivateFieldGet(this, _Conf_defaultValues, "f")[key]);
		}
		/**
		Delete an item.
		
		@param key - The key of the item to delete.
		*/
		delete(key) {
			const { store } = this;
			if (__classPrivateFieldGet(this, _Conf_options, "f").accessPropertiesByDotNotation) dotProp.delete(store, key);
			else delete store[key];
			this.store = store;
		}
		/**
		Delete all items.
		
		This resets known items to their default values, if defined by the `defaults` or `schema` option.
		*/
		clear() {
			this.store = createPlainObject();
			for (const key of Object.keys(__classPrivateFieldGet(this, _Conf_defaultValues, "f"))) this.reset(key);
		}
		/**
		Watches the given `key`, calling `callback` on any changes.
		
		@param key - The key wo watch.
		@param callback - A callback function that is called on any changes. When a `key` is first set `oldValue` will be `undefined`, and when a key is deleted `newValue` will be `undefined`.
		@returns A function, that when called, will unsubscribe.
		*/
		onDidChange(key, callback) {
			if (typeof key !== "string") throw new TypeError(`Expected \`key\` to be of type \`string\`, got ${typeof key}`);
			if (typeof callback !== "function") throw new TypeError(`Expected \`callback\` to be of type \`function\`, got ${typeof callback}`);
			return this._handleChange(() => this.get(key), callback);
		}
		/**
		Watches the whole config object, calling `callback` on any changes.
		
		@param callback - A callback function that is called on any changes. When a `key` is first set `oldValue` will be `undefined`, and when a key is deleted `newValue` will be `undefined`.
		@returns A function, that when called, will unsubscribe.
		*/
		onDidAnyChange(callback) {
			if (typeof callback !== "function") throw new TypeError(`Expected \`callback\` to be of type \`function\`, got ${typeof callback}`);
			return this._handleChange(() => this.store, callback);
		}
		get size() {
			return Object.keys(this.store).length;
		}
		get store() {
			try {
				const data = fs$6.readFileSync(this.path, __classPrivateFieldGet(this, _Conf_encryptionKey, "f") ? null : "utf8");
				const dataString = this._encryptData(data);
				const deserializedData = this._deserialize(dataString);
				this._validate(deserializedData);
				return Object.assign(createPlainObject(), deserializedData);
			} catch (error) {
				if ((error === null || error === void 0 ? void 0 : error.code) === "ENOENT") {
					this._ensureDirectory();
					return createPlainObject();
				}
				if (__classPrivateFieldGet(this, _Conf_options, "f").clearInvalidConfig && error.name === "SyntaxError") return createPlainObject();
				throw error;
			}
		}
		set store(value) {
			this._ensureDirectory();
			this._validate(value);
			this._write(value);
			this.events.emit("change");
		}
		*[(_Conf_validator = /* @__PURE__ */ new WeakMap(), _Conf_encryptionKey = /* @__PURE__ */ new WeakMap(), _Conf_options = /* @__PURE__ */ new WeakMap(), _Conf_defaultValues = /* @__PURE__ */ new WeakMap(), Symbol.iterator)]() {
			for (const [key, value] of Object.entries(this.store)) yield [key, value];
		}
		_encryptData(data) {
			if (!__classPrivateFieldGet(this, _Conf_encryptionKey, "f")) return data.toString();
			try {
				if (__classPrivateFieldGet(this, _Conf_encryptionKey, "f")) try {
					if (data.slice(16, 17).toString() === ":") {
						const initializationVector = data.slice(0, 16);
						const password = crypto.pbkdf2Sync(__classPrivateFieldGet(this, _Conf_encryptionKey, "f"), initializationVector.toString(), 1e4, 32, "sha512");
						const decipher = crypto.createDecipheriv(encryptionAlgorithm, password, initializationVector);
						data = Buffer.concat([decipher.update(Buffer.from(data.slice(17))), decipher.final()]).toString("utf8");
					} else {
						const decipher = crypto.createDecipher(encryptionAlgorithm, __classPrivateFieldGet(this, _Conf_encryptionKey, "f"));
						data = Buffer.concat([decipher.update(Buffer.from(data)), decipher.final()]).toString("utf8");
					}
				} catch (_a) {}
			} catch (_b) {}
			return data.toString();
		}
		_handleChange(getter, callback) {
			let currentValue = getter();
			const onChange = () => {
				const oldValue = currentValue;
				const newValue = getter();
				if ((0, util_1.isDeepStrictEqual)(newValue, oldValue)) return;
				currentValue = newValue;
				callback.call(this, newValue, oldValue);
			};
			this.events.on("change", onChange);
			return () => this.events.removeListener("change", onChange);
		}
		_validate(data) {
			if (!__classPrivateFieldGet(this, _Conf_validator, "f")) return;
			if (__classPrivateFieldGet(this, _Conf_validator, "f").call(this, data) || !__classPrivateFieldGet(this, _Conf_validator, "f").errors) return;
			const errors = __classPrivateFieldGet(this, _Conf_validator, "f").errors.map(({ instancePath, message = "" }) => `\`${instancePath.slice(1)}\` ${message}`);
			throw new Error("Config schema violation: " + errors.join("; "));
		}
		_ensureDirectory() {
			fs$6.mkdirSync(path$31.dirname(this.path), { recursive: true });
		}
		_write(value) {
			let data = this._serialize(value);
			if (__classPrivateFieldGet(this, _Conf_encryptionKey, "f")) {
				const initializationVector = crypto.randomBytes(16);
				const password = crypto.pbkdf2Sync(__classPrivateFieldGet(this, _Conf_encryptionKey, "f"), initializationVector.toString(), 1e4, 32, "sha512");
				const cipher = crypto.createCipheriv(encryptionAlgorithm, password, initializationVector);
				data = Buffer.concat([
					initializationVector,
					Buffer.from(":"),
					cipher.update(Buffer.from(data)),
					cipher.final()
				]);
			}
			if (process.env.SNAP) fs$6.writeFileSync(this.path, data, { mode: __classPrivateFieldGet(this, _Conf_options, "f").configFileMode });
			else try {
				atomically.writeFileSync(this.path, data, { mode: __classPrivateFieldGet(this, _Conf_options, "f").configFileMode });
			} catch (error) {
				if ((error === null || error === void 0 ? void 0 : error.code) === "EXDEV") {
					fs$6.writeFileSync(this.path, data, { mode: __classPrivateFieldGet(this, _Conf_options, "f").configFileMode });
					return;
				}
				throw error;
			}
		}
		_watch() {
			this._ensureDirectory();
			if (!fs$6.existsSync(this.path)) this._write(createPlainObject());
			if (process.platform === "win32") fs$6.watch(this.path, { persistent: false }, debounceFn(() => {
				this.events.emit("change");
			}, { wait: 100 }));
			else fs$6.watchFile(this.path, { persistent: false }, debounceFn(() => {
				this.events.emit("change");
			}, { wait: 5e3 }));
		}
		_migrate(migrations, versionToMigrate, beforeEachMigration) {
			let previousMigratedVersion = this._get(MIGRATION_KEY, "0.0.0");
			const newerVersions = Object.keys(migrations).filter((candidateVersion) => this._shouldPerformMigration(candidateVersion, previousMigratedVersion, versionToMigrate));
			let storeBackup = { ...this.store };
			for (const version of newerVersions) try {
				if (beforeEachMigration) beforeEachMigration(this, {
					fromVersion: previousMigratedVersion,
					toVersion: version,
					finalVersion: versionToMigrate,
					versions: newerVersions
				});
				const migration = migrations[version];
				migration(this);
				this._set(MIGRATION_KEY, version);
				previousMigratedVersion = version;
				storeBackup = { ...this.store };
			} catch (error) {
				this.store = storeBackup;
				throw new Error(`Something went wrong during the migration! Changes applied to the store until this failed migration will be restored. ${error}`);
			}
			if (this._isVersionInRangeFormat(previousMigratedVersion) || !semver.eq(previousMigratedVersion, versionToMigrate)) this._set(MIGRATION_KEY, versionToMigrate);
		}
		_containsReservedKey(key) {
			if (typeof key === "object") {
				if (Object.keys(key)[0] === INTERNAL_KEY) return true;
			}
			if (typeof key !== "string") return false;
			if (__classPrivateFieldGet(this, _Conf_options, "f").accessPropertiesByDotNotation) {
				if (key.startsWith(`${INTERNAL_KEY}.`)) return true;
				return false;
			}
			return false;
		}
		_isVersionInRangeFormat(version) {
			return semver.clean(version) === null;
		}
		_shouldPerformMigration(candidateVersion, previousMigratedVersion, versionToMigrate) {
			if (this._isVersionInRangeFormat(candidateVersion)) {
				if (previousMigratedVersion !== "0.0.0" && semver.satisfies(previousMigratedVersion, candidateVersion)) return false;
				return semver.satisfies(versionToMigrate, candidateVersion);
			}
			if (semver.lte(candidateVersion, previousMigratedVersion)) return false;
			if (semver.gt(candidateVersion, versionToMigrate)) return false;
			return true;
		}
		_get(key, defaultValue) {
			return dotProp.get(this.store, key, defaultValue);
		}
		_set(key, value) {
			const { store } = this;
			dotProp.set(store, key, value);
			this.store = store;
		}
	};
	exports.default = Conf;
	module.exports = Conf;
	module.exports.default = Conf;
}));
//#endregion
//#region ../../node_modules/electron-store/index.js
var require_electron_store = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var path$30 = require("path");
	var { app: app$3, ipcMain: ipcMain$2, ipcRenderer, shell: shell$2 } = require("electron");
	var Conf = require_source();
	var isInitialized = false;
	var initDataListener = () => {
		if (!ipcMain$2 || !app$3) throw new Error("Electron Store: You need to call `.initRenderer()` from the main process.");
		const appData = {
			defaultCwd: app$3.getPath("userData"),
			appVersion: app$3.getVersion()
		};
		if (isInitialized) return appData;
		ipcMain$2.on("electron-store-get-data", (event) => {
			event.returnValue = appData;
		});
		isInitialized = true;
		return appData;
	};
	var ElectronStore = class extends Conf {
		constructor(options) {
			let defaultCwd;
			let appVersion;
			if (ipcRenderer) {
				const appData = ipcRenderer.sendSync("electron-store-get-data");
				if (!appData) throw new Error("Electron Store: You need to call `.initRenderer()` from the main process.");
				({defaultCwd, appVersion} = appData);
			} else if (ipcMain$2 && app$3) ({defaultCwd, appVersion} = initDataListener());
			options = {
				name: "config",
				...options
			};
			if (!options.projectVersion) options.projectVersion = appVersion;
			if (options.cwd) options.cwd = path$30.isAbsolute(options.cwd) ? options.cwd : path$30.join(defaultCwd, options.cwd);
			else options.cwd = defaultCwd;
			options.configName = options.name;
			delete options.name;
			super(options);
		}
		static initRenderer() {
			initDataListener();
		}
		async openInEditor() {
			const error = await shell$2.openPath(this.path);
			if (error) throw new Error(error);
		}
	};
	module.exports = ElectronStore;
}));
//#endregion
//#region ../../node_modules/electron-log/src/renderer/electron-log-preload.js
var require_electron_log_preload = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var electron = {};
	try {
		electron = require("electron");
	} catch (e) {}
	if (electron.ipcRenderer) initialize(electron);
	if (typeof module === "object") module.exports = initialize;
	/**
	* @param {Electron.ContextBridge} contextBridge
	* @param {Electron.IpcRenderer} ipcRenderer
	*/
	function initialize({ contextBridge, ipcRenderer }) {
		if (!ipcRenderer) return;
		ipcRenderer.on("__ELECTRON_LOG_IPC__", (_, message) => {
			window.postMessage({
				cmd: "message",
				...message
			});
		});
		ipcRenderer.invoke("__ELECTRON_LOG__", { cmd: "getOptions" }).catch((e) => console.error(/* @__PURE__ */ new Error(`electron-log isn't initialized in the main process. Please call log.initialize() before. ${e.message}`)));
		const electronLog = {
			sendToMain(message) {
				try {
					ipcRenderer.send("__ELECTRON_LOG__", message);
				} catch (e) {
					console.error("electronLog.sendToMain ", e, "data:", message);
					ipcRenderer.send("__ELECTRON_LOG__", {
						cmd: "errorHandler",
						error: {
							message: e?.message,
							stack: e?.stack
						},
						errorName: "sendToMain"
					});
				}
			},
			log(...data) {
				electronLog.sendToMain({
					data,
					level: "info"
				});
			}
		};
		for (const level of [
			"error",
			"warn",
			"info",
			"verbose",
			"debug",
			"silly"
		]) electronLog[level] = (...data) => electronLog.sendToMain({
			data,
			level
		});
		if (contextBridge && process.contextIsolated) try {
			contextBridge.exposeInMainWorld("__electronLog", electronLog);
		} catch {}
		if (typeof window === "object") window.__electronLog = electronLog;
		else __electronLog = electronLog;
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/core/scope.js
var require_scope = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = scopeFactory;
	function scopeFactory(logger) {
		return Object.defineProperties(scope, {
			defaultLabel: {
				value: "",
				writable: true
			},
			labelPadding: {
				value: true,
				writable: true
			},
			maxLabelLength: {
				value: 0,
				writable: true
			},
			labelLength: { get() {
				switch (typeof scope.labelPadding) {
					case "boolean": return scope.labelPadding ? scope.maxLabelLength : 0;
					case "number": return scope.labelPadding;
					default: return 0;
				}
			} }
		});
		function scope(label) {
			scope.maxLabelLength = Math.max(scope.maxLabelLength, label.length);
			const newScope = {};
			for (const level of logger.levels) newScope[level] = (...d) => logger.logData(d, {
				level,
				scope: label
			});
			newScope.log = newScope.info;
			return newScope;
		}
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/core/Buffering.js
var require_Buffering = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Buffering = class {
		constructor({ processMessage }) {
			this.processMessage = processMessage;
			this.buffer = [];
			this.enabled = false;
			this.begin = this.begin.bind(this);
			this.commit = this.commit.bind(this);
			this.reject = this.reject.bind(this);
		}
		addMessage(message) {
			this.buffer.push(message);
		}
		begin() {
			this.enabled = [];
		}
		commit() {
			this.enabled = false;
			this.buffer.forEach((item) => this.processMessage(item));
			this.buffer = [];
		}
		reject() {
			this.enabled = false;
			this.buffer = [];
		}
	};
	module.exports = Buffering;
}));
//#endregion
//#region ../../node_modules/electron-log/src/core/Logger.js
var require_Logger = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var scopeFactory = require_scope();
	var Buffering = require_Buffering();
	module.exports = class Logger {
		static instances = {};
		dependencies = {};
		errorHandler = null;
		eventLogger = null;
		functions = {};
		hooks = [];
		isDev = false;
		levels = null;
		logId = null;
		scope = null;
		transports = {};
		variables = {};
		constructor({ allowUnknownLevel = false, dependencies = {}, errorHandler, eventLogger, initializeFn, isDev = false, levels = [
			"error",
			"warn",
			"info",
			"verbose",
			"debug",
			"silly"
		], logId, transportFactories = {}, variables } = {}) {
			this.addLevel = this.addLevel.bind(this);
			this.create = this.create.bind(this);
			this.initialize = this.initialize.bind(this);
			this.logData = this.logData.bind(this);
			this.processMessage = this.processMessage.bind(this);
			this.allowUnknownLevel = allowUnknownLevel;
			this.buffering = new Buffering(this);
			this.dependencies = dependencies;
			this.initializeFn = initializeFn;
			this.isDev = isDev;
			this.levels = levels;
			this.logId = logId;
			this.scope = scopeFactory(this);
			this.transportFactories = transportFactories;
			this.variables = variables || {};
			for (const name of this.levels) this.addLevel(name, false);
			this.log = this.info;
			this.functions.log = this.log;
			this.errorHandler = errorHandler;
			errorHandler?.setOptions({
				...dependencies,
				logFn: this.error
			});
			this.eventLogger = eventLogger;
			eventLogger?.setOptions({
				...dependencies,
				logger: this
			});
			for (const [name, factory] of Object.entries(transportFactories)) this.transports[name] = factory(this, dependencies);
			Logger.instances[logId] = this;
		}
		static getInstance({ logId }) {
			return this.instances[logId] || this.instances.default;
		}
		addLevel(level, index = this.levels.length) {
			if (index !== false) this.levels.splice(index, 0, level);
			this[level] = (...args) => this.logData(args, { level });
			this.functions[level] = this[level];
		}
		catchErrors(options) {
			this.processMessage({
				data: ["log.catchErrors is deprecated. Use log.errorHandler instead"],
				level: "warn"
			}, { transports: ["console"] });
			return this.errorHandler.startCatching(options);
		}
		create(options) {
			if (typeof options === "string") options = { logId: options };
			return new Logger({
				dependencies: this.dependencies,
				errorHandler: this.errorHandler,
				initializeFn: this.initializeFn,
				isDev: this.isDev,
				transportFactories: this.transportFactories,
				variables: { ...this.variables },
				...options
			});
		}
		compareLevels(passLevel, checkLevel, levels = this.levels) {
			const pass = levels.indexOf(passLevel);
			const check = levels.indexOf(checkLevel);
			if (check === -1 || pass === -1) return true;
			return check <= pass;
		}
		initialize(options = {}) {
			this.initializeFn({
				logger: this,
				...this.dependencies,
				...options
			});
		}
		logData(data, options = {}) {
			if (this.buffering.enabled) this.buffering.addMessage({
				data,
				date: /* @__PURE__ */ new Date(),
				...options
			});
			else this.processMessage({
				data,
				...options
			});
		}
		processMessage(message, { transports = this.transports } = {}) {
			if (message.cmd === "errorHandler") {
				this.errorHandler.handle(message.error, {
					errorName: message.errorName,
					processType: "renderer",
					showDialog: Boolean(message.showDialog)
				});
				return;
			}
			let level = message.level;
			if (!this.allowUnknownLevel) level = this.levels.includes(message.level) ? message.level : "info";
			const normalizedMessage = {
				date: /* @__PURE__ */ new Date(),
				logId: this.logId,
				...message,
				level,
				variables: {
					...this.variables,
					...message.variables
				}
			};
			for (const [transName, transFn] of this.transportEntries(transports)) {
				if (typeof transFn !== "function" || transFn.level === false) continue;
				if (!this.compareLevels(transFn.level, message.level)) continue;
				try {
					const transformedMsg = this.hooks.reduce((msg, hook) => {
						return msg ? hook(msg, transFn, transName) : msg;
					}, normalizedMessage);
					if (transformedMsg) transFn({
						...transformedMsg,
						data: [...transformedMsg.data]
					});
				} catch (e) {
					this.processInternalErrorFn(e);
				}
			}
		}
		processInternalErrorFn(_e) {}
		transportEntries(transports = this.transports) {
			return (Array.isArray(transports) ? transports : Object.entries(transports)).map((item) => {
				switch (typeof item) {
					case "string": return this.transports[item] ? [item, this.transports[item]] : null;
					case "function": return [item.name, item];
					default: return Array.isArray(item) ? item : null;
				}
			}).filter(Boolean);
		}
	};
}));
//#endregion
//#region ../../node_modules/electron-log/src/renderer/lib/RendererErrorHandler.js
var require_RendererErrorHandler = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var consoleError = console.error;
	var RendererErrorHandler = class {
		logFn = null;
		onError = null;
		showDialog = false;
		preventDefault = true;
		constructor({ logFn = null } = {}) {
			this.handleError = this.handleError.bind(this);
			this.handleRejection = this.handleRejection.bind(this);
			this.startCatching = this.startCatching.bind(this);
			this.logFn = logFn;
		}
		handle(error, { logFn = this.logFn, errorName = "", onError = this.onError, showDialog = this.showDialog } = {}) {
			try {
				if (onError?.({
					error,
					errorName,
					processType: "renderer"
				}) !== false) logFn({
					error,
					errorName,
					showDialog
				});
			} catch {
				consoleError(error);
			}
		}
		setOptions({ logFn, onError, preventDefault, showDialog }) {
			if (typeof logFn === "function") this.logFn = logFn;
			if (typeof onError === "function") this.onError = onError;
			if (typeof preventDefault === "boolean") this.preventDefault = preventDefault;
			if (typeof showDialog === "boolean") this.showDialog = showDialog;
		}
		startCatching({ onError, showDialog } = {}) {
			if (this.isActive) return;
			this.isActive = true;
			this.setOptions({
				onError,
				showDialog
			});
			window.addEventListener("error", (event) => {
				this.preventDefault && event.preventDefault?.();
				this.handleError(event.error || event);
			});
			window.addEventListener("unhandledrejection", (event) => {
				this.preventDefault && event.preventDefault?.();
				this.handleRejection(event.reason || event);
			});
		}
		handleError(error) {
			this.handle(error, { errorName: "Unhandled" });
		}
		handleRejection(reason) {
			const error = reason instanceof Error ? reason : new Error(JSON.stringify(reason));
			this.handle(error, { errorName: "Unhandled rejection" });
		}
	};
	module.exports = RendererErrorHandler;
}));
//#endregion
//#region ../../node_modules/electron-log/src/core/transforms/transform.js
var require_transform = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = { transform };
	function transform({ logger, message, transport, initialData = message?.data || [], transforms = transport?.transforms }) {
		return transforms.reduce((data, trans) => {
			if (typeof trans === "function") return trans({
				data,
				logger,
				message,
				transport
			});
			return data;
		}, initialData);
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/renderer/lib/transports/console.js
var require_console$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { transform } = require_transform();
	module.exports = consoleTransportRendererFactory;
	var consoleMethods = {
		error: console.error,
		warn: console.warn,
		info: console.info,
		verbose: console.info,
		debug: console.debug,
		silly: console.debug,
		log: console.log
	};
	function consoleTransportRendererFactory(logger) {
		return Object.assign(transport, {
			format: "{h}:{i}:{s}.{ms}{scope} › {text}",
			transforms: [formatDataFn],
			writeFn({ message: { level, data } }) {
				const consoleLogFn = consoleMethods[level] || consoleMethods.info;
				setTimeout(() => consoleLogFn(...data));
			}
		});
		function transport(message) {
			transport.writeFn({ message: {
				...message,
				data: transform({
					logger,
					message,
					transport
				})
			} });
		}
	}
	function formatDataFn({ data = [], logger = {}, message = {}, transport = {} }) {
		if (typeof transport.format === "function") return transport.format({
			data,
			level: message?.level || "info",
			logger,
			message,
			transport
		});
		if (typeof transport.format !== "string") return data;
		data.unshift(transport.format);
		if (typeof data[1] === "string" && data[1].match(/%[1cdfiOos]/)) data = [`${data[0]}${data[1]}`, ...data.slice(2)];
		const date = message.date || /* @__PURE__ */ new Date();
		data[0] = data[0].replace(/\{(\w+)}/g, (substring, name) => {
			switch (name) {
				case "level": return message.level;
				case "logId": return message.logId;
				case "scope": {
					const scope = message.scope || logger.scope?.defaultLabel;
					return scope ? ` (${scope})` : "";
				}
				case "text": return "";
				case "y": return date.getFullYear().toString(10);
				case "m": return (date.getMonth() + 1).toString(10).padStart(2, "0");
				case "d": return date.getDate().toString(10).padStart(2, "0");
				case "h": return date.getHours().toString(10).padStart(2, "0");
				case "i": return date.getMinutes().toString(10).padStart(2, "0");
				case "s": return date.getSeconds().toString(10).padStart(2, "0");
				case "ms": return date.getMilliseconds().toString(10).padStart(3, "0");
				case "iso": return date.toISOString();
				default: return message.variables?.[name] || substring;
			}
		}).trim();
		return data;
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/renderer/lib/transports/ipc.js
var require_ipc$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { transform } = require_transform();
	module.exports = ipcTransportRendererFactory;
	var RESTRICTED_TYPES = new Set([
		Promise,
		WeakMap,
		WeakSet
	]);
	function ipcTransportRendererFactory(logger) {
		return Object.assign(transport, {
			depth: 5,
			transforms: [serializeFn]
		});
		function transport(message) {
			if (!window.__electronLog) {
				logger.processMessage({
					data: ["electron-log: logger isn't initialized in the main process"],
					level: "error"
				}, { transports: ["console"] });
				return;
			}
			try {
				const serialized = transform({
					initialData: message,
					logger,
					message,
					transport
				});
				__electronLog.sendToMain(serialized);
			} catch (e) {
				logger.transports.console({
					data: [
						"electronLog.transports.ipc",
						e,
						"data:",
						message.data
					],
					level: "error"
				});
			}
		}
	}
	/**
	* Is type primitive, including null and undefined
	* @param {any} value
	* @returns {boolean}
	*/
	function isPrimitive(value) {
		return Object(value) !== value;
	}
	function serializeFn({ data, depth, seen = /* @__PURE__ */ new WeakSet(), transport = {} } = {}) {
		const actualDepth = depth || transport.depth || 5;
		if (seen.has(data)) return "[Circular]";
		if (actualDepth < 1) {
			if (isPrimitive(data)) return data;
			if (Array.isArray(data)) return "[Array]";
			return `[${typeof data}]`;
		}
		if (["function", "symbol"].includes(typeof data)) return data.toString();
		if (isPrimitive(data)) return data;
		if (RESTRICTED_TYPES.has(data.constructor)) return `[${data.constructor.name}]`;
		if (Array.isArray(data)) return data.map((item) => serializeFn({
			data: item,
			depth: actualDepth - 1,
			seen
		}));
		if (data instanceof Date) return data.toISOString();
		if (data instanceof Error) return data.stack;
		if (data instanceof Map) return new Map(Array.from(data).map(([key, value]) => [serializeFn({
			data: key,
			depth: actualDepth - 1,
			seen
		}), serializeFn({
			data: value,
			depth: actualDepth - 1,
			seen
		})]));
		if (data instanceof Set) return new Set(Array.from(data).map((val) => serializeFn({
			data: val,
			depth: actualDepth - 1,
			seen
		})));
		seen.add(data);
		return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, serializeFn({
			data: value,
			depth: actualDepth - 1,
			seen
		})]));
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/renderer/index.js
var require_renderer = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Logger = require_Logger();
	var RendererErrorHandler = require_RendererErrorHandler();
	var transportConsole = require_console$1();
	var transportIpc = require_ipc$1();
	if (typeof process === "object" && process.type === "browser") console.warn("electron-log/renderer is loaded in the main process. It could cause unexpected behaviour.");
	module.exports = createLogger();
	module.exports.Logger = Logger;
	module.exports.default = module.exports;
	function createLogger() {
		const logger = new Logger({
			allowUnknownLevel: true,
			errorHandler: new RendererErrorHandler(),
			initializeFn: () => {},
			logId: "default",
			transportFactories: {
				console: transportConsole,
				ipc: transportIpc
			},
			variables: { processType: "renderer" }
		});
		logger.errorHandler.setOptions({ logFn({ error, errorName, showDialog }) {
			logger.transports.console({
				data: [errorName, error].filter(Boolean),
				level: "error"
			});
			logger.transports.ipc({
				cmd: "errorHandler",
				error: {
					cause: error?.cause,
					code: error?.code,
					name: error?.name,
					message: error?.message,
					stack: error?.stack
				},
				errorName,
				logId: logger.logId,
				showDialog
			});
		} });
		if (typeof window === "object") window.addEventListener("message", (event) => {
			const { cmd, logId, ...message } = event.data || {};
			const instance = Logger.getInstance({ logId });
			if (cmd === "message") instance.processMessage(message, { transports: ["console"] });
		});
		return new Proxy(logger, { get(target, prop) {
			if (typeof target[prop] !== "undefined") return target[prop];
			return (...data) => logger.logData(data, { level: prop });
		} });
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/node/packageJson.js
var require_packageJson = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs$5 = require("fs");
	var path$29 = require("path");
	module.exports = {
		findAndReadPackageJson,
		tryReadJsonAt
	};
	/**
	* @return {{ name?: string, version?: string}}
	*/
	function findAndReadPackageJson() {
		return tryReadJsonAt(getMainModulePath()) || tryReadJsonAt(extractPathFromArgs()) || tryReadJsonAt(process.resourcesPath, "app.asar") || tryReadJsonAt(process.resourcesPath, "app") || tryReadJsonAt(process.cwd()) || {
			name: void 0,
			version: void 0
		};
	}
	/**
	* @param {...string} searchPaths
	* @return {{ name?: string, version?: string } | undefined}
	*/
	function tryReadJsonAt(...searchPaths) {
		if (!searchPaths[0]) return;
		try {
			const fileName = findUp("package.json", path$29.join(...searchPaths));
			if (!fileName) return;
			const json = JSON.parse(fs$5.readFileSync(fileName, "utf8"));
			const name = json?.productName || json?.name;
			if (!name || name.toLowerCase() === "electron") return;
			if (name) return {
				name,
				version: json?.version
			};
			return;
		} catch (e) {
			return;
		}
	}
	/**
	* @param {string} fileName
	* @param {string} [cwd]
	* @return {string | null}
	*/
	function findUp(fileName, cwd) {
		let currentPath = cwd;
		while (true) {
			const parsedPath = path$29.parse(currentPath);
			const root = parsedPath.root;
			const dir = parsedPath.dir;
			if (fs$5.existsSync(path$29.join(currentPath, fileName))) return path$29.resolve(path$29.join(currentPath, fileName));
			if (currentPath === root) return null;
			currentPath = dir;
		}
	}
	/**
	* Get app path from --user-data-dir cmd arg, passed to a renderer process
	* @return {string|null}
	*/
	function extractPathFromArgs() {
		const matchedArgs = process.argv.filter((arg) => {
			return arg.indexOf("--user-data-dir=") === 0;
		});
		if (matchedArgs.length === 0 || typeof matchedArgs[0] !== "string") return null;
		return matchedArgs[0].replace("--user-data-dir=", "");
	}
	function getMainModulePath() {
		try {
			return require.main?.filename;
		} catch {
			return;
		}
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/node/NodeExternalApi.js
var require_NodeExternalApi = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var childProcess = require("child_process");
	var os$5 = require("os");
	var path$28 = require("path");
	var packageJson = require_packageJson();
	var NodeExternalApi = class {
		appName = void 0;
		appPackageJson = void 0;
		platform = process.platform;
		getAppLogPath(appName = this.getAppName()) {
			if (this.platform === "darwin") return path$28.join(this.getSystemPathHome(), "Library/Logs", appName);
			return path$28.join(this.getAppUserDataPath(appName), "logs");
		}
		getAppName() {
			const appName = this.appName || this.getAppPackageJson()?.name;
			if (!appName) throw new Error("electron-log can't determine the app name. It tried these methods:\n1. Use `electron.app.name`\n2. Use productName or name from the nearest package.json`\nYou can also set it through log.transports.file.setAppName()");
			return appName;
		}
		/**
		* @private
		* @returns {undefined}
		*/
		getAppPackageJson() {
			if (typeof this.appPackageJson !== "object") this.appPackageJson = packageJson.findAndReadPackageJson();
			return this.appPackageJson;
		}
		getAppUserDataPath(appName = this.getAppName()) {
			return appName ? path$28.join(this.getSystemPathAppData(), appName) : void 0;
		}
		getAppVersion() {
			return this.getAppPackageJson()?.version;
		}
		getElectronLogPath() {
			return this.getAppLogPath();
		}
		getMacOsVersion() {
			const release = Number(os$5.release().split(".")[0]);
			if (release <= 19) return `10.${release - 4}`;
			return release - 9;
		}
		/**
		* @protected
		* @returns {string}
		*/
		getOsVersion() {
			let osName = os$5.type().replace("_", " ");
			let osVersion = os$5.release();
			if (osName === "Darwin") {
				osName = "macOS";
				osVersion = this.getMacOsVersion();
			}
			return `${osName} ${osVersion}`;
		}
		/**
		* @return {PathVariables}
		*/
		getPathVariables() {
			const appName = this.getAppName();
			const appVersion = this.getAppVersion();
			const self = this;
			return {
				appData: this.getSystemPathAppData(),
				appName,
				appVersion,
				get electronDefaultDir() {
					return self.getElectronLogPath();
				},
				home: this.getSystemPathHome(),
				libraryDefaultDir: this.getAppLogPath(appName),
				libraryTemplate: this.getAppLogPath("{appName}"),
				temp: this.getSystemPathTemp(),
				userData: this.getAppUserDataPath(appName)
			};
		}
		getSystemPathAppData() {
			const home = this.getSystemPathHome();
			switch (this.platform) {
				case "darwin": return path$28.join(home, "Library/Application Support");
				case "win32": return process.env.APPDATA || path$28.join(home, "AppData/Roaming");
				default: return process.env.XDG_CONFIG_HOME || path$28.join(home, ".config");
			}
		}
		getSystemPathHome() {
			return os$5.homedir?.() || process.env.HOME;
		}
		getSystemPathTemp() {
			return os$5.tmpdir();
		}
		getVersions() {
			return {
				app: `${this.getAppName()} ${this.getAppVersion()}`,
				electron: void 0,
				os: this.getOsVersion()
			};
		}
		isDev() {
			return process.env.NODE_ENV === "development" || process.env.ELECTRON_IS_DEV === "1";
		}
		isElectron() {
			return Boolean(process.versions.electron);
		}
		onAppEvent(_eventName, _handler) {}
		onAppReady(handler) {
			handler();
		}
		onEveryWebContentsEvent(eventName, handler) {}
		/**
		* Listen to async messages sent from opposite process
		* @param {string} channel
		* @param {function} listener
		*/
		onIpc(channel, listener) {}
		onIpcInvoke(channel, listener) {}
		/**
		* @param {string} url
		* @param {Function} [logFunction]
		*/
		openUrl(url, logFunction = console.error) {
			const start = {
				darwin: "open",
				win32: "start",
				linux: "xdg-open"
			}[process.platform] || "xdg-open";
			childProcess.exec(`${start} ${url}`, {}, (err) => {
				if (err) logFunction(err);
			});
		}
		setAppName(appName) {
			this.appName = appName;
		}
		setPlatform(platform) {
			this.platform = platform;
		}
		setPreloadFileForSessions({ filePath, includeFutureSession = true, getSessions = () => [] }) {}
		/**
		* Sent a message to opposite process
		* @param {string} channel
		* @param {any} message
		*/
		sendIpc(channel, message) {}
		showErrorBox(title, message) {}
	};
	module.exports = NodeExternalApi;
}));
//#endregion
//#region ../../node_modules/electron-log/src/main/ElectronExternalApi.js
var require_ElectronExternalApi = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var path$27 = require("path");
	var NodeExternalApi = require_NodeExternalApi();
	var ElectronExternalApi = class extends NodeExternalApi {
		/**
		* @type {typeof Electron}
		*/
		electron = void 0;
		/**
		* @param {object} options
		* @param {typeof Electron} [options.electron]
		*/
		constructor({ electron } = {}) {
			super();
			this.electron = electron;
		}
		getAppName() {
			let appName;
			try {
				appName = this.appName || this.electron.app?.name || this.electron.app?.getName();
			} catch {}
			return appName || super.getAppName();
		}
		getAppUserDataPath(appName) {
			return this.getPath("userData") || super.getAppUserDataPath(appName);
		}
		getAppVersion() {
			let appVersion;
			try {
				appVersion = this.electron.app?.getVersion();
			} catch {}
			return appVersion || super.getAppVersion();
		}
		getElectronLogPath() {
			return this.getPath("logs") || super.getElectronLogPath();
		}
		/**
		* @private
		* @param {any} name
		* @returns {string|undefined}
		*/
		getPath(name) {
			try {
				return this.electron.app?.getPath(name);
			} catch {
				return;
			}
		}
		getVersions() {
			return {
				app: `${this.getAppName()} ${this.getAppVersion()}`,
				electron: `Electron ${process.versions.electron}`,
				os: this.getOsVersion()
			};
		}
		getSystemPathAppData() {
			return this.getPath("appData") || super.getSystemPathAppData();
		}
		isDev() {
			if (this.electron.app?.isPackaged !== void 0) return !this.electron.app.isPackaged;
			if (typeof process.execPath === "string") return path$27.basename(process.execPath).toLowerCase().startsWith("electron");
			return super.isDev();
		}
		onAppEvent(eventName, handler) {
			this.electron.app?.on(eventName, handler);
			return () => {
				this.electron.app?.off(eventName, handler);
			};
		}
		onAppReady(handler) {
			if (this.electron.app?.isReady()) handler();
			else if (this.electron.app?.once) this.electron.app?.once("ready", handler);
			else handler();
		}
		onEveryWebContentsEvent(eventName, handler) {
			this.electron.webContents?.getAllWebContents()?.forEach((webContents) => {
				webContents.on(eventName, handler);
			});
			this.electron.app?.on("web-contents-created", onWebContentsCreated);
			return () => {
				this.electron.webContents?.getAllWebContents().forEach((webContents) => {
					webContents.off(eventName, handler);
				});
				this.electron.app?.off("web-contents-created", onWebContentsCreated);
			};
			function onWebContentsCreated(_, webContents) {
				webContents.on(eventName, handler);
			}
		}
		/**
		* Listen to async messages sent from opposite process
		* @param {string} channel
		* @param {function} listener
		*/
		onIpc(channel, listener) {
			this.electron.ipcMain?.on(channel, listener);
		}
		onIpcInvoke(channel, listener) {
			this.electron.ipcMain?.handle?.(channel, listener);
		}
		/**
		* @param {string} url
		* @param {Function} [logFunction]
		*/
		openUrl(url, logFunction = console.error) {
			this.electron.shell?.openExternal(url).catch(logFunction);
		}
		setPreloadFileForSessions({ filePath, includeFutureSession = true, getSessions = () => [this.electron.session?.defaultSession] }) {
			for (const session of getSessions().filter(Boolean)) setPreload(session);
			if (includeFutureSession) this.onAppEvent("session-created", (session) => {
				setPreload(session);
			});
			/**
			* @param {Session} session
			*/
			function setPreload(session) {
				if (typeof session.registerPreloadScript === "function") session.registerPreloadScript({
					filePath,
					id: "electron-log-preload",
					type: "frame"
				});
				else session.setPreloads([...session.getPreloads(), filePath]);
			}
		}
		/**
		* Sent a message to opposite process
		* @param {string} channel
		* @param {any} message
		*/
		sendIpc(channel, message) {
			this.electron.BrowserWindow?.getAllWindows()?.forEach((wnd) => {
				if (wnd.webContents?.isDestroyed() === false && wnd.webContents?.isCrashed() === false) wnd.webContents.send(channel, message);
			});
		}
		showErrorBox(title, message) {
			this.electron.dialog?.showErrorBox(title, message);
		}
	};
	module.exports = ElectronExternalApi;
}));
//#endregion
//#region ../../node_modules/electron-log/src/main/initialize.js
var require_initialize = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs$4 = require("fs");
	var os$4 = require("os");
	var path$26 = require("path");
	var preloadInitializeFn = require_electron_log_preload();
	var preloadInitialized = false;
	var spyConsoleInitialized = false;
	module.exports = { initialize({ externalApi, getSessions, includeFutureSession, logger, preload = true, spyRendererConsole = false }) {
		externalApi.onAppReady(() => {
			try {
				if (preload) initializePreload({
					externalApi,
					getSessions,
					includeFutureSession,
					logger,
					preloadOption: preload
				});
				if (spyRendererConsole) initializeSpyRendererConsole({
					externalApi,
					logger
				});
			} catch (err) {
				logger.warn(err);
			}
		});
	} };
	function initializePreload({ externalApi, getSessions, includeFutureSession, logger, preloadOption }) {
		let preloadPath = typeof preloadOption === "string" ? preloadOption : void 0;
		if (preloadInitialized) {
			logger.warn((/* @__PURE__ */ new Error("log.initialize({ preload }) already called")).stack);
			return;
		}
		preloadInitialized = true;
		try {
			preloadPath = path$26.resolve(__dirname, "../renderer/electron-log-preload.js");
		} catch {}
		if (!preloadPath || !fs$4.existsSync(preloadPath)) {
			preloadPath = path$26.join(externalApi.getAppUserDataPath() || os$4.tmpdir(), "electron-log-preload.js");
			const preloadCode = `
      try {
        (${preloadInitializeFn.toString()})(require('electron'));
      } catch(e) {
        console.error(e);
      }
    `;
			fs$4.writeFileSync(preloadPath, preloadCode, "utf8");
		}
		externalApi.setPreloadFileForSessions({
			filePath: preloadPath,
			includeFutureSession,
			getSessions
		});
	}
	function initializeSpyRendererConsole({ externalApi, logger }) {
		if (spyConsoleInitialized) {
			logger.warn((/* @__PURE__ */ new Error("log.initialize({ spyRendererConsole }) already called")).stack);
			return;
		}
		spyConsoleInitialized = true;
		const levels = [
			"debug",
			"info",
			"warn",
			"error"
		];
		externalApi.onEveryWebContentsEvent("console-message", (event, level, message) => {
			logger.processMessage({
				data: [message],
				level: levels[level],
				variables: { processType: "renderer" }
			});
		});
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/node/ErrorHandler.js
var require_ErrorHandler = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var ErrorHandler = class {
		externalApi = void 0;
		isActive = false;
		logFn = void 0;
		onError = void 0;
		showDialog = true;
		constructor({ externalApi, logFn = void 0, onError = void 0, showDialog = void 0 } = {}) {
			this.createIssue = this.createIssue.bind(this);
			this.handleError = this.handleError.bind(this);
			this.handleRejection = this.handleRejection.bind(this);
			this.setOptions({
				externalApi,
				logFn,
				onError,
				showDialog
			});
			this.startCatching = this.startCatching.bind(this);
			this.stopCatching = this.stopCatching.bind(this);
		}
		handle(error, { logFn = this.logFn, onError = this.onError, processType = "browser", showDialog = this.showDialog, errorName = "" } = {}) {
			error = normalizeError(error);
			try {
				if (typeof onError === "function") {
					const versions = this.externalApi?.getVersions() || {};
					const createIssue = this.createIssue;
					if (onError({
						createIssue,
						error,
						errorName,
						processType,
						versions
					}) === false) return;
				}
				errorName ? logFn(errorName, error) : logFn(error);
				if (showDialog && !errorName.includes("rejection") && this.externalApi) this.externalApi.showErrorBox(`A JavaScript error occurred in the ${processType} process`, error.stack);
			} catch {
				console.error(error);
			}
		}
		setOptions({ externalApi, logFn, onError, showDialog }) {
			if (typeof externalApi === "object") this.externalApi = externalApi;
			if (typeof logFn === "function") this.logFn = logFn;
			if (typeof onError === "function") this.onError = onError;
			if (typeof showDialog === "boolean") this.showDialog = showDialog;
		}
		startCatching({ onError, showDialog } = {}) {
			if (this.isActive) return;
			this.isActive = true;
			this.setOptions({
				onError,
				showDialog
			});
			process.on("uncaughtException", this.handleError);
			process.on("unhandledRejection", this.handleRejection);
		}
		stopCatching() {
			this.isActive = false;
			process.removeListener("uncaughtException", this.handleError);
			process.removeListener("unhandledRejection", this.handleRejection);
		}
		createIssue(pageUrl, queryParams) {
			this.externalApi?.openUrl(`${pageUrl}?${new URLSearchParams(queryParams).toString()}`);
		}
		handleError(error) {
			this.handle(error, { errorName: "Unhandled" });
		}
		handleRejection(reason) {
			const error = reason instanceof Error ? reason : new Error(JSON.stringify(reason));
			this.handle(error, { errorName: "Unhandled rejection" });
		}
	};
	function normalizeError(e) {
		if (e instanceof Error) return e;
		if (e && typeof e === "object") {
			if (e.message) return Object.assign(new Error(e.message), e);
			try {
				return new Error(JSON.stringify(e));
			} catch (serErr) {
				return /* @__PURE__ */ new Error(`Couldn't normalize error ${String(e)}: ${serErr}`);
			}
		}
		return /* @__PURE__ */ new Error(`Can't normalize error ${String(e)}`);
	}
	module.exports = ErrorHandler;
}));
//#endregion
//#region ../../node_modules/electron-log/src/node/EventLogger.js
var require_EventLogger = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var EventLogger = class {
		disposers = [];
		format = "{eventSource}#{eventName}:";
		formatters = {
			app: {
				"certificate-error": ({ args }) => {
					return this.arrayToObject(args.slice(1, 4), [
						"url",
						"error",
						"certificate"
					]);
				},
				"child-process-gone": ({ args }) => {
					return args.length === 1 ? args[0] : args;
				},
				"render-process-gone": ({ args: [webContents, details] }) => {
					return details && typeof details === "object" ? {
						...details,
						...this.getWebContentsDetails(webContents)
					} : [];
				}
			},
			webContents: {
				"console-message": ({ args: [level, message, line, sourceId] }) => {
					if (level < 3) return;
					return {
						message,
						source: `${sourceId}:${line}`
					};
				},
				"did-fail-load": ({ args }) => {
					return this.arrayToObject(args, [
						"errorCode",
						"errorDescription",
						"validatedURL",
						"isMainFrame",
						"frameProcessId",
						"frameRoutingId"
					]);
				},
				"did-fail-provisional-load": ({ args }) => {
					return this.arrayToObject(args, [
						"errorCode",
						"errorDescription",
						"validatedURL",
						"isMainFrame",
						"frameProcessId",
						"frameRoutingId"
					]);
				},
				"plugin-crashed": ({ args }) => {
					return this.arrayToObject(args, ["name", "version"]);
				},
				"preload-error": ({ args }) => {
					return this.arrayToObject(args, ["preloadPath", "error"]);
				}
			}
		};
		events = {
			app: {
				"certificate-error": true,
				"child-process-gone": true,
				"render-process-gone": true
			},
			webContents: {
				"did-fail-load": true,
				"did-fail-provisional-load": true,
				"plugin-crashed": true,
				"preload-error": true,
				"unresponsive": true
			}
		};
		externalApi = void 0;
		level = "error";
		scope = "";
		constructor(options = {}) {
			this.setOptions(options);
		}
		setOptions({ events, externalApi, level, logger, format, formatters, scope }) {
			if (typeof events === "object") this.events = events;
			if (typeof externalApi === "object") this.externalApi = externalApi;
			if (typeof level === "string") this.level = level;
			if (typeof logger === "object") this.logger = logger;
			if (typeof format === "string" || typeof format === "function") this.format = format;
			if (typeof formatters === "object") this.formatters = formatters;
			if (typeof scope === "string") this.scope = scope;
		}
		startLogging(options = {}) {
			this.setOptions(options);
			this.disposeListeners();
			for (const eventName of this.getEventNames(this.events.app)) this.disposers.push(this.externalApi.onAppEvent(eventName, (...handlerArgs) => {
				this.handleEvent({
					eventSource: "app",
					eventName,
					handlerArgs
				});
			}));
			for (const eventName of this.getEventNames(this.events.webContents)) this.disposers.push(this.externalApi.onEveryWebContentsEvent(eventName, (...handlerArgs) => {
				this.handleEvent({
					eventSource: "webContents",
					eventName,
					handlerArgs
				});
			}));
		}
		stopLogging() {
			this.disposeListeners();
		}
		arrayToObject(array, fieldNames) {
			const obj = {};
			fieldNames.forEach((fieldName, index) => {
				obj[fieldName] = array[index];
			});
			if (array.length > fieldNames.length) obj.unknownArgs = array.slice(fieldNames.length);
			return obj;
		}
		disposeListeners() {
			this.disposers.forEach((disposer) => disposer());
			this.disposers = [];
		}
		formatEventLog({ eventName, eventSource, handlerArgs }) {
			const [event, ...args] = handlerArgs;
			if (typeof this.format === "function") return this.format({
				args,
				event,
				eventName,
				eventSource
			});
			const formatter = this.formatters[eventSource]?.[eventName];
			let formattedArgs = args;
			if (typeof formatter === "function") formattedArgs = formatter({
				args,
				event,
				eventName,
				eventSource
			});
			if (!formattedArgs) return;
			const eventData = {};
			if (Array.isArray(formattedArgs)) eventData.args = formattedArgs;
			else if (typeof formattedArgs === "object") Object.assign(eventData, formattedArgs);
			if (eventSource === "webContents") Object.assign(eventData, this.getWebContentsDetails(event?.sender));
			return [this.format.replace("{eventSource}", eventSource === "app" ? "App" : "WebContents").replace("{eventName}", eventName), eventData];
		}
		getEventNames(eventMap) {
			if (!eventMap || typeof eventMap !== "object") return [];
			return Object.entries(eventMap).filter(([_, listen]) => listen).map(([eventName]) => eventName);
		}
		getWebContentsDetails(webContents) {
			if (!webContents?.loadURL) return {};
			try {
				return { webContents: {
					id: webContents.id,
					url: webContents.getURL()
				} };
			} catch {
				return {};
			}
		}
		handleEvent({ eventName, eventSource, handlerArgs }) {
			const log = this.formatEventLog({
				eventName,
				eventSource,
				handlerArgs
			});
			if (log) (this.scope ? this.logger.scope(this.scope) : this.logger)?.[this.level]?.(...log);
		}
	};
	module.exports = EventLogger;
}));
//#endregion
//#region ../../node_modules/electron-log/src/core/transforms/format.js
var require_format = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { transform } = require_transform();
	module.exports = {
		concatFirstStringElements,
		formatScope,
		formatText,
		formatVariables,
		timeZoneFromOffset,
		format({ message, logger, transport, data = message?.data }) {
			switch (typeof transport.format) {
				case "string": return transform({
					message,
					logger,
					transforms: [
						formatVariables,
						formatScope,
						formatText
					],
					transport,
					initialData: [transport.format, ...data]
				});
				case "function": return transport.format({
					data,
					level: message?.level || "info",
					logger,
					message,
					transport
				});
				default: return data;
			}
		}
	};
	/**
	* The first argument of console.log may contain a template. In the library
	* the first element is a string related to transports.console.format. So
	* this function concatenates first two elements to make templates like %d
	* work
	* @param {*[]} data
	* @return {*[]}
	*/
	function concatFirstStringElements({ data }) {
		if (typeof data[0] !== "string" || typeof data[1] !== "string") return data;
		if (data[0].match(/%[1cdfiOos]/)) return data;
		return [`${data[0]} ${data[1]}`, ...data.slice(2)];
	}
	function timeZoneFromOffset(minutesOffset) {
		const minutesPositive = Math.abs(minutesOffset);
		return `${minutesOffset > 0 ? "-" : "+"}${Math.floor(minutesPositive / 60).toString().padStart(2, "0")}:${(minutesPositive % 60).toString().padStart(2, "0")}`;
	}
	function formatScope({ data, logger, message }) {
		const { defaultLabel, labelLength } = logger?.scope || {};
		const template = data[0];
		let label = message.scope;
		if (!label) label = defaultLabel;
		let scopeText;
		if (label === "") scopeText = labelLength > 0 ? "".padEnd(labelLength + 3) : "";
		else if (typeof label === "string") scopeText = ` (${label})`.padEnd(labelLength + 3);
		else scopeText = "";
		data[0] = template.replace("{scope}", scopeText);
		return data;
	}
	function formatVariables({ data, message }) {
		let template = data[0];
		if (typeof template !== "string") return data;
		template = template.replace("{level}]", `${message.level}]`.padEnd(6, " "));
		const date = message.date || /* @__PURE__ */ new Date();
		data[0] = template.replace(/\{(\w+)}/g, (substring, name) => {
			switch (name) {
				case "level": return message.level || "info";
				case "logId": return message.logId;
				case "y": return date.getFullYear().toString(10);
				case "m": return (date.getMonth() + 1).toString(10).padStart(2, "0");
				case "d": return date.getDate().toString(10).padStart(2, "0");
				case "h": return date.getHours().toString(10).padStart(2, "0");
				case "i": return date.getMinutes().toString(10).padStart(2, "0");
				case "s": return date.getSeconds().toString(10).padStart(2, "0");
				case "ms": return date.getMilliseconds().toString(10).padStart(3, "0");
				case "z": return timeZoneFromOffset(date.getTimezoneOffset());
				case "iso": return date.toISOString();
				default: return message.variables?.[name] || substring;
			}
		}).trim();
		return data;
	}
	function formatText({ data }) {
		const template = data[0];
		if (typeof template !== "string") return data;
		if (template.lastIndexOf("{text}") === template.length - 6) {
			data[0] = template.replace(/\s?{text}/, "");
			if (data[0] === "") data.shift();
			return data;
		}
		const templatePieces = template.split("{text}");
		let result = [];
		if (templatePieces[0] !== "") result.push(templatePieces[0]);
		result = result.concat(data.slice(1));
		if (templatePieces[1] !== "") result.push(templatePieces[1]);
		return result;
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/node/transforms/object.js
var require_object = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var util$3 = require("util");
	module.exports = {
		serialize,
		maxDepth({ data, transport, depth = transport?.depth ?? 6 }) {
			if (!data) return data;
			if (depth < 1) {
				if (Array.isArray(data)) return "[array]";
				if (typeof data === "object" && data) return "[object]";
				return data;
			}
			if (Array.isArray(data)) return data.map((child) => module.exports.maxDepth({
				data: child,
				depth: depth - 1
			}));
			if (typeof data !== "object") return data;
			if (data && typeof data.toISOString === "function") return data;
			if (data === null) return null;
			if (data instanceof Error) return data;
			const newJson = {};
			for (const i in data) {
				if (!Object.prototype.hasOwnProperty.call(data, i)) continue;
				newJson[i] = module.exports.maxDepth({
					data: data[i],
					depth: depth - 1
				});
			}
			return newJson;
		},
		toJSON({ data }) {
			return JSON.parse(JSON.stringify(data, createSerializer()));
		},
		toString({ data, transport }) {
			const inspectOptions = transport?.inspectOptions || {};
			const simplifiedData = data.map((item) => {
				if (item === void 0) return;
				try {
					const str = JSON.stringify(item, createSerializer(), "  ");
					return str === void 0 ? void 0 : JSON.parse(str);
				} catch (e) {
					return item;
				}
			});
			return util$3.formatWithOptions(inspectOptions, ...simplifiedData);
		}
	};
	/**
	* @param {object} options?
	* @param {boolean} options.serializeMapAndSet?
	* @return {function}
	*/
	function createSerializer(options = {}) {
		const seen = /* @__PURE__ */ new WeakSet();
		return function(key, value) {
			if (typeof value === "object" && value !== null) {
				if (seen.has(value)) return;
				seen.add(value);
			}
			return serialize(key, value, options);
		};
	}
	/**
	* @param {string} key
	* @param {any} value
	* @param {object} options?
	* @return {any}
	*/
	function serialize(key, value, options = {}) {
		const serializeMapAndSet = options?.serializeMapAndSet !== false;
		if (value instanceof Error) return value.stack;
		if (!value) return value;
		if (typeof value === "function") return `[function] ${value.toString()}`;
		if (value instanceof Date) return value.toISOString();
		if (serializeMapAndSet && value instanceof Map && Object.fromEntries) return Object.fromEntries(value);
		if (serializeMapAndSet && value instanceof Set && Array.from) return Array.from(value);
		return value;
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/core/transforms/style.js
var require_style = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = {
		transformStyles,
		applyAnsiStyles({ data }) {
			return transformStyles(data, styleToAnsi, resetAnsiStyle);
		},
		removeStyles({ data }) {
			return transformStyles(data, () => "");
		}
	};
	var ANSI_COLORS = {
		unset: "\x1B[0m",
		black: "\x1B[30m",
		red: "\x1B[31m",
		green: "\x1B[32m",
		yellow: "\x1B[33m",
		blue: "\x1B[34m",
		magenta: "\x1B[35m",
		cyan: "\x1B[36m",
		white: "\x1B[37m",
		gray: "\x1B[90m"
	};
	function styleToAnsi(style) {
		return ANSI_COLORS[style.replace(/color:\s*(\w+).*/, "$1").toLowerCase()] || "";
	}
	function resetAnsiStyle(string) {
		return string + ANSI_COLORS.unset;
	}
	function transformStyles(data, onStyleFound, onStyleApplied) {
		const foundStyles = {};
		return data.reduce((result, item, index, array) => {
			if (foundStyles[index]) return result;
			if (typeof item === "string") {
				let valueIndex = index;
				let styleApplied = false;
				item = item.replace(/%[1cdfiOos]/g, (match) => {
					valueIndex += 1;
					if (match !== "%c") return match;
					const style = array[valueIndex];
					if (typeof style === "string") {
						foundStyles[valueIndex] = true;
						styleApplied = true;
						return onStyleFound(style, item);
					}
					return match;
				});
				if (styleApplied && onStyleApplied) item = onStyleApplied(item);
			}
			result.push(item);
			return result;
		}, []);
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/node/transports/console.js
var require_console = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { concatFirstStringElements, format } = require_format();
	var { maxDepth, toJSON } = require_object();
	var { applyAnsiStyles, removeStyles } = require_style();
	var { transform } = require_transform();
	var consoleMethods = {
		error: console.error,
		warn: console.warn,
		info: console.info,
		verbose: console.info,
		debug: console.debug,
		silly: console.debug,
		log: console.log
	};
	module.exports = consoleTransportFactory;
	var DEFAULT_FORMAT = `%c{h}:{i}:{s}.{ms}{scope}%c ${process.platform === "win32" ? ">" : "›"} {text}`;
	Object.assign(consoleTransportFactory, { DEFAULT_FORMAT });
	function consoleTransportFactory(logger) {
		return Object.assign(transport, {
			colorMap: {
				error: "red",
				warn: "yellow",
				info: "cyan",
				verbose: "unset",
				debug: "gray",
				silly: "gray",
				default: "unset"
			},
			format: DEFAULT_FORMAT,
			level: "silly",
			transforms: [
				addTemplateColors,
				format,
				formatStyles,
				concatFirstStringElements,
				maxDepth,
				toJSON
			],
			useStyles: process.env.FORCE_STYLES,
			writeFn({ message }) {
				(consoleMethods[message.level] || consoleMethods.info)(...message.data);
			}
		});
		function transport(message) {
			const data = transform({
				logger,
				message,
				transport
			});
			transport.writeFn({ message: {
				...message,
				data
			} });
		}
	}
	function addTemplateColors({ data, message, transport }) {
		if (typeof transport.format !== "string" || !transport.format.includes("%c")) return data;
		return [
			`color:${levelToStyle(message.level, transport)}`,
			"color:unset",
			...data
		];
	}
	function canUseStyles(useStyleValue, level) {
		if (typeof useStyleValue === "boolean") return useStyleValue;
		const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
		return stream && stream.isTTY;
	}
	function formatStyles(args) {
		const { message, transport } = args;
		return (canUseStyles(transport.useStyles, message.level) ? applyAnsiStyles : removeStyles)(args);
	}
	function levelToStyle(level, transport) {
		return transport.colorMap[level] || transport.colorMap.default;
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/node/transports/file/File.js
var require_File = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var EventEmitter$1 = require("events");
	var fs$3 = require("fs");
	var os$3 = require("os");
	var File = class extends EventEmitter$1 {
		asyncWriteQueue = [];
		bytesWritten = 0;
		hasActiveAsyncWriting = false;
		path = null;
		initialSize = void 0;
		writeOptions = null;
		writeAsync = false;
		constructor({ path, writeOptions = {
			encoding: "utf8",
			flag: "a",
			mode: 438
		}, writeAsync = false }) {
			super();
			this.path = path;
			this.writeOptions = writeOptions;
			this.writeAsync = writeAsync;
		}
		get size() {
			return this.getSize();
		}
		clear() {
			try {
				fs$3.writeFileSync(this.path, "", {
					mode: this.writeOptions.mode,
					flag: "w"
				});
				this.reset();
				return true;
			} catch (e) {
				if (e.code === "ENOENT") return true;
				this.emit("error", e, this);
				return false;
			}
		}
		crop(bytesAfter) {
			try {
				const content = readFileSyncFromEnd(this.path, bytesAfter || 4096);
				this.clear();
				this.writeLine(`[log cropped]${os$3.EOL}${content}`);
			} catch (e) {
				this.emit("error", /* @__PURE__ */ new Error(`Couldn't crop file ${this.path}. ${e.message}`), this);
			}
		}
		getSize() {
			if (this.initialSize === void 0) try {
				const stats = fs$3.statSync(this.path);
				this.initialSize = stats.size;
			} catch (e) {
				this.initialSize = 0;
			}
			return this.initialSize + this.bytesWritten;
		}
		increaseBytesWrittenCounter(text) {
			this.bytesWritten += Buffer.byteLength(text, this.writeOptions.encoding);
		}
		isNull() {
			return false;
		}
		nextAsyncWrite() {
			const file = this;
			if (this.hasActiveAsyncWriting || this.asyncWriteQueue.length === 0) return;
			const text = this.asyncWriteQueue.join("");
			this.asyncWriteQueue = [];
			this.hasActiveAsyncWriting = true;
			fs$3.writeFile(this.path, text, this.writeOptions, (e) => {
				file.hasActiveAsyncWriting = false;
				if (e) file.emit("error", /* @__PURE__ */ new Error(`Couldn't write to ${file.path}. ${e.message}`), this);
				else file.increaseBytesWrittenCounter(text);
				file.nextAsyncWrite();
			});
		}
		reset() {
			this.initialSize = void 0;
			this.bytesWritten = 0;
		}
		toString() {
			return this.path;
		}
		writeLine(text) {
			text += os$3.EOL;
			if (this.writeAsync) {
				this.asyncWriteQueue.push(text);
				this.nextAsyncWrite();
				return;
			}
			try {
				fs$3.writeFileSync(this.path, text, this.writeOptions);
				this.increaseBytesWrittenCounter(text);
			} catch (e) {
				this.emit("error", /* @__PURE__ */ new Error(`Couldn't write to ${this.path}. ${e.message}`), this);
			}
		}
	};
	module.exports = File;
	function readFileSyncFromEnd(filePath, bytesCount) {
		const buffer = Buffer.alloc(bytesCount);
		const stats = fs$3.statSync(filePath);
		const readLength = Math.min(stats.size, bytesCount);
		const offset = Math.max(0, stats.size - bytesCount);
		const fd = fs$3.openSync(filePath, "r");
		const totalBytes = fs$3.readSync(fd, buffer, 0, readLength, offset);
		fs$3.closeSync(fd);
		return buffer.toString("utf8", 0, totalBytes);
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/node/transports/file/NullFile.js
var require_NullFile = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var File = require_File();
	var NullFile = class extends File {
		clear() {}
		crop() {}
		getSize() {
			return 0;
		}
		isNull() {
			return true;
		}
		writeLine() {}
	};
	module.exports = NullFile;
}));
//#endregion
//#region ../../node_modules/electron-log/src/node/transports/file/FileRegistry.js
var require_FileRegistry = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var EventEmitter = require("events");
	var fs$2 = require("fs");
	var path$25 = require("path");
	var File = require_File();
	var NullFile = require_NullFile();
	var FileRegistry = class extends EventEmitter {
		store = {};
		constructor() {
			super();
			this.emitError = this.emitError.bind(this);
		}
		/**
		* Provide a File object corresponding to the filePath
		* @param {string} filePath
		* @param {WriteOptions} [writeOptions]
		* @param {boolean} [writeAsync]
		* @return {File}
		*/
		provide({ filePath, writeOptions = {}, writeAsync = false }) {
			let file;
			try {
				filePath = path$25.resolve(filePath);
				if (this.store[filePath]) return this.store[filePath];
				file = this.createFile({
					filePath,
					writeOptions,
					writeAsync
				});
			} catch (e) {
				file = new NullFile({ path: filePath });
				this.emitError(e, file);
			}
			file.on("error", this.emitError);
			this.store[filePath] = file;
			return file;
		}
		/**
		* @param {string} filePath
		* @param {WriteOptions} writeOptions
		* @param {boolean} async
		* @return {File}
		* @private
		*/
		createFile({ filePath, writeOptions, writeAsync }) {
			this.testFileWriting({
				filePath,
				writeOptions
			});
			return new File({
				path: filePath,
				writeOptions,
				writeAsync
			});
		}
		/**
		* @param {Error} error
		* @param {File} file
		* @private
		*/
		emitError(error, file) {
			this.emit("error", error, file);
		}
		/**
		* @param {string} filePath
		* @param {WriteOptions} writeOptions
		* @private
		*/
		testFileWriting({ filePath, writeOptions }) {
			fs$2.mkdirSync(path$25.dirname(filePath), { recursive: true });
			fs$2.writeFileSync(filePath, "", {
				flag: "a",
				mode: writeOptions.mode
			});
		}
	};
	module.exports = FileRegistry;
}));
//#endregion
//#region ../../node_modules/electron-log/src/node/transports/file/index.js
var require_file$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs$1 = require("fs");
	var os$2 = require("os");
	var path$24 = require("path");
	var FileRegistry = require_FileRegistry();
	var { transform } = require_transform();
	var { removeStyles } = require_style();
	var { format, concatFirstStringElements } = require_format();
	var { toString } = require_object();
	module.exports = fileTransportFactory;
	var globalRegistry = new FileRegistry();
	function fileTransportFactory(logger, { registry = globalRegistry, externalApi } = {}) {
		/** @type {PathVariables} */
		let pathVariables;
		if (registry.listenerCount("error") < 1) registry.on("error", (e, file) => {
			logConsole(`Can't write to ${file}`, e);
		});
		return Object.assign(transport, {
			fileName: getDefaultFileName(logger.variables.processType),
			format: "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}",
			getFile,
			inspectOptions: { depth: 5 },
			level: "silly",
			maxSize: 1024 ** 2,
			readAllLogs,
			sync: true,
			transforms: [
				removeStyles,
				format,
				concatFirstStringElements,
				toString
			],
			writeOptions: {
				flag: "a",
				mode: 438,
				encoding: "utf8"
			},
			archiveLogFn(file) {
				const oldPath = file.toString();
				const inf = path$24.parse(oldPath);
				try {
					fs$1.renameSync(oldPath, path$24.join(inf.dir, `${inf.name}.old${inf.ext}`));
				} catch (e) {
					logConsole("Could not rotate log", e);
					const quarterOfMaxSize = Math.round(transport.maxSize / 4);
					file.crop(Math.min(quarterOfMaxSize, 256 * 1024));
				}
			},
			resolvePathFn(vars) {
				return path$24.join(vars.libraryDefaultDir, vars.fileName);
			},
			setAppName(name) {
				logger.dependencies.externalApi.setAppName(name);
			}
		});
		function transport(message) {
			const file = getFile(message);
			if (transport.maxSize > 0 && file.size > transport.maxSize) {
				transport.archiveLogFn(file);
				file.reset();
			}
			const content = transform({
				logger,
				message,
				transport
			});
			file.writeLine(content);
		}
		function initializeOnFirstAccess() {
			if (pathVariables) return;
			pathVariables = Object.create(Object.prototype, {
				...Object.getOwnPropertyDescriptors(externalApi.getPathVariables()),
				fileName: {
					get() {
						return transport.fileName;
					},
					enumerable: true
				}
			});
			if (typeof transport.archiveLog === "function") {
				transport.archiveLogFn = transport.archiveLog;
				logConsole("archiveLog is deprecated. Use archiveLogFn instead");
			}
			if (typeof transport.resolvePath === "function") {
				transport.resolvePathFn = transport.resolvePath;
				logConsole("resolvePath is deprecated. Use resolvePathFn instead");
			}
		}
		function logConsole(message, error = null, level = "error") {
			const data = [`electron-log.transports.file: ${message}`];
			if (error) data.push(error);
			logger.transports.console({
				data,
				date: /* @__PURE__ */ new Date(),
				level
			});
		}
		function getFile(msg) {
			initializeOnFirstAccess();
			const filePath = transport.resolvePathFn(pathVariables, msg);
			return registry.provide({
				filePath,
				writeAsync: !transport.sync,
				writeOptions: transport.writeOptions
			});
		}
		function readAllLogs({ fileFilter = (f) => f.endsWith(".log") } = {}) {
			initializeOnFirstAccess();
			const logsPath = path$24.dirname(transport.resolvePathFn(pathVariables));
			if (!fs$1.existsSync(logsPath)) return [];
			return fs$1.readdirSync(logsPath).map((fileName) => path$24.join(logsPath, fileName)).filter(fileFilter).map((logPath) => {
				try {
					return {
						path: logPath,
						lines: fs$1.readFileSync(logPath, "utf8").split(os$2.EOL)
					};
				} catch {
					return null;
				}
			}).filter(Boolean);
		}
	}
	function getDefaultFileName(processType = process.type) {
		switch (processType) {
			case "renderer": return "renderer.log";
			case "worker": return "worker.log";
			default: return "main.log";
		}
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/node/transports/ipc.js
var require_ipc = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { maxDepth, toJSON } = require_object();
	var { transform } = require_transform();
	module.exports = ipcTransportFactory;
	/**
	* @param logger
	* @param {ElectronExternalApi} externalApi
	* @returns {transport|null}
	*/
	function ipcTransportFactory(logger, { externalApi }) {
		Object.assign(transport, {
			depth: 3,
			eventId: "__ELECTRON_LOG_IPC__",
			level: logger.isDev ? "silly" : false,
			transforms: [toJSON, maxDepth]
		});
		return externalApi?.isElectron() ? transport : void 0;
		function transport(message) {
			if (message?.variables?.processType === "renderer") return;
			externalApi?.sendIpc(transport.eventId, {
				...message,
				data: transform({
					logger,
					message,
					transport
				})
			});
		}
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/node/transports/remote.js
var require_remote = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var http = require("http");
	var https = require("https");
	var { transform } = require_transform();
	var { removeStyles } = require_style();
	var { toJSON, maxDepth } = require_object();
	module.exports = remoteTransportFactory;
	function remoteTransportFactory(logger) {
		return Object.assign(transport, {
			client: { name: "electron-application" },
			depth: 6,
			level: false,
			requestOptions: {},
			transforms: [
				removeStyles,
				toJSON,
				maxDepth
			],
			makeBodyFn({ message }) {
				return JSON.stringify({
					client: transport.client,
					data: message.data,
					date: message.date.getTime(),
					level: message.level,
					scope: message.scope,
					variables: message.variables
				});
			},
			processErrorFn({ error }) {
				logger.processMessage({
					data: [`electron-log: can't POST ${transport.url}`, error],
					level: "warn"
				}, { transports: ["console", "file"] });
			},
			sendRequestFn({ serverUrl, requestOptions, body }) {
				const request = (serverUrl.startsWith("https:") ? https : http).request(serverUrl, {
					method: "POST",
					...requestOptions,
					headers: {
						"Content-Type": "application/json",
						"Content-Length": body.length,
						...requestOptions.headers
					}
				});
				request.write(body);
				request.end();
				return request;
			}
		});
		function transport(message) {
			if (!transport.url) return;
			const body = transport.makeBodyFn({
				logger,
				message: {
					...message,
					data: transform({
						logger,
						message,
						transport
					})
				},
				transport
			});
			const request = transport.sendRequestFn({
				serverUrl: transport.url,
				requestOptions: transport.requestOptions,
				body: Buffer.from(body, "utf8")
			});
			request.on("error", (error) => transport.processErrorFn({
				error,
				logger,
				message,
				request,
				transport
			}));
		}
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/node/createDefaultLogger.js
var require_createDefaultLogger = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Logger = require_Logger();
	var ErrorHandler = require_ErrorHandler();
	var EventLogger = require_EventLogger();
	var transportConsole = require_console();
	var transportFile = require_file$1();
	var transportIpc = require_ipc();
	var transportRemote = require_remote();
	module.exports = createDefaultLogger;
	function createDefaultLogger({ dependencies, initializeFn }) {
		const defaultLogger = new Logger({
			dependencies,
			errorHandler: new ErrorHandler(),
			eventLogger: new EventLogger(),
			initializeFn,
			isDev: dependencies.externalApi?.isDev(),
			logId: "default",
			transportFactories: {
				console: transportConsole,
				file: transportFile,
				ipc: transportIpc,
				remote: transportRemote
			},
			variables: { processType: "main" }
		});
		defaultLogger.default = defaultLogger;
		defaultLogger.Logger = Logger;
		defaultLogger.processInternalErrorFn = (e) => {
			defaultLogger.transports.console.writeFn({ message: {
				data: ["Unhandled electron-log error", e],
				level: "error"
			} });
		};
		return defaultLogger;
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/main/index.js
var require_main$2 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var electron$1 = require("electron");
	var ElectronExternalApi = require_ElectronExternalApi();
	var { initialize } = require_initialize();
	var createDefaultLogger = require_createDefaultLogger();
	var externalApi = new ElectronExternalApi({ electron: electron$1 });
	var defaultLogger = createDefaultLogger({
		dependencies: { externalApi },
		initializeFn: initialize
	});
	module.exports = defaultLogger;
	externalApi.onIpc("__ELECTRON_LOG__", (_, message) => {
		if (message.scope) defaultLogger.Logger.getInstance(message).scope(message.scope);
		const date = new Date(message.date);
		processMessage({
			...message,
			date: date.getTime() ? date : /* @__PURE__ */ new Date()
		});
	});
	externalApi.onIpcInvoke("__ELECTRON_LOG__", (_, { cmd = "", logId }) => {
		switch (cmd) {
			case "getOptions": return {
				levels: defaultLogger.Logger.getInstance({ logId }).levels,
				logId
			};
			default:
				processMessage({
					data: [`Unknown cmd '${cmd}'`],
					level: "error"
				});
				return {};
		}
	});
	function processMessage(message) {
		defaultLogger.Logger.getInstance(message)?.processMessage(message);
	}
}));
//#endregion
//#region ../../node_modules/electron-log/src/node/index.js
var require_node$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var NodeExternalApi = require_NodeExternalApi();
	module.exports = require_createDefaultLogger()({ dependencies: { externalApi: new NodeExternalApi() } });
}));
//#endregion
//#region ../../node_modules/electron-log/src/index.js
var require_src$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isRenderer = typeof process === "undefined" || process.type === "renderer" || process.type === "worker";
	var isMain = typeof process === "object" && process.type === "browser";
	if (isRenderer) {
		require_electron_log_preload();
		module.exports = require_renderer();
	} else if (isMain) module.exports = require_main$2();
	else module.exports = require_node$1();
}));
//#endregion
//#region src/main/window.ts
var import_electron_store = /* @__PURE__ */ __toESM(require_electron_store());
var import_src = /* @__PURE__ */ __toESM(require_src$1());
var store = new import_electron_store.default({
	name: "window-state",
	defaults: {
		width: 1400,
		height: 900,
		isMaximized: false
	}
});
/**
* 获取窗口状态
*/
function getWindowState() {
	const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
	const savedState = store.store;
	return {
		x: savedState.x ?? Math.max(0, (width - savedState.width) / 2),
		y: savedState.y ?? Math.max(0, (height - savedState.height) / 2),
		width: Math.min(savedState.width, width),
		height: Math.min(savedState.height, height),
		isMaximized: savedState.isMaximized
	};
}
/**
* 保存窗口状态
*/
function saveWindowState(window) {
	if (!window.isDestroyed()) {
		const bounds = window.getBounds();
		const isMaximized = window.isMaximized();
		store.store = {
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
			isMaximized
		};
	}
}
/**
* 创建主窗口
*/
function createMainWindow() {
	const windowState = getWindowState();
	const mainWindow = new electron.BrowserWindow({
		x: windowState.x,
		y: windowState.y,
		width: windowState.width,
		height: windowState.height,
		minWidth: 1024,
		minHeight: 768,
		show: false,
		title: "GitHub Stars",
		icon: (0, node_path.join)(__dirname, "../../build/icon.png"),
		webPreferences: {
			preload: (0, node_path.join)(__dirname, "../preload/index.js"),
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	mainWindow.on("ready-to-show", () => {
		mainWindow.show();
		if (windowState.isMaximized) mainWindow.maximize();
		import_src.default.info("主窗口已显示");
	});
	mainWindow.on("close", () => {
		saveWindowState(mainWindow);
	});
	mainWindow.webContents.setWindowOpenHandler((details) => {
		electron.shell.openExternal(details.url);
		return { action: "deny" };
	});
	loadContent(mainWindow);
	return mainWindow;
}
/**
* 加载窗口内容
*/
function loadContent(window) {
	if (is.dev) {
		const frontendUrl = process.env.FRONTEND_URL || "http://localhost:10001";
		window.loadURL(frontendUrl);
		window.webContents.openDevTools();
		import_src.default.info(`开发环境：加载前端服务器 ${frontendUrl}`);
	} else {
		const frontendPath = (0, node_path.join)(process.resourcesPath, "frontend-dist", "index.html");
		window.loadFile(frontendPath);
		import_src.default.info("生产环境：加载打包文件");
	}
}
//#endregion
//#region src/main/ipc.ts
/**
* 设置IPC处理器
*/
function setupIpcHandlers(mainWindow) {
	/**
	* 获取应用版本
	*/
	electron.ipcMain.handle("app:getVersion", () => {
		return electron.app.getVersion();
	});
	/**
	* 获取应用名称
	*/
	electron.ipcMain.handle("app:getName", () => {
		return electron.app.getName();
	});
	/** 允许渲染进程访问的系统路径名称白名单 */
	const ALLOWED_PATHS = [
		"userData",
		"temp",
		"downloads",
		"desktop",
		"documents",
		"home",
		"appData",
		"logs"
	];
	/**
	* 获取应用路径
	*/
	electron.ipcMain.handle("app:getPath", (_, name) => {
		if (!ALLOWED_PATHS.includes(name)) throw new Error(`不允许的路径名称: ${name}`);
		return electron.app.getPath(name);
	});
	/**
	* 显示打开文件夹对话框
	*/
	electron.ipcMain.handle("dialog:openDirectory", async (_, options) => {
		const result = await electron.dialog.showOpenDialog(mainWindow, {
			properties: ["openDirectory"],
			title: options?.title ?? "选择文件夹",
			defaultPath: options?.defaultPath
		});
		if (result.canceled) return null;
		return result.filePaths[0];
	});
	/**
	* 显示保存文件对话框
	*/
	electron.ipcMain.handle("dialog:saveFile", async (_, options) => {
		const result = await electron.dialog.showSaveDialog(mainWindow, {
			title: options?.title ?? "保存文件",
			defaultPath: options?.defaultPath,
			filters: options?.filters
		});
		if (result.canceled) return null;
		return result.filePath;
	});
	/**
	* 显示消息框
	*/
	electron.ipcMain.handle("dialog:showMessageBox", async (_, options) => {
		return await electron.dialog.showMessageBox(mainWindow, options);
	});
	/**
	* 打开外部链接
	* 仅允许 http/https 协议，防止 file:///smb:// 等危险协议
	*/
	electron.ipcMain.handle("shell:openExternal", async (_, url) => {
		const parsed = new URL(url);
		if (!["https:", "http:"].includes(parsed.protocol)) throw new Error(`不允许的协议: ${parsed.protocol}`);
		await electron.shell.openExternal(url);
	});
	/**
	* 在文件管理器中显示
	*/
	electron.ipcMain.handle("shell:showItemInFolder", (_, fullPath) => {
		electron.shell.showItemInFolder(fullPath);
	});
	/**
	* 窗口控制
	*/
	electron.ipcMain.handle("window:minimize", () => {
		mainWindow.minimize();
	});
	electron.ipcMain.handle("window:maximize", () => {
		if (mainWindow.isMaximized()) mainWindow.unmaximize();
		else mainWindow.maximize();
	});
	electron.ipcMain.handle("window:close", () => {
		mainWindow.close();
	});
	electron.ipcMain.handle("window:isMaximized", () => {
		return mainWindow.isMaximized();
	});
	/**
	* 获取系统信息
	*/
	electron.ipcMain.handle("system:getInfo", () => {
		return {
			platform: process.platform,
			arch: process.arch,
			version: process.version,
			electronVersion: process.versions.electron,
			chromeVersion: process.versions.chrome,
			nodeVersion: process.versions.node
		};
	});
	/**
	* 获取桌面端特有信息
	*/
	electron.ipcMain.handle("desktop:getConfig", () => {
		return {
			isDesktop: true,
			platform: process.platform,
			userDataPath: electron.app.getPath("userData"),
			tempPath: electron.app.getPath("temp"),
			downloadsPath: electron.app.getPath("downloads")
		};
	});
	import_src.default.info("IPC处理器已注册");
}
//#endregion
//#region src/main/tray.ts
var tray = null;
/**
* 创建系统托盘
*/
function createTray(mainWindow) {
	const iconPath = (0, node_path.join)(__dirname, "../../build/icon.png");
	tray = new electron.Tray(electron.nativeImage.createFromPath(iconPath).resize({
		width: 16,
		height: 16
	}));
	tray.setToolTip("GitHub Stars");
	const contextMenu = electron.Menu.buildFromTemplate([
		{
			label: "显示窗口",
			click: () => {
				mainWindow.show();
				mainWindow.focus();
			}
		},
		{ type: "separator" },
		{
			label: "检查更新",
			click: () => {
				mainWindow.webContents.send("menu:check-update");
			}
		},
		{ type: "separator" },
		{
			label: "退出",
			click: () => {
				electron.app.quit();
			}
		}
	]);
	tray.setContextMenu(contextMenu);
	tray.on("click", () => {
		if (mainWindow.isVisible()) mainWindow.hide();
		else {
			mainWindow.show();
			mainWindow.focus();
		}
	});
	tray.on("double-click", () => {
		mainWindow.show();
		mainWindow.focus();
	});
	import_src.default.info("系统托盘已创建");
	return tray;
}
//#endregion
//#region ../../node_modules/universalify/index.js
var require_universalify = /* @__PURE__ */ __commonJSMin(((exports) => {
	exports.fromCallback = function(fn) {
		return Object.defineProperty(function(...args) {
			if (typeof args[args.length - 1] === "function") fn.apply(this, args);
			else return new Promise((resolve, reject) => {
				args.push((err, res) => err != null ? reject(err) : resolve(res));
				fn.apply(this, args);
			});
		}, "name", { value: fn.name });
	};
	exports.fromPromise = function(fn) {
		return Object.defineProperty(function(...args) {
			const cb = args[args.length - 1];
			if (typeof cb !== "function") return fn.apply(this, args);
			else {
				args.pop();
				fn.apply(this, args).then((r) => cb(null, r), cb);
			}
		}, "name", { value: fn.name });
	};
}));
//#endregion
//#region ../../node_modules/graceful-fs/polyfills.js
var require_polyfills = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var constants = require("constants");
	var origCwd = process.cwd;
	var cwd = null;
	var platform = process.env.GRACEFUL_FS_PLATFORM || process.platform;
	process.cwd = function() {
		if (!cwd) cwd = origCwd.call(process);
		return cwd;
	};
	try {
		process.cwd();
	} catch (er) {}
	if (typeof process.chdir === "function") {
		var chdir = process.chdir;
		process.chdir = function(d) {
			cwd = null;
			chdir.call(process, d);
		};
		if (Object.setPrototypeOf) Object.setPrototypeOf(process.chdir, chdir);
	}
	module.exports = patch;
	function patch(fs) {
		if (constants.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./)) patchLchmod(fs);
		if (!fs.lutimes) patchLutimes(fs);
		fs.chown = chownFix(fs.chown);
		fs.fchown = chownFix(fs.fchown);
		fs.lchown = chownFix(fs.lchown);
		fs.chmod = chmodFix(fs.chmod);
		fs.fchmod = chmodFix(fs.fchmod);
		fs.lchmod = chmodFix(fs.lchmod);
		fs.chownSync = chownFixSync(fs.chownSync);
		fs.fchownSync = chownFixSync(fs.fchownSync);
		fs.lchownSync = chownFixSync(fs.lchownSync);
		fs.chmodSync = chmodFixSync(fs.chmodSync);
		fs.fchmodSync = chmodFixSync(fs.fchmodSync);
		fs.lchmodSync = chmodFixSync(fs.lchmodSync);
		fs.stat = statFix(fs.stat);
		fs.fstat = statFix(fs.fstat);
		fs.lstat = statFix(fs.lstat);
		fs.statSync = statFixSync(fs.statSync);
		fs.fstatSync = statFixSync(fs.fstatSync);
		fs.lstatSync = statFixSync(fs.lstatSync);
		if (fs.chmod && !fs.lchmod) {
			fs.lchmod = function(path, mode, cb) {
				if (cb) process.nextTick(cb);
			};
			fs.lchmodSync = function() {};
		}
		if (fs.chown && !fs.lchown) {
			fs.lchown = function(path, uid, gid, cb) {
				if (cb) process.nextTick(cb);
			};
			fs.lchownSync = function() {};
		}
		if (platform === "win32") fs.rename = typeof fs.rename !== "function" ? fs.rename : (function(fs$rename) {
			function rename(from, to, cb) {
				var start = Date.now();
				var backoff = 0;
				fs$rename(from, to, function CB(er) {
					if (er && (er.code === "EACCES" || er.code === "EPERM" || er.code === "EBUSY") && Date.now() - start < 6e4) {
						setTimeout(function() {
							fs.stat(to, function(stater, st) {
								if (stater && stater.code === "ENOENT") fs$rename(from, to, CB);
								else cb(er);
							});
						}, backoff);
						if (backoff < 100) backoff += 10;
						return;
					}
					if (cb) cb(er);
				});
			}
			if (Object.setPrototypeOf) Object.setPrototypeOf(rename, fs$rename);
			return rename;
		})(fs.rename);
		fs.read = typeof fs.read !== "function" ? fs.read : (function(fs$read) {
			function read(fd, buffer, offset, length, position, callback_) {
				var callback;
				if (callback_ && typeof callback_ === "function") {
					var eagCounter = 0;
					callback = function(er, _, __) {
						if (er && er.code === "EAGAIN" && eagCounter < 10) {
							eagCounter++;
							return fs$read.call(fs, fd, buffer, offset, length, position, callback);
						}
						callback_.apply(this, arguments);
					};
				}
				return fs$read.call(fs, fd, buffer, offset, length, position, callback);
			}
			if (Object.setPrototypeOf) Object.setPrototypeOf(read, fs$read);
			return read;
		})(fs.read);
		fs.readSync = typeof fs.readSync !== "function" ? fs.readSync : (function(fs$readSync) {
			return function(fd, buffer, offset, length, position) {
				var eagCounter = 0;
				while (true) try {
					return fs$readSync.call(fs, fd, buffer, offset, length, position);
				} catch (er) {
					if (er.code === "EAGAIN" && eagCounter < 10) {
						eagCounter++;
						continue;
					}
					throw er;
				}
			};
		})(fs.readSync);
		function patchLchmod(fs) {
			fs.lchmod = function(path, mode, callback) {
				fs.open(path, constants.O_WRONLY | constants.O_SYMLINK, mode, function(err, fd) {
					if (err) {
						if (callback) callback(err);
						return;
					}
					fs.fchmod(fd, mode, function(err) {
						fs.close(fd, function(err2) {
							if (callback) callback(err || err2);
						});
					});
				});
			};
			fs.lchmodSync = function(path, mode) {
				var fd = fs.openSync(path, constants.O_WRONLY | constants.O_SYMLINK, mode);
				var threw = true;
				var ret;
				try {
					ret = fs.fchmodSync(fd, mode);
					threw = false;
				} finally {
					if (threw) try {
						fs.closeSync(fd);
					} catch (er) {}
					else fs.closeSync(fd);
				}
				return ret;
			};
		}
		function patchLutimes(fs) {
			if (constants.hasOwnProperty("O_SYMLINK") && fs.futimes) {
				fs.lutimes = function(path, at, mt, cb) {
					fs.open(path, constants.O_SYMLINK, function(er, fd) {
						if (er) {
							if (cb) cb(er);
							return;
						}
						fs.futimes(fd, at, mt, function(er) {
							fs.close(fd, function(er2) {
								if (cb) cb(er || er2);
							});
						});
					});
				};
				fs.lutimesSync = function(path, at, mt) {
					var fd = fs.openSync(path, constants.O_SYMLINK);
					var ret;
					var threw = true;
					try {
						ret = fs.futimesSync(fd, at, mt);
						threw = false;
					} finally {
						if (threw) try {
							fs.closeSync(fd);
						} catch (er) {}
						else fs.closeSync(fd);
					}
					return ret;
				};
			} else if (fs.futimes) {
				fs.lutimes = function(_a, _b, _c, cb) {
					if (cb) process.nextTick(cb);
				};
				fs.lutimesSync = function() {};
			}
		}
		function chmodFix(orig) {
			if (!orig) return orig;
			return function(target, mode, cb) {
				return orig.call(fs, target, mode, function(er) {
					if (chownErOk(er)) er = null;
					if (cb) cb.apply(this, arguments);
				});
			};
		}
		function chmodFixSync(orig) {
			if (!orig) return orig;
			return function(target, mode) {
				try {
					return orig.call(fs, target, mode);
				} catch (er) {
					if (!chownErOk(er)) throw er;
				}
			};
		}
		function chownFix(orig) {
			if (!orig) return orig;
			return function(target, uid, gid, cb) {
				return orig.call(fs, target, uid, gid, function(er) {
					if (chownErOk(er)) er = null;
					if (cb) cb.apply(this, arguments);
				});
			};
		}
		function chownFixSync(orig) {
			if (!orig) return orig;
			return function(target, uid, gid) {
				try {
					return orig.call(fs, target, uid, gid);
				} catch (er) {
					if (!chownErOk(er)) throw er;
				}
			};
		}
		function statFix(orig) {
			if (!orig) return orig;
			return function(target, options, cb) {
				if (typeof options === "function") {
					cb = options;
					options = null;
				}
				function callback(er, stats) {
					if (stats) {
						if (stats.uid < 0) stats.uid += 4294967296;
						if (stats.gid < 0) stats.gid += 4294967296;
					}
					if (cb) cb.apply(this, arguments);
				}
				return options ? orig.call(fs, target, options, callback) : orig.call(fs, target, callback);
			};
		}
		function statFixSync(orig) {
			if (!orig) return orig;
			return function(target, options) {
				var stats = options ? orig.call(fs, target, options) : orig.call(fs, target);
				if (stats) {
					if (stats.uid < 0) stats.uid += 4294967296;
					if (stats.gid < 0) stats.gid += 4294967296;
				}
				return stats;
			};
		}
		function chownErOk(er) {
			if (!er) return true;
			if (er.code === "ENOSYS") return true;
			if (!process.getuid || process.getuid() !== 0) {
				if (er.code === "EINVAL" || er.code === "EPERM") return true;
			}
			return false;
		}
	}
}));
//#endregion
//#region ../../node_modules/graceful-fs/legacy-streams.js
var require_legacy_streams = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Stream = require("stream").Stream;
	module.exports = legacy;
	function legacy(fs) {
		return {
			ReadStream,
			WriteStream
		};
		function ReadStream(path, options) {
			if (!(this instanceof ReadStream)) return new ReadStream(path, options);
			Stream.call(this);
			var self = this;
			this.path = path;
			this.fd = null;
			this.readable = true;
			this.paused = false;
			this.flags = "r";
			this.mode = 438;
			this.bufferSize = 64 * 1024;
			options = options || {};
			var keys = Object.keys(options);
			for (var index = 0, length = keys.length; index < length; index++) {
				var key = keys[index];
				this[key] = options[key];
			}
			if (this.encoding) this.setEncoding(this.encoding);
			if (this.start !== void 0) {
				if ("number" !== typeof this.start) throw TypeError("start must be a Number");
				if (this.end === void 0) this.end = Infinity;
				else if ("number" !== typeof this.end) throw TypeError("end must be a Number");
				if (this.start > this.end) throw new Error("start must be <= end");
				this.pos = this.start;
			}
			if (this.fd !== null) {
				process.nextTick(function() {
					self._read();
				});
				return;
			}
			fs.open(this.path, this.flags, this.mode, function(err, fd) {
				if (err) {
					self.emit("error", err);
					self.readable = false;
					return;
				}
				self.fd = fd;
				self.emit("open", fd);
				self._read();
			});
		}
		function WriteStream(path, options) {
			if (!(this instanceof WriteStream)) return new WriteStream(path, options);
			Stream.call(this);
			this.path = path;
			this.fd = null;
			this.writable = true;
			this.flags = "w";
			this.encoding = "binary";
			this.mode = 438;
			this.bytesWritten = 0;
			options = options || {};
			var keys = Object.keys(options);
			for (var index = 0, length = keys.length; index < length; index++) {
				var key = keys[index];
				this[key] = options[key];
			}
			if (this.start !== void 0) {
				if ("number" !== typeof this.start) throw TypeError("start must be a Number");
				if (this.start < 0) throw new Error("start must be >= zero");
				this.pos = this.start;
			}
			this.busy = false;
			this._queue = [];
			if (this.fd === null) {
				this._open = fs.open;
				this._queue.push([
					this._open,
					this.path,
					this.flags,
					this.mode,
					void 0
				]);
				this.flush();
			}
		}
	}
}));
//#endregion
//#region ../../node_modules/graceful-fs/clone.js
var require_clone = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = clone;
	var getPrototypeOf = Object.getPrototypeOf || function(obj) {
		return obj.__proto__;
	};
	function clone(obj) {
		if (obj === null || typeof obj !== "object") return obj;
		if (obj instanceof Object) var copy = { __proto__: getPrototypeOf(obj) };
		else var copy = Object.create(null);
		Object.getOwnPropertyNames(obj).forEach(function(key) {
			Object.defineProperty(copy, key, Object.getOwnPropertyDescriptor(obj, key));
		});
		return copy;
	}
}));
//#endregion
//#region ../../node_modules/graceful-fs/graceful-fs.js
var require_graceful_fs = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs = require("fs");
	var polyfills = require_polyfills();
	var legacy = require_legacy_streams();
	var clone = require_clone();
	var util$2 = require("util");
	/* istanbul ignore next - node 0.x polyfill */
	var gracefulQueue;
	var previousSymbol;
	/* istanbul ignore else - node 0.x polyfill */
	if (typeof Symbol === "function" && typeof Symbol.for === "function") {
		gracefulQueue = Symbol.for("graceful-fs.queue");
		previousSymbol = Symbol.for("graceful-fs.previous");
	} else {
		gracefulQueue = "___graceful-fs.queue";
		previousSymbol = "___graceful-fs.previous";
	}
	function noop() {}
	function publishQueue(context, queue) {
		Object.defineProperty(context, gracefulQueue, { get: function() {
			return queue;
		} });
	}
	var debug = noop;
	if (util$2.debuglog) debug = util$2.debuglog("gfs4");
	else if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || "")) debug = function() {
		var m = util$2.format.apply(util$2, arguments);
		m = "GFS4: " + m.split(/\n/).join("\nGFS4: ");
		console.error(m);
	};
	if (!fs[gracefulQueue]) {
		publishQueue(fs, global[gracefulQueue] || []);
		fs.close = (function(fs$close) {
			function close(fd, cb) {
				return fs$close.call(fs, fd, function(err) {
					if (!err) resetQueue();
					if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
			Object.defineProperty(close, previousSymbol, { value: fs$close });
			return close;
		})(fs.close);
		fs.closeSync = (function(fs$closeSync) {
			function closeSync(fd) {
				fs$closeSync.apply(fs, arguments);
				resetQueue();
			}
			Object.defineProperty(closeSync, previousSymbol, { value: fs$closeSync });
			return closeSync;
		})(fs.closeSync);
		if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || "")) process.on("exit", function() {
			debug(fs[gracefulQueue]);
			require("assert").equal(fs[gracefulQueue].length, 0);
		});
	}
	if (!global[gracefulQueue]) publishQueue(global, fs[gracefulQueue]);
	module.exports = patch(clone(fs));
	if (process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !fs.__patched) {
		module.exports = patch(fs);
		fs.__patched = true;
	}
	function patch(fs) {
		polyfills(fs);
		fs.gracefulify = patch;
		fs.createReadStream = createReadStream;
		fs.createWriteStream = createWriteStream;
		var fs$readFile = fs.readFile;
		fs.readFile = readFile;
		function readFile(path, options, cb) {
			if (typeof options === "function") cb = options, options = null;
			return go$readFile(path, options, cb);
			function go$readFile(path, options, cb, startTime) {
				return fs$readFile(path, options, function(err) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$readFile,
						[
							path,
							options,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
		}
		var fs$writeFile = fs.writeFile;
		fs.writeFile = writeFile;
		function writeFile(path, data, options, cb) {
			if (typeof options === "function") cb = options, options = null;
			return go$writeFile(path, data, options, cb);
			function go$writeFile(path, data, options, cb, startTime) {
				return fs$writeFile(path, data, options, function(err) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$writeFile,
						[
							path,
							data,
							options,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
		}
		var fs$appendFile = fs.appendFile;
		if (fs$appendFile) fs.appendFile = appendFile;
		function appendFile(path, data, options, cb) {
			if (typeof options === "function") cb = options, options = null;
			return go$appendFile(path, data, options, cb);
			function go$appendFile(path, data, options, cb, startTime) {
				return fs$appendFile(path, data, options, function(err) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$appendFile,
						[
							path,
							data,
							options,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
		}
		var fs$copyFile = fs.copyFile;
		if (fs$copyFile) fs.copyFile = copyFile;
		function copyFile(src, dest, flags, cb) {
			if (typeof flags === "function") {
				cb = flags;
				flags = 0;
			}
			return go$copyFile(src, dest, flags, cb);
			function go$copyFile(src, dest, flags, cb, startTime) {
				return fs$copyFile(src, dest, flags, function(err) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$copyFile,
						[
							src,
							dest,
							flags,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
		}
		var fs$readdir = fs.readdir;
		fs.readdir = readdir;
		var noReaddirOptionVersions = /^v[0-5]\./;
		function readdir(path, options, cb) {
			if (typeof options === "function") cb = options, options = null;
			var go$readdir = noReaddirOptionVersions.test(process.version) ? function go$readdir(path, options, cb, startTime) {
				return fs$readdir(path, fs$readdirCallback(path, options, cb, startTime));
			} : function go$readdir(path, options, cb, startTime) {
				return fs$readdir(path, options, fs$readdirCallback(path, options, cb, startTime));
			};
			return go$readdir(path, options, cb);
			function fs$readdirCallback(path, options, cb, startTime) {
				return function(err, files) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$readdir,
						[
							path,
							options,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else {
						if (files && files.sort) files.sort();
						if (typeof cb === "function") cb.call(this, err, files);
					}
				};
			}
		}
		if (process.version.substr(0, 4) === "v0.8") {
			var legStreams = legacy(fs);
			ReadStream = legStreams.ReadStream;
			WriteStream = legStreams.WriteStream;
		}
		var fs$ReadStream = fs.ReadStream;
		if (fs$ReadStream) {
			ReadStream.prototype = Object.create(fs$ReadStream.prototype);
			ReadStream.prototype.open = ReadStream$open;
		}
		var fs$WriteStream = fs.WriteStream;
		if (fs$WriteStream) {
			WriteStream.prototype = Object.create(fs$WriteStream.prototype);
			WriteStream.prototype.open = WriteStream$open;
		}
		Object.defineProperty(fs, "ReadStream", {
			get: function() {
				return ReadStream;
			},
			set: function(val) {
				ReadStream = val;
			},
			enumerable: true,
			configurable: true
		});
		Object.defineProperty(fs, "WriteStream", {
			get: function() {
				return WriteStream;
			},
			set: function(val) {
				WriteStream = val;
			},
			enumerable: true,
			configurable: true
		});
		var FileReadStream = ReadStream;
		Object.defineProperty(fs, "FileReadStream", {
			get: function() {
				return FileReadStream;
			},
			set: function(val) {
				FileReadStream = val;
			},
			enumerable: true,
			configurable: true
		});
		var FileWriteStream = WriteStream;
		Object.defineProperty(fs, "FileWriteStream", {
			get: function() {
				return FileWriteStream;
			},
			set: function(val) {
				FileWriteStream = val;
			},
			enumerable: true,
			configurable: true
		});
		function ReadStream(path, options) {
			if (this instanceof ReadStream) return fs$ReadStream.apply(this, arguments), this;
			else return ReadStream.apply(Object.create(ReadStream.prototype), arguments);
		}
		function ReadStream$open() {
			var that = this;
			open(that.path, that.flags, that.mode, function(err, fd) {
				if (err) {
					if (that.autoClose) that.destroy();
					that.emit("error", err);
				} else {
					that.fd = fd;
					that.emit("open", fd);
					that.read();
				}
			});
		}
		function WriteStream(path, options) {
			if (this instanceof WriteStream) return fs$WriteStream.apply(this, arguments), this;
			else return WriteStream.apply(Object.create(WriteStream.prototype), arguments);
		}
		function WriteStream$open() {
			var that = this;
			open(that.path, that.flags, that.mode, function(err, fd) {
				if (err) {
					that.destroy();
					that.emit("error", err);
				} else {
					that.fd = fd;
					that.emit("open", fd);
				}
			});
		}
		function createReadStream(path, options) {
			return new fs.ReadStream(path, options);
		}
		function createWriteStream(path, options) {
			return new fs.WriteStream(path, options);
		}
		var fs$open = fs.open;
		fs.open = open;
		function open(path, flags, mode, cb) {
			if (typeof mode === "function") cb = mode, mode = null;
			return go$open(path, flags, mode, cb);
			function go$open(path, flags, mode, cb, startTime) {
				return fs$open(path, flags, mode, function(err, fd) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$open,
						[
							path,
							flags,
							mode,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
		}
		return fs;
	}
	function enqueue(elem) {
		debug("ENQUEUE", elem[0].name, elem[1]);
		fs[gracefulQueue].push(elem);
		retry();
	}
	var retryTimer;
	function resetQueue() {
		var now = Date.now();
		for (var i = 0; i < fs[gracefulQueue].length; ++i) if (fs[gracefulQueue][i].length > 2) {
			fs[gracefulQueue][i][3] = now;
			fs[gracefulQueue][i][4] = now;
		}
		retry();
	}
	function retry() {
		clearTimeout(retryTimer);
		retryTimer = void 0;
		if (fs[gracefulQueue].length === 0) return;
		var elem = fs[gracefulQueue].shift();
		var fn = elem[0];
		var args = elem[1];
		var err = elem[2];
		var startTime = elem[3];
		var lastTime = elem[4];
		if (startTime === void 0) {
			debug("RETRY", fn.name, args);
			fn.apply(null, args);
		} else if (Date.now() - startTime >= 6e4) {
			debug("TIMEOUT", fn.name, args);
			var cb = args.pop();
			if (typeof cb === "function") cb.call(null, err);
		} else {
			var sinceAttempt = Date.now() - lastTime;
			var sinceStart = Math.max(lastTime - startTime, 1);
			if (sinceAttempt >= Math.min(sinceStart * 1.2, 100)) {
				debug("RETRY", fn.name, args);
				fn.apply(null, args.concat([startTime]));
			} else fs[gracefulQueue].push(elem);
		}
		if (retryTimer === void 0) retryTimer = setTimeout(retry, 0);
	}
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/fs/index.js
var require_fs = /* @__PURE__ */ __commonJSMin(((exports) => {
	var u = require_universalify().fromCallback;
	var fs = require_graceful_fs();
	var api = [
		"access",
		"appendFile",
		"chmod",
		"chown",
		"close",
		"copyFile",
		"fchmod",
		"fchown",
		"fdatasync",
		"fstat",
		"fsync",
		"ftruncate",
		"futimes",
		"lchmod",
		"lchown",
		"link",
		"lstat",
		"mkdir",
		"mkdtemp",
		"open",
		"opendir",
		"readdir",
		"readFile",
		"readlink",
		"realpath",
		"rename",
		"rm",
		"rmdir",
		"stat",
		"symlink",
		"truncate",
		"unlink",
		"utimes",
		"writeFile"
	].filter((key) => {
		return typeof fs[key] === "function";
	});
	Object.assign(exports, fs);
	api.forEach((method) => {
		exports[method] = u(fs[method]);
	});
	exports.exists = function(filename, callback) {
		if (typeof callback === "function") return fs.exists(filename, callback);
		return new Promise((resolve) => {
			return fs.exists(filename, resolve);
		});
	};
	exports.read = function(fd, buffer, offset, length, position, callback) {
		if (typeof callback === "function") return fs.read(fd, buffer, offset, length, position, callback);
		return new Promise((resolve, reject) => {
			fs.read(fd, buffer, offset, length, position, (err, bytesRead, buffer) => {
				if (err) return reject(err);
				resolve({
					bytesRead,
					buffer
				});
			});
		});
	};
	exports.write = function(fd, buffer, ...args) {
		if (typeof args[args.length - 1] === "function") return fs.write(fd, buffer, ...args);
		return new Promise((resolve, reject) => {
			fs.write(fd, buffer, ...args, (err, bytesWritten, buffer) => {
				if (err) return reject(err);
				resolve({
					bytesWritten,
					buffer
				});
			});
		});
	};
	if (typeof fs.writev === "function") exports.writev = function(fd, buffers, ...args) {
		if (typeof args[args.length - 1] === "function") return fs.writev(fd, buffers, ...args);
		return new Promise((resolve, reject) => {
			fs.writev(fd, buffers, ...args, (err, bytesWritten, buffers) => {
				if (err) return reject(err);
				resolve({
					bytesWritten,
					buffers
				});
			});
		});
	};
	if (typeof fs.realpath.native === "function") exports.realpath.native = u(fs.realpath.native);
	else process.emitWarning("fs.realpath.native is not a function. Is fs being monkey-patched?", "Warning", "fs-extra-WARN0003");
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/mkdirs/utils.js
var require_utils$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var path$23 = require("path");
	module.exports.checkPath = function checkPath(pth) {
		if (process.platform === "win32") {
			if (/[<>:"|?*]/.test(pth.replace(path$23.parse(pth).root, ""))) {
				const error = /* @__PURE__ */ new Error(`Path contains invalid characters: ${pth}`);
				error.code = "EINVAL";
				throw error;
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/mkdirs/make-dir.js
var require_make_dir = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs = require_fs();
	var { checkPath } = require_utils$1();
	var getMode = (options) => {
		const defaults = { mode: 511 };
		if (typeof options === "number") return options;
		return {
			...defaults,
			...options
		}.mode;
	};
	module.exports.makeDir = async (dir, options) => {
		checkPath(dir);
		return fs.mkdir(dir, {
			mode: getMode(options),
			recursive: true
		});
	};
	module.exports.makeDirSync = (dir, options) => {
		checkPath(dir);
		return fs.mkdirSync(dir, {
			mode: getMode(options),
			recursive: true
		});
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/mkdirs/index.js
var require_mkdirs = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var u = require_universalify().fromPromise;
	var { makeDir: _makeDir, makeDirSync } = require_make_dir();
	var makeDir = u(_makeDir);
	module.exports = {
		mkdirs: makeDir,
		mkdirsSync: makeDirSync,
		mkdirp: makeDir,
		mkdirpSync: makeDirSync,
		ensureDir: makeDir,
		ensureDirSync: makeDirSync
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/path-exists/index.js
var require_path_exists = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var u = require_universalify().fromPromise;
	var fs = require_fs();
	function pathExists(path) {
		return fs.access(path).then(() => true).catch(() => false);
	}
	module.exports = {
		pathExists: u(pathExists),
		pathExistsSync: fs.existsSync
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/util/utimes.js
var require_utimes = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs = require_graceful_fs();
	function utimesMillis(path, atime, mtime, callback) {
		fs.open(path, "r+", (err, fd) => {
			if (err) return callback(err);
			fs.futimes(fd, atime, mtime, (futimesErr) => {
				fs.close(fd, (closeErr) => {
					if (callback) callback(futimesErr || closeErr);
				});
			});
		});
	}
	function utimesMillisSync(path, atime, mtime) {
		const fd = fs.openSync(path, "r+");
		fs.futimesSync(fd, atime, mtime);
		return fs.closeSync(fd);
	}
	module.exports = {
		utimesMillis,
		utimesMillisSync
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/util/stat.js
var require_stat = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs = require_fs();
	var path$22 = require("path");
	var util$1 = require("util");
	function getStats(src, dest, opts) {
		const statFunc = opts.dereference ? (file) => fs.stat(file, { bigint: true }) : (file) => fs.lstat(file, { bigint: true });
		return Promise.all([statFunc(src), statFunc(dest).catch((err) => {
			if (err.code === "ENOENT") return null;
			throw err;
		})]).then(([srcStat, destStat]) => ({
			srcStat,
			destStat
		}));
	}
	function getStatsSync(src, dest, opts) {
		let destStat;
		const statFunc = opts.dereference ? (file) => fs.statSync(file, { bigint: true }) : (file) => fs.lstatSync(file, { bigint: true });
		const srcStat = statFunc(src);
		try {
			destStat = statFunc(dest);
		} catch (err) {
			if (err.code === "ENOENT") return {
				srcStat,
				destStat: null
			};
			throw err;
		}
		return {
			srcStat,
			destStat
		};
	}
	function checkPaths(src, dest, funcName, opts, cb) {
		util$1.callbackify(getStats)(src, dest, opts, (err, stats) => {
			if (err) return cb(err);
			const { srcStat, destStat } = stats;
			if (destStat) {
				if (areIdentical(srcStat, destStat)) {
					const srcBaseName = path$22.basename(src);
					const destBaseName = path$22.basename(dest);
					if (funcName === "move" && srcBaseName !== destBaseName && srcBaseName.toLowerCase() === destBaseName.toLowerCase()) return cb(null, {
						srcStat,
						destStat,
						isChangingCase: true
					});
					return cb(/* @__PURE__ */ new Error("Source and destination must not be the same."));
				}
				if (srcStat.isDirectory() && !destStat.isDirectory()) return cb(/* @__PURE__ */ new Error(`Cannot overwrite non-directory '${dest}' with directory '${src}'.`));
				if (!srcStat.isDirectory() && destStat.isDirectory()) return cb(/* @__PURE__ */ new Error(`Cannot overwrite directory '${dest}' with non-directory '${src}'.`));
			}
			if (srcStat.isDirectory() && isSrcSubdir(src, dest)) return cb(new Error(errMsg(src, dest, funcName)));
			return cb(null, {
				srcStat,
				destStat
			});
		});
	}
	function checkPathsSync(src, dest, funcName, opts) {
		const { srcStat, destStat } = getStatsSync(src, dest, opts);
		if (destStat) {
			if (areIdentical(srcStat, destStat)) {
				const srcBaseName = path$22.basename(src);
				const destBaseName = path$22.basename(dest);
				if (funcName === "move" && srcBaseName !== destBaseName && srcBaseName.toLowerCase() === destBaseName.toLowerCase()) return {
					srcStat,
					destStat,
					isChangingCase: true
				};
				throw new Error("Source and destination must not be the same.");
			}
			if (srcStat.isDirectory() && !destStat.isDirectory()) throw new Error(`Cannot overwrite non-directory '${dest}' with directory '${src}'.`);
			if (!srcStat.isDirectory() && destStat.isDirectory()) throw new Error(`Cannot overwrite directory '${dest}' with non-directory '${src}'.`);
		}
		if (srcStat.isDirectory() && isSrcSubdir(src, dest)) throw new Error(errMsg(src, dest, funcName));
		return {
			srcStat,
			destStat
		};
	}
	function checkParentPaths(src, srcStat, dest, funcName, cb) {
		const srcParent = path$22.resolve(path$22.dirname(src));
		const destParent = path$22.resolve(path$22.dirname(dest));
		if (destParent === srcParent || destParent === path$22.parse(destParent).root) return cb();
		fs.stat(destParent, { bigint: true }, (err, destStat) => {
			if (err) {
				if (err.code === "ENOENT") return cb();
				return cb(err);
			}
			if (areIdentical(srcStat, destStat)) return cb(new Error(errMsg(src, dest, funcName)));
			return checkParentPaths(src, srcStat, destParent, funcName, cb);
		});
	}
	function checkParentPathsSync(src, srcStat, dest, funcName) {
		const srcParent = path$22.resolve(path$22.dirname(src));
		const destParent = path$22.resolve(path$22.dirname(dest));
		if (destParent === srcParent || destParent === path$22.parse(destParent).root) return;
		let destStat;
		try {
			destStat = fs.statSync(destParent, { bigint: true });
		} catch (err) {
			if (err.code === "ENOENT") return;
			throw err;
		}
		if (areIdentical(srcStat, destStat)) throw new Error(errMsg(src, dest, funcName));
		return checkParentPathsSync(src, srcStat, destParent, funcName);
	}
	function areIdentical(srcStat, destStat) {
		return destStat.ino && destStat.dev && destStat.ino === srcStat.ino && destStat.dev === srcStat.dev;
	}
	function isSrcSubdir(src, dest) {
		const srcArr = path$22.resolve(src).split(path$22.sep).filter((i) => i);
		const destArr = path$22.resolve(dest).split(path$22.sep).filter((i) => i);
		return srcArr.reduce((acc, cur, i) => acc && destArr[i] === cur, true);
	}
	function errMsg(src, dest, funcName) {
		return `Cannot ${funcName} '${src}' to a subdirectory of itself, '${dest}'.`;
	}
	module.exports = {
		checkPaths,
		checkPathsSync,
		checkParentPaths,
		checkParentPathsSync,
		isSrcSubdir,
		areIdentical
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/copy/copy.js
var require_copy$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs = require_graceful_fs();
	var path$21 = require("path");
	var mkdirs = require_mkdirs().mkdirs;
	var pathExists = require_path_exists().pathExists;
	var utimesMillis = require_utimes().utimesMillis;
	var stat = require_stat();
	function copy(src, dest, opts, cb) {
		if (typeof opts === "function" && !cb) {
			cb = opts;
			opts = {};
		} else if (typeof opts === "function") opts = { filter: opts };
		cb = cb || function() {};
		opts = opts || {};
		opts.clobber = "clobber" in opts ? !!opts.clobber : true;
		opts.overwrite = "overwrite" in opts ? !!opts.overwrite : opts.clobber;
		if (opts.preserveTimestamps && process.arch === "ia32") process.emitWarning("Using the preserveTimestamps option in 32-bit node is not recommended;\n\n	see https://github.com/jprichardson/node-fs-extra/issues/269", "Warning", "fs-extra-WARN0001");
		stat.checkPaths(src, dest, "copy", opts, (err, stats) => {
			if (err) return cb(err);
			const { srcStat, destStat } = stats;
			stat.checkParentPaths(src, srcStat, dest, "copy", (err) => {
				if (err) return cb(err);
				if (opts.filter) return handleFilter(checkParentDir, destStat, src, dest, opts, cb);
				return checkParentDir(destStat, src, dest, opts, cb);
			});
		});
	}
	function checkParentDir(destStat, src, dest, opts, cb) {
		const destParent = path$21.dirname(dest);
		pathExists(destParent, (err, dirExists) => {
			if (err) return cb(err);
			if (dirExists) return getStats(destStat, src, dest, opts, cb);
			mkdirs(destParent, (err) => {
				if (err) return cb(err);
				return getStats(destStat, src, dest, opts, cb);
			});
		});
	}
	function handleFilter(onInclude, destStat, src, dest, opts, cb) {
		Promise.resolve(opts.filter(src, dest)).then((include) => {
			if (include) return onInclude(destStat, src, dest, opts, cb);
			return cb();
		}, (error) => cb(error));
	}
	function startCopy(destStat, src, dest, opts, cb) {
		if (opts.filter) return handleFilter(getStats, destStat, src, dest, opts, cb);
		return getStats(destStat, src, dest, opts, cb);
	}
	function getStats(destStat, src, dest, opts, cb) {
		(opts.dereference ? fs.stat : fs.lstat)(src, (err, srcStat) => {
			if (err) return cb(err);
			if (srcStat.isDirectory()) return onDir(srcStat, destStat, src, dest, opts, cb);
			else if (srcStat.isFile() || srcStat.isCharacterDevice() || srcStat.isBlockDevice()) return onFile(srcStat, destStat, src, dest, opts, cb);
			else if (srcStat.isSymbolicLink()) return onLink(destStat, src, dest, opts, cb);
			else if (srcStat.isSocket()) return cb(/* @__PURE__ */ new Error(`Cannot copy a socket file: ${src}`));
			else if (srcStat.isFIFO()) return cb(/* @__PURE__ */ new Error(`Cannot copy a FIFO pipe: ${src}`));
			return cb(/* @__PURE__ */ new Error(`Unknown file: ${src}`));
		});
	}
	function onFile(srcStat, destStat, src, dest, opts, cb) {
		if (!destStat) return copyFile(srcStat, src, dest, opts, cb);
		return mayCopyFile(srcStat, src, dest, opts, cb);
	}
	function mayCopyFile(srcStat, src, dest, opts, cb) {
		if (opts.overwrite) fs.unlink(dest, (err) => {
			if (err) return cb(err);
			return copyFile(srcStat, src, dest, opts, cb);
		});
		else if (opts.errorOnExist) return cb(/* @__PURE__ */ new Error(`'${dest}' already exists`));
		else return cb();
	}
	function copyFile(srcStat, src, dest, opts, cb) {
		fs.copyFile(src, dest, (err) => {
			if (err) return cb(err);
			if (opts.preserveTimestamps) return handleTimestampsAndMode(srcStat.mode, src, dest, cb);
			return setDestMode(dest, srcStat.mode, cb);
		});
	}
	function handleTimestampsAndMode(srcMode, src, dest, cb) {
		if (fileIsNotWritable(srcMode)) return makeFileWritable(dest, srcMode, (err) => {
			if (err) return cb(err);
			return setDestTimestampsAndMode(srcMode, src, dest, cb);
		});
		return setDestTimestampsAndMode(srcMode, src, dest, cb);
	}
	function fileIsNotWritable(srcMode) {
		return (srcMode & 128) === 0;
	}
	function makeFileWritable(dest, srcMode, cb) {
		return setDestMode(dest, srcMode | 128, cb);
	}
	function setDestTimestampsAndMode(srcMode, src, dest, cb) {
		setDestTimestamps(src, dest, (err) => {
			if (err) return cb(err);
			return setDestMode(dest, srcMode, cb);
		});
	}
	function setDestMode(dest, srcMode, cb) {
		return fs.chmod(dest, srcMode, cb);
	}
	function setDestTimestamps(src, dest, cb) {
		fs.stat(src, (err, updatedSrcStat) => {
			if (err) return cb(err);
			return utimesMillis(dest, updatedSrcStat.atime, updatedSrcStat.mtime, cb);
		});
	}
	function onDir(srcStat, destStat, src, dest, opts, cb) {
		if (!destStat) return mkDirAndCopy(srcStat.mode, src, dest, opts, cb);
		return copyDir(src, dest, opts, cb);
	}
	function mkDirAndCopy(srcMode, src, dest, opts, cb) {
		fs.mkdir(dest, (err) => {
			if (err) return cb(err);
			copyDir(src, dest, opts, (err) => {
				if (err) return cb(err);
				return setDestMode(dest, srcMode, cb);
			});
		});
	}
	function copyDir(src, dest, opts, cb) {
		fs.readdir(src, (err, items) => {
			if (err) return cb(err);
			return copyDirItems(items, src, dest, opts, cb);
		});
	}
	function copyDirItems(items, src, dest, opts, cb) {
		const item = items.pop();
		if (!item) return cb();
		return copyDirItem(items, item, src, dest, opts, cb);
	}
	function copyDirItem(items, item, src, dest, opts, cb) {
		const srcItem = path$21.join(src, item);
		const destItem = path$21.join(dest, item);
		stat.checkPaths(srcItem, destItem, "copy", opts, (err, stats) => {
			if (err) return cb(err);
			const { destStat } = stats;
			startCopy(destStat, srcItem, destItem, opts, (err) => {
				if (err) return cb(err);
				return copyDirItems(items, src, dest, opts, cb);
			});
		});
	}
	function onLink(destStat, src, dest, opts, cb) {
		fs.readlink(src, (err, resolvedSrc) => {
			if (err) return cb(err);
			if (opts.dereference) resolvedSrc = path$21.resolve(process.cwd(), resolvedSrc);
			if (!destStat) return fs.symlink(resolvedSrc, dest, cb);
			else fs.readlink(dest, (err, resolvedDest) => {
				if (err) {
					if (err.code === "EINVAL" || err.code === "UNKNOWN") return fs.symlink(resolvedSrc, dest, cb);
					return cb(err);
				}
				if (opts.dereference) resolvedDest = path$21.resolve(process.cwd(), resolvedDest);
				if (stat.isSrcSubdir(resolvedSrc, resolvedDest)) return cb(/* @__PURE__ */ new Error(`Cannot copy '${resolvedSrc}' to a subdirectory of itself, '${resolvedDest}'.`));
				if (destStat.isDirectory() && stat.isSrcSubdir(resolvedDest, resolvedSrc)) return cb(/* @__PURE__ */ new Error(`Cannot overwrite '${resolvedDest}' with '${resolvedSrc}'.`));
				return copyLink(resolvedSrc, dest, cb);
			});
		});
	}
	function copyLink(resolvedSrc, dest, cb) {
		fs.unlink(dest, (err) => {
			if (err) return cb(err);
			return fs.symlink(resolvedSrc, dest, cb);
		});
	}
	module.exports = copy;
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/copy/copy-sync.js
var require_copy_sync = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs = require_graceful_fs();
	var path$20 = require("path");
	var mkdirsSync = require_mkdirs().mkdirsSync;
	var utimesMillisSync = require_utimes().utimesMillisSync;
	var stat = require_stat();
	function copySync(src, dest, opts) {
		if (typeof opts === "function") opts = { filter: opts };
		opts = opts || {};
		opts.clobber = "clobber" in opts ? !!opts.clobber : true;
		opts.overwrite = "overwrite" in opts ? !!opts.overwrite : opts.clobber;
		if (opts.preserveTimestamps && process.arch === "ia32") process.emitWarning("Using the preserveTimestamps option in 32-bit node is not recommended;\n\n	see https://github.com/jprichardson/node-fs-extra/issues/269", "Warning", "fs-extra-WARN0002");
		const { srcStat, destStat } = stat.checkPathsSync(src, dest, "copy", opts);
		stat.checkParentPathsSync(src, srcStat, dest, "copy");
		return handleFilterAndCopy(destStat, src, dest, opts);
	}
	function handleFilterAndCopy(destStat, src, dest, opts) {
		if (opts.filter && !opts.filter(src, dest)) return;
		const destParent = path$20.dirname(dest);
		if (!fs.existsSync(destParent)) mkdirsSync(destParent);
		return getStats(destStat, src, dest, opts);
	}
	function startCopy(destStat, src, dest, opts) {
		if (opts.filter && !opts.filter(src, dest)) return;
		return getStats(destStat, src, dest, opts);
	}
	function getStats(destStat, src, dest, opts) {
		const srcStat = (opts.dereference ? fs.statSync : fs.lstatSync)(src);
		if (srcStat.isDirectory()) return onDir(srcStat, destStat, src, dest, opts);
		else if (srcStat.isFile() || srcStat.isCharacterDevice() || srcStat.isBlockDevice()) return onFile(srcStat, destStat, src, dest, opts);
		else if (srcStat.isSymbolicLink()) return onLink(destStat, src, dest, opts);
		else if (srcStat.isSocket()) throw new Error(`Cannot copy a socket file: ${src}`);
		else if (srcStat.isFIFO()) throw new Error(`Cannot copy a FIFO pipe: ${src}`);
		throw new Error(`Unknown file: ${src}`);
	}
	function onFile(srcStat, destStat, src, dest, opts) {
		if (!destStat) return copyFile(srcStat, src, dest, opts);
		return mayCopyFile(srcStat, src, dest, opts);
	}
	function mayCopyFile(srcStat, src, dest, opts) {
		if (opts.overwrite) {
			fs.unlinkSync(dest);
			return copyFile(srcStat, src, dest, opts);
		} else if (opts.errorOnExist) throw new Error(`'${dest}' already exists`);
	}
	function copyFile(srcStat, src, dest, opts) {
		fs.copyFileSync(src, dest);
		if (opts.preserveTimestamps) handleTimestamps(srcStat.mode, src, dest);
		return setDestMode(dest, srcStat.mode);
	}
	function handleTimestamps(srcMode, src, dest) {
		if (fileIsNotWritable(srcMode)) makeFileWritable(dest, srcMode);
		return setDestTimestamps(src, dest);
	}
	function fileIsNotWritable(srcMode) {
		return (srcMode & 128) === 0;
	}
	function makeFileWritable(dest, srcMode) {
		return setDestMode(dest, srcMode | 128);
	}
	function setDestMode(dest, srcMode) {
		return fs.chmodSync(dest, srcMode);
	}
	function setDestTimestamps(src, dest) {
		const updatedSrcStat = fs.statSync(src);
		return utimesMillisSync(dest, updatedSrcStat.atime, updatedSrcStat.mtime);
	}
	function onDir(srcStat, destStat, src, dest, opts) {
		if (!destStat) return mkDirAndCopy(srcStat.mode, src, dest, opts);
		return copyDir(src, dest, opts);
	}
	function mkDirAndCopy(srcMode, src, dest, opts) {
		fs.mkdirSync(dest);
		copyDir(src, dest, opts);
		return setDestMode(dest, srcMode);
	}
	function copyDir(src, dest, opts) {
		fs.readdirSync(src).forEach((item) => copyDirItem(item, src, dest, opts));
	}
	function copyDirItem(item, src, dest, opts) {
		const srcItem = path$20.join(src, item);
		const destItem = path$20.join(dest, item);
		const { destStat } = stat.checkPathsSync(srcItem, destItem, "copy", opts);
		return startCopy(destStat, srcItem, destItem, opts);
	}
	function onLink(destStat, src, dest, opts) {
		let resolvedSrc = fs.readlinkSync(src);
		if (opts.dereference) resolvedSrc = path$20.resolve(process.cwd(), resolvedSrc);
		if (!destStat) return fs.symlinkSync(resolvedSrc, dest);
		else {
			let resolvedDest;
			try {
				resolvedDest = fs.readlinkSync(dest);
			} catch (err) {
				if (err.code === "EINVAL" || err.code === "UNKNOWN") return fs.symlinkSync(resolvedSrc, dest);
				throw err;
			}
			if (opts.dereference) resolvedDest = path$20.resolve(process.cwd(), resolvedDest);
			if (stat.isSrcSubdir(resolvedSrc, resolvedDest)) throw new Error(`Cannot copy '${resolvedSrc}' to a subdirectory of itself, '${resolvedDest}'.`);
			if (fs.statSync(dest).isDirectory() && stat.isSrcSubdir(resolvedDest, resolvedSrc)) throw new Error(`Cannot overwrite '${resolvedDest}' with '${resolvedSrc}'.`);
			return copyLink(resolvedSrc, dest);
		}
	}
	function copyLink(resolvedSrc, dest) {
		fs.unlinkSync(dest);
		return fs.symlinkSync(resolvedSrc, dest);
	}
	module.exports = copySync;
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/copy/index.js
var require_copy = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var u = require_universalify().fromCallback;
	module.exports = {
		copy: u(require_copy$1()),
		copySync: require_copy_sync()
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/remove/rimraf.js
var require_rimraf = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs = require_graceful_fs();
	var path$19 = require("path");
	var assert = require("assert");
	var isWindows = process.platform === "win32";
	function defaults(options) {
		[
			"unlink",
			"chmod",
			"stat",
			"lstat",
			"rmdir",
			"readdir"
		].forEach((m) => {
			options[m] = options[m] || fs[m];
			m = m + "Sync";
			options[m] = options[m] || fs[m];
		});
		options.maxBusyTries = options.maxBusyTries || 3;
	}
	function rimraf(p, options, cb) {
		let busyTries = 0;
		if (typeof options === "function") {
			cb = options;
			options = {};
		}
		assert(p, "rimraf: missing path");
		assert.strictEqual(typeof p, "string", "rimraf: path should be a string");
		assert.strictEqual(typeof cb, "function", "rimraf: callback function required");
		assert(options, "rimraf: invalid options argument provided");
		assert.strictEqual(typeof options, "object", "rimraf: options should be object");
		defaults(options);
		rimraf_(p, options, function CB(er) {
			if (er) {
				if ((er.code === "EBUSY" || er.code === "ENOTEMPTY" || er.code === "EPERM") && busyTries < options.maxBusyTries) {
					busyTries++;
					const time = busyTries * 100;
					return setTimeout(() => rimraf_(p, options, CB), time);
				}
				if (er.code === "ENOENT") er = null;
			}
			cb(er);
		});
	}
	function rimraf_(p, options, cb) {
		assert(p);
		assert(options);
		assert(typeof cb === "function");
		options.lstat(p, (er, st) => {
			if (er && er.code === "ENOENT") return cb(null);
			if (er && er.code === "EPERM" && isWindows) return fixWinEPERM(p, options, er, cb);
			if (st && st.isDirectory()) return rmdir(p, options, er, cb);
			options.unlink(p, (er) => {
				if (er) {
					if (er.code === "ENOENT") return cb(null);
					if (er.code === "EPERM") return isWindows ? fixWinEPERM(p, options, er, cb) : rmdir(p, options, er, cb);
					if (er.code === "EISDIR") return rmdir(p, options, er, cb);
				}
				return cb(er);
			});
		});
	}
	function fixWinEPERM(p, options, er, cb) {
		assert(p);
		assert(options);
		assert(typeof cb === "function");
		options.chmod(p, 438, (er2) => {
			if (er2) cb(er2.code === "ENOENT" ? null : er);
			else options.stat(p, (er3, stats) => {
				if (er3) cb(er3.code === "ENOENT" ? null : er);
				else if (stats.isDirectory()) rmdir(p, options, er, cb);
				else options.unlink(p, cb);
			});
		});
	}
	function fixWinEPERMSync(p, options, er) {
		let stats;
		assert(p);
		assert(options);
		try {
			options.chmodSync(p, 438);
		} catch (er2) {
			if (er2.code === "ENOENT") return;
			else throw er;
		}
		try {
			stats = options.statSync(p);
		} catch (er3) {
			if (er3.code === "ENOENT") return;
			else throw er;
		}
		if (stats.isDirectory()) rmdirSync(p, options, er);
		else options.unlinkSync(p);
	}
	function rmdir(p, options, originalEr, cb) {
		assert(p);
		assert(options);
		assert(typeof cb === "function");
		options.rmdir(p, (er) => {
			if (er && (er.code === "ENOTEMPTY" || er.code === "EEXIST" || er.code === "EPERM")) rmkids(p, options, cb);
			else if (er && er.code === "ENOTDIR") cb(originalEr);
			else cb(er);
		});
	}
	function rmkids(p, options, cb) {
		assert(p);
		assert(options);
		assert(typeof cb === "function");
		options.readdir(p, (er, files) => {
			if (er) return cb(er);
			let n = files.length;
			let errState;
			if (n === 0) return options.rmdir(p, cb);
			files.forEach((f) => {
				rimraf(path$19.join(p, f), options, (er) => {
					if (errState) return;
					if (er) return cb(errState = er);
					if (--n === 0) options.rmdir(p, cb);
				});
			});
		});
	}
	function rimrafSync(p, options) {
		let st;
		options = options || {};
		defaults(options);
		assert(p, "rimraf: missing path");
		assert.strictEqual(typeof p, "string", "rimraf: path should be a string");
		assert(options, "rimraf: missing options");
		assert.strictEqual(typeof options, "object", "rimraf: options should be object");
		try {
			st = options.lstatSync(p);
		} catch (er) {
			if (er.code === "ENOENT") return;
			if (er.code === "EPERM" && isWindows) fixWinEPERMSync(p, options, er);
		}
		try {
			if (st && st.isDirectory()) rmdirSync(p, options, null);
			else options.unlinkSync(p);
		} catch (er) {
			if (er.code === "ENOENT") return;
			else if (er.code === "EPERM") return isWindows ? fixWinEPERMSync(p, options, er) : rmdirSync(p, options, er);
			else if (er.code !== "EISDIR") throw er;
			rmdirSync(p, options, er);
		}
	}
	function rmdirSync(p, options, originalEr) {
		assert(p);
		assert(options);
		try {
			options.rmdirSync(p);
		} catch (er) {
			if (er.code === "ENOTDIR") throw originalEr;
			else if (er.code === "ENOTEMPTY" || er.code === "EEXIST" || er.code === "EPERM") rmkidsSync(p, options);
			else if (er.code !== "ENOENT") throw er;
		}
	}
	function rmkidsSync(p, options) {
		assert(p);
		assert(options);
		options.readdirSync(p).forEach((f) => rimrafSync(path$19.join(p, f), options));
		if (isWindows) {
			const startTime = Date.now();
			do
				try {
					return options.rmdirSync(p, options);
				} catch {}
			while (Date.now() - startTime < 500);
		} else return options.rmdirSync(p, options);
	}
	module.exports = rimraf;
	rimraf.sync = rimrafSync;
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/remove/index.js
var require_remove = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs = require_graceful_fs();
	var u = require_universalify().fromCallback;
	var rimraf = require_rimraf();
	function remove(path, callback) {
		if (fs.rm) return fs.rm(path, {
			recursive: true,
			force: true
		}, callback);
		rimraf(path, callback);
	}
	function removeSync(path) {
		if (fs.rmSync) return fs.rmSync(path, {
			recursive: true,
			force: true
		});
		rimraf.sync(path);
	}
	module.exports = {
		remove: u(remove),
		removeSync
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/empty/index.js
var require_empty = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var u = require_universalify().fromPromise;
	var fs = require_fs();
	var path$18 = require("path");
	var mkdir = require_mkdirs();
	var remove = require_remove();
	var emptyDir = u(async function emptyDir(dir) {
		let items;
		try {
			items = await fs.readdir(dir);
		} catch {
			return mkdir.mkdirs(dir);
		}
		return Promise.all(items.map((item) => remove.remove(path$18.join(dir, item))));
	});
	function emptyDirSync(dir) {
		let items;
		try {
			items = fs.readdirSync(dir);
		} catch {
			return mkdir.mkdirsSync(dir);
		}
		items.forEach((item) => {
			item = path$18.join(dir, item);
			remove.removeSync(item);
		});
	}
	module.exports = {
		emptyDirSync,
		emptydirSync: emptyDirSync,
		emptyDir,
		emptydir: emptyDir
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/ensure/file.js
var require_file = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var u = require_universalify().fromCallback;
	var path$17 = require("path");
	var fs = require_graceful_fs();
	var mkdir = require_mkdirs();
	function createFile(file, callback) {
		function makeFile() {
			fs.writeFile(file, "", (err) => {
				if (err) return callback(err);
				callback();
			});
		}
		fs.stat(file, (err, stats) => {
			if (!err && stats.isFile()) return callback();
			const dir = path$17.dirname(file);
			fs.stat(dir, (err, stats) => {
				if (err) {
					if (err.code === "ENOENT") return mkdir.mkdirs(dir, (err) => {
						if (err) return callback(err);
						makeFile();
					});
					return callback(err);
				}
				if (stats.isDirectory()) makeFile();
				else fs.readdir(dir, (err) => {
					if (err) return callback(err);
				});
			});
		});
	}
	function createFileSync(file) {
		let stats;
		try {
			stats = fs.statSync(file);
		} catch {}
		if (stats && stats.isFile()) return;
		const dir = path$17.dirname(file);
		try {
			if (!fs.statSync(dir).isDirectory()) fs.readdirSync(dir);
		} catch (err) {
			if (err && err.code === "ENOENT") mkdir.mkdirsSync(dir);
			else throw err;
		}
		fs.writeFileSync(file, "");
	}
	module.exports = {
		createFile: u(createFile),
		createFileSync
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/ensure/link.js
var require_link = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var u = require_universalify().fromCallback;
	var path$16 = require("path");
	var fs = require_graceful_fs();
	var mkdir = require_mkdirs();
	var pathExists = require_path_exists().pathExists;
	var { areIdentical } = require_stat();
	function createLink(srcpath, dstpath, callback) {
		function makeLink(srcpath, dstpath) {
			fs.link(srcpath, dstpath, (err) => {
				if (err) return callback(err);
				callback(null);
			});
		}
		fs.lstat(dstpath, (_, dstStat) => {
			fs.lstat(srcpath, (err, srcStat) => {
				if (err) {
					err.message = err.message.replace("lstat", "ensureLink");
					return callback(err);
				}
				if (dstStat && areIdentical(srcStat, dstStat)) return callback(null);
				const dir = path$16.dirname(dstpath);
				pathExists(dir, (err, dirExists) => {
					if (err) return callback(err);
					if (dirExists) return makeLink(srcpath, dstpath);
					mkdir.mkdirs(dir, (err) => {
						if (err) return callback(err);
						makeLink(srcpath, dstpath);
					});
				});
			});
		});
	}
	function createLinkSync(srcpath, dstpath) {
		let dstStat;
		try {
			dstStat = fs.lstatSync(dstpath);
		} catch {}
		try {
			const srcStat = fs.lstatSync(srcpath);
			if (dstStat && areIdentical(srcStat, dstStat)) return;
		} catch (err) {
			err.message = err.message.replace("lstat", "ensureLink");
			throw err;
		}
		const dir = path$16.dirname(dstpath);
		if (fs.existsSync(dir)) return fs.linkSync(srcpath, dstpath);
		mkdir.mkdirsSync(dir);
		return fs.linkSync(srcpath, dstpath);
	}
	module.exports = {
		createLink: u(createLink),
		createLinkSync
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/ensure/symlink-paths.js
var require_symlink_paths = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var path$15 = require("path");
	var fs = require_graceful_fs();
	var pathExists = require_path_exists().pathExists;
	/**
	* Function that returns two types of paths, one relative to symlink, and one
	* relative to the current working directory. Checks if path is absolute or
	* relative. If the path is relative, this function checks if the path is
	* relative to symlink or relative to current working directory. This is an
	* initiative to find a smarter `srcpath` to supply when building symlinks.
	* This allows you to determine which path to use out of one of three possible
	* types of source paths. The first is an absolute path. This is detected by
	* `path.isAbsolute()`. When an absolute path is provided, it is checked to
	* see if it exists. If it does it's used, if not an error is returned
	* (callback)/ thrown (sync). The other two options for `srcpath` are a
	* relative url. By default Node's `fs.symlink` works by creating a symlink
	* using `dstpath` and expects the `srcpath` to be relative to the newly
	* created symlink. If you provide a `srcpath` that does not exist on the file
	* system it results in a broken symlink. To minimize this, the function
	* checks to see if the 'relative to symlink' source file exists, and if it
	* does it will use it. If it does not, it checks if there's a file that
	* exists that is relative to the current working directory, if does its used.
	* This preserves the expectations of the original fs.symlink spec and adds
	* the ability to pass in `relative to current working direcotry` paths.
	*/
	function symlinkPaths(srcpath, dstpath, callback) {
		if (path$15.isAbsolute(srcpath)) return fs.lstat(srcpath, (err) => {
			if (err) {
				err.message = err.message.replace("lstat", "ensureSymlink");
				return callback(err);
			}
			return callback(null, {
				toCwd: srcpath,
				toDst: srcpath
			});
		});
		else {
			const dstdir = path$15.dirname(dstpath);
			const relativeToDst = path$15.join(dstdir, srcpath);
			return pathExists(relativeToDst, (err, exists) => {
				if (err) return callback(err);
				if (exists) return callback(null, {
					toCwd: relativeToDst,
					toDst: srcpath
				});
				else return fs.lstat(srcpath, (err) => {
					if (err) {
						err.message = err.message.replace("lstat", "ensureSymlink");
						return callback(err);
					}
					return callback(null, {
						toCwd: srcpath,
						toDst: path$15.relative(dstdir, srcpath)
					});
				});
			});
		}
	}
	function symlinkPathsSync(srcpath, dstpath) {
		let exists;
		if (path$15.isAbsolute(srcpath)) {
			exists = fs.existsSync(srcpath);
			if (!exists) throw new Error("absolute srcpath does not exist");
			return {
				toCwd: srcpath,
				toDst: srcpath
			};
		} else {
			const dstdir = path$15.dirname(dstpath);
			const relativeToDst = path$15.join(dstdir, srcpath);
			exists = fs.existsSync(relativeToDst);
			if (exists) return {
				toCwd: relativeToDst,
				toDst: srcpath
			};
			else {
				exists = fs.existsSync(srcpath);
				if (!exists) throw new Error("relative srcpath does not exist");
				return {
					toCwd: srcpath,
					toDst: path$15.relative(dstdir, srcpath)
				};
			}
		}
	}
	module.exports = {
		symlinkPaths,
		symlinkPathsSync
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/ensure/symlink-type.js
var require_symlink_type = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs = require_graceful_fs();
	function symlinkType(srcpath, type, callback) {
		callback = typeof type === "function" ? type : callback;
		type = typeof type === "function" ? false : type;
		if (type) return callback(null, type);
		fs.lstat(srcpath, (err, stats) => {
			if (err) return callback(null, "file");
			type = stats && stats.isDirectory() ? "dir" : "file";
			callback(null, type);
		});
	}
	function symlinkTypeSync(srcpath, type) {
		let stats;
		if (type) return type;
		try {
			stats = fs.lstatSync(srcpath);
		} catch {
			return "file";
		}
		return stats && stats.isDirectory() ? "dir" : "file";
	}
	module.exports = {
		symlinkType,
		symlinkTypeSync
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/ensure/symlink.js
var require_symlink = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var u = require_universalify().fromCallback;
	var path$14 = require("path");
	var fs = require_fs();
	var _mkdirs = require_mkdirs();
	var mkdirs = _mkdirs.mkdirs;
	var mkdirsSync = _mkdirs.mkdirsSync;
	var _symlinkPaths = require_symlink_paths();
	var symlinkPaths = _symlinkPaths.symlinkPaths;
	var symlinkPathsSync = _symlinkPaths.symlinkPathsSync;
	var _symlinkType = require_symlink_type();
	var symlinkType = _symlinkType.symlinkType;
	var symlinkTypeSync = _symlinkType.symlinkTypeSync;
	var pathExists = require_path_exists().pathExists;
	var { areIdentical } = require_stat();
	function createSymlink(srcpath, dstpath, type, callback) {
		callback = typeof type === "function" ? type : callback;
		type = typeof type === "function" ? false : type;
		fs.lstat(dstpath, (err, stats) => {
			if (!err && stats.isSymbolicLink()) Promise.all([fs.stat(srcpath), fs.stat(dstpath)]).then(([srcStat, dstStat]) => {
				if (areIdentical(srcStat, dstStat)) return callback(null);
				_createSymlink(srcpath, dstpath, type, callback);
			});
			else _createSymlink(srcpath, dstpath, type, callback);
		});
	}
	function _createSymlink(srcpath, dstpath, type, callback) {
		symlinkPaths(srcpath, dstpath, (err, relative) => {
			if (err) return callback(err);
			srcpath = relative.toDst;
			symlinkType(relative.toCwd, type, (err, type) => {
				if (err) return callback(err);
				const dir = path$14.dirname(dstpath);
				pathExists(dir, (err, dirExists) => {
					if (err) return callback(err);
					if (dirExists) return fs.symlink(srcpath, dstpath, type, callback);
					mkdirs(dir, (err) => {
						if (err) return callback(err);
						fs.symlink(srcpath, dstpath, type, callback);
					});
				});
			});
		});
	}
	function createSymlinkSync(srcpath, dstpath, type) {
		let stats;
		try {
			stats = fs.lstatSync(dstpath);
		} catch {}
		if (stats && stats.isSymbolicLink()) {
			if (areIdentical(fs.statSync(srcpath), fs.statSync(dstpath))) return;
		}
		const relative = symlinkPathsSync(srcpath, dstpath);
		srcpath = relative.toDst;
		type = symlinkTypeSync(relative.toCwd, type);
		const dir = path$14.dirname(dstpath);
		if (fs.existsSync(dir)) return fs.symlinkSync(srcpath, dstpath, type);
		mkdirsSync(dir);
		return fs.symlinkSync(srcpath, dstpath, type);
	}
	module.exports = {
		createSymlink: u(createSymlink),
		createSymlinkSync
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/ensure/index.js
var require_ensure = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { createFile, createFileSync } = require_file();
	var { createLink, createLinkSync } = require_link();
	var { createSymlink, createSymlinkSync } = require_symlink();
	module.exports = {
		createFile,
		createFileSync,
		ensureFile: createFile,
		ensureFileSync: createFileSync,
		createLink,
		createLinkSync,
		ensureLink: createLink,
		ensureLinkSync: createLinkSync,
		createSymlink,
		createSymlinkSync,
		ensureSymlink: createSymlink,
		ensureSymlinkSync: createSymlinkSync
	};
}));
//#endregion
//#region ../../node_modules/jsonfile/utils.js
var require_utils = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function stringify(obj, { EOL = "\n", finalEOL = true, replacer = null, spaces } = {}) {
		const EOF = finalEOL ? EOL : "";
		const str = JSON.stringify(obj, replacer, spaces);
		if (str === void 0) throw new TypeError(`Converting ${typeof obj} value to JSON is not supported`);
		return str.replace(/\n/g, EOL) + EOF;
	}
	function stripBom(content) {
		if (Buffer.isBuffer(content)) content = content.toString("utf8");
		return content.replace(/^\uFEFF/, "");
	}
	module.exports = {
		stringify,
		stripBom
	};
}));
//#endregion
//#region ../../node_modules/jsonfile/index.js
var require_jsonfile$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _fs;
	try {
		_fs = require_graceful_fs();
	} catch (_) {
		_fs = require("fs");
	}
	var universalify = require_universalify();
	var { stringify, stripBom } = require_utils();
	async function _readFile(file, options = {}) {
		if (typeof options === "string") options = { encoding: options };
		const fs = options.fs || _fs;
		const shouldThrow = "throws" in options ? options.throws : true;
		let data = await universalify.fromCallback(fs.readFile)(file, options);
		data = stripBom(data);
		let obj;
		try {
			obj = JSON.parse(data, options ? options.reviver : null);
		} catch (err) {
			if (shouldThrow) {
				err.message = `${file}: ${err.message}`;
				throw err;
			} else return null;
		}
		return obj;
	}
	var readFile = universalify.fromPromise(_readFile);
	function readFileSync(file, options = {}) {
		if (typeof options === "string") options = { encoding: options };
		const fs = options.fs || _fs;
		const shouldThrow = "throws" in options ? options.throws : true;
		try {
			let content = fs.readFileSync(file, options);
			content = stripBom(content);
			return JSON.parse(content, options.reviver);
		} catch (err) {
			if (shouldThrow) {
				err.message = `${file}: ${err.message}`;
				throw err;
			} else return null;
		}
	}
	async function _writeFile(file, obj, options = {}) {
		const fs = options.fs || _fs;
		const str = stringify(obj, options);
		await universalify.fromCallback(fs.writeFile)(file, str, options);
	}
	var writeFile = universalify.fromPromise(_writeFile);
	function writeFileSync(file, obj, options = {}) {
		const fs = options.fs || _fs;
		const str = stringify(obj, options);
		return fs.writeFileSync(file, str, options);
	}
	module.exports = {
		readFile,
		readFileSync,
		writeFile,
		writeFileSync
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/json/jsonfile.js
var require_jsonfile = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var jsonFile = require_jsonfile$1();
	module.exports = {
		readJson: jsonFile.readFile,
		readJsonSync: jsonFile.readFileSync,
		writeJson: jsonFile.writeFile,
		writeJsonSync: jsonFile.writeFileSync
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/output-file/index.js
var require_output_file = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var u = require_universalify().fromCallback;
	var fs = require_graceful_fs();
	var path$13 = require("path");
	var mkdir = require_mkdirs();
	var pathExists = require_path_exists().pathExists;
	function outputFile(file, data, encoding, callback) {
		if (typeof encoding === "function") {
			callback = encoding;
			encoding = "utf8";
		}
		const dir = path$13.dirname(file);
		pathExists(dir, (err, itDoes) => {
			if (err) return callback(err);
			if (itDoes) return fs.writeFile(file, data, encoding, callback);
			mkdir.mkdirs(dir, (err) => {
				if (err) return callback(err);
				fs.writeFile(file, data, encoding, callback);
			});
		});
	}
	function outputFileSync(file, ...args) {
		const dir = path$13.dirname(file);
		if (fs.existsSync(dir)) return fs.writeFileSync(file, ...args);
		mkdir.mkdirsSync(dir);
		fs.writeFileSync(file, ...args);
	}
	module.exports = {
		outputFile: u(outputFile),
		outputFileSync
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/json/output-json.js
var require_output_json = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { stringify } = require_utils();
	var { outputFile } = require_output_file();
	async function outputJson(file, data, options = {}) {
		await outputFile(file, stringify(data, options), options);
	}
	module.exports = outputJson;
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/json/output-json-sync.js
var require_output_json_sync = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { stringify } = require_utils();
	var { outputFileSync } = require_output_file();
	function outputJsonSync(file, data, options) {
		outputFileSync(file, stringify(data, options), options);
	}
	module.exports = outputJsonSync;
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/json/index.js
var require_json$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var u = require_universalify().fromPromise;
	var jsonFile = require_jsonfile();
	jsonFile.outputJson = u(require_output_json());
	jsonFile.outputJsonSync = require_output_json_sync();
	jsonFile.outputJSON = jsonFile.outputJson;
	jsonFile.outputJSONSync = jsonFile.outputJsonSync;
	jsonFile.writeJSON = jsonFile.writeJson;
	jsonFile.writeJSONSync = jsonFile.writeJsonSync;
	jsonFile.readJSON = jsonFile.readJson;
	jsonFile.readJSONSync = jsonFile.readJsonSync;
	module.exports = jsonFile;
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/move/move.js
var require_move$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs = require_graceful_fs();
	var path$12 = require("path");
	var copy = require_copy().copy;
	var remove = require_remove().remove;
	var mkdirp = require_mkdirs().mkdirp;
	var pathExists = require_path_exists().pathExists;
	var stat = require_stat();
	function move(src, dest, opts, cb) {
		if (typeof opts === "function") {
			cb = opts;
			opts = {};
		}
		opts = opts || {};
		const overwrite = opts.overwrite || opts.clobber || false;
		stat.checkPaths(src, dest, "move", opts, (err, stats) => {
			if (err) return cb(err);
			const { srcStat, isChangingCase = false } = stats;
			stat.checkParentPaths(src, srcStat, dest, "move", (err) => {
				if (err) return cb(err);
				if (isParentRoot(dest)) return doRename(src, dest, overwrite, isChangingCase, cb);
				mkdirp(path$12.dirname(dest), (err) => {
					if (err) return cb(err);
					return doRename(src, dest, overwrite, isChangingCase, cb);
				});
			});
		});
	}
	function isParentRoot(dest) {
		const parent = path$12.dirname(dest);
		return path$12.parse(parent).root === parent;
	}
	function doRename(src, dest, overwrite, isChangingCase, cb) {
		if (isChangingCase) return rename(src, dest, overwrite, cb);
		if (overwrite) return remove(dest, (err) => {
			if (err) return cb(err);
			return rename(src, dest, overwrite, cb);
		});
		pathExists(dest, (err, destExists) => {
			if (err) return cb(err);
			if (destExists) return cb(/* @__PURE__ */ new Error("dest already exists."));
			return rename(src, dest, overwrite, cb);
		});
	}
	function rename(src, dest, overwrite, cb) {
		fs.rename(src, dest, (err) => {
			if (!err) return cb();
			if (err.code !== "EXDEV") return cb(err);
			return moveAcrossDevice(src, dest, overwrite, cb);
		});
	}
	function moveAcrossDevice(src, dest, overwrite, cb) {
		copy(src, dest, {
			overwrite,
			errorOnExist: true
		}, (err) => {
			if (err) return cb(err);
			return remove(src, cb);
		});
	}
	module.exports = move;
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/move/move-sync.js
var require_move_sync = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs = require_graceful_fs();
	var path$11 = require("path");
	var copySync = require_copy().copySync;
	var removeSync = require_remove().removeSync;
	var mkdirpSync = require_mkdirs().mkdirpSync;
	var stat = require_stat();
	function moveSync(src, dest, opts) {
		opts = opts || {};
		const overwrite = opts.overwrite || opts.clobber || false;
		const { srcStat, isChangingCase = false } = stat.checkPathsSync(src, dest, "move", opts);
		stat.checkParentPathsSync(src, srcStat, dest, "move");
		if (!isParentRoot(dest)) mkdirpSync(path$11.dirname(dest));
		return doRename(src, dest, overwrite, isChangingCase);
	}
	function isParentRoot(dest) {
		const parent = path$11.dirname(dest);
		return path$11.parse(parent).root === parent;
	}
	function doRename(src, dest, overwrite, isChangingCase) {
		if (isChangingCase) return rename(src, dest, overwrite);
		if (overwrite) {
			removeSync(dest);
			return rename(src, dest, overwrite);
		}
		if (fs.existsSync(dest)) throw new Error("dest already exists.");
		return rename(src, dest, overwrite);
	}
	function rename(src, dest, overwrite) {
		try {
			fs.renameSync(src, dest);
		} catch (err) {
			if (err.code !== "EXDEV") throw err;
			return moveAcrossDevice(src, dest, overwrite);
		}
	}
	function moveAcrossDevice(src, dest, overwrite) {
		copySync(src, dest, {
			overwrite,
			errorOnExist: true
		});
		return removeSync(src);
	}
	module.exports = moveSync;
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/move/index.js
var require_move = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var u = require_universalify().fromCallback;
	module.exports = {
		move: u(require_move$1()),
		moveSync: require_move_sync()
	};
}));
//#endregion
//#region ../../node_modules/fs-extra/lib/index.js
var require_lib = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = {
		...require_fs(),
		...require_copy(),
		...require_empty(),
		...require_ensure(),
		...require_json$1(),
		...require_mkdirs(),
		...require_move(),
		...require_output_file(),
		...require_path_exists(),
		...require_remove()
	};
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/builder-util-runtime/out/CancellationToken.js
var require_CancellationToken = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.CancellationError = exports.CancellationToken = void 0;
	var events_1$1 = require("events");
	var CancellationToken = class extends events_1$1.EventEmitter {
		get cancelled() {
			return this._cancelled || this._parent != null && this._parent.cancelled;
		}
		set parent(value) {
			this.removeParentCancelHandler();
			this._parent = value;
			this.parentCancelHandler = () => this.cancel();
			this._parent.onCancel(this.parentCancelHandler);
		}
		constructor(parent) {
			super();
			this.parentCancelHandler = null;
			this._parent = null;
			this._cancelled = false;
			if (parent != null) this.parent = parent;
		}
		cancel() {
			this._cancelled = true;
			this.emit("cancel");
		}
		onCancel(handler) {
			if (this.cancelled) handler();
			else this.once("cancel", handler);
		}
		createPromise(callback) {
			if (this.cancelled) return Promise.reject(new CancellationError());
			const finallyHandler = () => {
				if (cancelHandler != null) try {
					this.removeListener("cancel", cancelHandler);
					cancelHandler = null;
				} catch (_ignore) {}
			};
			let cancelHandler = null;
			return new Promise((resolve, reject) => {
				let addedCancelHandler = null;
				cancelHandler = () => {
					try {
						if (addedCancelHandler != null) {
							addedCancelHandler();
							addedCancelHandler = null;
						}
					} finally {
						reject(new CancellationError());
					}
				};
				if (this.cancelled) {
					cancelHandler();
					return;
				}
				this.onCancel(cancelHandler);
				callback(resolve, reject, (callback) => {
					addedCancelHandler = callback;
				});
			}).then((it) => {
				finallyHandler();
				return it;
			}).catch((e) => {
				finallyHandler();
				throw e;
			});
		}
		removeParentCancelHandler() {
			const parent = this._parent;
			if (parent != null && this.parentCancelHandler != null) {
				parent.removeListener("cancel", this.parentCancelHandler);
				this.parentCancelHandler = null;
			}
		}
		dispose() {
			try {
				this.removeParentCancelHandler();
			} finally {
				this.removeAllListeners();
				this._parent = null;
			}
		}
	};
	exports.CancellationToken = CancellationToken;
	var CancellationError = class extends Error {
		constructor() {
			super("cancelled");
		}
	};
	exports.CancellationError = CancellationError;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/builder-util-runtime/out/error.js
var require_error = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.newError = newError;
	function newError(message, code) {
		const error = new Error(message);
		error.code = code;
		return error;
	}
}));
//#endregion
//#region ../../node_modules/ms/index.js
var require_ms = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Helpers.
	*/
	var s = 1e3;
	var m = s * 60;
	var h = m * 60;
	var d = h * 24;
	var w = d * 7;
	var y = d * 365.25;
	/**
	* Parse or format the given `val`.
	*
	* Options:
	*
	*  - `long` verbose formatting [false]
	*
	* @param {String|Number} val
	* @param {Object} [options]
	* @throws {Error} throw an error if val is not a non-empty string or a number
	* @return {String|Number}
	* @api public
	*/
	module.exports = function(val, options) {
		options = options || {};
		var type = typeof val;
		if (type === "string" && val.length > 0) return parse(val);
		else if (type === "number" && isFinite(val)) return options.long ? fmtLong(val) : fmtShort(val);
		throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(val));
	};
	/**
	* Parse the given `str` and return milliseconds.
	*
	* @param {String} str
	* @return {Number}
	* @api private
	*/
	function parse(str) {
		str = String(str);
		if (str.length > 100) return;
		var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
		if (!match) return;
		var n = parseFloat(match[1]);
		switch ((match[2] || "ms").toLowerCase()) {
			case "years":
			case "year":
			case "yrs":
			case "yr":
			case "y": return n * y;
			case "weeks":
			case "week":
			case "w": return n * w;
			case "days":
			case "day":
			case "d": return n * d;
			case "hours":
			case "hour":
			case "hrs":
			case "hr":
			case "h": return n * h;
			case "minutes":
			case "minute":
			case "mins":
			case "min":
			case "m": return n * m;
			case "seconds":
			case "second":
			case "secs":
			case "sec":
			case "s": return n * s;
			case "milliseconds":
			case "millisecond":
			case "msecs":
			case "msec":
			case "ms": return n;
			default: return;
		}
	}
	/**
	* Short format for `ms`.
	*
	* @param {Number} ms
	* @return {String}
	* @api private
	*/
	function fmtShort(ms) {
		var msAbs = Math.abs(ms);
		if (msAbs >= d) return Math.round(ms / d) + "d";
		if (msAbs >= h) return Math.round(ms / h) + "h";
		if (msAbs >= m) return Math.round(ms / m) + "m";
		if (msAbs >= s) return Math.round(ms / s) + "s";
		return ms + "ms";
	}
	/**
	* Long format for `ms`.
	*
	* @param {Number} ms
	* @return {String}
	* @api private
	*/
	function fmtLong(ms) {
		var msAbs = Math.abs(ms);
		if (msAbs >= d) return plural(ms, msAbs, d, "day");
		if (msAbs >= h) return plural(ms, msAbs, h, "hour");
		if (msAbs >= m) return plural(ms, msAbs, m, "minute");
		if (msAbs >= s) return plural(ms, msAbs, s, "second");
		return ms + " ms";
	}
	/**
	* Pluralization helper.
	*/
	function plural(ms, msAbs, n, name) {
		var isPlural = msAbs >= n * 1.5;
		return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
	}
}));
//#endregion
//#region ../../node_modules/debug/src/common.js
var require_common$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* This is the common logic for both the Node.js and web browser
	* implementations of `debug()`.
	*/
	function setup(env) {
		createDebug.debug = createDebug;
		createDebug.default = createDebug;
		createDebug.coerce = coerce;
		createDebug.disable = disable;
		createDebug.enable = enable;
		createDebug.enabled = enabled;
		createDebug.humanize = require_ms();
		createDebug.destroy = destroy;
		Object.keys(env).forEach((key) => {
			createDebug[key] = env[key];
		});
		/**
		* The currently active debug mode names, and names to skip.
		*/
		createDebug.names = [];
		createDebug.skips = [];
		/**
		* Map of special "%n" handling functions, for the debug "format" argument.
		*
		* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
		*/
		createDebug.formatters = {};
		/**
		* Selects a color for a debug namespace
		* @param {String} namespace The namespace string for the debug instance to be colored
		* @return {Number|String} An ANSI color code for the given namespace
		* @api private
		*/
		function selectColor(namespace) {
			let hash = 0;
			for (let i = 0; i < namespace.length; i++) {
				hash = (hash << 5) - hash + namespace.charCodeAt(i);
				hash |= 0;
			}
			return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
		}
		createDebug.selectColor = selectColor;
		/**
		* Create a debugger with the given `namespace`.
		*
		* @param {String} namespace
		* @return {Function}
		* @api public
		*/
		function createDebug(namespace) {
			let prevTime;
			let enableOverride = null;
			let namespacesCache;
			let enabledCache;
			function debug(...args) {
				if (!debug.enabled) return;
				const self = debug;
				const curr = Number(/* @__PURE__ */ new Date());
				self.diff = curr - (prevTime || curr);
				self.prev = prevTime;
				self.curr = curr;
				prevTime = curr;
				args[0] = createDebug.coerce(args[0]);
				if (typeof args[0] !== "string") args.unshift("%O");
				let index = 0;
				args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
					if (match === "%%") return "%";
					index++;
					const formatter = createDebug.formatters[format];
					if (typeof formatter === "function") {
						const val = args[index];
						match = formatter.call(self, val);
						args.splice(index, 1);
						index--;
					}
					return match;
				});
				createDebug.formatArgs.call(self, args);
				(self.log || createDebug.log).apply(self, args);
			}
			debug.namespace = namespace;
			debug.useColors = createDebug.useColors();
			debug.color = createDebug.selectColor(namespace);
			debug.extend = extend;
			debug.destroy = createDebug.destroy;
			Object.defineProperty(debug, "enabled", {
				enumerable: true,
				configurable: false,
				get: () => {
					if (enableOverride !== null) return enableOverride;
					if (namespacesCache !== createDebug.namespaces) {
						namespacesCache = createDebug.namespaces;
						enabledCache = createDebug.enabled(namespace);
					}
					return enabledCache;
				},
				set: (v) => {
					enableOverride = v;
				}
			});
			if (typeof createDebug.init === "function") createDebug.init(debug);
			return debug;
		}
		function extend(namespace, delimiter) {
			const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
			newDebug.log = this.log;
			return newDebug;
		}
		/**
		* Enables a debug mode by namespaces. This can include modes
		* separated by a colon and wildcards.
		*
		* @param {String} namespaces
		* @api public
		*/
		function enable(namespaces) {
			createDebug.save(namespaces);
			createDebug.namespaces = namespaces;
			createDebug.names = [];
			createDebug.skips = [];
			const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
			for (const ns of split) if (ns[0] === "-") createDebug.skips.push(ns.slice(1));
			else createDebug.names.push(ns);
		}
		/**
		* Checks if the given string matches a namespace template, honoring
		* asterisks as wildcards.
		*
		* @param {String} search
		* @param {String} template
		* @return {Boolean}
		*/
		function matchesTemplate(search, template) {
			let searchIndex = 0;
			let templateIndex = 0;
			let starIndex = -1;
			let matchIndex = 0;
			while (searchIndex < search.length) if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) if (template[templateIndex] === "*") {
				starIndex = templateIndex;
				matchIndex = searchIndex;
				templateIndex++;
			} else {
				searchIndex++;
				templateIndex++;
			}
			else if (starIndex !== -1) {
				templateIndex = starIndex + 1;
				matchIndex++;
				searchIndex = matchIndex;
			} else return false;
			while (templateIndex < template.length && template[templateIndex] === "*") templateIndex++;
			return templateIndex === template.length;
		}
		/**
		* Disable debug output.
		*
		* @return {String} namespaces
		* @api public
		*/
		function disable() {
			const namespaces = [...createDebug.names, ...createDebug.skips.map((namespace) => "-" + namespace)].join(",");
			createDebug.enable("");
			return namespaces;
		}
		/**
		* Returns true if the given mode name is enabled, false otherwise.
		*
		* @param {String} name
		* @return {Boolean}
		* @api public
		*/
		function enabled(name) {
			for (const skip of createDebug.skips) if (matchesTemplate(name, skip)) return false;
			for (const ns of createDebug.names) if (matchesTemplate(name, ns)) return true;
			return false;
		}
		/**
		* Coerce `val`.
		*
		* @param {Mixed} val
		* @return {Mixed}
		* @api private
		*/
		function coerce(val) {
			if (val instanceof Error) return val.stack || val.message;
			return val;
		}
		/**
		* XXX DO NOT USE. This is a temporary stub function.
		* XXX It WILL be removed in the next major release.
		*/
		function destroy() {
			console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
		}
		createDebug.enable(createDebug.load());
		return createDebug;
	}
	module.exports = setup;
}));
//#endregion
//#region ../../node_modules/debug/src/browser.js
var require_browser = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* This is the web browser implementation of `debug()`.
	*/
	exports.formatArgs = formatArgs;
	exports.save = save;
	exports.load = load;
	exports.useColors = useColors;
	exports.storage = localstorage();
	exports.destroy = (() => {
		let warned = false;
		return () => {
			if (!warned) {
				warned = true;
				console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
			}
		};
	})();
	/**
	* Colors.
	*/
	exports.colors = [
		"#0000CC",
		"#0000FF",
		"#0033CC",
		"#0033FF",
		"#0066CC",
		"#0066FF",
		"#0099CC",
		"#0099FF",
		"#00CC00",
		"#00CC33",
		"#00CC66",
		"#00CC99",
		"#00CCCC",
		"#00CCFF",
		"#3300CC",
		"#3300FF",
		"#3333CC",
		"#3333FF",
		"#3366CC",
		"#3366FF",
		"#3399CC",
		"#3399FF",
		"#33CC00",
		"#33CC33",
		"#33CC66",
		"#33CC99",
		"#33CCCC",
		"#33CCFF",
		"#6600CC",
		"#6600FF",
		"#6633CC",
		"#6633FF",
		"#66CC00",
		"#66CC33",
		"#9900CC",
		"#9900FF",
		"#9933CC",
		"#9933FF",
		"#99CC00",
		"#99CC33",
		"#CC0000",
		"#CC0033",
		"#CC0066",
		"#CC0099",
		"#CC00CC",
		"#CC00FF",
		"#CC3300",
		"#CC3333",
		"#CC3366",
		"#CC3399",
		"#CC33CC",
		"#CC33FF",
		"#CC6600",
		"#CC6633",
		"#CC9900",
		"#CC9933",
		"#CCCC00",
		"#CCCC33",
		"#FF0000",
		"#FF0033",
		"#FF0066",
		"#FF0099",
		"#FF00CC",
		"#FF00FF",
		"#FF3300",
		"#FF3333",
		"#FF3366",
		"#FF3399",
		"#FF33CC",
		"#FF33FF",
		"#FF6600",
		"#FF6633",
		"#FF9900",
		"#FF9933",
		"#FFCC00",
		"#FFCC33"
	];
	/**
	* Currently only WebKit-based Web Inspectors, Firefox >= v31,
	* and the Firebug extension (any Firefox version) are known
	* to support "%c" CSS customizations.
	*
	* TODO: add a `localStorage` variable to explicitly enable/disable colors
	*/
	function useColors() {
		if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) return true;
		if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) return false;
		let m;
		return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
	}
	/**
	* Colorize log arguments if enabled.
	*
	* @api public
	*/
	function formatArgs(args) {
		args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
		if (!this.useColors) return;
		const c = "color: " + this.color;
		args.splice(1, 0, c, "color: inherit");
		let index = 0;
		let lastC = 0;
		args[0].replace(/%[a-zA-Z%]/g, (match) => {
			if (match === "%%") return;
			index++;
			if (match === "%c") lastC = index;
		});
		args.splice(lastC, 0, c);
	}
	/**
	* Invokes `console.debug()` when available.
	* No-op when `console.debug` is not a "function".
	* If `console.debug` is not available, falls back
	* to `console.log`.
	*
	* @api public
	*/
	exports.log = console.debug || console.log || (() => {});
	/**
	* Save `namespaces`.
	*
	* @param {String} namespaces
	* @api private
	*/
	function save(namespaces) {
		try {
			if (namespaces) exports.storage.setItem("debug", namespaces);
			else exports.storage.removeItem("debug");
		} catch (error) {}
	}
	/**
	* Load `namespaces`.
	*
	* @return {String} returns the previously persisted debug modes
	* @api private
	*/
	function load() {
		let r;
		try {
			r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
		} catch (error) {}
		if (!r && typeof process !== "undefined" && "env" in process) r = process.env.DEBUG;
		return r;
	}
	/**
	* Localstorage attempts to return the localstorage.
	*
	* This is necessary because safari throws
	* when a user disables cookies/localstorage
	* and you attempt to access it.
	*
	* @return {LocalStorage}
	* @api private
	*/
	function localstorage() {
		try {
			return localStorage;
		} catch (error) {}
	}
	module.exports = require_common$1()(exports);
	var { formatters } = module.exports;
	/**
	* Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
	*/
	formatters.j = function(v) {
		try {
			return JSON.stringify(v);
		} catch (error) {
			return "[UnexpectedJSONParseError]: " + error.message;
		}
	};
}));
//#endregion
//#region ../../node_modules/has-flag/index.js
var require_has_flag = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = (flag, argv = process.argv) => {
		const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
		const position = argv.indexOf(prefix + flag);
		const terminatorPosition = argv.indexOf("--");
		return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
	};
}));
//#endregion
//#region ../../node_modules/supports-color/index.js
var require_supports_color = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var os$1 = require("os");
	var tty$1 = require("tty");
	var hasFlag = require_has_flag();
	var { env } = process;
	var forceColor;
	if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) forceColor = 0;
	else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) forceColor = 1;
	if ("FORCE_COLOR" in env) if (env.FORCE_COLOR === "true") forceColor = 1;
	else if (env.FORCE_COLOR === "false") forceColor = 0;
	else forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
	function translateLevel(level) {
		if (level === 0) return false;
		return {
			level,
			hasBasic: true,
			has256: level >= 2,
			has16m: level >= 3
		};
	}
	function supportsColor(haveStream, streamIsTTY) {
		if (forceColor === 0) return 0;
		if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) return 3;
		if (hasFlag("color=256")) return 2;
		if (haveStream && !streamIsTTY && forceColor === void 0) return 0;
		const min = forceColor || 0;
		if (env.TERM === "dumb") return min;
		if (process.platform === "win32") {
			const osRelease = os$1.release().split(".");
			if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) return Number(osRelease[2]) >= 14931 ? 3 : 2;
			return 1;
		}
		if ("CI" in env) {
			if ([
				"TRAVIS",
				"CIRCLECI",
				"APPVEYOR",
				"GITLAB_CI",
				"GITHUB_ACTIONS",
				"BUILDKITE"
			].some((sign) => sign in env) || env.CI_NAME === "codeship") return 1;
			return min;
		}
		if ("TEAMCITY_VERSION" in env) return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
		if (env.COLORTERM === "truecolor") return 3;
		if ("TERM_PROGRAM" in env) {
			const version = parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
			switch (env.TERM_PROGRAM) {
				case "iTerm.app": return version >= 3 ? 3 : 2;
				case "Apple_Terminal": return 2;
			}
		}
		if (/-256(color)?$/i.test(env.TERM)) return 2;
		if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) return 1;
		if ("COLORTERM" in env) return 1;
		return min;
	}
	function getSupportLevel(stream) {
		return translateLevel(supportsColor(stream, stream && stream.isTTY));
	}
	module.exports = {
		supportsColor: getSupportLevel,
		stdout: translateLevel(supportsColor(true, tty$1.isatty(1))),
		stderr: translateLevel(supportsColor(true, tty$1.isatty(2)))
	};
}));
//#endregion
//#region ../../node_modules/debug/src/node.js
var require_node = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Module dependencies.
	*/
	var tty = require("tty");
	var util = require("util");
	/**
	* This is the Node.js implementation of `debug()`.
	*/
	exports.init = init;
	exports.log = log;
	exports.formatArgs = formatArgs;
	exports.save = save;
	exports.load = load;
	exports.useColors = useColors;
	exports.destroy = util.deprecate(() => {}, "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
	/**
	* Colors.
	*/
	exports.colors = [
		6,
		2,
		3,
		4,
		5,
		1
	];
	try {
		const supportsColor = require_supports_color();
		if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) exports.colors = [
			20,
			21,
			26,
			27,
			32,
			33,
			38,
			39,
			40,
			41,
			42,
			43,
			44,
			45,
			56,
			57,
			62,
			63,
			68,
			69,
			74,
			75,
			76,
			77,
			78,
			79,
			80,
			81,
			92,
			93,
			98,
			99,
			112,
			113,
			128,
			129,
			134,
			135,
			148,
			149,
			160,
			161,
			162,
			163,
			164,
			165,
			166,
			167,
			168,
			169,
			170,
			171,
			172,
			173,
			178,
			179,
			184,
			185,
			196,
			197,
			198,
			199,
			200,
			201,
			202,
			203,
			204,
			205,
			206,
			207,
			208,
			209,
			214,
			215,
			220,
			221
		];
	} catch (error) {}
	/**
	* Build up the default `inspectOpts` object from the environment variables.
	*
	*   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
	*/
	exports.inspectOpts = Object.keys(process.env).filter((key) => {
		return /^debug_/i.test(key);
	}).reduce((obj, key) => {
		const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
			return k.toUpperCase();
		});
		let val = process.env[key];
		if (/^(yes|on|true|enabled)$/i.test(val)) val = true;
		else if (/^(no|off|false|disabled)$/i.test(val)) val = false;
		else if (val === "null") val = null;
		else val = Number(val);
		obj[prop] = val;
		return obj;
	}, {});
	/**
	* Is stdout a TTY? Colored output is enabled when `true`.
	*/
	function useColors() {
		return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
	}
	/**
	* Adds ANSI color escape codes if enabled.
	*
	* @api public
	*/
	function formatArgs(args) {
		const { namespace: name, useColors } = this;
		if (useColors) {
			const c = this.color;
			const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
			const prefix = `  ${colorCode};1m${name} \u001B[0m`;
			args[0] = prefix + args[0].split("\n").join("\n" + prefix);
			args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
		} else args[0] = getDate() + name + " " + args[0];
	}
	function getDate() {
		if (exports.inspectOpts.hideDate) return "";
		return (/* @__PURE__ */ new Date()).toISOString() + " ";
	}
	/**
	* Invokes `util.formatWithOptions()` with the specified arguments and writes to stderr.
	*/
	function log(...args) {
		return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + "\n");
	}
	/**
	* Save `namespaces`.
	*
	* @param {String} namespaces
	* @api private
	*/
	function save(namespaces) {
		if (namespaces) process.env.DEBUG = namespaces;
		else delete process.env.DEBUG;
	}
	/**
	* Load `namespaces`.
	*
	* @return {String} returns the previously persisted debug modes
	* @api private
	*/
	function load() {
		return process.env.DEBUG;
	}
	/**
	* Init logic for `debug` instances.
	*
	* Create a new `inspectOpts` object in case `useColors` is set
	* differently for a particular `debug` instance.
	*/
	function init(debug) {
		debug.inspectOpts = {};
		const keys = Object.keys(exports.inspectOpts);
		for (let i = 0; i < keys.length; i++) debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
	}
	module.exports = require_common$1()(exports);
	var { formatters } = module.exports;
	/**
	* Map %o to `util.inspect()`, all on a single line.
	*/
	formatters.o = function(v) {
		this.inspectOpts.colors = this.useColors;
		return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
	};
	/**
	* Map %O to `util.inspect()`, allowing multiple lines if needed.
	*/
	formatters.O = function(v) {
		this.inspectOpts.colors = this.useColors;
		return util.inspect(v, this.inspectOpts);
	};
}));
//#endregion
//#region ../../node_modules/debug/src/index.js
var require_src = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Detect Electron renderer / nwjs process, which is node, but we should
	* treat as a browser.
	*/
	if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) module.exports = require_browser();
	else module.exports = require_node();
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/builder-util-runtime/out/ProgressCallbackTransform.js
var require_ProgressCallbackTransform = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ProgressCallbackTransform = void 0;
	var stream_1$3 = require("stream");
	var ProgressCallbackTransform = class extends stream_1$3.Transform {
		constructor(total, cancellationToken, onProgress) {
			super();
			this.total = total;
			this.cancellationToken = cancellationToken;
			this.onProgress = onProgress;
			this.start = Date.now();
			this.transferred = 0;
			this.delta = 0;
			this.nextUpdate = this.start + 1e3;
		}
		_transform(chunk, encoding, callback) {
			if (this.cancellationToken.cancelled) {
				callback(/* @__PURE__ */ new Error("cancelled"), null);
				return;
			}
			this.transferred += chunk.length;
			this.delta += chunk.length;
			const now = Date.now();
			if (now >= this.nextUpdate && this.transferred !== this.total) {
				this.nextUpdate = now + 1e3;
				this.onProgress({
					total: this.total,
					delta: this.delta,
					transferred: this.transferred,
					percent: this.transferred / this.total * 100,
					bytesPerSecond: Math.round(this.transferred / ((now - this.start) / 1e3))
				});
				this.delta = 0;
			}
			callback(null, chunk);
		}
		_flush(callback) {
			if (this.cancellationToken.cancelled) {
				callback(/* @__PURE__ */ new Error("cancelled"));
				return;
			}
			this.onProgress({
				total: this.total,
				delta: this.delta,
				transferred: this.total,
				percent: 100,
				bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1e3))
			});
			this.delta = 0;
			callback(null);
		}
	};
	exports.ProgressCallbackTransform = ProgressCallbackTransform;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/builder-util-runtime/out/httpExecutor.js
var require_httpExecutor = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.DigestTransform = exports.HttpExecutor = exports.HttpError = void 0;
	exports.addSensitiveRedirectHeader = addSensitiveRedirectHeader;
	exports.addSensitiveFieldPattern = addSensitiveFieldPattern;
	exports.createHttpError = createHttpError;
	exports.parseJson = parseJson;
	exports.configureRequestOptionsFromUrl = configureRequestOptionsFromUrl;
	exports.configureRequestUrl = configureRequestUrl;
	exports.safeGetHeader = safeGetHeader;
	exports.configureRequestOptions = configureRequestOptions;
	exports.isSensitiveFieldName = isSensitiveFieldName;
	exports.hashSensitiveValue = hashSensitiveValue;
	exports.safeStringifyJson = safeStringifyJson;
	var crypto_1$4 = require("crypto");
	var debug_1 = require_src();
	var fs_1$5 = require("fs");
	var stream_1$2 = require("stream");
	var url_1$7 = require("url");
	var CancellationToken_1 = require_CancellationToken();
	var error_1 = require_error();
	var ProgressCallbackTransform_1 = require_ProgressCallbackTransform();
	var debug = (0, debug_1.default)("electron-builder");
	var normalizeName = (name) => name.toLowerCase().replace(/[-_]/g, "");
	var SENSITIVE_REDIRECT_HEADERS = new Set([
		"authorization",
		"proxyauthorization",
		"privatetoken",
		"xapikey",
		"xauthtoken",
		"xaccesstoken",
		"xgitlabtoken",
		"cookie",
		"xcsrftoken"
	]);
	var SENSITIVE_FIELD_PATTERNS = [
		"token",
		"password",
		"secret",
		"authorization",
		"credential",
		"apikey",
		"passphrase",
		"auth"
	];
	var SENSITIVE_FIELD_SUFFIXES = ["key"];
	/**
	* Register an additional HTTP header to strip on cross-origin redirects.
	* Intended for custom publishers (e.g. GenericPublisher with a non-standard auth header).
	*/
	function addSensitiveRedirectHeader(header) {
		SENSITIVE_REDIRECT_HEADERS.add(normalizeName(header));
	}
	/**
	* Register an additional substring pattern used by {@link safeStringifyJson} to
	* identify sensitive field names. Input is normalized (lowercased, separators stripped).
	* Intended for custom publishers that store credentials under non-standard field names.
	*/
	function addSensitiveFieldPattern(pattern) {
		SENSITIVE_FIELD_PATTERNS.push(pattern.toLowerCase().replace(/[-_]/g, ""));
	}
	function createHttpError(response, description = null) {
		return new HttpError(response.statusCode || -1, `${response.statusCode} ${response.statusMessage}` + (description == null ? "" : "\n" + JSON.stringify(description, null, "  ")) + "\nHeaders: " + safeStringifyJson(response.headers), description);
	}
	var HTTP_STATUS_CODES = new Map([
		[429, "Too many requests"],
		[400, "Bad request"],
		[403, "Forbidden"],
		[404, "Not found"],
		[405, "Method not allowed"],
		[406, "Not acceptable"],
		[408, "Request timeout"],
		[413, "Request entity too large"],
		[500, "Internal server error"],
		[502, "Bad gateway"],
		[503, "Service unavailable"],
		[504, "Gateway timeout"],
		[505, "HTTP version not supported"]
	]);
	var HttpError = class extends Error {
		constructor(statusCode, message = `HTTP error: ${HTTP_STATUS_CODES.get(statusCode) || statusCode}`, description = null) {
			super(message);
			this.statusCode = statusCode;
			this.description = description;
			this.name = "HttpError";
			this.code = `HTTP_ERROR_${statusCode}`;
		}
		isServerError() {
			return this.statusCode >= 500 && this.statusCode <= 599;
		}
	};
	exports.HttpError = HttpError;
	function parseJson(result) {
		return result.then((it) => it == null || it.length === 0 ? null : JSON.parse(it));
	}
	exports.HttpExecutor = class HttpExecutor {
		constructor() {
			this.maxRedirects = 10;
		}
		request(options, cancellationToken = new CancellationToken_1.CancellationToken(), data) {
			configureRequestOptions(options);
			const json = data == null ? void 0 : JSON.stringify(data);
			const encodedData = json ? Buffer.from(json) : void 0;
			if (encodedData != null) {
				if (debug.enabled) debug(safeStringifyJson(data));
				const { headers, ...opts } = options;
				options = {
					method: "post",
					headers: {
						"Content-Type": "application/json",
						"Content-Length": encodedData.length,
						...headers
					},
					...opts
				};
			}
			return this.doApiRequest(options, cancellationToken, (it) => it.end(encodedData));
		}
		doApiRequest(options, cancellationToken, requestProcessor, redirectCount = 0) {
			if (debug.enabled) {
				const { headers: _headers, auth: _auth, ...safeOptions } = options;
				debug(`Request: ${safeStringifyJson(safeOptions)}`);
			}
			return cancellationToken.createPromise((resolve, reject, onCancel) => {
				const request = this.createRequest(options, (response) => {
					try {
						this.handleResponse(response, options, cancellationToken, resolve, reject, redirectCount, requestProcessor);
					} catch (e) {
						reject(e);
					}
				});
				this.addErrorAndTimeoutHandlers(request, reject, options.timeout);
				this.addRedirectHandlers(request, options, reject, redirectCount, (options) => {
					this.doApiRequest(options, cancellationToken, requestProcessor, redirectCount).then(resolve).catch(reject);
				});
				requestProcessor(request, reject);
				onCancel(() => request.abort());
			});
		}
		addRedirectHandlers(request, options, reject, redirectCount, handler) {}
		addErrorAndTimeoutHandlers(request, reject, timeout = 60 * 1e3) {
			this.addTimeOutHandler(request, reject, timeout);
			request.on("error", reject);
			request.on("aborted", () => {
				reject(/* @__PURE__ */ new Error("Request has been aborted by the server"));
			});
		}
		handleResponse(response, options, cancellationToken, resolve, reject, redirectCount, requestProcessor) {
			var _a;
			if (debug.enabled) {
				const { headers: _headers, auth: _auth, ...safeOptions } = options;
				debug(`Response: ${response.statusCode} ${response.statusMessage}, request options: ${safeStringifyJson(safeOptions)}`);
			}
			if (response.statusCode === 404) {
				reject(createHttpError(response, `method: ${options.method || "GET"} url: ${options.protocol || "https:"}//${options.hostname}${options.port ? `:${options.port}` : ""}${options.path}

Please double check that your authentication token is correct. Due to security reasons, actual status maybe not reported, but 404.
`));
				return;
			} else if (response.statusCode === 204) {
				resolve();
				return;
			}
			const code = (_a = response.statusCode) !== null && _a !== void 0 ? _a : 0;
			const shouldRedirect = code >= 300 && code < 400;
			const redirectUrl = safeGetHeader(response, "location");
			if (shouldRedirect && redirectUrl != null) {
				if (redirectCount > this.maxRedirects) {
					reject(this.createMaxRedirectError());
					return;
				}
				this.doApiRequest(HttpExecutor.prepareRedirectUrlOptions(redirectUrl, options), cancellationToken, requestProcessor, redirectCount).then(resolve).catch(reject);
				return;
			}
			response.setEncoding("utf8");
			let data = "";
			response.on("error", reject);
			response.on("data", (chunk) => data += chunk);
			response.on("end", () => {
				try {
					if (response.statusCode != null && response.statusCode >= 400) {
						const contentType = safeGetHeader(response, "content-type");
						const isJson = contentType != null && (Array.isArray(contentType) ? contentType.find((it) => it.includes("json")) != null : contentType.includes("json"));
						reject(createHttpError(response, `method: ${options.method || "GET"} url: ${options.protocol || "https:"}//${options.hostname}${options.port ? `:${options.port}` : ""}${options.path}

          Data:
          ${isJson ? safeStringifyJson(JSON.parse(data)) : data}
          `));
					} else resolve(data.length === 0 ? null : data);
				} catch (e) {
					reject(e);
				}
			});
		}
		async downloadToBuffer(url, options) {
			return await options.cancellationToken.createPromise((resolve, reject, onCancel) => {
				const responseChunks = [];
				const requestOptions = {
					headers: options.headers || void 0,
					redirect: "manual"
				};
				configureRequestUrl(url, requestOptions);
				configureRequestOptions(requestOptions);
				this.doDownload(requestOptions, {
					destination: null,
					options,
					onCancel,
					callback: (error) => {
						if (error == null) resolve(Buffer.concat(responseChunks));
						else reject(error);
					},
					responseHandler: (response, callback) => {
						let receivedLength = 0;
						response.on("data", (chunk) => {
							receivedLength += chunk.length;
							if (receivedLength > 524288e3) {
								callback(/* @__PURE__ */ new Error("Maximum allowed size is 500 MB"));
								return;
							}
							responseChunks.push(chunk);
						});
						response.on("end", () => {
							callback(null);
						});
					}
				}, 0);
			});
		}
		doDownload(requestOptions, options, redirectCount) {
			const request = this.createRequest(requestOptions, (response) => {
				if (response.statusCode >= 400) {
					options.callback(/* @__PURE__ */ new Error(`Cannot download "${requestOptions.protocol || "https:"}//${requestOptions.hostname}${requestOptions.path}", status ${response.statusCode}: ${response.statusMessage}`));
					return;
				}
				response.on("error", options.callback);
				const redirectUrl = safeGetHeader(response, "location");
				if (redirectUrl != null) {
					if (redirectCount < this.maxRedirects) this.doDownload(HttpExecutor.prepareRedirectUrlOptions(redirectUrl, requestOptions), options, redirectCount++);
					else options.callback(this.createMaxRedirectError());
					return;
				}
				if (options.responseHandler == null) configurePipes(options, response);
				else options.responseHandler(response, options.callback);
			});
			this.addErrorAndTimeoutHandlers(request, options.callback, requestOptions.timeout);
			this.addRedirectHandlers(request, requestOptions, options.callback, redirectCount, (requestOptions) => {
				this.doDownload(requestOptions, options, redirectCount++);
			});
			request.end();
		}
		createMaxRedirectError() {
			return /* @__PURE__ */ new Error(`Too many redirects (> ${this.maxRedirects})`);
		}
		addTimeOutHandler(request, callback, timeout) {
			request.on("socket", (socket) => {
				socket.setTimeout(timeout, () => {
					request.abort();
					callback(/* @__PURE__ */ new Error("Request timed out"));
				});
			});
		}
		static prepareRedirectUrlOptions(redirectUrl, options) {
			const newOptions = configureRequestOptionsFromUrl(redirectUrl, { ...options });
			const headers = newOptions.headers;
			if (headers == null) return newOptions;
			const originalUrl = HttpExecutor.reconstructOriginalUrl(options);
			const parsedRedirectUrl = parseUrl(redirectUrl, options);
			if (HttpExecutor.isCrossOriginRedirect(originalUrl, parsedRedirectUrl)) {
				if (debug.enabled) debug(`Cross-origin redirect (${originalUrl.host} → ${parsedRedirectUrl.host}): stripping sensitive headers`);
				for (const key of Object.keys(headers)) if (SENSITIVE_REDIRECT_HEADERS.has(normalizeName(key))) delete headers[key];
			}
			return newOptions;
		}
		static reconstructOriginalUrl(options) {
			const protocol = options.protocol || "https:";
			if (!options.hostname) throw new Error("Missing hostname in request options");
			const hostname = options.hostname;
			const port = options.port ? `:${options.port}` : "";
			const path = options.path || "/";
			return new url_1$7.URL(`${protocol}//${hostname}${port}${path}`);
		}
		static isCrossOriginRedirect(originalUrl, redirectUrl) {
			if (originalUrl.hostname.toLowerCase() !== redirectUrl.hostname.toLowerCase()) return true;
			if (originalUrl.protocol === "http:" && ["80", ""].includes(originalUrl.port) && redirectUrl.protocol === "https:" && ["443", ""].includes(redirectUrl.port)) return false;
			if (originalUrl.protocol !== redirectUrl.protocol) return true;
			return originalUrl.port !== redirectUrl.port;
		}
		static async retryOnServerError(task, maxRetries = 3) {
			for (let attemptNumber = 0;; attemptNumber++) try {
				return await task();
			} catch (e) {
				if (attemptNumber < maxRetries && (e instanceof HttpError && e.isServerError() || e.code === "EPIPE")) {
					await new Promise((r) => setTimeout(r, 1e3 * (attemptNumber + 1)));
					continue;
				}
				throw e;
			}
		}
	};
	function parseUrl(url, options) {
		try {
			return new url_1$7.URL(url);
		} catch {
			const hostname = options.hostname;
			const baseUrl = `${options.protocol || "https:"}//${hostname}${options.port ? `:${options.port}` : ""}`;
			return new url_1$7.URL(url, baseUrl);
		}
	}
	function configureRequestOptionsFromUrl(url, options) {
		const result = configureRequestOptions(options);
		configureRequestUrl(parseUrl(url, options), result);
		return result;
	}
	function configureRequestUrl(url, options) {
		options.protocol = url.protocol;
		options.hostname = url.hostname;
		if (url.port) options.port = url.port;
		else if (options.port) delete options.port;
		options.path = url.pathname + url.search;
	}
	var DigestTransform = class extends stream_1$2.Transform {
		get actual() {
			return this._actual;
		}
		constructor(expected, algorithm = "sha512", encoding = "base64") {
			super();
			this.expected = expected;
			this.algorithm = algorithm;
			this.encoding = encoding;
			this._actual = null;
			this.isValidateOnEnd = true;
			this.digester = (0, crypto_1$4.createHash)(algorithm);
		}
		_transform(chunk, encoding, callback) {
			this.digester.update(chunk);
			callback(null, chunk);
		}
		_flush(callback) {
			this._actual = this.digester.digest(this.encoding);
			if (this.isValidateOnEnd) try {
				this.validate();
			} catch (e) {
				callback(e);
				return;
			}
			callback(null);
		}
		validate() {
			if (this._actual == null) throw (0, error_1.newError)("Not finished yet", "ERR_STREAM_NOT_FINISHED");
			if (this._actual !== this.expected) throw (0, error_1.newError)(`${this.algorithm} checksum mismatch, expected ${this.expected}, got ${this._actual}`, "ERR_CHECKSUM_MISMATCH");
			return null;
		}
	};
	exports.DigestTransform = DigestTransform;
	function checkSha2(sha2Header, sha2, callback) {
		if (sha2Header != null && sha2 != null && sha2Header !== sha2) {
			callback(/* @__PURE__ */ new Error(`checksum mismatch: expected ${sha2} but got ${sha2Header} (X-Checksum-Sha2 header)`));
			return false;
		}
		return true;
	}
	function safeGetHeader(response, headerKey) {
		const value = response.headers[headerKey];
		if (value == null) return null;
		else if (Array.isArray(value)) return value.length === 0 ? null : value[value.length - 1];
		else return value;
	}
	function configurePipes(options, response) {
		if (!checkSha2(safeGetHeader(response, "X-Checksum-Sha2"), options.options.sha2, options.callback)) return;
		const streams = [];
		if (options.options.onProgress != null) {
			const contentLength = safeGetHeader(response, "content-length");
			if (contentLength != null) streams.push(new ProgressCallbackTransform_1.ProgressCallbackTransform(parseInt(contentLength, 10), options.options.cancellationToken, options.options.onProgress));
		}
		const sha512 = options.options.sha512;
		if (sha512 != null) streams.push(new DigestTransform(sha512, "sha512", sha512.length === 128 && !sha512.includes("+") && !sha512.includes("Z") && !sha512.includes("=") ? "hex" : "base64"));
		else if (options.options.sha2 != null) streams.push(new DigestTransform(options.options.sha2, "sha256", "hex"));
		const fileOut = (0, fs_1$5.createWriteStream)(options.destination);
		streams.push(fileOut);
		let lastStream = response;
		for (const stream of streams) {
			stream.on("error", (error) => {
				fileOut.close();
				if (!options.options.cancellationToken.cancelled) options.callback(error);
			});
			lastStream = lastStream.pipe(stream);
		}
		fileOut.on("finish", () => {
			fileOut.close(options.callback);
		});
	}
	function configureRequestOptions(options, token, method) {
		if (method != null) options.method = method;
		options.headers = { ...options.headers };
		const headers = options.headers;
		if (token != null) headers.authorization = token.startsWith("Basic") || token.startsWith("Bearer") ? token : `token ${token}`;
		if (headers["User-Agent"] == null) headers["User-Agent"] = "electron-builder";
		if (method == null || method === "GET" || headers["Cache-Control"] == null) headers["Cache-Control"] = "no-cache";
		if (options.protocol == null && process.versions.electron != null) options.protocol = "https:";
		return options;
	}
	function isSensitiveFieldName(name) {
		const normalized = normalizeName(name);
		return SENSITIVE_FIELD_PATTERNS.some((p) => normalized.includes(p)) || SENSITIVE_FIELD_SUFFIXES.some((s) => normalized.endsWith(s));
	}
	function hashSensitiveValue(value) {
		return `${(0, crypto_1$4.createHash)("sha256").update(value).digest("hex")} (sha256 hash)`;
	}
	function safeStringifyJson(data, skippedNames) {
		return JSON.stringify(data, (name, value) => {
			if (isSensitiveFieldName(name) || skippedNames != null && skippedNames.has(name)) return typeof value === "string" ? hashSensitiveValue(value) : "<stripped sensitive data>";
			return value;
		}, 2);
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/builder-util-runtime/out/MemoLazy.js
var require_MemoLazy = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.MemoLazy = void 0;
	var MemoLazy = class {
		constructor(selector, creator) {
			this.selector = selector;
			this.creator = creator;
			this.selected = void 0;
			this._value = void 0;
		}
		get hasValue() {
			return this._value !== void 0;
		}
		get value() {
			const selected = this.selector();
			if (this._value !== void 0 && equals(this.selected, selected)) return this._value;
			this.selected = selected;
			const result = this.creator(selected);
			this.value = result;
			return result;
		}
		set value(value) {
			this._value = value;
		}
	};
	exports.MemoLazy = MemoLazy;
	function equals(firstValue, secondValue) {
		if (typeof firstValue === "object" && firstValue !== null && typeof secondValue === "object" && secondValue !== null) {
			const keys1 = Object.keys(firstValue);
			const keys2 = Object.keys(secondValue);
			return keys1.length === keys2.length && keys1.every((key) => equals(firstValue[key], secondValue[key]));
		}
		return firstValue === secondValue;
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/builder-util-runtime/out/publishOptions.js
var require_publishOptions = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.githubUrl = githubUrl;
	exports.githubTagPrefix = githubTagPrefix;
	exports.getS3LikeProviderBaseUrl = getS3LikeProviderBaseUrl;
	/** @private */
	function githubUrl(options, defaultHost = "github.com") {
		return `${options.protocol || "https"}://${options.host || defaultHost}`;
	}
	function githubTagPrefix(options) {
		var _a;
		if (options.tagNamePrefix) return options.tagNamePrefix;
		if ((_a = options.vPrefixedTagName) !== null && _a !== void 0 ? _a : true) return "v";
		return "";
	}
	function getS3LikeProviderBaseUrl(configuration) {
		const provider = configuration.provider;
		if (provider === "s3") return s3Url(configuration);
		if (provider === "spaces") return spacesUrl(configuration);
		throw new Error(`Not supported provider: ${provider}`);
	}
	function s3Url(options) {
		let url;
		if (options.accelerate == true) url = `https://${options.bucket}.s3-accelerate.amazonaws.com`;
		else if (options.endpoint != null) url = `${options.endpoint}/${options.bucket}`;
		else if (options.bucket.includes(".")) {
			if (options.region == null) throw new Error(`Bucket name "${options.bucket}" includes a dot, but S3 region is missing`);
			if (options.region === "us-east-1") url = `https://s3.amazonaws.com/${options.bucket}`;
			else url = `https://s3-${options.region}.amazonaws.com/${options.bucket}`;
		} else if (options.region === "cn-north-1") url = `https://${options.bucket}.s3.${options.region}.amazonaws.com.cn`;
		else url = `https://${options.bucket}.s3.amazonaws.com`;
		return appendPath(url, options.path);
	}
	function appendPath(url, p) {
		if (p != null && p.length > 0) {
			if (!p.startsWith("/")) url += "/";
			url += p;
		}
		return url;
	}
	function spacesUrl(options) {
		if (options.name == null) throw new Error(`name is missing`);
		if (options.region == null) throw new Error(`region is missing`);
		return appendPath(`https://${options.name}.${options.region}.digitaloceanspaces.com`, options.path);
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/builder-util-runtime/out/retry.js
var require_retry = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.retry = retry;
	var CancellationToken_1 = require_CancellationToken();
	async function retry(task, options) {
		var _a;
		const { retries: retryCount, interval, backoff = 0, attempt = 0, shouldRetry, cancellationToken = new CancellationToken_1.CancellationToken() } = options;
		try {
			return await task();
		} catch (error) {
			if (await Promise.resolve((_a = shouldRetry === null || shouldRetry === void 0 ? void 0 : shouldRetry(error)) !== null && _a !== void 0 ? _a : true) && retryCount > 0 && !cancellationToken.cancelled) {
				await new Promise((resolve) => setTimeout(resolve, interval + backoff * attempt));
				return await retry(task, {
					...options,
					retries: retryCount - 1,
					attempt: attempt + 1
				});
			} else throw error;
		}
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/builder-util-runtime/out/rfc2253Parser.js
var require_rfc2253Parser = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.parseDn = parseDn;
	function parseDn(seq) {
		let quoted = false;
		let key = null;
		let token = "";
		let nextNonSpace = 0;
		seq = seq.trim();
		const result = /* @__PURE__ */ new Map();
		for (let i = 0; i <= seq.length; i++) {
			if (i === seq.length) {
				if (key !== null) result.set(key, token);
				break;
			}
			const ch = seq[i];
			if (quoted) {
				if (ch === "\"") {
					quoted = false;
					continue;
				}
			} else {
				if (ch === "\"") {
					quoted = true;
					continue;
				}
				if (ch === "\\") {
					i++;
					const ord = parseInt(seq.slice(i, i + 2), 16);
					if (Number.isNaN(ord)) token += seq[i];
					else {
						i++;
						token += String.fromCharCode(ord);
					}
					continue;
				}
				if (key === null && ch === "=") {
					key = token;
					token = "";
					continue;
				}
				if (ch === "," || ch === ";" || ch === "+") {
					if (key !== null) result.set(key, token);
					key = null;
					token = "";
					continue;
				}
			}
			if (ch === " " && !quoted) {
				if (token.length === 0) continue;
				if (i > nextNonSpace) {
					let j = i;
					while (seq[j] === " ") j++;
					nextNonSpace = j;
				}
				if (nextNonSpace >= seq.length || seq[nextNonSpace] === "," || seq[nextNonSpace] === ";" || key === null && seq[nextNonSpace] === "=" || key !== null && seq[nextNonSpace] === "+") {
					i = nextNonSpace - 1;
					continue;
				}
			}
			token += ch;
		}
		return result;
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/builder-util-runtime/out/uuid.js
var require_uuid = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.nil = exports.UUID = void 0;
	var crypto_1$3 = require("crypto");
	var error_1 = require_error();
	var invalidName = "options.name must be either a string or a Buffer";
	var randomHost = (0, crypto_1$3.randomBytes)(16);
	randomHost[0] = randomHost[0] | 1;
	var hex2byte = {};
	var byte2hex = [];
	for (let i = 0; i < 256; i++) {
		const hex = (i + 256).toString(16).substr(1);
		hex2byte[hex] = i;
		byte2hex[i] = hex;
	}
	var UUID = class UUID {
		constructor(uuid) {
			this.ascii = null;
			this.binary = null;
			const check = UUID.check(uuid);
			if (!check) throw new Error("not a UUID");
			this.version = check.version;
			if (check.format === "ascii") this.ascii = uuid;
			else this.binary = uuid;
		}
		static v5(name, namespace) {
			return uuidNamed(name, "sha1", 80, namespace);
		}
		toString() {
			if (this.ascii == null) this.ascii = stringify(this.binary);
			return this.ascii;
		}
		inspect() {
			return `UUID v${this.version} ${this.toString()}`;
		}
		static check(uuid, offset = 0) {
			if (typeof uuid === "string") {
				uuid = uuid.toLowerCase();
				if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-([a-f0-9]{12})$/.test(uuid)) return false;
				if (uuid === "00000000-0000-0000-0000-000000000000") return {
					version: void 0,
					variant: "nil",
					format: "ascii"
				};
				return {
					version: (hex2byte[uuid[14] + uuid[15]] & 240) >> 4,
					variant: getVariant((hex2byte[uuid[19] + uuid[20]] & 224) >> 5),
					format: "ascii"
				};
			}
			if (Buffer.isBuffer(uuid)) {
				if (uuid.length < offset + 16) return false;
				let i = 0;
				for (; i < 16; i++) if (uuid[offset + i] !== 0) break;
				if (i === 16) return {
					version: void 0,
					variant: "nil",
					format: "binary"
				};
				return {
					version: (uuid[offset + 6] & 240) >> 4,
					variant: getVariant((uuid[offset + 8] & 224) >> 5),
					format: "binary"
				};
			}
			throw (0, error_1.newError)("Unknown type of uuid", "ERR_UNKNOWN_UUID_TYPE");
		}
		static parse(input) {
			const buffer = Buffer.allocUnsafe(16);
			let j = 0;
			for (let i = 0; i < 16; i++) {
				buffer[i] = hex2byte[input[j++] + input[j++]];
				if (i === 3 || i === 5 || i === 7 || i === 9) j += 1;
			}
			return buffer;
		}
	};
	exports.UUID = UUID;
	UUID.OID = UUID.parse("6ba7b812-9dad-11d1-80b4-00c04fd430c8");
	function getVariant(bits) {
		switch (bits) {
			case 0:
			case 1:
			case 3: return "ncs";
			case 4:
			case 5: return "rfc4122";
			case 6: return "microsoft";
			default: return "future";
		}
	}
	var UuidEncoding;
	(function(UuidEncoding) {
		UuidEncoding[UuidEncoding["ASCII"] = 0] = "ASCII";
		UuidEncoding[UuidEncoding["BINARY"] = 1] = "BINARY";
		UuidEncoding[UuidEncoding["OBJECT"] = 2] = "OBJECT";
	})(UuidEncoding || (UuidEncoding = {}));
	function uuidNamed(name, hashMethod, version, namespace, encoding = UuidEncoding.ASCII) {
		const hash = (0, crypto_1$3.createHash)(hashMethod);
		if (typeof name !== "string" && !Buffer.isBuffer(name)) throw (0, error_1.newError)(invalidName, "ERR_INVALID_UUID_NAME");
		hash.update(namespace);
		hash.update(name);
		const buffer = hash.digest();
		let result;
		switch (encoding) {
			case UuidEncoding.BINARY:
				buffer[6] = buffer[6] & 15 | version;
				buffer[8] = buffer[8] & 63 | 128;
				result = buffer;
				break;
			case UuidEncoding.OBJECT:
				buffer[6] = buffer[6] & 15 | version;
				buffer[8] = buffer[8] & 63 | 128;
				result = new UUID(buffer);
				break;
			default:
				result = byte2hex[buffer[0]] + byte2hex[buffer[1]] + byte2hex[buffer[2]] + byte2hex[buffer[3]] + "-" + byte2hex[buffer[4]] + byte2hex[buffer[5]] + "-" + byte2hex[buffer[6] & 15 | version] + byte2hex[buffer[7]] + "-" + byte2hex[buffer[8] & 63 | 128] + byte2hex[buffer[9]] + "-" + byte2hex[buffer[10]] + byte2hex[buffer[11]] + byte2hex[buffer[12]] + byte2hex[buffer[13]] + byte2hex[buffer[14]] + byte2hex[buffer[15]];
				break;
		}
		return result;
	}
	function stringify(buffer) {
		return byte2hex[buffer[0]] + byte2hex[buffer[1]] + byte2hex[buffer[2]] + byte2hex[buffer[3]] + "-" + byte2hex[buffer[4]] + byte2hex[buffer[5]] + "-" + byte2hex[buffer[6]] + byte2hex[buffer[7]] + "-" + byte2hex[buffer[8]] + byte2hex[buffer[9]] + "-" + byte2hex[buffer[10]] + byte2hex[buffer[11]] + byte2hex[buffer[12]] + byte2hex[buffer[13]] + byte2hex[buffer[14]] + byte2hex[buffer[15]];
	}
	exports.nil = new UUID("00000000-0000-0000-0000-000000000000");
}));
//#endregion
//#region ../../node_modules/sax/lib/sax.js
var require_sax = /* @__PURE__ */ __commonJSMin(((exports) => {
	(function(sax) {
		sax.parser = function(strict, opt) {
			return new SAXParser(strict, opt);
		};
		sax.SAXParser = SAXParser;
		sax.SAXStream = SAXStream;
		sax.createStream = createStream;
		sax.MAX_BUFFER_LENGTH = 64 * 1024;
		var buffers = [
			"comment",
			"sgmlDecl",
			"textNode",
			"tagName",
			"doctype",
			"procInstName",
			"procInstBody",
			"entity",
			"attribName",
			"attribValue",
			"cdata",
			"script"
		];
		sax.EVENTS = [
			"text",
			"processinginstruction",
			"sgmldeclaration",
			"doctype",
			"comment",
			"opentagstart",
			"attribute",
			"opentag",
			"closetag",
			"opencdata",
			"cdata",
			"closecdata",
			"error",
			"end",
			"ready",
			"script",
			"opennamespace",
			"closenamespace"
		];
		function SAXParser(strict, opt) {
			if (!(this instanceof SAXParser)) return new SAXParser(strict, opt);
			var parser = this;
			clearBuffers(parser);
			parser.q = parser.c = "";
			parser.bufferCheckPosition = sax.MAX_BUFFER_LENGTH;
			parser.encoding = null;
			parser.opt = opt || {};
			parser.opt.lowercase = parser.opt.lowercase || parser.opt.lowercasetags;
			parser.looseCase = parser.opt.lowercase ? "toLowerCase" : "toUpperCase";
			parser.opt.maxEntityCount = parser.opt.maxEntityCount || 512;
			parser.opt.maxEntityDepth = parser.opt.maxEntityDepth || 4;
			parser.entityCount = parser.entityDepth = 0;
			parser.tags = [];
			parser.closed = parser.closedRoot = parser.sawRoot = false;
			parser.tag = parser.error = null;
			parser.strict = !!strict;
			parser.noscript = !!(strict || parser.opt.noscript);
			parser.state = S.BEGIN;
			parser.strictEntities = parser.opt.strictEntities;
			parser.ENTITIES = parser.strictEntities ? Object.create(sax.XML_ENTITIES) : Object.create(sax.ENTITIES);
			parser.attribList = [];
			if (parser.opt.xmlns) parser.ns = Object.create(rootNS);
			if (parser.opt.unquotedAttributeValues === void 0) parser.opt.unquotedAttributeValues = !strict;
			parser.trackPosition = parser.opt.position !== false;
			if (parser.trackPosition) parser.position = parser.line = parser.column = 0;
			emit(parser, "onready");
		}
		if (!Object.create) Object.create = function(o) {
			function F() {}
			F.prototype = o;
			return new F();
		};
		if (!Object.keys) Object.keys = function(o) {
			var a = [];
			for (var i in o) if (o.hasOwnProperty(i)) a.push(i);
			return a;
		};
		function checkBufferLength(parser) {
			var maxAllowed = Math.max(sax.MAX_BUFFER_LENGTH, 10);
			var maxActual = 0;
			for (var i = 0, l = buffers.length; i < l; i++) {
				var len = parser[buffers[i]].length;
				if (len > maxAllowed) switch (buffers[i]) {
					case "textNode":
						closeText(parser);
						break;
					case "cdata":
						emitNode(parser, "oncdata", parser.cdata);
						parser.cdata = "";
						break;
					case "script":
						emitNode(parser, "onscript", parser.script);
						parser.script = "";
						break;
					default: error(parser, "Max buffer length exceeded: " + buffers[i]);
				}
				maxActual = Math.max(maxActual, len);
			}
			parser.bufferCheckPosition = sax.MAX_BUFFER_LENGTH - maxActual + parser.position;
		}
		function clearBuffers(parser) {
			for (var i = 0, l = buffers.length; i < l; i++) parser[buffers[i]] = "";
		}
		function flushBuffers(parser) {
			closeText(parser);
			if (parser.cdata !== "") {
				emitNode(parser, "oncdata", parser.cdata);
				parser.cdata = "";
			}
			if (parser.script !== "") {
				emitNode(parser, "onscript", parser.script);
				parser.script = "";
			}
		}
		SAXParser.prototype = {
			end: function() {
				end(this);
			},
			write,
			resume: function() {
				this.error = null;
				return this;
			},
			close: function() {
				return this.write(null);
			},
			flush: function() {
				flushBuffers(this);
			}
		};
		var Stream;
		try {
			Stream = require("stream").Stream;
		} catch (ex) {
			Stream = function() {};
		}
		if (!Stream) Stream = function() {};
		var streamWraps = sax.EVENTS.filter(function(ev) {
			return ev !== "error" && ev !== "end";
		});
		function createStream(strict, opt) {
			return new SAXStream(strict, opt);
		}
		function determineBufferEncoding(data, isEnd) {
			if (data.length >= 2) {
				if (data[0] === 255 && data[1] === 254) return "utf-16le";
				if (data[0] === 254 && data[1] === 255) return "utf-16be";
			}
			if (data.length >= 3 && data[0] === 239 && data[1] === 187 && data[2] === 191) return "utf8";
			if (data.length >= 4) {
				if (data[0] === 60 && data[1] === 0 && data[2] === 63 && data[3] === 0) return "utf-16le";
				if (data[0] === 0 && data[1] === 60 && data[2] === 0 && data[3] === 63) return "utf-16be";
				return "utf8";
			}
			return isEnd ? "utf8" : null;
		}
		function SAXStream(strict, opt) {
			if (!(this instanceof SAXStream)) return new SAXStream(strict, opt);
			Stream.apply(this);
			this._parser = new SAXParser(strict, opt);
			this.writable = true;
			this.readable = true;
			var me = this;
			this._parser.onend = function() {
				me.emit("end");
			};
			this._parser.onerror = function(er) {
				me.emit("error", er);
				me._parser.error = null;
			};
			this._decoder = null;
			this._decoderBuffer = null;
			streamWraps.forEach(function(ev) {
				Object.defineProperty(me, "on" + ev, {
					get: function() {
						return me._parser["on" + ev];
					},
					set: function(h) {
						if (!h) {
							me.removeAllListeners(ev);
							me._parser["on" + ev] = h;
							return h;
						}
						me.on(ev, h);
					},
					enumerable: true,
					configurable: false
				});
			});
		}
		SAXStream.prototype = Object.create(Stream.prototype, { constructor: { value: SAXStream } });
		SAXStream.prototype._decodeBuffer = function(data, isEnd) {
			if (this._decoderBuffer) {
				data = Buffer.concat([this._decoderBuffer, data]);
				this._decoderBuffer = null;
			}
			if (!this._decoder) {
				var encoding = determineBufferEncoding(data, isEnd);
				if (!encoding) {
					this._decoderBuffer = data;
					return "";
				}
				this._parser.encoding = encoding;
				this._decoder = new TextDecoder(encoding);
			}
			return this._decoder.decode(data, { stream: !isEnd });
		};
		SAXStream.prototype.write = function(data) {
			if (typeof Buffer === "function" && typeof Buffer.isBuffer === "function" && Buffer.isBuffer(data)) data = this._decodeBuffer(data, false);
			else if (this._decoderBuffer) {
				var remaining = this._decodeBuffer(Buffer.alloc(0), true);
				if (remaining) {
					this._parser.write(remaining);
					this.emit("data", remaining);
				}
			}
			this._parser.write(data.toString());
			this.emit("data", data);
			return true;
		};
		SAXStream.prototype.end = function(chunk) {
			if (chunk && chunk.length) this.write(chunk);
			if (this._decoderBuffer) {
				var finalChunk = this._decodeBuffer(Buffer.alloc(0), true);
				if (finalChunk) {
					this._parser.write(finalChunk);
					this.emit("data", finalChunk);
				}
			} else if (this._decoder) {
				var remaining = this._decoder.decode();
				if (remaining) {
					this._parser.write(remaining);
					this.emit("data", remaining);
				}
			}
			this._parser.end();
			return true;
		};
		SAXStream.prototype.on = function(ev, handler) {
			var me = this;
			if (!me._parser["on" + ev] && streamWraps.indexOf(ev) !== -1) me._parser["on" + ev] = function() {
				var args = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
				args.splice(0, 0, ev);
				me.emit.apply(me, args);
			};
			return Stream.prototype.on.call(me, ev, handler);
		};
		var CDATA = "[CDATA[";
		var DOCTYPE = "DOCTYPE";
		var XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
		var XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";
		var rootNS = {
			xml: XML_NAMESPACE,
			xmlns: XMLNS_NAMESPACE
		};
		var nameStart = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;
		var nameBody = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;
		var entityStart = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;
		var entityBody = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;
		function isWhitespace(c) {
			return c === " " || c === "\n" || c === "\r" || c === "	";
		}
		function isQuote(c) {
			return c === "\"" || c === "'";
		}
		function isAttribEnd(c) {
			return c === ">" || isWhitespace(c);
		}
		function isMatch(regex, c) {
			return regex.test(c);
		}
		function notMatch(regex, c) {
			return !isMatch(regex, c);
		}
		var S = 0;
		sax.STATE = {
			BEGIN: S++,
			BEGIN_WHITESPACE: S++,
			TEXT: S++,
			TEXT_ENTITY: S++,
			OPEN_WAKA: S++,
			SGML_DECL: S++,
			SGML_DECL_QUOTED: S++,
			DOCTYPE: S++,
			DOCTYPE_QUOTED: S++,
			DOCTYPE_DTD: S++,
			DOCTYPE_DTD_QUOTED: S++,
			COMMENT_STARTING: S++,
			COMMENT: S++,
			COMMENT_ENDING: S++,
			COMMENT_ENDED: S++,
			CDATA: S++,
			CDATA_ENDING: S++,
			CDATA_ENDING_2: S++,
			PROC_INST: S++,
			PROC_INST_BODY: S++,
			PROC_INST_ENDING: S++,
			OPEN_TAG: S++,
			OPEN_TAG_SLASH: S++,
			ATTRIB: S++,
			ATTRIB_NAME: S++,
			ATTRIB_NAME_SAW_WHITE: S++,
			ATTRIB_VALUE: S++,
			ATTRIB_VALUE_QUOTED: S++,
			ATTRIB_VALUE_CLOSED: S++,
			ATTRIB_VALUE_UNQUOTED: S++,
			ATTRIB_VALUE_ENTITY_Q: S++,
			ATTRIB_VALUE_ENTITY_U: S++,
			CLOSE_TAG: S++,
			CLOSE_TAG_SAW_WHITE: S++,
			SCRIPT: S++,
			SCRIPT_ENDING: S++
		};
		sax.XML_ENTITIES = {
			amp: "&",
			gt: ">",
			lt: "<",
			quot: "\"",
			apos: "'"
		};
		sax.ENTITIES = {
			amp: "&",
			gt: ">",
			lt: "<",
			quot: "\"",
			apos: "'",
			AElig: 198,
			Aacute: 193,
			Acirc: 194,
			Agrave: 192,
			Aring: 197,
			Atilde: 195,
			Auml: 196,
			Ccedil: 199,
			ETH: 208,
			Eacute: 201,
			Ecirc: 202,
			Egrave: 200,
			Euml: 203,
			Iacute: 205,
			Icirc: 206,
			Igrave: 204,
			Iuml: 207,
			Ntilde: 209,
			Oacute: 211,
			Ocirc: 212,
			Ograve: 210,
			Oslash: 216,
			Otilde: 213,
			Ouml: 214,
			THORN: 222,
			Uacute: 218,
			Ucirc: 219,
			Ugrave: 217,
			Uuml: 220,
			Yacute: 221,
			aacute: 225,
			acirc: 226,
			aelig: 230,
			agrave: 224,
			aring: 229,
			atilde: 227,
			auml: 228,
			ccedil: 231,
			eacute: 233,
			ecirc: 234,
			egrave: 232,
			eth: 240,
			euml: 235,
			iacute: 237,
			icirc: 238,
			igrave: 236,
			iuml: 239,
			ntilde: 241,
			oacute: 243,
			ocirc: 244,
			ograve: 242,
			oslash: 248,
			otilde: 245,
			ouml: 246,
			szlig: 223,
			thorn: 254,
			uacute: 250,
			ucirc: 251,
			ugrave: 249,
			uuml: 252,
			yacute: 253,
			yuml: 255,
			copy: 169,
			reg: 174,
			nbsp: 160,
			iexcl: 161,
			cent: 162,
			pound: 163,
			curren: 164,
			yen: 165,
			brvbar: 166,
			sect: 167,
			uml: 168,
			ordf: 170,
			laquo: 171,
			not: 172,
			shy: 173,
			macr: 175,
			deg: 176,
			plusmn: 177,
			sup1: 185,
			sup2: 178,
			sup3: 179,
			acute: 180,
			micro: 181,
			para: 182,
			middot: 183,
			cedil: 184,
			ordm: 186,
			raquo: 187,
			frac14: 188,
			frac12: 189,
			frac34: 190,
			iquest: 191,
			times: 215,
			divide: 247,
			OElig: 338,
			oelig: 339,
			Scaron: 352,
			scaron: 353,
			Yuml: 376,
			fnof: 402,
			circ: 710,
			tilde: 732,
			Alpha: 913,
			Beta: 914,
			Gamma: 915,
			Delta: 916,
			Epsilon: 917,
			Zeta: 918,
			Eta: 919,
			Theta: 920,
			Iota: 921,
			Kappa: 922,
			Lambda: 923,
			Mu: 924,
			Nu: 925,
			Xi: 926,
			Omicron: 927,
			Pi: 928,
			Rho: 929,
			Sigma: 931,
			Tau: 932,
			Upsilon: 933,
			Phi: 934,
			Chi: 935,
			Psi: 936,
			Omega: 937,
			alpha: 945,
			beta: 946,
			gamma: 947,
			delta: 948,
			epsilon: 949,
			zeta: 950,
			eta: 951,
			theta: 952,
			iota: 953,
			kappa: 954,
			lambda: 955,
			mu: 956,
			nu: 957,
			xi: 958,
			omicron: 959,
			pi: 960,
			rho: 961,
			sigmaf: 962,
			sigma: 963,
			tau: 964,
			upsilon: 965,
			phi: 966,
			chi: 967,
			psi: 968,
			omega: 969,
			thetasym: 977,
			upsih: 978,
			piv: 982,
			ensp: 8194,
			emsp: 8195,
			thinsp: 8201,
			zwnj: 8204,
			zwj: 8205,
			lrm: 8206,
			rlm: 8207,
			ndash: 8211,
			mdash: 8212,
			lsquo: 8216,
			rsquo: 8217,
			sbquo: 8218,
			ldquo: 8220,
			rdquo: 8221,
			bdquo: 8222,
			dagger: 8224,
			Dagger: 8225,
			bull: 8226,
			hellip: 8230,
			permil: 8240,
			prime: 8242,
			Prime: 8243,
			lsaquo: 8249,
			rsaquo: 8250,
			oline: 8254,
			frasl: 8260,
			euro: 8364,
			image: 8465,
			weierp: 8472,
			real: 8476,
			trade: 8482,
			alefsym: 8501,
			larr: 8592,
			uarr: 8593,
			rarr: 8594,
			darr: 8595,
			harr: 8596,
			crarr: 8629,
			lArr: 8656,
			uArr: 8657,
			rArr: 8658,
			dArr: 8659,
			hArr: 8660,
			forall: 8704,
			part: 8706,
			exist: 8707,
			empty: 8709,
			nabla: 8711,
			isin: 8712,
			notin: 8713,
			ni: 8715,
			prod: 8719,
			sum: 8721,
			minus: 8722,
			lowast: 8727,
			radic: 8730,
			prop: 8733,
			infin: 8734,
			ang: 8736,
			and: 8743,
			or: 8744,
			cap: 8745,
			cup: 8746,
			int: 8747,
			there4: 8756,
			sim: 8764,
			cong: 8773,
			asymp: 8776,
			ne: 8800,
			equiv: 8801,
			le: 8804,
			ge: 8805,
			sub: 8834,
			sup: 8835,
			nsub: 8836,
			sube: 8838,
			supe: 8839,
			oplus: 8853,
			otimes: 8855,
			perp: 8869,
			sdot: 8901,
			lceil: 8968,
			rceil: 8969,
			lfloor: 8970,
			rfloor: 8971,
			lang: 9001,
			rang: 9002,
			loz: 9674,
			spades: 9824,
			clubs: 9827,
			hearts: 9829,
			diams: 9830
		};
		Object.keys(sax.ENTITIES).forEach(function(key) {
			var e = sax.ENTITIES[key];
			var s = typeof e === "number" ? String.fromCharCode(e) : e;
			sax.ENTITIES[key] = s;
		});
		for (var s in sax.STATE) sax.STATE[sax.STATE[s]] = s;
		S = sax.STATE;
		function emit(parser, event, data) {
			parser[event] && parser[event](data);
		}
		function getDeclaredEncoding(body) {
			var match = body && body.match(/(?:^|\s)encoding\s*=\s*(['"])([^'"]+)\1/i);
			return match ? match[2] : null;
		}
		function normalizeEncodingName(encoding) {
			if (!encoding) return null;
			return encoding.toLowerCase().replace(/[^a-z0-9]/g, "");
		}
		function encodingsMatch(detectedEncoding, declaredEncoding) {
			const detected = normalizeEncodingName(detectedEncoding);
			const declared = normalizeEncodingName(declaredEncoding);
			if (!detected || !declared) return true;
			if (declared === "utf16") return detected === "utf16le" || detected === "utf16be";
			return detected === declared;
		}
		function validateXmlDeclarationEncoding(parser, data) {
			if (!parser.strict || !parser.encoding || !data || data.name !== "xml") return;
			var declaredEncoding = getDeclaredEncoding(data.body);
			if (declaredEncoding && !encodingsMatch(parser.encoding, declaredEncoding)) strictFail(parser, "XML declaration encoding " + declaredEncoding + " does not match detected stream encoding " + parser.encoding.toUpperCase());
		}
		function emitNode(parser, nodeType, data) {
			if (parser.textNode) closeText(parser);
			emit(parser, nodeType, data);
		}
		function closeText(parser) {
			parser.textNode = textopts(parser.opt, parser.textNode);
			if (parser.textNode) emit(parser, "ontext", parser.textNode);
			parser.textNode = "";
		}
		function textopts(opt, text) {
			if (opt.trim) text = text.trim();
			if (opt.normalize) text = text.replace(/\s+/g, " ");
			return text;
		}
		function error(parser, er) {
			closeText(parser);
			if (parser.trackPosition) er += "\nLine: " + parser.line + "\nColumn: " + parser.column + "\nChar: " + parser.c;
			er = new Error(er);
			parser.error = er;
			emit(parser, "onerror", er);
			return parser;
		}
		function end(parser) {
			if (parser.sawRoot && !parser.closedRoot) strictFail(parser, "Unclosed root tag");
			if (parser.state !== S.BEGIN && parser.state !== S.BEGIN_WHITESPACE && parser.state !== S.TEXT) error(parser, "Unexpected end");
			closeText(parser);
			parser.c = "";
			parser.closed = true;
			emit(parser, "onend");
			SAXParser.call(parser, parser.strict, parser.opt);
			return parser;
		}
		function strictFail(parser, message) {
			if (typeof parser !== "object" || !(parser instanceof SAXParser)) throw new Error("bad call to strictFail");
			if (parser.strict) error(parser, message);
		}
		function newTag(parser) {
			if (!parser.strict) parser.tagName = parser.tagName[parser.looseCase]();
			var parent = parser.tags[parser.tags.length - 1] || parser;
			var tag = parser.tag = {
				name: parser.tagName,
				attributes: {}
			};
			if (parser.opt.xmlns) tag.ns = parent.ns;
			parser.attribList.length = 0;
			emitNode(parser, "onopentagstart", tag);
		}
		function qname(name, attribute) {
			var qualName = name.indexOf(":") < 0 ? ["", name] : name.split(":");
			var prefix = qualName[0];
			var local = qualName[1];
			if (attribute && name === "xmlns") {
				prefix = "xmlns";
				local = "";
			}
			return {
				prefix,
				local
			};
		}
		function attrib(parser) {
			if (!parser.strict) parser.attribName = parser.attribName[parser.looseCase]();
			if (parser.attribList.indexOf(parser.attribName) !== -1 || parser.tag.attributes.hasOwnProperty(parser.attribName)) {
				parser.attribName = parser.attribValue = "";
				return;
			}
			if (parser.opt.xmlns) {
				var qn = qname(parser.attribName, true);
				var prefix = qn.prefix;
				var local = qn.local;
				if (prefix === "xmlns") if (local === "xml" && parser.attribValue !== XML_NAMESPACE) strictFail(parser, "xml: prefix must be bound to " + XML_NAMESPACE + "\nActual: " + parser.attribValue);
				else if (local === "xmlns" && parser.attribValue !== XMLNS_NAMESPACE) strictFail(parser, "xmlns: prefix must be bound to " + XMLNS_NAMESPACE + "\nActual: " + parser.attribValue);
				else {
					var tag = parser.tag;
					var parent = parser.tags[parser.tags.length - 1] || parser;
					if (tag.ns === parent.ns) tag.ns = Object.create(parent.ns);
					tag.ns[local] = parser.attribValue;
				}
				parser.attribList.push([parser.attribName, parser.attribValue]);
			} else {
				parser.tag.attributes[parser.attribName] = parser.attribValue;
				emitNode(parser, "onattribute", {
					name: parser.attribName,
					value: parser.attribValue
				});
			}
			parser.attribName = parser.attribValue = "";
		}
		function openTag(parser, selfClosing) {
			if (parser.opt.xmlns) {
				var tag = parser.tag;
				var qn = qname(parser.tagName);
				tag.prefix = qn.prefix;
				tag.local = qn.local;
				tag.uri = tag.ns[qn.prefix] || "";
				if (tag.prefix && !tag.uri) {
					strictFail(parser, "Unbound namespace prefix: " + JSON.stringify(parser.tagName));
					tag.uri = qn.prefix;
				}
				var parent = parser.tags[parser.tags.length - 1] || parser;
				if (tag.ns && parent.ns !== tag.ns) Object.keys(tag.ns).forEach(function(p) {
					emitNode(parser, "onopennamespace", {
						prefix: p,
						uri: tag.ns[p]
					});
				});
				for (var i = 0, l = parser.attribList.length; i < l; i++) {
					var nv = parser.attribList[i];
					var name = nv[0];
					var value = nv[1];
					var qualName = qname(name, true);
					var prefix = qualName.prefix;
					var local = qualName.local;
					var uri = prefix === "" ? "" : tag.ns[prefix] || "";
					var a = {
						name,
						value,
						prefix,
						local,
						uri
					};
					if (prefix && prefix !== "xmlns" && !uri) {
						strictFail(parser, "Unbound namespace prefix: " + JSON.stringify(prefix));
						a.uri = prefix;
					}
					parser.tag.attributes[name] = a;
					emitNode(parser, "onattribute", a);
				}
				parser.attribList.length = 0;
			}
			parser.tag.isSelfClosing = !!selfClosing;
			parser.sawRoot = true;
			parser.tags.push(parser.tag);
			emitNode(parser, "onopentag", parser.tag);
			if (!selfClosing) {
				if (!parser.noscript && parser.tagName.toLowerCase() === "script") parser.state = S.SCRIPT;
				else parser.state = S.TEXT;
				parser.tag = null;
				parser.tagName = "";
			}
			parser.attribName = parser.attribValue = "";
			parser.attribList.length = 0;
		}
		function closeTag(parser) {
			if (!parser.tagName) {
				strictFail(parser, "Weird empty close tag.");
				parser.textNode += "</>";
				parser.state = S.TEXT;
				return;
			}
			if (parser.script) {
				if (parser.tagName !== "script") {
					parser.script += "</" + parser.tagName + ">";
					parser.tagName = "";
					parser.state = S.SCRIPT;
					return;
				}
				emitNode(parser, "onscript", parser.script);
				parser.script = "";
			}
			var t = parser.tags.length;
			var tagName = parser.tagName;
			if (!parser.strict) tagName = tagName[parser.looseCase]();
			var closeTo = tagName;
			while (t--) if (parser.tags[t].name !== closeTo) strictFail(parser, "Unexpected close tag");
			else break;
			if (t < 0) {
				strictFail(parser, "Unmatched closing tag: " + parser.tagName);
				parser.textNode += "</" + parser.tagName + ">";
				parser.state = S.TEXT;
				return;
			}
			parser.tagName = tagName;
			var s = parser.tags.length;
			while (s-- > t) {
				var tag = parser.tag = parser.tags.pop();
				parser.tagName = parser.tag.name;
				emitNode(parser, "onclosetag", parser.tagName);
				var x = {};
				for (var i in tag.ns) x[i] = tag.ns[i];
				var parent = parser.tags[parser.tags.length - 1] || parser;
				if (parser.opt.xmlns && tag.ns !== parent.ns) Object.keys(tag.ns).forEach(function(p) {
					var n = tag.ns[p];
					emitNode(parser, "onclosenamespace", {
						prefix: p,
						uri: n
					});
				});
			}
			if (t === 0) parser.closedRoot = true;
			parser.tagName = parser.attribValue = parser.attribName = "";
			parser.attribList.length = 0;
			parser.state = S.TEXT;
		}
		function parseEntity(parser) {
			var entity = parser.entity;
			var entityLC = entity.toLowerCase();
			var num;
			var numStr = "";
			if (parser.ENTITIES[entity]) return parser.ENTITIES[entity];
			if (parser.ENTITIES[entityLC]) return parser.ENTITIES[entityLC];
			entity = entityLC;
			if (entity.charAt(0) === "#") if (entity.charAt(1) === "x") {
				entity = entity.slice(2);
				num = parseInt(entity, 16);
				numStr = num.toString(16);
			} else {
				entity = entity.slice(1);
				num = parseInt(entity, 10);
				numStr = num.toString(10);
			}
			entity = entity.replace(/^0+/, "");
			if (isNaN(num) || numStr.toLowerCase() !== entity || num < 0 || num > 1114111) {
				strictFail(parser, "Invalid character entity");
				return "&" + parser.entity + ";";
			}
			return String.fromCodePoint(num);
		}
		function beginWhiteSpace(parser, c) {
			if (c === "<") {
				parser.state = S.OPEN_WAKA;
				parser.startTagPosition = parser.position;
			} else if (!isWhitespace(c)) {
				strictFail(parser, "Non-whitespace before first tag.");
				parser.textNode = c;
				parser.state = S.TEXT;
			}
		}
		function charAt(chunk, i) {
			var result = "";
			if (i < chunk.length) result = chunk.charAt(i);
			return result;
		}
		function write(chunk) {
			var parser = this;
			if (this.error) throw this.error;
			if (parser.closed) return error(parser, "Cannot write after close. Assign an onready handler.");
			if (chunk === null) return end(parser);
			if (typeof chunk === "object") chunk = chunk.toString();
			var i = 0;
			var c = "";
			while (true) {
				c = charAt(chunk, i++);
				parser.c = c;
				if (!c) break;
				if (parser.trackPosition) {
					parser.position++;
					if (c === "\n") {
						parser.line++;
						parser.column = 0;
					} else parser.column++;
				}
				switch (parser.state) {
					case S.BEGIN:
						parser.state = S.BEGIN_WHITESPACE;
						if (c === "﻿") continue;
						beginWhiteSpace(parser, c);
						continue;
					case S.BEGIN_WHITESPACE:
						beginWhiteSpace(parser, c);
						continue;
					case S.TEXT:
						if (parser.sawRoot && !parser.closedRoot) {
							var starti = i - 1;
							while (c && c !== "<" && c !== "&") {
								c = charAt(chunk, i++);
								if (c && parser.trackPosition) {
									parser.position++;
									if (c === "\n") {
										parser.line++;
										parser.column = 0;
									} else parser.column++;
								}
							}
							parser.textNode += chunk.substring(starti, i - 1);
						}
						if (c === "<" && !(parser.sawRoot && parser.closedRoot && !parser.strict)) {
							parser.state = S.OPEN_WAKA;
							parser.startTagPosition = parser.position;
						} else {
							if (!isWhitespace(c) && (!parser.sawRoot || parser.closedRoot)) strictFail(parser, "Text data outside of root node.");
							if (c === "&") parser.state = S.TEXT_ENTITY;
							else parser.textNode += c;
						}
						continue;
					case S.SCRIPT:
						if (c === "<") parser.state = S.SCRIPT_ENDING;
						else parser.script += c;
						continue;
					case S.SCRIPT_ENDING:
						if (c === "/") parser.state = S.CLOSE_TAG;
						else {
							parser.script += "<" + c;
							parser.state = S.SCRIPT;
						}
						continue;
					case S.OPEN_WAKA:
						if (c === "!") {
							parser.state = S.SGML_DECL;
							parser.sgmlDecl = "";
						} else if (isWhitespace(c)) {} else if (isMatch(nameStart, c)) {
							parser.state = S.OPEN_TAG;
							parser.tagName = c;
						} else if (c === "/") {
							parser.state = S.CLOSE_TAG;
							parser.tagName = "";
						} else if (c === "?") {
							parser.state = S.PROC_INST;
							parser.procInstName = parser.procInstBody = "";
						} else {
							strictFail(parser, "Unencoded <");
							if (parser.startTagPosition + 1 < parser.position) {
								var pad = parser.position - parser.startTagPosition;
								c = new Array(pad).join(" ") + c;
							}
							parser.textNode += "<" + c;
							parser.state = S.TEXT;
						}
						continue;
					case S.SGML_DECL:
						if (parser.sgmlDecl + c === "--") {
							parser.state = S.COMMENT;
							parser.comment = "";
							parser.sgmlDecl = "";
							continue;
						}
						if (parser.doctype && parser.doctype !== true && parser.sgmlDecl) {
							parser.state = S.DOCTYPE_DTD;
							parser.doctype += "<!" + parser.sgmlDecl + c;
							parser.sgmlDecl = "";
						} else if ((parser.sgmlDecl + c).toUpperCase() === CDATA) {
							emitNode(parser, "onopencdata");
							parser.state = S.CDATA;
							parser.sgmlDecl = "";
							parser.cdata = "";
						} else if ((parser.sgmlDecl + c).toUpperCase() === DOCTYPE) {
							parser.state = S.DOCTYPE;
							if (parser.doctype || parser.sawRoot) strictFail(parser, "Inappropriately located doctype declaration");
							parser.doctype = "";
							parser.sgmlDecl = "";
						} else if (c === ">") {
							emitNode(parser, "onsgmldeclaration", parser.sgmlDecl);
							parser.sgmlDecl = "";
							parser.state = S.TEXT;
						} else if (isQuote(c)) {
							parser.state = S.SGML_DECL_QUOTED;
							parser.sgmlDecl += c;
						} else parser.sgmlDecl += c;
						continue;
					case S.SGML_DECL_QUOTED:
						if (c === parser.q) {
							parser.state = S.SGML_DECL;
							parser.q = "";
						}
						parser.sgmlDecl += c;
						continue;
					case S.DOCTYPE:
						if (c === ">") {
							parser.state = S.TEXT;
							emitNode(parser, "ondoctype", parser.doctype);
							parser.doctype = true;
						} else {
							parser.doctype += c;
							if (c === "[") parser.state = S.DOCTYPE_DTD;
							else if (isQuote(c)) {
								parser.state = S.DOCTYPE_QUOTED;
								parser.q = c;
							}
						}
						continue;
					case S.DOCTYPE_QUOTED:
						parser.doctype += c;
						if (c === parser.q) {
							parser.q = "";
							parser.state = S.DOCTYPE;
						}
						continue;
					case S.DOCTYPE_DTD:
						if (c === "]") {
							parser.doctype += c;
							parser.state = S.DOCTYPE;
						} else if (c === "<") {
							parser.state = S.OPEN_WAKA;
							parser.startTagPosition = parser.position;
						} else if (isQuote(c)) {
							parser.doctype += c;
							parser.state = S.DOCTYPE_DTD_QUOTED;
							parser.q = c;
						} else parser.doctype += c;
						continue;
					case S.DOCTYPE_DTD_QUOTED:
						parser.doctype += c;
						if (c === parser.q) {
							parser.state = S.DOCTYPE_DTD;
							parser.q = "";
						}
						continue;
					case S.COMMENT:
						if (c === "-") parser.state = S.COMMENT_ENDING;
						else parser.comment += c;
						continue;
					case S.COMMENT_ENDING:
						if (c === "-") {
							parser.state = S.COMMENT_ENDED;
							parser.comment = textopts(parser.opt, parser.comment);
							if (parser.comment) emitNode(parser, "oncomment", parser.comment);
							parser.comment = "";
						} else {
							parser.comment += "-" + c;
							parser.state = S.COMMENT;
						}
						continue;
					case S.COMMENT_ENDED:
						if (c !== ">") {
							strictFail(parser, "Malformed comment");
							parser.comment += "--" + c;
							parser.state = S.COMMENT;
						} else if (parser.doctype && parser.doctype !== true) parser.state = S.DOCTYPE_DTD;
						else parser.state = S.TEXT;
						continue;
					case S.CDATA:
						var starti = i - 1;
						while (c && c !== "]") {
							c = charAt(chunk, i++);
							if (c && parser.trackPosition) {
								parser.position++;
								if (c === "\n") {
									parser.line++;
									parser.column = 0;
								} else parser.column++;
							}
						}
						parser.cdata += chunk.substring(starti, i - 1);
						if (c === "]") parser.state = S.CDATA_ENDING;
						continue;
					case S.CDATA_ENDING:
						if (c === "]") parser.state = S.CDATA_ENDING_2;
						else {
							parser.cdata += "]" + c;
							parser.state = S.CDATA;
						}
						continue;
					case S.CDATA_ENDING_2:
						if (c === ">") {
							if (parser.cdata) emitNode(parser, "oncdata", parser.cdata);
							emitNode(parser, "onclosecdata");
							parser.cdata = "";
							parser.state = S.TEXT;
						} else if (c === "]") parser.cdata += "]";
						else {
							parser.cdata += "]]" + c;
							parser.state = S.CDATA;
						}
						continue;
					case S.PROC_INST:
						if (c === "?") parser.state = S.PROC_INST_ENDING;
						else if (isWhitespace(c)) parser.state = S.PROC_INST_BODY;
						else parser.procInstName += c;
						continue;
					case S.PROC_INST_BODY:
						if (!parser.procInstBody && isWhitespace(c)) continue;
						else if (c === "?") parser.state = S.PROC_INST_ENDING;
						else parser.procInstBody += c;
						continue;
					case S.PROC_INST_ENDING:
						if (c === ">") {
							const procInstEndData = {
								name: parser.procInstName,
								body: parser.procInstBody
							};
							validateXmlDeclarationEncoding(parser, procInstEndData);
							emitNode(parser, "onprocessinginstruction", procInstEndData);
							parser.procInstName = parser.procInstBody = "";
							parser.state = S.TEXT;
						} else {
							parser.procInstBody += "?" + c;
							parser.state = S.PROC_INST_BODY;
						}
						continue;
					case S.OPEN_TAG:
						if (isMatch(nameBody, c)) parser.tagName += c;
						else {
							newTag(parser);
							if (c === ">") openTag(parser);
							else if (c === "/") parser.state = S.OPEN_TAG_SLASH;
							else {
								if (!isWhitespace(c)) strictFail(parser, "Invalid character in tag name");
								parser.state = S.ATTRIB;
							}
						}
						continue;
					case S.OPEN_TAG_SLASH:
						if (c === ">") {
							openTag(parser, true);
							closeTag(parser);
						} else {
							strictFail(parser, "Forward-slash in opening tag not followed by >");
							parser.state = S.ATTRIB;
						}
						continue;
					case S.ATTRIB:
						if (isWhitespace(c)) continue;
						else if (c === ">") openTag(parser);
						else if (c === "/") parser.state = S.OPEN_TAG_SLASH;
						else if (isMatch(nameStart, c)) {
							parser.attribName = c;
							parser.attribValue = "";
							parser.state = S.ATTRIB_NAME;
						} else strictFail(parser, "Invalid attribute name");
						continue;
					case S.ATTRIB_NAME:
						if (c === "=") parser.state = S.ATTRIB_VALUE;
						else if (c === ">") {
							strictFail(parser, "Attribute without value");
							parser.attribValue = parser.attribName;
							attrib(parser);
							openTag(parser);
						} else if (isWhitespace(c)) parser.state = S.ATTRIB_NAME_SAW_WHITE;
						else if (isMatch(nameBody, c)) parser.attribName += c;
						else strictFail(parser, "Invalid attribute name");
						continue;
					case S.ATTRIB_NAME_SAW_WHITE:
						if (c === "=") parser.state = S.ATTRIB_VALUE;
						else if (isWhitespace(c)) continue;
						else {
							strictFail(parser, "Attribute without value");
							parser.tag.attributes[parser.attribName] = "";
							parser.attribValue = "";
							emitNode(parser, "onattribute", {
								name: parser.attribName,
								value: ""
							});
							parser.attribName = "";
							if (c === ">") openTag(parser);
							else if (isMatch(nameStart, c)) {
								parser.attribName = c;
								parser.state = S.ATTRIB_NAME;
							} else {
								strictFail(parser, "Invalid attribute name");
								parser.state = S.ATTRIB;
							}
						}
						continue;
					case S.ATTRIB_VALUE:
						if (isWhitespace(c)) continue;
						else if (isQuote(c)) {
							parser.q = c;
							parser.state = S.ATTRIB_VALUE_QUOTED;
						} else {
							if (!parser.opt.unquotedAttributeValues) error(parser, "Unquoted attribute value");
							parser.state = S.ATTRIB_VALUE_UNQUOTED;
							parser.attribValue = c;
						}
						continue;
					case S.ATTRIB_VALUE_QUOTED:
						if (c !== parser.q) {
							if (c === "&") parser.state = S.ATTRIB_VALUE_ENTITY_Q;
							else parser.attribValue += c;
							continue;
						}
						attrib(parser);
						parser.q = "";
						parser.state = S.ATTRIB_VALUE_CLOSED;
						continue;
					case S.ATTRIB_VALUE_CLOSED:
						if (isWhitespace(c)) parser.state = S.ATTRIB;
						else if (c === ">") openTag(parser);
						else if (c === "/") parser.state = S.OPEN_TAG_SLASH;
						else if (isMatch(nameStart, c)) {
							strictFail(parser, "No whitespace between attributes");
							parser.attribName = c;
							parser.attribValue = "";
							parser.state = S.ATTRIB_NAME;
						} else strictFail(parser, "Invalid attribute name");
						continue;
					case S.ATTRIB_VALUE_UNQUOTED:
						if (!isAttribEnd(c)) {
							if (c === "&") parser.state = S.ATTRIB_VALUE_ENTITY_U;
							else parser.attribValue += c;
							continue;
						}
						attrib(parser);
						if (c === ">") openTag(parser);
						else parser.state = S.ATTRIB;
						continue;
					case S.CLOSE_TAG:
						if (!parser.tagName) if (isWhitespace(c)) continue;
						else if (notMatch(nameStart, c)) if (parser.script) {
							parser.script += "</" + c;
							parser.state = S.SCRIPT;
						} else strictFail(parser, "Invalid tagname in closing tag.");
						else parser.tagName = c;
						else if (c === ">") closeTag(parser);
						else if (isMatch(nameBody, c)) parser.tagName += c;
						else if (parser.script) {
							parser.script += "</" + parser.tagName + c;
							parser.tagName = "";
							parser.state = S.SCRIPT;
						} else {
							if (!isWhitespace(c)) strictFail(parser, "Invalid tagname in closing tag");
							parser.state = S.CLOSE_TAG_SAW_WHITE;
						}
						continue;
					case S.CLOSE_TAG_SAW_WHITE:
						if (isWhitespace(c)) continue;
						if (c === ">") closeTag(parser);
						else strictFail(parser, "Invalid characters in closing tag");
						continue;
					case S.TEXT_ENTITY:
					case S.ATTRIB_VALUE_ENTITY_Q:
					case S.ATTRIB_VALUE_ENTITY_U:
						var returnState;
						var buffer;
						switch (parser.state) {
							case S.TEXT_ENTITY:
								returnState = S.TEXT;
								buffer = "textNode";
								break;
							case S.ATTRIB_VALUE_ENTITY_Q:
								returnState = S.ATTRIB_VALUE_QUOTED;
								buffer = "attribValue";
								break;
							case S.ATTRIB_VALUE_ENTITY_U:
								returnState = S.ATTRIB_VALUE_UNQUOTED;
								buffer = "attribValue";
								break;
						}
						if (c === ";") {
							var parsedEntity = parseEntity(parser);
							if (parser.opt.unparsedEntities && !Object.values(sax.XML_ENTITIES).includes(parsedEntity)) {
								if ((parser.entityCount += 1) > parser.opt.maxEntityCount) error(parser, "Parsed entity count exceeds max entity count");
								if ((parser.entityDepth += 1) > parser.opt.maxEntityDepth) error(parser, "Parsed entity depth exceeds max entity depth");
								parser.entity = "";
								parser.state = returnState;
								parser.write(parsedEntity);
								parser.entityDepth -= 1;
							} else {
								parser[buffer] += parsedEntity;
								parser.entity = "";
								parser.state = returnState;
							}
						} else if (isMatch(parser.entity.length ? entityBody : entityStart, c)) parser.entity += c;
						else {
							strictFail(parser, "Invalid character in entity name");
							parser[buffer] += "&" + parser.entity + c;
							parser.entity = "";
							parser.state = returnState;
						}
						continue;
					default: throw new Error(parser, "Unknown state: " + parser.state);
				}
			}
			if (parser.position >= parser.bufferCheckPosition) checkBufferLength(parser);
			return parser;
		}
		/*! http://mths.be/fromcodepoint v0.1.0 by @mathias */
		/* istanbul ignore next */
		if (!String.fromCodePoint) (function() {
			var stringFromCharCode = String.fromCharCode;
			var floor = Math.floor;
			var fromCodePoint = function() {
				var MAX_SIZE = 16384;
				var codeUnits = [];
				var highSurrogate;
				var lowSurrogate;
				var index = -1;
				var length = arguments.length;
				if (!length) return "";
				var result = "";
				while (++index < length) {
					var codePoint = Number(arguments[index]);
					if (!isFinite(codePoint) || codePoint < 0 || codePoint > 1114111 || floor(codePoint) !== codePoint) throw RangeError("Invalid code point: " + codePoint);
					if (codePoint <= 65535) codeUnits.push(codePoint);
					else {
						codePoint -= 65536;
						highSurrogate = (codePoint >> 10) + 55296;
						lowSurrogate = codePoint % 1024 + 56320;
						codeUnits.push(highSurrogate, lowSurrogate);
					}
					if (index + 1 === length || codeUnits.length > MAX_SIZE) {
						result += stringFromCharCode.apply(null, codeUnits);
						codeUnits.length = 0;
					}
				}
				return result;
			};
			/* istanbul ignore next */
			if (Object.defineProperty) Object.defineProperty(String, "fromCodePoint", {
				value: fromCodePoint,
				configurable: true,
				writable: true
			});
			else String.fromCodePoint = fromCodePoint;
		})();
	})(typeof exports === "undefined" ? exports.sax = {} : exports);
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/builder-util-runtime/out/xml.js
var require_xml = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.XElement = void 0;
	exports.parseXml = parseXml;
	var sax = require_sax();
	var error_1 = require_error();
	var XElement = class {
		constructor(name) {
			this.name = name;
			this.value = "";
			this.attributes = null;
			this.isCData = false;
			this.elements = null;
			if (!name) throw (0, error_1.newError)("Element name cannot be empty", "ERR_XML_ELEMENT_NAME_EMPTY");
			if (!isValidName(name)) throw (0, error_1.newError)(`Invalid element name: ${name}`, "ERR_XML_ELEMENT_INVALID_NAME");
		}
		attribute(name) {
			const result = this.attributes === null ? null : this.attributes[name];
			if (result == null) throw (0, error_1.newError)(`No attribute "${name}"`, "ERR_XML_MISSED_ATTRIBUTE");
			return result;
		}
		removeAttribute(name) {
			if (this.attributes !== null) delete this.attributes[name];
		}
		element(name, ignoreCase = false, errorIfMissed = null) {
			const result = this.elementOrNull(name, ignoreCase);
			if (result === null) throw (0, error_1.newError)(errorIfMissed || `No element "${name}"`, "ERR_XML_MISSED_ELEMENT");
			return result;
		}
		elementOrNull(name, ignoreCase = false) {
			if (this.elements === null) return null;
			for (const element of this.elements) if (isNameEquals(element, name, ignoreCase)) return element;
			return null;
		}
		getElements(name, ignoreCase = false) {
			if (this.elements === null) return [];
			return this.elements.filter((it) => isNameEquals(it, name, ignoreCase));
		}
		elementValueOrEmpty(name, ignoreCase = false) {
			const element = this.elementOrNull(name, ignoreCase);
			return element === null ? "" : element.value;
		}
	};
	exports.XElement = XElement;
	var NAME_REG_EXP = /* @__PURE__ */ new RegExp(/^[A-Za-z_][:A-Za-z0-9_-]*$/i);
	function isValidName(name) {
		return NAME_REG_EXP.test(name);
	}
	function isNameEquals(element, name, ignoreCase) {
		const elementName = element.name;
		return elementName === name || ignoreCase === true && elementName.length === name.length && elementName.toLowerCase() === name.toLowerCase();
	}
	function parseXml(data) {
		let rootElement = null;
		const parser = sax.parser(true, {});
		const elements = [];
		parser.onopentag = (saxElement) => {
			const element = new XElement(saxElement.name);
			element.attributes = saxElement.attributes;
			if (rootElement === null) rootElement = element;
			else {
				const parent = elements[elements.length - 1];
				if (parent.elements == null) parent.elements = [];
				parent.elements.push(element);
			}
			elements.push(element);
		};
		parser.onclosetag = () => {
			elements.pop();
		};
		parser.ontext = (text) => {
			if (elements.length > 0) elements[elements.length - 1].value = text;
		};
		parser.oncdata = (cdata) => {
			const element = elements[elements.length - 1];
			element.value = cdata;
			element.isCData = true;
		};
		parser.onerror = (err) => {
			throw err;
		};
		parser.write(data);
		return rootElement;
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/builder-util-runtime/out/objects.js
var require_objects = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.mapToObject = mapToObject;
	exports.isValidKey = isValidKey;
	exports.asArray = asArray;
	exports.deepAssign = deepAssign;
	exports.objectToArgs = objectToArgs;
	function mapToObject(map) {
		const obj = {};
		for (const [key, value] of map) {
			if (!isValidKey(key)) continue;
			if (value instanceof Map) obj[key] = mapToObject(value);
			else obj[key] = value;
		}
		return obj;
	}
	function isValidKey(key) {
		if ([
			"__proto__",
			"prototype",
			"constructor"
		].includes(key)) return false;
		return [
			"string",
			"number",
			"symbol",
			"boolean"
		].includes(typeof key) || key === null;
	}
	function asArray(v) {
		if (v == null) return [];
		else if (Array.isArray(v)) return v;
		else return [v];
	}
	function isObject(x) {
		if (Array.isArray(x)) return false;
		const type = typeof x;
		return type === "object" || type === "function";
	}
	function assignKey(target, from, key) {
		const value = from[key];
		if (value === void 0) return;
		const prevValue = target[key];
		if (prevValue == null || value == null || !isObject(prevValue) || !isObject(value)) if (Array.isArray(prevValue) && Array.isArray(value)) target[key] = Array.from(new Set(prevValue.concat(value)));
		else target[key] = value;
		else target[key] = assign(prevValue, value);
	}
	function assign(to, from) {
		if (to !== from) {
			for (const key of Object.getOwnPropertyNames(from)) if (isValidKey(key)) assignKey(to, from, key);
		}
		return to;
	}
	function deepAssign(target, ...objects) {
		for (const o of objects) if (o != null) assign(target, o);
		return target;
	}
	var SAFE_FLAG_NAME_RE = /^[a-zA-Z][a-zA-Z0-9-]*$/;
	var UNSAFE_VALUE_RE = /[\0\r\n]/;
	function objectToArgs(obj) {
		const args = Object.entries(obj).reduce((args, [name, value]) => {
			if (!isValidKey(name) || value == null) return args;
			if (!SAFE_FLAG_NAME_RE.test(name)) throw new Error(`objectToArgs: unsafe flag name rejected: ${JSON.stringify(name)}`);
			if (UNSAFE_VALUE_RE.test(value)) throw new Error(`objectToArgs: value for --${name} contains a null byte or newline`);
			return args.concat([`--${name}`, value]);
		}, []);
		return Object.freeze(args);
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/builder-util-runtime/out/index.js
var require_out = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.CURRENT_APP_PACKAGE_FILE_NAME = exports.CURRENT_APP_INSTALLER_FILE_NAME = exports.objectToArgs = exports.deepAssign = exports.asArray = exports.mapToObject = exports.isValidKey = exports.XElement = exports.parseXml = exports.UUID = exports.parseDn = exports.retry = exports.githubTagPrefix = exports.githubUrl = exports.getS3LikeProviderBaseUrl = exports.ProgressCallbackTransform = exports.MemoLazy = exports.safeStringifyJson = exports.safeGetHeader = exports.parseJson = exports.isSensitiveFieldName = exports.HttpExecutor = exports.hashSensitiveValue = exports.HttpError = exports.DigestTransform = exports.createHttpError = exports.configureRequestUrl = exports.configureRequestOptionsFromUrl = exports.configureRequestOptions = exports.newError = exports.CancellationToken = exports.CancellationError = void 0;
	var CancellationToken_1 = require_CancellationToken();
	Object.defineProperty(exports, "CancellationError", {
		enumerable: true,
		get: function() {
			return CancellationToken_1.CancellationError;
		}
	});
	Object.defineProperty(exports, "CancellationToken", {
		enumerable: true,
		get: function() {
			return CancellationToken_1.CancellationToken;
		}
	});
	var error_1 = require_error();
	Object.defineProperty(exports, "newError", {
		enumerable: true,
		get: function() {
			return error_1.newError;
		}
	});
	var httpExecutor_1 = require_httpExecutor();
	Object.defineProperty(exports, "configureRequestOptions", {
		enumerable: true,
		get: function() {
			return httpExecutor_1.configureRequestOptions;
		}
	});
	Object.defineProperty(exports, "configureRequestOptionsFromUrl", {
		enumerable: true,
		get: function() {
			return httpExecutor_1.configureRequestOptionsFromUrl;
		}
	});
	Object.defineProperty(exports, "configureRequestUrl", {
		enumerable: true,
		get: function() {
			return httpExecutor_1.configureRequestUrl;
		}
	});
	Object.defineProperty(exports, "createHttpError", {
		enumerable: true,
		get: function() {
			return httpExecutor_1.createHttpError;
		}
	});
	Object.defineProperty(exports, "DigestTransform", {
		enumerable: true,
		get: function() {
			return httpExecutor_1.DigestTransform;
		}
	});
	Object.defineProperty(exports, "HttpError", {
		enumerable: true,
		get: function() {
			return httpExecutor_1.HttpError;
		}
	});
	Object.defineProperty(exports, "hashSensitiveValue", {
		enumerable: true,
		get: function() {
			return httpExecutor_1.hashSensitiveValue;
		}
	});
	Object.defineProperty(exports, "HttpExecutor", {
		enumerable: true,
		get: function() {
			return httpExecutor_1.HttpExecutor;
		}
	});
	Object.defineProperty(exports, "isSensitiveFieldName", {
		enumerable: true,
		get: function() {
			return httpExecutor_1.isSensitiveFieldName;
		}
	});
	Object.defineProperty(exports, "parseJson", {
		enumerable: true,
		get: function() {
			return httpExecutor_1.parseJson;
		}
	});
	Object.defineProperty(exports, "safeGetHeader", {
		enumerable: true,
		get: function() {
			return httpExecutor_1.safeGetHeader;
		}
	});
	Object.defineProperty(exports, "safeStringifyJson", {
		enumerable: true,
		get: function() {
			return httpExecutor_1.safeStringifyJson;
		}
	});
	var MemoLazy_1 = require_MemoLazy();
	Object.defineProperty(exports, "MemoLazy", {
		enumerable: true,
		get: function() {
			return MemoLazy_1.MemoLazy;
		}
	});
	var ProgressCallbackTransform_1 = require_ProgressCallbackTransform();
	Object.defineProperty(exports, "ProgressCallbackTransform", {
		enumerable: true,
		get: function() {
			return ProgressCallbackTransform_1.ProgressCallbackTransform;
		}
	});
	var publishOptions_1 = require_publishOptions();
	Object.defineProperty(exports, "getS3LikeProviderBaseUrl", {
		enumerable: true,
		get: function() {
			return publishOptions_1.getS3LikeProviderBaseUrl;
		}
	});
	Object.defineProperty(exports, "githubUrl", {
		enumerable: true,
		get: function() {
			return publishOptions_1.githubUrl;
		}
	});
	Object.defineProperty(exports, "githubTagPrefix", {
		enumerable: true,
		get: function() {
			return publishOptions_1.githubTagPrefix;
		}
	});
	var retry_1 = require_retry();
	Object.defineProperty(exports, "retry", {
		enumerable: true,
		get: function() {
			return retry_1.retry;
		}
	});
	var rfc2253Parser_1 = require_rfc2253Parser();
	Object.defineProperty(exports, "parseDn", {
		enumerable: true,
		get: function() {
			return rfc2253Parser_1.parseDn;
		}
	});
	var uuid_1 = require_uuid();
	Object.defineProperty(exports, "UUID", {
		enumerable: true,
		get: function() {
			return uuid_1.UUID;
		}
	});
	var xml_1 = require_xml();
	Object.defineProperty(exports, "parseXml", {
		enumerable: true,
		get: function() {
			return xml_1.parseXml;
		}
	});
	Object.defineProperty(exports, "XElement", {
		enumerable: true,
		get: function() {
			return xml_1.XElement;
		}
	});
	var objects_1 = require_objects();
	Object.defineProperty(exports, "isValidKey", {
		enumerable: true,
		get: function() {
			return objects_1.isValidKey;
		}
	});
	Object.defineProperty(exports, "mapToObject", {
		enumerable: true,
		get: function() {
			return objects_1.mapToObject;
		}
	});
	Object.defineProperty(exports, "asArray", {
		enumerable: true,
		get: function() {
			return objects_1.asArray;
		}
	});
	Object.defineProperty(exports, "deepAssign", {
		enumerable: true,
		get: function() {
			return objects_1.deepAssign;
		}
	});
	Object.defineProperty(exports, "objectToArgs", {
		enumerable: true,
		get: function() {
			return objects_1.objectToArgs;
		}
	});
	exports.CURRENT_APP_INSTALLER_FILE_NAME = "installer.exe";
	exports.CURRENT_APP_PACKAGE_FILE_NAME = "package.7z";
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/common.js
var require_common = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function isNothing(subject) {
		return typeof subject === "undefined" || subject === null;
	}
	function isObject(subject) {
		return typeof subject === "object" && subject !== null;
	}
	function toArray(sequence) {
		if (Array.isArray(sequence)) return sequence;
		else if (isNothing(sequence)) return [];
		return [sequence];
	}
	function extend(target, source) {
		if (source) {
			const sourceKeys = Object.keys(source);
			for (let index = 0, length = sourceKeys.length; index < length; index += 1) {
				const key = sourceKeys[index];
				target[key] = source[key];
			}
		}
		return target;
	}
	function repeat(string, count) {
		let result = "";
		for (let cycle = 0; cycle < count; cycle += 1) result += string;
		return result;
	}
	function isNegativeZero(number) {
		return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
	}
	module.exports.isNothing = isNothing;
	module.exports.isObject = isObject;
	module.exports.toArray = toArray;
	module.exports.repeat = repeat;
	module.exports.isNegativeZero = isNegativeZero;
	module.exports.extend = extend;
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/exception.js
var require_exception = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function formatError(exception, compact) {
		let where = "";
		const message = exception.reason || "(unknown reason)";
		if (!exception.mark) return message;
		if (exception.mark.name) where += "in \"" + exception.mark.name + "\" ";
		where += "(" + (exception.mark.line + 1) + ":" + (exception.mark.column + 1) + ")";
		if (!compact && exception.mark.snippet) where += "\n\n" + exception.mark.snippet;
		return message + " " + where;
	}
	function YAMLException(reason, mark) {
		Error.call(this);
		this.name = "YAMLException";
		this.reason = reason;
		this.mark = mark;
		this.message = formatError(this, false);
		if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
		else this.stack = (/* @__PURE__ */ new Error()).stack || "";
	}
	YAMLException.prototype = Object.create(Error.prototype);
	YAMLException.prototype.constructor = YAMLException;
	YAMLException.prototype.toString = function toString(compact) {
		return this.name + ": " + formatError(this, compact);
	};
	module.exports = YAMLException;
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/snippet.js
var require_snippet = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var common = require_common();
	function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
		let head = "";
		let tail = "";
		const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
		if (position - lineStart > maxHalfLength) {
			head = " ... ";
			lineStart = position - maxHalfLength + head.length;
		}
		if (lineEnd - position > maxHalfLength) {
			tail = " ...";
			lineEnd = position + maxHalfLength - tail.length;
		}
		return {
			str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "→") + tail,
			pos: position - lineStart + head.length
		};
	}
	function padStart(string, max) {
		return common.repeat(" ", max - string.length) + string;
	}
	function makeSnippet(mark, options) {
		options = Object.create(options || null);
		if (!mark.buffer) return null;
		if (!options.maxLength) options.maxLength = 79;
		if (typeof options.indent !== "number") options.indent = 1;
		if (typeof options.linesBefore !== "number") options.linesBefore = 3;
		if (typeof options.linesAfter !== "number") options.linesAfter = 2;
		const re = /\r?\n|\r|\0/g;
		const lineStarts = [0];
		const lineEnds = [];
		let match;
		let foundLineNo = -1;
		while (match = re.exec(mark.buffer)) {
			lineEnds.push(match.index);
			lineStarts.push(match.index + match[0].length);
			if (mark.position <= match.index && foundLineNo < 0) foundLineNo = lineStarts.length - 2;
		}
		if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
		let result = "";
		const lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
		const maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
		for (let i = 1; i <= options.linesBefore; i++) {
			if (foundLineNo - i < 0) break;
			const line = getLine(mark.buffer, lineStarts[foundLineNo - i], lineEnds[foundLineNo - i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]), maxLineLength);
			result = common.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line.str + "\n" + result;
		}
		const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
		result += common.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
		result += common.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
		for (let i = 1; i <= options.linesAfter; i++) {
			if (foundLineNo + i >= lineEnds.length) break;
			const line = getLine(mark.buffer, lineStarts[foundLineNo + i], lineEnds[foundLineNo + i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]), maxLineLength);
			result += common.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line.str + "\n";
		}
		return result.replace(/\n$/, "");
	}
	module.exports = makeSnippet;
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/type.js
var require_type = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var YAMLException = require_exception();
	var TYPE_CONSTRUCTOR_OPTIONS = [
		"kind",
		"multi",
		"resolve",
		"construct",
		"instanceOf",
		"predicate",
		"represent",
		"representName",
		"defaultStyle",
		"styleAliases"
	];
	var YAML_NODE_KINDS = [
		"scalar",
		"sequence",
		"mapping"
	];
	function compileStyleAliases(map) {
		const result = {};
		if (map !== null) Object.keys(map).forEach(function(style) {
			map[style].forEach(function(alias) {
				result[String(alias)] = style;
			});
		});
		return result;
	}
	function Type(tag, options) {
		options = options || {};
		Object.keys(options).forEach(function(name) {
			if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) throw new YAMLException("Unknown option \"" + name + "\" is met in definition of \"" + tag + "\" YAML type.");
		});
		this.options = options;
		this.tag = tag;
		this.kind = options["kind"] || null;
		this.resolve = options["resolve"] || function() {
			return true;
		};
		this.construct = options["construct"] || function(data) {
			return data;
		};
		this.instanceOf = options["instanceOf"] || null;
		this.predicate = options["predicate"] || null;
		this.represent = options["represent"] || null;
		this.representName = options["representName"] || null;
		this.defaultStyle = options["defaultStyle"] || null;
		this.multi = options["multi"] || false;
		this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
		if (YAML_NODE_KINDS.indexOf(this.kind) === -1) throw new YAMLException("Unknown kind \"" + this.kind + "\" is specified for \"" + tag + "\" YAML type.");
	}
	module.exports = Type;
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/schema.js
var require_schema = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var YAMLException = require_exception();
	var Type = require_type();
	function compileList(schema, name) {
		const result = [];
		schema[name].forEach(function(currentType) {
			let newIndex = result.length;
			result.forEach(function(previousType, previousIndex) {
				if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) newIndex = previousIndex;
			});
			result[newIndex] = currentType;
		});
		return result;
	}
	function compileMap() {
		const result = {
			scalar: {},
			sequence: {},
			mapping: {},
			fallback: {},
			multi: {
				scalar: [],
				sequence: [],
				mapping: [],
				fallback: []
			}
		};
		function collectType(type) {
			if (type.multi) {
				result.multi[type.kind].push(type);
				result.multi["fallback"].push(type);
			} else result[type.kind][type.tag] = result["fallback"][type.tag] = type;
		}
		for (let index = 0, length = arguments.length; index < length; index += 1) arguments[index].forEach(collectType);
		return result;
	}
	function Schema(definition) {
		return this.extend(definition);
	}
	Schema.prototype.extend = function extend(definition) {
		let implicit = [];
		let explicit = [];
		if (definition instanceof Type) explicit.push(definition);
		else if (Array.isArray(definition)) explicit = explicit.concat(definition);
		else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
			if (definition.implicit) implicit = implicit.concat(definition.implicit);
			if (definition.explicit) explicit = explicit.concat(definition.explicit);
		} else throw new YAMLException("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
		implicit.forEach(function(type) {
			if (!(type instanceof Type)) throw new YAMLException("Specified list of YAML types (or a single Type object) contains a non-Type object.");
			if (type.loadKind && type.loadKind !== "scalar") throw new YAMLException("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
			if (type.multi) throw new YAMLException("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
		});
		explicit.forEach(function(type) {
			if (!(type instanceof Type)) throw new YAMLException("Specified list of YAML types (or a single Type object) contains a non-Type object.");
		});
		const result = Object.create(Schema.prototype);
		result.implicit = (this.implicit || []).concat(implicit);
		result.explicit = (this.explicit || []).concat(explicit);
		result.compiledImplicit = compileList(result, "implicit");
		result.compiledExplicit = compileList(result, "explicit");
		result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
		return result;
	};
	module.exports = Schema;
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/type/str.js
var require_str = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = new (require_type())("tag:yaml.org,2002:str", {
		kind: "scalar",
		construct: function(data) {
			return data !== null ? data : "";
		}
	});
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/type/seq.js
var require_seq = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = new (require_type())("tag:yaml.org,2002:seq", {
		kind: "sequence",
		construct: function(data) {
			return data !== null ? data : [];
		}
	});
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/type/map.js
var require_map = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = new (require_type())("tag:yaml.org,2002:map", {
		kind: "mapping",
		construct: function(data) {
			return data !== null ? data : {};
		}
	});
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/schema/failsafe.js
var require_failsafe = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = new (require_schema())({ explicit: [
		require_str(),
		require_seq(),
		require_map()
	] });
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/type/null.js
var require_null = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	function resolveYamlNull(data) {
		if (data === null) return true;
		const max = data.length;
		return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
	}
	function constructYamlNull() {
		return null;
	}
	function isNull(object) {
		return object === null;
	}
	module.exports = new Type("tag:yaml.org,2002:null", {
		kind: "scalar",
		resolve: resolveYamlNull,
		construct: constructYamlNull,
		predicate: isNull,
		represent: {
			canonical: function() {
				return "~";
			},
			lowercase: function() {
				return "null";
			},
			uppercase: function() {
				return "NULL";
			},
			camelcase: function() {
				return "Null";
			},
			empty: function() {
				return "";
			}
		},
		defaultStyle: "lowercase"
	});
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/type/bool.js
var require_bool = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	function resolveYamlBoolean(data) {
		if (data === null) return false;
		const max = data.length;
		return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
	}
	function constructYamlBoolean(data) {
		return data === "true" || data === "True" || data === "TRUE";
	}
	function isBoolean(object) {
		return Object.prototype.toString.call(object) === "[object Boolean]";
	}
	module.exports = new Type("tag:yaml.org,2002:bool", {
		kind: "scalar",
		resolve: resolveYamlBoolean,
		construct: constructYamlBoolean,
		predicate: isBoolean,
		represent: {
			lowercase: function(object) {
				return object ? "true" : "false";
			},
			uppercase: function(object) {
				return object ? "TRUE" : "FALSE";
			},
			camelcase: function(object) {
				return object ? "True" : "False";
			}
		},
		defaultStyle: "lowercase"
	});
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/type/int.js
var require_int = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var common = require_common();
	var Type = require_type();
	function isHexCode(c) {
		return c >= 48 && c <= 57 || c >= 65 && c <= 70 || c >= 97 && c <= 102;
	}
	function isOctCode(c) {
		return c >= 48 && c <= 55;
	}
	function isDecCode(c) {
		return c >= 48 && c <= 57;
	}
	function resolveYamlInteger(data) {
		if (data === null) return false;
		const max = data.length;
		let index = 0;
		let hasDigits = false;
		if (!max) return false;
		let ch = data[index];
		if (ch === "-" || ch === "+") ch = data[++index];
		if (ch === "0") {
			if (index + 1 === max) return true;
			ch = data[++index];
			if (ch === "b") {
				index++;
				for (; index < max; index++) {
					ch = data[index];
					if (ch !== "0" && ch !== "1") return false;
					hasDigits = true;
				}
				return hasDigits && Number.isFinite(parseYamlInteger(data));
			}
			if (ch === "x") {
				index++;
				for (; index < max; index++) {
					if (!isHexCode(data.charCodeAt(index))) return false;
					hasDigits = true;
				}
				return hasDigits && Number.isFinite(parseYamlInteger(data));
			}
			if (ch === "o") {
				index++;
				for (; index < max; index++) {
					if (!isOctCode(data.charCodeAt(index))) return false;
					hasDigits = true;
				}
				return hasDigits && Number.isFinite(parseYamlInteger(data));
			}
		}
		for (; index < max; index++) {
			if (!isDecCode(data.charCodeAt(index))) return false;
			hasDigits = true;
		}
		if (!hasDigits) return false;
		return Number.isFinite(parseYamlInteger(data));
	}
	function parseYamlInteger(data) {
		let value = data;
		let sign = 1;
		let ch = value[0];
		if (ch === "-" || ch === "+") {
			if (ch === "-") sign = -1;
			value = value.slice(1);
			ch = value[0];
		}
		if (value === "0") return 0;
		if (ch === "0") {
			if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
			if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
			if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
		}
		return sign * parseInt(value, 10);
	}
	function constructYamlInteger(data) {
		return parseYamlInteger(data);
	}
	function isInteger(object) {
		return Object.prototype.toString.call(object) === "[object Number]" && object % 1 === 0 && !common.isNegativeZero(object);
	}
	module.exports = new Type("tag:yaml.org,2002:int", {
		kind: "scalar",
		resolve: resolveYamlInteger,
		construct: constructYamlInteger,
		predicate: isInteger,
		represent: {
			binary: function(obj) {
				return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
			},
			octal: function(obj) {
				return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
			},
			decimal: function(obj) {
				return obj.toString(10);
			},
			hexadecimal: function(obj) {
				return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
			}
		},
		defaultStyle: "decimal",
		styleAliases: {
			binary: [2, "bin"],
			octal: [8, "oct"],
			decimal: [10, "dec"],
			hexadecimal: [16, "hex"]
		}
	});
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/type/float.js
var require_float = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var common = require_common();
	var Type = require_type();
	var YAML_FLOAT_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
	var YAML_FLOAT_SPECIAL_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
	function resolveYamlFloat(data) {
		if (data === null) return false;
		if (!YAML_FLOAT_PATTERN.test(data)) return false;
		if (Number.isFinite(parseFloat(data, 10))) return true;
		return YAML_FLOAT_SPECIAL_PATTERN.test(data);
	}
	function constructYamlFloat(data) {
		let value = data.toLowerCase();
		const sign = value[0] === "-" ? -1 : 1;
		if ("+-".indexOf(value[0]) >= 0) value = value.slice(1);
		if (value === ".inf") return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
		else if (value === ".nan") return NaN;
		return sign * parseFloat(value, 10);
	}
	var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
	function representYamlFloat(object, style) {
		if (isNaN(object)) switch (style) {
			case "lowercase": return ".nan";
			case "uppercase": return ".NAN";
			case "camelcase": return ".NaN";
		}
		else if (Number.POSITIVE_INFINITY === object) switch (style) {
			case "lowercase": return ".inf";
			case "uppercase": return ".INF";
			case "camelcase": return ".Inf";
		}
		else if (Number.NEGATIVE_INFINITY === object) switch (style) {
			case "lowercase": return "-.inf";
			case "uppercase": return "-.INF";
			case "camelcase": return "-.Inf";
		}
		else if (common.isNegativeZero(object)) return "-0.0";
		const res = object.toString(10);
		return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
	}
	function isFloat(object) {
		return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common.isNegativeZero(object));
	}
	module.exports = new Type("tag:yaml.org,2002:float", {
		kind: "scalar",
		resolve: resolveYamlFloat,
		construct: constructYamlFloat,
		predicate: isFloat,
		represent: representYamlFloat,
		defaultStyle: "lowercase"
	});
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/schema/json.js
var require_json = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_failsafe().extend({ implicit: [
		require_null(),
		require_bool(),
		require_int(),
		require_float()
	] });
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/schema/core.js
var require_core = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_json();
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/type/timestamp.js
var require_timestamp = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	var YAML_DATE_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$");
	var YAML_TIMESTAMP_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$");
	function resolveYamlTimestamp(data) {
		if (data === null) return false;
		if (YAML_DATE_REGEXP.exec(data) !== null) return true;
		if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
		return false;
	}
	function constructYamlTimestamp(data) {
		let fraction = 0;
		let delta = null;
		let match = YAML_DATE_REGEXP.exec(data);
		if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
		if (match === null) throw new Error("Date resolve error");
		const year = +match[1];
		const month = +match[2] - 1;
		const day = +match[3];
		if (!match[4]) return new Date(Date.UTC(year, month, day));
		const hour = +match[4];
		const minute = +match[5];
		const second = +match[6];
		if (match[7]) {
			fraction = match[7].slice(0, 3);
			while (fraction.length < 3) fraction += "0";
			fraction = +fraction;
		}
		if (match[9]) {
			const tzHour = +match[10];
			const tzMinute = +(match[11] || 0);
			delta = (tzHour * 60 + tzMinute) * 6e4;
			if (match[9] === "-") delta = -delta;
		}
		const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
		if (delta) date.setTime(date.getTime() - delta);
		return date;
	}
	function representYamlTimestamp(object) {
		return object.toISOString();
	}
	module.exports = new Type("tag:yaml.org,2002:timestamp", {
		kind: "scalar",
		resolve: resolveYamlTimestamp,
		construct: constructYamlTimestamp,
		instanceOf: Date,
		represent: representYamlTimestamp
	});
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/type/merge.js
var require_merge = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	function resolveYamlMerge(data) {
		return data === "<<" || data === null;
	}
	module.exports = new Type("tag:yaml.org,2002:merge", {
		kind: "scalar",
		resolve: resolveYamlMerge
	});
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/type/binary.js
var require_binary = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	var BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
	function resolveYamlBinary(data) {
		if (data === null) return false;
		let bitlen = 0;
		const max = data.length;
		const map = BASE64_MAP;
		for (let idx = 0; idx < max; idx++) {
			const code = map.indexOf(data.charAt(idx));
			if (code > 64) continue;
			if (code < 0) return false;
			bitlen += 6;
		}
		return bitlen % 8 === 0;
	}
	function constructYamlBinary(data) {
		const input = data.replace(/[\r\n=]/g, "");
		const max = input.length;
		const map = BASE64_MAP;
		let bits = 0;
		const result = [];
		for (let idx = 0; idx < max; idx++) {
			if (idx % 4 === 0 && idx) {
				result.push(bits >> 16 & 255);
				result.push(bits >> 8 & 255);
				result.push(bits & 255);
			}
			bits = bits << 6 | map.indexOf(input.charAt(idx));
		}
		const tailbits = max % 4 * 6;
		if (tailbits === 0) {
			result.push(bits >> 16 & 255);
			result.push(bits >> 8 & 255);
			result.push(bits & 255);
		} else if (tailbits === 18) {
			result.push(bits >> 10 & 255);
			result.push(bits >> 2 & 255);
		} else if (tailbits === 12) result.push(bits >> 4 & 255);
		return new Uint8Array(result);
	}
	function representYamlBinary(object) {
		let result = "";
		let bits = 0;
		const max = object.length;
		const map = BASE64_MAP;
		for (let idx = 0; idx < max; idx++) {
			if (idx % 3 === 0 && idx) {
				result += map[bits >> 18 & 63];
				result += map[bits >> 12 & 63];
				result += map[bits >> 6 & 63];
				result += map[bits & 63];
			}
			bits = (bits << 8) + object[idx];
		}
		const tail = max % 3;
		if (tail === 0) {
			result += map[bits >> 18 & 63];
			result += map[bits >> 12 & 63];
			result += map[bits >> 6 & 63];
			result += map[bits & 63];
		} else if (tail === 2) {
			result += map[bits >> 10 & 63];
			result += map[bits >> 4 & 63];
			result += map[bits << 2 & 63];
			result += map[64];
		} else if (tail === 1) {
			result += map[bits >> 2 & 63];
			result += map[bits << 4 & 63];
			result += map[64];
			result += map[64];
		}
		return result;
	}
	function isBinary(obj) {
		return Object.prototype.toString.call(obj) === "[object Uint8Array]";
	}
	module.exports = new Type("tag:yaml.org,2002:binary", {
		kind: "scalar",
		resolve: resolveYamlBinary,
		construct: constructYamlBinary,
		predicate: isBinary,
		represent: representYamlBinary
	});
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/type/omap.js
var require_omap = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	var _hasOwnProperty = Object.prototype.hasOwnProperty;
	var _toString = Object.prototype.toString;
	function resolveYamlOmap(data) {
		if (data === null) return true;
		const objectKeys = [];
		const object = data;
		for (let index = 0, length = object.length; index < length; index += 1) {
			const pair = object[index];
			let pairHasKey = false;
			if (_toString.call(pair) !== "[object Object]") return false;
			let pairKey;
			for (pairKey in pair) if (_hasOwnProperty.call(pair, pairKey)) if (!pairHasKey) pairHasKey = true;
			else return false;
			if (!pairHasKey) return false;
			if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
			else return false;
		}
		return true;
	}
	function constructYamlOmap(data) {
		return data !== null ? data : [];
	}
	module.exports = new Type("tag:yaml.org,2002:omap", {
		kind: "sequence",
		resolve: resolveYamlOmap,
		construct: constructYamlOmap
	});
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/type/pairs.js
var require_pairs = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	var _toString = Object.prototype.toString;
	function resolveYamlPairs(data) {
		if (data === null) return true;
		const object = data;
		const result = new Array(object.length);
		for (let index = 0, length = object.length; index < length; index += 1) {
			const pair = object[index];
			if (_toString.call(pair) !== "[object Object]") return false;
			const keys = Object.keys(pair);
			if (keys.length !== 1) return false;
			result[index] = [keys[0], pair[keys[0]]];
		}
		return true;
	}
	function constructYamlPairs(data) {
		if (data === null) return [];
		const object = data;
		const result = new Array(object.length);
		for (let index = 0, length = object.length; index < length; index += 1) {
			const pair = object[index];
			const keys = Object.keys(pair);
			result[index] = [keys[0], pair[keys[0]]];
		}
		return result;
	}
	module.exports = new Type("tag:yaml.org,2002:pairs", {
		kind: "sequence",
		resolve: resolveYamlPairs,
		construct: constructYamlPairs
	});
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/type/set.js
var require_set = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	var _hasOwnProperty = Object.prototype.hasOwnProperty;
	function resolveYamlSet(data) {
		if (data === null) return true;
		const object = data;
		for (const key in object) if (_hasOwnProperty.call(object, key)) {
			if (object[key] !== null) return false;
		}
		return true;
	}
	function constructYamlSet(data) {
		return data !== null ? data : {};
	}
	module.exports = new Type("tag:yaml.org,2002:set", {
		kind: "mapping",
		resolve: resolveYamlSet,
		construct: constructYamlSet
	});
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/schema/default.js
var require_default = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_core().extend({
		implicit: [require_timestamp(), require_merge()],
		explicit: [
			require_binary(),
			require_omap(),
			require_pairs(),
			require_set()
		]
	});
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/loader.js
var require_loader = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var common = require_common();
	var YAMLException = require_exception();
	var makeSnippet = require_snippet();
	var DEFAULT_SCHEMA = require_default();
	var _hasOwnProperty = Object.prototype.hasOwnProperty;
	var CONTEXT_FLOW_IN = 1;
	var CONTEXT_FLOW_OUT = 2;
	var CONTEXT_BLOCK_IN = 3;
	var CONTEXT_BLOCK_OUT = 4;
	var CHOMPING_CLIP = 1;
	var CHOMPING_STRIP = 2;
	var CHOMPING_KEEP = 3;
	var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
	var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
	var PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
	var PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
	var PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;
	function _class(obj) {
		return Object.prototype.toString.call(obj);
	}
	function isEol(c) {
		return c === 10 || c === 13;
	}
	function isWhiteSpace(c) {
		return c === 9 || c === 32;
	}
	function isWsOrEol(c) {
		return c === 9 || c === 32 || c === 10 || c === 13;
	}
	function isFlowIndicator(c) {
		return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
	}
	function fromHexCode(c) {
		if (c >= 48 && c <= 57) return c - 48;
		const lc = c | 32;
		if (lc >= 97 && lc <= 102) return lc - 97 + 10;
		return -1;
	}
	function escapedHexLen(c) {
		if (c === 120) return 2;
		if (c === 117) return 4;
		if (c === 85) return 8;
		return 0;
	}
	function fromDecimalCode(c) {
		if (c >= 48 && c <= 57) return c - 48;
		return -1;
	}
	function simpleEscapeSequence(c) {
		switch (c) {
			case 48: return "\0";
			case 97: return "\x07";
			case 98: return "\b";
			case 116: return "	";
			case 9: return "	";
			case 110: return "\n";
			case 118: return "\v";
			case 102: return "\f";
			case 114: return "\r";
			case 101: return "\x1B";
			case 32: return " ";
			case 34: return "\"";
			case 47: return "/";
			case 92: return "\\";
			case 78: return "";
			case 95: return "\xA0";
			case 76: return "\u2028";
			case 80: return "\u2029";
			default: return "";
		}
	}
	function charFromCodepoint(c) {
		if (c <= 65535) return String.fromCharCode(c);
		return String.fromCharCode((c - 65536 >> 10) + 55296, (c - 65536 & 1023) + 56320);
	}
	function setProperty(object, key, value) {
		if (key === "__proto__") Object.defineProperty(object, key, {
			configurable: true,
			enumerable: true,
			writable: true,
			value
		});
		else object[key] = value;
	}
	var simpleEscapeCheck = new Array(256);
	var simpleEscapeMap = new Array(256);
	for (let i = 0; i < 256; i++) {
		simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
		simpleEscapeMap[i] = simpleEscapeSequence(i);
	}
	function State(input, options) {
		this.input = input;
		this.filename = options["filename"] || null;
		this.schema = options["schema"] || DEFAULT_SCHEMA;
		this.onWarning = options["onWarning"] || null;
		this.legacy = options["legacy"] || false;
		this.json = options["json"] || false;
		this.listener = options["listener"] || null;
		this.maxDepth = typeof options["maxDepth"] === "number" ? options["maxDepth"] : 100;
		this.maxMergeSeqLength = typeof options["maxMergeSeqLength"] === "number" ? options["maxMergeSeqLength"] : 20;
		this.implicitTypes = this.schema.compiledImplicit;
		this.typeMap = this.schema.compiledTypeMap;
		this.length = input.length;
		this.position = 0;
		this.line = 0;
		this.lineStart = 0;
		this.lineIndent = 0;
		this.depth = 0;
		this.firstTabInLine = -1;
		this.documents = [];
		this.anchorMapTransactions = [];
	}
	function generateError(state, message) {
		const mark = {
			name: state.filename,
			buffer: state.input.slice(0, -1),
			position: state.position,
			line: state.line,
			column: state.position - state.lineStart
		};
		mark.snippet = makeSnippet(mark);
		return new YAMLException(message, mark);
	}
	function throwError(state, message) {
		throw generateError(state, message);
	}
	function throwWarning(state, message) {
		if (state.onWarning) state.onWarning.call(null, generateError(state, message));
	}
	function storeAnchor(state, name, value) {
		const transactions = state.anchorMapTransactions;
		if (transactions.length !== 0) {
			const transaction = transactions[transactions.length - 1];
			if (!_hasOwnProperty.call(transaction, name)) transaction[name] = {
				existed: _hasOwnProperty.call(state.anchorMap, name),
				value: state.anchorMap[name]
			};
		}
		state.anchorMap[name] = value;
	}
	function beginAnchorTransaction(state) {
		state.anchorMapTransactions.push(Object.create(null));
	}
	function commitAnchorTransaction(state) {
		const transaction = state.anchorMapTransactions.pop();
		const transactions = state.anchorMapTransactions;
		if (transactions.length === 0) return;
		const parent = transactions[transactions.length - 1];
		const names = Object.keys(transaction);
		for (let index = 0, length = names.length; index < length; index += 1) {
			const name = names[index];
			if (!_hasOwnProperty.call(parent, name)) parent[name] = transaction[name];
		}
	}
	function rollbackAnchorTransaction(state) {
		const transaction = state.anchorMapTransactions.pop();
		const names = Object.keys(transaction);
		for (let index = names.length - 1; index >= 0; index -= 1) {
			const entry = transaction[names[index]];
			if (entry.existed) state.anchorMap[names[index]] = entry.value;
			else delete state.anchorMap[names[index]];
		}
	}
	function snapshotState(state) {
		return {
			position: state.position,
			line: state.line,
			lineStart: state.lineStart,
			lineIndent: state.lineIndent,
			firstTabInLine: state.firstTabInLine,
			tag: state.tag,
			anchor: state.anchor,
			kind: state.kind,
			result: state.result
		};
	}
	function restoreState(state, snapshot) {
		state.position = snapshot.position;
		state.line = snapshot.line;
		state.lineStart = snapshot.lineStart;
		state.lineIndent = snapshot.lineIndent;
		state.firstTabInLine = snapshot.firstTabInLine;
		state.tag = snapshot.tag;
		state.anchor = snapshot.anchor;
		state.kind = snapshot.kind;
		state.result = snapshot.result;
	}
	var directiveHandlers = {
		YAML: function handleYamlDirective(state, name, args) {
			if (state.version !== null) throwError(state, "duplication of %YAML directive");
			if (args.length !== 1) throwError(state, "YAML directive accepts exactly one argument");
			const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
			if (match === null) throwError(state, "ill-formed argument of the YAML directive");
			const major = parseInt(match[1], 10);
			const minor = parseInt(match[2], 10);
			if (major !== 1) throwError(state, "unacceptable YAML version of the document");
			state.version = args[0];
			state.checkLineBreaks = minor < 2;
			if (minor !== 1 && minor !== 2) throwWarning(state, "unsupported YAML version of the document");
		},
		TAG: function handleTagDirective(state, name, args) {
			let prefix;
			if (args.length !== 2) throwError(state, "TAG directive accepts exactly two arguments");
			const handle = args[0];
			prefix = args[1];
			if (!PATTERN_TAG_HANDLE.test(handle)) throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
			if (_hasOwnProperty.call(state.tagMap, handle)) throwError(state, "there is a previously declared suffix for \"" + handle + "\" tag handle");
			if (!PATTERN_TAG_URI.test(prefix)) throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
			try {
				prefix = decodeURIComponent(prefix);
			} catch (err) {
				throwError(state, "tag prefix is malformed: " + prefix);
			}
			state.tagMap[handle] = prefix;
		}
	};
	function captureSegment(state, start, end, checkJson) {
		if (start < end) {
			const _result = state.input.slice(start, end);
			if (checkJson) for (let _position = 0, _length = _result.length; _position < _length; _position += 1) {
				const _character = _result.charCodeAt(_position);
				if (!(_character === 9 || _character >= 32 && _character <= 1114111)) throwError(state, "expected valid JSON character");
			}
			else if (PATTERN_NON_PRINTABLE.test(_result)) throwError(state, "the stream contains non-printable characters");
			state.result += _result;
		}
	}
	function mergeMappings(state, destination, source, overridableKeys) {
		if (!common.isObject(source)) throwError(state, "cannot merge mappings; the provided source object is unacceptable");
		const sourceKeys = Object.keys(source);
		for (let index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
			const key = sourceKeys[index];
			if (!_hasOwnProperty.call(destination, key)) {
				setProperty(destination, key, source[key]);
				overridableKeys[key] = true;
			}
		}
	}
	function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
		if (Array.isArray(keyNode)) {
			keyNode = Array.prototype.slice.call(keyNode);
			for (let index = 0, quantity = keyNode.length; index < quantity; index += 1) {
				if (Array.isArray(keyNode[index])) throwError(state, "nested arrays are not supported inside keys");
				if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") keyNode[index] = "[object Object]";
			}
		}
		if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") keyNode = "[object Object]";
		keyNode = String(keyNode);
		if (_result === null) _result = {};
		if (keyTag === "tag:yaml.org,2002:merge") if (Array.isArray(valueNode)) {
			if (valueNode.length > state.maxMergeSeqLength) throwError(state, "merge sequence length exceeded maxMergeSeqLength (" + state.maxMergeSeqLength + ")");
			const seen = /* @__PURE__ */ new Set();
			for (let index = 0, quantity = valueNode.length; index < quantity; index += 1) {
				const src = valueNode[index];
				if (seen.has(src)) continue;
				seen.add(src);
				mergeMappings(state, _result, src, overridableKeys);
			}
		} else mergeMappings(state, _result, valueNode, overridableKeys);
		else {
			if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
				state.line = startLine || state.line;
				state.lineStart = startLineStart || state.lineStart;
				state.position = startPos || state.position;
				throwError(state, "duplicated mapping key");
			}
			setProperty(_result, keyNode, valueNode);
			delete overridableKeys[keyNode];
		}
		return _result;
	}
	function readLineBreak(state) {
		const ch = state.input.charCodeAt(state.position);
		if (ch === 10) state.position++;
		else if (ch === 13) {
			state.position++;
			if (state.input.charCodeAt(state.position) === 10) state.position++;
		} else throwError(state, "a line break is expected");
		state.line += 1;
		state.lineStart = state.position;
		state.firstTabInLine = -1;
	}
	function skipSeparationSpace(state, allowComments, checkIndent) {
		let lineBreaks = 0;
		let ch = state.input.charCodeAt(state.position);
		while (ch !== 0) {
			while (isWhiteSpace(ch)) {
				if (ch === 9 && state.firstTabInLine === -1) state.firstTabInLine = state.position;
				ch = state.input.charCodeAt(++state.position);
			}
			if (allowComments && ch === 35) do
				ch = state.input.charCodeAt(++state.position);
			while (ch !== 10 && ch !== 13 && ch !== 0);
			if (isEol(ch)) {
				readLineBreak(state);
				ch = state.input.charCodeAt(state.position);
				lineBreaks++;
				state.lineIndent = 0;
				while (ch === 32) {
					state.lineIndent++;
					ch = state.input.charCodeAt(++state.position);
				}
			} else break;
		}
		if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) throwWarning(state, "deficient indentation");
		return lineBreaks;
	}
	function testDocumentSeparator(state) {
		let _position = state.position;
		let ch = state.input.charCodeAt(_position);
		if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
			_position += 3;
			ch = state.input.charCodeAt(_position);
			if (ch === 0 || isWsOrEol(ch)) return true;
		}
		return false;
	}
	function writeFoldedLines(state, count) {
		if (count === 1) state.result += " ";
		else if (count > 1) state.result += common.repeat("\n", count - 1);
	}
	function readPlainScalar(state, nodeIndent, withinFlowCollection) {
		let captureStart;
		let captureEnd;
		let hasPendingContent;
		let _line;
		let _lineStart;
		let _lineIndent;
		const _kind = state.kind;
		const _result = state.result;
		let ch = state.input.charCodeAt(state.position);
		if (isWsOrEol(ch) || isFlowIndicator(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) return false;
		if (ch === 63 || ch === 45) {
			const following = state.input.charCodeAt(state.position + 1);
			if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) return false;
		}
		state.kind = "scalar";
		state.result = "";
		captureStart = captureEnd = state.position;
		hasPendingContent = false;
		while (ch !== 0) {
			if (ch === 58) {
				const following = state.input.charCodeAt(state.position + 1);
				if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) break;
			} else if (ch === 35) {
				if (isWsOrEol(state.input.charCodeAt(state.position - 1))) break;
			} else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && isFlowIndicator(ch)) break;
			else if (isEol(ch)) {
				_line = state.line;
				_lineStart = state.lineStart;
				_lineIndent = state.lineIndent;
				skipSeparationSpace(state, false, -1);
				if (state.lineIndent >= nodeIndent) {
					hasPendingContent = true;
					ch = state.input.charCodeAt(state.position);
					continue;
				} else {
					state.position = captureEnd;
					state.line = _line;
					state.lineStart = _lineStart;
					state.lineIndent = _lineIndent;
					break;
				}
			}
			if (hasPendingContent) {
				captureSegment(state, captureStart, captureEnd, false);
				writeFoldedLines(state, state.line - _line);
				captureStart = captureEnd = state.position;
				hasPendingContent = false;
			}
			if (!isWhiteSpace(ch)) captureEnd = state.position + 1;
			ch = state.input.charCodeAt(++state.position);
		}
		captureSegment(state, captureStart, captureEnd, false);
		if (state.result) return true;
		state.kind = _kind;
		state.result = _result;
		return false;
	}
	function readSingleQuotedScalar(state, nodeIndent) {
		let captureStart;
		let captureEnd;
		let ch = state.input.charCodeAt(state.position);
		if (ch !== 39) return false;
		state.kind = "scalar";
		state.result = "";
		state.position++;
		captureStart = captureEnd = state.position;
		while ((ch = state.input.charCodeAt(state.position)) !== 0) if (ch === 39) {
			captureSegment(state, captureStart, state.position, true);
			ch = state.input.charCodeAt(++state.position);
			if (ch === 39) {
				captureStart = state.position;
				state.position++;
				captureEnd = state.position;
			} else return true;
		} else if (isEol(ch)) {
			captureSegment(state, captureStart, captureEnd, true);
			writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
			captureStart = captureEnd = state.position;
		} else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a single quoted scalar");
		else {
			state.position++;
			if (!isWhiteSpace(ch)) captureEnd = state.position;
		}
		throwError(state, "unexpected end of the stream within a single quoted scalar");
	}
	function readDoubleQuotedScalar(state, nodeIndent) {
		let captureStart;
		let captureEnd;
		let tmp;
		let ch = state.input.charCodeAt(state.position);
		if (ch !== 34) return false;
		state.kind = "scalar";
		state.result = "";
		state.position++;
		captureStart = captureEnd = state.position;
		while ((ch = state.input.charCodeAt(state.position)) !== 0) if (ch === 34) {
			captureSegment(state, captureStart, state.position, true);
			state.position++;
			return true;
		} else if (ch === 92) {
			captureSegment(state, captureStart, state.position, true);
			ch = state.input.charCodeAt(++state.position);
			if (isEol(ch)) skipSeparationSpace(state, false, nodeIndent);
			else if (ch < 256 && simpleEscapeCheck[ch]) {
				state.result += simpleEscapeMap[ch];
				state.position++;
			} else if ((tmp = escapedHexLen(ch)) > 0) {
				let hexLength = tmp;
				let hexResult = 0;
				for (; hexLength > 0; hexLength--) {
					ch = state.input.charCodeAt(++state.position);
					if ((tmp = fromHexCode(ch)) >= 0) hexResult = (hexResult << 4) + tmp;
					else throwError(state, "expected hexadecimal character");
				}
				state.result += charFromCodepoint(hexResult);
				state.position++;
			} else throwError(state, "unknown escape sequence");
			captureStart = captureEnd = state.position;
		} else if (isEol(ch)) {
			captureSegment(state, captureStart, captureEnd, true);
			writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
			captureStart = captureEnd = state.position;
		} else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a double quoted scalar");
		else {
			state.position++;
			if (!isWhiteSpace(ch)) captureEnd = state.position;
		}
		throwError(state, "unexpected end of the stream within a double quoted scalar");
	}
	function readFlowCollection(state, nodeIndent) {
		let readNext = true;
		let _line;
		let _lineStart;
		let _pos;
		const _tag = state.tag;
		let _result;
		const _anchor = state.anchor;
		let terminator;
		let isPair;
		let isExplicitPair;
		let isMapping;
		const overridableKeys = Object.create(null);
		let keyNode;
		let keyTag;
		let valueNode;
		let ch = state.input.charCodeAt(state.position);
		if (ch === 91) {
			terminator = 93;
			isMapping = false;
			_result = [];
		} else if (ch === 123) {
			terminator = 125;
			isMapping = true;
			_result = {};
		} else return false;
		if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
		ch = state.input.charCodeAt(++state.position);
		while (ch !== 0) {
			skipSeparationSpace(state, true, nodeIndent);
			ch = state.input.charCodeAt(state.position);
			if (ch === terminator) {
				state.position++;
				state.tag = _tag;
				state.anchor = _anchor;
				state.kind = isMapping ? "mapping" : "sequence";
				state.result = _result;
				return true;
			} else if (!readNext) throwError(state, "missed comma between flow collection entries");
			else if (ch === 44) throwError(state, "expected the node content, but found ','");
			keyTag = keyNode = valueNode = null;
			isPair = isExplicitPair = false;
			if (ch === 63) {
				if (isWsOrEol(state.input.charCodeAt(state.position + 1))) {
					isPair = isExplicitPair = true;
					state.position++;
					skipSeparationSpace(state, true, nodeIndent);
				}
			}
			_line = state.line;
			_lineStart = state.lineStart;
			_pos = state.position;
			composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
			keyTag = state.tag;
			keyNode = state.result;
			skipSeparationSpace(state, true, nodeIndent);
			ch = state.input.charCodeAt(state.position);
			if ((isExplicitPair || state.line === _line) && ch === 58) {
				isPair = true;
				ch = state.input.charCodeAt(++state.position);
				skipSeparationSpace(state, true, nodeIndent);
				composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
				valueNode = state.result;
			}
			if (isMapping) storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
			else if (isPair) _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
			else _result.push(keyNode);
			skipSeparationSpace(state, true, nodeIndent);
			ch = state.input.charCodeAt(state.position);
			if (ch === 44) {
				readNext = true;
				ch = state.input.charCodeAt(++state.position);
			} else readNext = false;
		}
		throwError(state, "unexpected end of the stream within a flow collection");
	}
	function readBlockScalar(state, nodeIndent) {
		let folding;
		let chomping = CHOMPING_CLIP;
		let didReadContent = false;
		let detectedIndent = false;
		let textIndent = nodeIndent;
		let emptyLines = 0;
		let atMoreIndented = false;
		let tmp;
		let ch = state.input.charCodeAt(state.position);
		if (ch === 124) folding = false;
		else if (ch === 62) folding = true;
		else return false;
		state.kind = "scalar";
		state.result = "";
		while (ch !== 0) {
			ch = state.input.charCodeAt(++state.position);
			if (ch === 43 || ch === 45) if (CHOMPING_CLIP === chomping) chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
			else throwError(state, "repeat of a chomping mode identifier");
			else if ((tmp = fromDecimalCode(ch)) >= 0) if (tmp === 0) throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
			else if (!detectedIndent) {
				textIndent = nodeIndent + tmp - 1;
				detectedIndent = true;
			} else throwError(state, "repeat of an indentation width identifier");
			else break;
		}
		if (isWhiteSpace(ch)) {
			do
				ch = state.input.charCodeAt(++state.position);
			while (isWhiteSpace(ch));
			if (ch === 35) do
				ch = state.input.charCodeAt(++state.position);
			while (!isEol(ch) && ch !== 0);
		}
		while (ch !== 0) {
			readLineBreak(state);
			state.lineIndent = 0;
			ch = state.input.charCodeAt(state.position);
			while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
				state.lineIndent++;
				ch = state.input.charCodeAt(++state.position);
			}
			if (!detectedIndent && state.lineIndent > textIndent) textIndent = state.lineIndent;
			if (isEol(ch)) {
				emptyLines++;
				continue;
			}
			if (!detectedIndent && textIndent === 0) throwError(state, "missing indentation for block scalar");
			if (state.lineIndent < textIndent) {
				if (chomping === CHOMPING_KEEP) state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
				else if (chomping === CHOMPING_CLIP) {
					if (didReadContent) state.result += "\n";
				}
				break;
			}
			if (folding) if (isWhiteSpace(ch)) {
				atMoreIndented = true;
				state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
			} else if (atMoreIndented) {
				atMoreIndented = false;
				state.result += common.repeat("\n", emptyLines + 1);
			} else if (emptyLines === 0) {
				if (didReadContent) state.result += " ";
			} else state.result += common.repeat("\n", emptyLines);
			else state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
			didReadContent = true;
			detectedIndent = true;
			emptyLines = 0;
			const captureStart = state.position;
			while (!isEol(ch) && ch !== 0) ch = state.input.charCodeAt(++state.position);
			captureSegment(state, captureStart, state.position, false);
		}
		return true;
	}
	function readBlockSequence(state, nodeIndent) {
		const _tag = state.tag;
		const _anchor = state.anchor;
		const _result = [];
		let detected = false;
		if (state.firstTabInLine !== -1) return false;
		if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
		let ch = state.input.charCodeAt(state.position);
		while (ch !== 0) {
			if (state.firstTabInLine !== -1) {
				state.position = state.firstTabInLine;
				throwError(state, "tab characters must not be used in indentation");
			}
			if (ch !== 45) break;
			if (!isWsOrEol(state.input.charCodeAt(state.position + 1))) break;
			detected = true;
			state.position++;
			if (skipSeparationSpace(state, true, -1)) {
				if (state.lineIndent <= nodeIndent) {
					_result.push(null);
					ch = state.input.charCodeAt(state.position);
					continue;
				}
			}
			const _line = state.line;
			composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
			_result.push(state.result);
			skipSeparationSpace(state, true, -1);
			ch = state.input.charCodeAt(state.position);
			if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) throwError(state, "bad indentation of a sequence entry");
			else if (state.lineIndent < nodeIndent) break;
		}
		if (detected) {
			state.tag = _tag;
			state.anchor = _anchor;
			state.kind = "sequence";
			state.result = _result;
			return true;
		}
		return false;
	}
	function readBlockMapping(state, nodeIndent, flowIndent) {
		let allowCompact;
		let _keyLine;
		let _keyLineStart;
		let _keyPos;
		const _tag = state.tag;
		const _anchor = state.anchor;
		const _result = {};
		const overridableKeys = Object.create(null);
		let keyTag = null;
		let keyNode = null;
		let valueNode = null;
		let atExplicitKey = false;
		let detected = false;
		if (state.firstTabInLine !== -1) return false;
		if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
		let ch = state.input.charCodeAt(state.position);
		while (ch !== 0) {
			if (!atExplicitKey && state.firstTabInLine !== -1) {
				state.position = state.firstTabInLine;
				throwError(state, "tab characters must not be used in indentation");
			}
			const following = state.input.charCodeAt(state.position + 1);
			const _line = state.line;
			if ((ch === 63 || ch === 58) && isWsOrEol(following)) {
				if (ch === 63) {
					if (atExplicitKey) {
						storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
						keyTag = keyNode = valueNode = null;
					}
					detected = true;
					atExplicitKey = true;
					allowCompact = true;
				} else if (atExplicitKey) {
					atExplicitKey = false;
					allowCompact = true;
				} else throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
				state.position += 1;
				ch = following;
			} else {
				_keyLine = state.line;
				_keyLineStart = state.lineStart;
				_keyPos = state.position;
				if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) break;
				if (state.line === _line) {
					ch = state.input.charCodeAt(state.position);
					while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
					if (ch === 58) {
						ch = state.input.charCodeAt(++state.position);
						if (!isWsOrEol(ch)) throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
						if (atExplicitKey) {
							storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
							keyTag = keyNode = valueNode = null;
						}
						detected = true;
						atExplicitKey = false;
						allowCompact = false;
						keyTag = state.tag;
						keyNode = state.result;
					} else if (detected) throwError(state, "can not read an implicit mapping pair; a colon is missed");
					else {
						state.tag = _tag;
						state.anchor = _anchor;
						return true;
					}
				} else if (detected) throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
				else {
					state.tag = _tag;
					state.anchor = _anchor;
					return true;
				}
			}
			if (state.line === _line || state.lineIndent > nodeIndent) {
				if (atExplicitKey) {
					_keyLine = state.line;
					_keyLineStart = state.lineStart;
					_keyPos = state.position;
				}
				if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) if (atExplicitKey) keyNode = state.result;
				else valueNode = state.result;
				if (!atExplicitKey) {
					storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
					keyTag = keyNode = valueNode = null;
				}
				skipSeparationSpace(state, true, -1);
				ch = state.input.charCodeAt(state.position);
			}
			if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) throwError(state, "bad indentation of a mapping entry");
			else if (state.lineIndent < nodeIndent) break;
		}
		if (atExplicitKey) storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
		if (detected) {
			state.tag = _tag;
			state.anchor = _anchor;
			state.kind = "mapping";
			state.result = _result;
		}
		return detected;
	}
	function readTagProperty(state) {
		let isVerbatim = false;
		let isNamed = false;
		let tagHandle;
		let tagName;
		let ch = state.input.charCodeAt(state.position);
		if (ch !== 33) return false;
		if (state.tag !== null) throwError(state, "duplication of a tag property");
		ch = state.input.charCodeAt(++state.position);
		if (ch === 60) {
			isVerbatim = true;
			ch = state.input.charCodeAt(++state.position);
		} else if (ch === 33) {
			isNamed = true;
			tagHandle = "!!";
			ch = state.input.charCodeAt(++state.position);
		} else tagHandle = "!";
		let _position = state.position;
		if (isVerbatim) {
			do
				ch = state.input.charCodeAt(++state.position);
			while (ch !== 0 && ch !== 62);
			if (state.position < state.length) {
				tagName = state.input.slice(_position, state.position);
				ch = state.input.charCodeAt(++state.position);
			} else throwError(state, "unexpected end of the stream within a verbatim tag");
		} else {
			while (ch !== 0 && !isWsOrEol(ch)) {
				if (ch === 33) if (!isNamed) {
					tagHandle = state.input.slice(_position - 1, state.position + 1);
					if (!PATTERN_TAG_HANDLE.test(tagHandle)) throwError(state, "named tag handle cannot contain such characters");
					isNamed = true;
					_position = state.position + 1;
				} else throwError(state, "tag suffix cannot contain exclamation marks");
				ch = state.input.charCodeAt(++state.position);
			}
			tagName = state.input.slice(_position, state.position);
			if (PATTERN_FLOW_INDICATORS.test(tagName)) throwError(state, "tag suffix cannot contain flow indicator characters");
		}
		if (tagName && !PATTERN_TAG_URI.test(tagName)) throwError(state, "tag name cannot contain such characters: " + tagName);
		try {
			tagName = decodeURIComponent(tagName);
		} catch (err) {
			throwError(state, "tag name is malformed: " + tagName);
		}
		if (isVerbatim) state.tag = tagName;
		else if (_hasOwnProperty.call(state.tagMap, tagHandle)) state.tag = state.tagMap[tagHandle] + tagName;
		else if (tagHandle === "!") state.tag = "!" + tagName;
		else if (tagHandle === "!!") state.tag = "tag:yaml.org,2002:" + tagName;
		else throwError(state, "undeclared tag handle \"" + tagHandle + "\"");
		return true;
	}
	function readAnchorProperty(state) {
		let ch = state.input.charCodeAt(state.position);
		if (ch !== 38) return false;
		if (state.anchor !== null) throwError(state, "duplication of an anchor property");
		ch = state.input.charCodeAt(++state.position);
		const _position = state.position;
		while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) ch = state.input.charCodeAt(++state.position);
		if (state.position === _position) throwError(state, "name of an anchor node must contain at least one character");
		state.anchor = state.input.slice(_position, state.position);
		return true;
	}
	function readAlias(state) {
		let ch = state.input.charCodeAt(state.position);
		if (ch !== 42) return false;
		ch = state.input.charCodeAt(++state.position);
		const _position = state.position;
		while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) ch = state.input.charCodeAt(++state.position);
		if (state.position === _position) throwError(state, "name of an alias node must contain at least one character");
		const alias = state.input.slice(_position, state.position);
		if (!_hasOwnProperty.call(state.anchorMap, alias)) throwError(state, "unidentified alias \"" + alias + "\"");
		state.result = state.anchorMap[alias];
		skipSeparationSpace(state, true, -1);
		return true;
	}
	function tryReadBlockMappingFromProperty(state, propertyStart, nodeIndent, flowIndent) {
		const fallbackState = snapshotState(state);
		beginAnchorTransaction(state);
		restoreState(state, propertyStart);
		state.tag = null;
		state.anchor = null;
		state.kind = null;
		state.result = null;
		if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === "mapping") {
			commitAnchorTransaction(state);
			return true;
		}
		rollbackAnchorTransaction(state);
		restoreState(state, fallbackState);
		return false;
	}
	function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
		let allowBlockScalars;
		let allowBlockCollections;
		let indentStatus = 1;
		let atNewLine = false;
		let hasContent = false;
		let propertyStart = null;
		let type;
		let flowIndent;
		let blockIndent;
		if (state.depth >= state.maxDepth) throwError(state, "nesting exceeded maxDepth (" + state.maxDepth + ")");
		state.depth += 1;
		if (state.listener !== null) state.listener("open", state);
		state.tag = null;
		state.anchor = null;
		state.kind = null;
		state.result = null;
		const allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
		if (allowToSeek) {
			if (skipSeparationSpace(state, true, -1)) {
				atNewLine = true;
				if (state.lineIndent > parentIndent) indentStatus = 1;
				else if (state.lineIndent === parentIndent) indentStatus = 0;
				else if (state.lineIndent < parentIndent) indentStatus = -1;
			}
		}
		if (indentStatus === 1) while (true) {
			const ch = state.input.charCodeAt(state.position);
			const propertyState = snapshotState(state);
			if (atNewLine && (ch === 33 && state.tag !== null || ch === 38 && state.anchor !== null)) break;
			if (!readTagProperty(state) && !readAnchorProperty(state)) break;
			if (propertyStart === null) propertyStart = propertyState;
			if (skipSeparationSpace(state, true, -1)) {
				atNewLine = true;
				allowBlockCollections = allowBlockStyles;
				if (state.lineIndent > parentIndent) indentStatus = 1;
				else if (state.lineIndent === parentIndent) indentStatus = 0;
				else if (state.lineIndent < parentIndent) indentStatus = -1;
			} else allowBlockCollections = false;
		}
		if (allowBlockCollections) allowBlockCollections = atNewLine || allowCompact;
		if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
			if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) flowIndent = parentIndent;
			else flowIndent = parentIndent + 1;
			blockIndent = state.position - state.lineStart;
			if (indentStatus === 1) if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) hasContent = true;
			else {
				const ch = state.input.charCodeAt(state.position);
				if (propertyStart !== null && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62 && tryReadBlockMappingFromProperty(state, propertyStart, propertyStart.position - propertyStart.lineStart, flowIndent)) hasContent = true;
				else if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) hasContent = true;
				else if (readAlias(state)) {
					hasContent = true;
					if (state.tag !== null || state.anchor !== null) throwError(state, "alias node should not have any properties");
				} else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
					hasContent = true;
					if (state.tag === null) state.tag = "?";
				}
				if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
			}
			else if (indentStatus === 0) hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
		}
		if (state.tag === null) {
			if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
		} else if (state.tag === "?") {
			if (state.result !== null && state.kind !== "scalar") throwError(state, "unacceptable node kind for !<?> tag; it should be \"scalar\", not \"" + state.kind + "\"");
			for (let typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
				type = state.implicitTypes[typeIndex];
				if (type.resolve(state.result)) {
					state.result = type.construct(state.result);
					state.tag = type.tag;
					if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
					break;
				}
			}
		} else if (state.tag !== "!") {
			if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) type = state.typeMap[state.kind || "fallback"][state.tag];
			else {
				type = null;
				const typeList = state.typeMap.multi[state.kind || "fallback"];
				for (let typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
					type = typeList[typeIndex];
					break;
				}
			}
			if (!type) throwError(state, "unknown tag !<" + state.tag + ">");
			if (state.result !== null && type.kind !== state.kind) throwError(state, "unacceptable node kind for !<" + state.tag + "> tag; it should be \"" + type.kind + "\", not \"" + state.kind + "\"");
			if (!type.resolve(state.result, state.tag)) throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
			else {
				state.result = type.construct(state.result, state.tag);
				if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
			}
		}
		if (state.listener !== null) state.listener("close", state);
		state.depth -= 1;
		return state.tag !== null || state.anchor !== null || hasContent;
	}
	function readDocument(state) {
		const documentStart = state.position;
		let hasDirectives = false;
		let ch;
		state.version = null;
		state.checkLineBreaks = state.legacy;
		state.tagMap = Object.create(null);
		state.anchorMap = Object.create(null);
		while ((ch = state.input.charCodeAt(state.position)) !== 0) {
			skipSeparationSpace(state, true, -1);
			ch = state.input.charCodeAt(state.position);
			if (state.lineIndent > 0 || ch !== 37) break;
			hasDirectives = true;
			ch = state.input.charCodeAt(++state.position);
			let _position = state.position;
			while (ch !== 0 && !isWsOrEol(ch)) ch = state.input.charCodeAt(++state.position);
			const directiveName = state.input.slice(_position, state.position);
			const directiveArgs = [];
			if (directiveName.length < 1) throwError(state, "directive name must not be less than one character in length");
			while (ch !== 0) {
				while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
				if (ch === 35) {
					do
						ch = state.input.charCodeAt(++state.position);
					while (ch !== 0 && !isEol(ch));
					break;
				}
				if (isEol(ch)) break;
				_position = state.position;
				while (ch !== 0 && !isWsOrEol(ch)) ch = state.input.charCodeAt(++state.position);
				directiveArgs.push(state.input.slice(_position, state.position));
			}
			if (ch !== 0) readLineBreak(state);
			if (_hasOwnProperty.call(directiveHandlers, directiveName)) directiveHandlers[directiveName](state, directiveName, directiveArgs);
			else throwWarning(state, "unknown document directive \"" + directiveName + "\"");
		}
		skipSeparationSpace(state, true, -1);
		if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
			state.position += 3;
			skipSeparationSpace(state, true, -1);
		} else if (hasDirectives) throwError(state, "directives end mark is expected");
		composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
		skipSeparationSpace(state, true, -1);
		if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) throwWarning(state, "non-ASCII line breaks are interpreted as content");
		state.documents.push(state.result);
		if (state.position === state.lineStart && testDocumentSeparator(state)) {
			if (state.input.charCodeAt(state.position) === 46) {
				state.position += 3;
				skipSeparationSpace(state, true, -1);
			}
			return;
		}
		if (state.position < state.length - 1) throwError(state, "end of the stream or a document separator is expected");
	}
	function loadDocuments(input, options) {
		input = String(input);
		options = options || {};
		if (input.length !== 0) {
			if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) input += "\n";
			if (input.charCodeAt(0) === 65279) input = input.slice(1);
		}
		const state = new State(input, options);
		const nullpos = input.indexOf("\0");
		if (nullpos !== -1) {
			state.position = nullpos;
			throwError(state, "null byte is not allowed in input");
		}
		state.input += "\0";
		while (state.input.charCodeAt(state.position) === 32) {
			state.lineIndent += 1;
			state.position += 1;
		}
		while (state.position < state.length - 1) readDocument(state);
		return state.documents;
	}
	function loadAll(input, iterator, options) {
		if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
			options = iterator;
			iterator = null;
		}
		const documents = loadDocuments(input, options);
		if (typeof iterator !== "function") return documents;
		for (let index = 0, length = documents.length; index < length; index += 1) iterator(documents[index]);
	}
	function load(input, options) {
		const documents = loadDocuments(input, options);
		if (documents.length === 0) return;
		else if (documents.length === 1) return documents[0];
		throw new YAMLException("expected a single document in the stream, but found more");
	}
	module.exports.loadAll = loadAll;
	module.exports.load = load;
}));
//#endregion
//#region ../../node_modules/js-yaml/lib/dumper.js
var require_dumper = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var common = require_common();
	var YAMLException = require_exception();
	var DEFAULT_SCHEMA = require_default();
	var _toString = Object.prototype.toString;
	var _hasOwnProperty = Object.prototype.hasOwnProperty;
	var CHAR_BOM = 65279;
	var CHAR_TAB = 9;
	var CHAR_LINE_FEED = 10;
	var CHAR_CARRIAGE_RETURN = 13;
	var CHAR_SPACE = 32;
	var CHAR_EXCLAMATION = 33;
	var CHAR_DOUBLE_QUOTE = 34;
	var CHAR_SHARP = 35;
	var CHAR_PERCENT = 37;
	var CHAR_AMPERSAND = 38;
	var CHAR_SINGLE_QUOTE = 39;
	var CHAR_ASTERISK = 42;
	var CHAR_COMMA = 44;
	var CHAR_MINUS = 45;
	var CHAR_COLON = 58;
	var CHAR_EQUALS = 61;
	var CHAR_GREATER_THAN = 62;
	var CHAR_QUESTION = 63;
	var CHAR_COMMERCIAL_AT = 64;
	var CHAR_LEFT_SQUARE_BRACKET = 91;
	var CHAR_RIGHT_SQUARE_BRACKET = 93;
	var CHAR_GRAVE_ACCENT = 96;
	var CHAR_LEFT_CURLY_BRACKET = 123;
	var CHAR_VERTICAL_LINE = 124;
	var CHAR_RIGHT_CURLY_BRACKET = 125;
	var ESCAPE_SEQUENCES = {};
	ESCAPE_SEQUENCES[0] = "\\0";
	ESCAPE_SEQUENCES[7] = "\\a";
	ESCAPE_SEQUENCES[8] = "\\b";
	ESCAPE_SEQUENCES[9] = "\\t";
	ESCAPE_SEQUENCES[10] = "\\n";
	ESCAPE_SEQUENCES[11] = "\\v";
	ESCAPE_SEQUENCES[12] = "\\f";
	ESCAPE_SEQUENCES[13] = "\\r";
	ESCAPE_SEQUENCES[27] = "\\e";
	ESCAPE_SEQUENCES[34] = "\\\"";
	ESCAPE_SEQUENCES[92] = "\\\\";
	ESCAPE_SEQUENCES[133] = "\\N";
	ESCAPE_SEQUENCES[160] = "\\_";
	ESCAPE_SEQUENCES[8232] = "\\L";
	ESCAPE_SEQUENCES[8233] = "\\P";
	var DEPRECATED_BOOLEANS_SYNTAX = [
		"y",
		"Y",
		"yes",
		"Yes",
		"YES",
		"on",
		"On",
		"ON",
		"n",
		"N",
		"no",
		"No",
		"NO",
		"off",
		"Off",
		"OFF"
	];
	var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
	function compileStyleMap(schema, map) {
		if (map === null) return {};
		const result = {};
		const keys = Object.keys(map);
		for (let index = 0, length = keys.length; index < length; index += 1) {
			let tag = keys[index];
			let style = String(map[tag]);
			if (tag.slice(0, 2) === "!!") tag = "tag:yaml.org,2002:" + tag.slice(2);
			const type = schema.compiledTypeMap["fallback"][tag];
			if (type && _hasOwnProperty.call(type.styleAliases, style)) style = type.styleAliases[style];
			result[tag] = style;
		}
		return result;
	}
	function encodeHex(character) {
		let handle;
		let length;
		const string = character.toString(16).toUpperCase();
		if (character <= 255) {
			handle = "x";
			length = 2;
		} else if (character <= 65535) {
			handle = "u";
			length = 4;
		} else if (character <= 4294967295) {
			handle = "U";
			length = 8;
		} else throw new YAMLException("code point within a string may not be greater than 0xFFFFFFFF");
		return "\\" + handle + common.repeat("0", length - string.length) + string;
	}
	var QUOTING_TYPE_SINGLE = 1;
	var QUOTING_TYPE_DOUBLE = 2;
	function State(options) {
		this.schema = options["schema"] || DEFAULT_SCHEMA;
		this.indent = Math.max(1, options["indent"] || 2);
		this.noArrayIndent = options["noArrayIndent"] || false;
		this.skipInvalid = options["skipInvalid"] || false;
		this.flowLevel = common.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
		this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
		this.sortKeys = options["sortKeys"] || false;
		this.lineWidth = options["lineWidth"] || 80;
		this.noRefs = options["noRefs"] || false;
		this.noCompatMode = options["noCompatMode"] || false;
		this.condenseFlow = options["condenseFlow"] || false;
		this.quotingType = options["quotingType"] === "\"" ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
		this.forceQuotes = options["forceQuotes"] || false;
		this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
		this.implicitTypes = this.schema.compiledImplicit;
		this.explicitTypes = this.schema.compiledExplicit;
		this.tag = null;
		this.result = "";
		this.duplicates = [];
		this.usedDuplicates = null;
	}
	function indentString(string, spaces) {
		const ind = common.repeat(" ", spaces);
		let position = 0;
		let result = "";
		const length = string.length;
		while (position < length) {
			let line;
			const next = string.indexOf("\n", position);
			if (next === -1) {
				line = string.slice(position);
				position = length;
			} else {
				line = string.slice(position, next + 1);
				position = next + 1;
			}
			if (line.length && line !== "\n") result += ind;
			result += line;
		}
		return result;
	}
	function generateNextLine(state, level) {
		return "\n" + common.repeat(" ", state.indent * level);
	}
	function testImplicitResolving(state, str) {
		for (let index = 0, length = state.implicitTypes.length; index < length; index += 1) if (state.implicitTypes[index].resolve(str)) return true;
		return false;
	}
	function isWhitespace(c) {
		return c === CHAR_SPACE || c === CHAR_TAB;
	}
	function isPrintable(c) {
		return c >= 32 && c <= 126 || c >= 161 && c <= 55295 && c !== 8232 && c !== 8233 || c >= 57344 && c <= 65533 && c !== CHAR_BOM || c >= 65536 && c <= 1114111;
	}
	function isNsCharOrWhitespace(c) {
		return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
	}
	function isPlainSafe(c, prev, inblock) {
		const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
		const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
		return (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar;
	}
	function isPlainSafeFirst(c) {
		return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
	}
	function isPlainSafeLast(c) {
		return !isWhitespace(c) && c !== CHAR_COLON;
	}
	function codePointAt(string, pos) {
		const first = string.charCodeAt(pos);
		let second;
		if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
			second = string.charCodeAt(pos + 1);
			if (second >= 56320 && second <= 57343) return (first - 55296) * 1024 + second - 56320 + 65536;
		}
		return first;
	}
	function needIndentIndicator(string) {
		return /^\n* /.test(string);
	}
	var STYLE_PLAIN = 1;
	var STYLE_SINGLE = 2;
	var STYLE_LITERAL = 3;
	var STYLE_FOLDED = 4;
	var STYLE_DOUBLE = 5;
	function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
		let i;
		let char = 0;
		let prevChar = null;
		let hasLineBreak = false;
		let hasFoldableLine = false;
		const shouldTrackWidth = lineWidth !== -1;
		let previousLineBreak = -1;
		let plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
		if (singleLineOnly || forceQuotes) for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
			char = codePointAt(string, i);
			if (!isPrintable(char)) return STYLE_DOUBLE;
			plain = plain && isPlainSafe(char, prevChar, inblock);
			prevChar = char;
		}
		else {
			for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
				char = codePointAt(string, i);
				if (char === CHAR_LINE_FEED) {
					hasLineBreak = true;
					if (shouldTrackWidth) {
						hasFoldableLine = hasFoldableLine || i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
						previousLineBreak = i;
					}
				} else if (!isPrintable(char)) return STYLE_DOUBLE;
				plain = plain && isPlainSafe(char, prevChar, inblock);
				prevChar = char;
			}
			hasFoldableLine = hasFoldableLine || shouldTrackWidth && i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
		}
		if (!hasLineBreak && !hasFoldableLine) {
			if (plain && !forceQuotes && !testAmbiguousType(string)) return STYLE_PLAIN;
			return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
		}
		if (indentPerLevel > 9 && needIndentIndicator(string)) return STYLE_DOUBLE;
		if (!forceQuotes) return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
		return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
	}
	function writeScalar(state, string, level, iskey, inblock) {
		state.dump = function() {
			if (string.length === 0) return state.quotingType === QUOTING_TYPE_DOUBLE ? "\"\"" : "''";
			if (!state.noCompatMode) {
				if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) return state.quotingType === QUOTING_TYPE_DOUBLE ? "\"" + string + "\"" : "'" + string + "'";
			}
			const indent = state.indent * Math.max(1, level);
			const lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
			const singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
			function testAmbiguity(string) {
				return testImplicitResolving(state, string);
			}
			switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {
				case STYLE_PLAIN: return string;
				case STYLE_SINGLE: return "'" + string.replace(/'/g, "''") + "'";
				case STYLE_LITERAL: return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
				case STYLE_FOLDED: return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
				case STYLE_DOUBLE: return "\"" + escapeString(string, lineWidth) + "\"";
				default: throw new YAMLException("impossible error: invalid scalar style");
			}
		}();
	}
	function blockHeader(string, indentPerLevel) {
		const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
		const clip = string[string.length - 1] === "\n";
		return indentIndicator + (clip && (string[string.length - 2] === "\n" || string === "\n") ? "+" : clip ? "" : "-") + "\n";
	}
	function dropEndingNewline(string) {
		return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
	}
	function foldString(string, width) {
		const lineRe = /(\n+)([^\n]*)/g;
		let result = function() {
			let nextLF = string.indexOf("\n");
			nextLF = nextLF !== -1 ? nextLF : string.length;
			lineRe.lastIndex = nextLF;
			return foldLine(string.slice(0, nextLF), width);
		}();
		let prevMoreIndented = string[0] === "\n" || string[0] === " ";
		let moreIndented;
		let match;
		while (match = lineRe.exec(string)) {
			const prefix = match[1];
			const line = match[2];
			moreIndented = line[0] === " ";
			result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
			prevMoreIndented = moreIndented;
		}
		return result;
	}
	function foldLine(line, width) {
		if (line === "" || line[0] === " ") return line;
		const breakRe = / [^ ]/g;
		let match;
		let start = 0;
		let end;
		let curr = 0;
		let next = 0;
		let result = "";
		while (match = breakRe.exec(line)) {
			next = match.index;
			if (next - start > width) {
				end = curr > start ? curr : next;
				result += "\n" + line.slice(start, end);
				start = end + 1;
			}
			curr = next;
		}
		result += "\n";
		if (line.length - start > width && curr > start) result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
		else result += line.slice(start);
		return result.slice(1);
	}
	function escapeString(string) {
		let result = "";
		let char = 0;
		for (let i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
			char = codePointAt(string, i);
			const escapeSeq = ESCAPE_SEQUENCES[char];
			if (!escapeSeq && isPrintable(char)) {
				result += string[i];
				if (char >= 65536) result += string[i + 1];
			} else result += escapeSeq || encodeHex(char);
		}
		return result;
	}
	function writeFlowSequence(state, level, object) {
		let _result = "";
		const _tag = state.tag;
		for (let index = 0, length = object.length; index < length; index += 1) {
			let value = object[index];
			if (state.replacer) value = state.replacer.call(object, String(index), value);
			if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
				if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
				_result += state.dump;
			}
		}
		state.tag = _tag;
		state.dump = "[" + _result + "]";
	}
	function writeBlockSequence(state, level, object, compact) {
		let _result = "";
		const _tag = state.tag;
		for (let index = 0, length = object.length; index < length; index += 1) {
			let value = object[index];
			if (state.replacer) value = state.replacer.call(object, String(index), value);
			if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
				if (!compact || _result !== "") _result += generateNextLine(state, level);
				if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) _result += "-";
				else _result += "- ";
				_result += state.dump;
			}
		}
		state.tag = _tag;
		state.dump = _result || "[]";
	}
	function writeFlowMapping(state, level, object) {
		let _result = "";
		const _tag = state.tag;
		const objectKeyList = Object.keys(object);
		for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
			let pairBuffer = "";
			if (_result !== "") pairBuffer += ", ";
			if (state.condenseFlow) pairBuffer += "\"";
			const objectKey = objectKeyList[index];
			let objectValue = object[objectKey];
			if (state.replacer) objectValue = state.replacer.call(object, objectKey, objectValue);
			if (!writeNode(state, level, objectKey, false, false)) continue;
			if (state.dump.length > 1024) pairBuffer += "? ";
			pairBuffer += state.dump + (state.condenseFlow ? "\"" : "") + ":" + (state.condenseFlow ? "" : " ");
			if (!writeNode(state, level, objectValue, false, false)) continue;
			pairBuffer += state.dump;
			_result += pairBuffer;
		}
		state.tag = _tag;
		state.dump = "{" + _result + "}";
	}
	function writeBlockMapping(state, level, object, compact) {
		let _result = "";
		const _tag = state.tag;
		const objectKeyList = Object.keys(object);
		if (state.sortKeys === true) objectKeyList.sort();
		else if (typeof state.sortKeys === "function") objectKeyList.sort(state.sortKeys);
		else if (state.sortKeys) throw new YAMLException("sortKeys must be a boolean or a function");
		for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
			let pairBuffer = "";
			if (!compact || _result !== "") pairBuffer += generateNextLine(state, level);
			const objectKey = objectKeyList[index];
			let objectValue = object[objectKey];
			if (state.replacer) objectValue = state.replacer.call(object, objectKey, objectValue);
			if (!writeNode(state, level + 1, objectKey, true, true, true)) continue;
			const explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
			if (explicitPair) if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) pairBuffer += "?";
			else pairBuffer += "? ";
			pairBuffer += state.dump;
			if (explicitPair) pairBuffer += generateNextLine(state, level);
			if (!writeNode(state, level + 1, objectValue, true, explicitPair)) continue;
			if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) pairBuffer += ":";
			else pairBuffer += ": ";
			pairBuffer += state.dump;
			_result += pairBuffer;
		}
		state.tag = _tag;
		state.dump = _result || "{}";
	}
	function detectType(state, object, explicit) {
		const typeList = explicit ? state.explicitTypes : state.implicitTypes;
		for (let index = 0, length = typeList.length; index < length; index += 1) {
			const type = typeList[index];
			if ((type.instanceOf || type.predicate) && (!type.instanceOf || typeof object === "object" && object instanceof type.instanceOf) && (!type.predicate || type.predicate(object))) {
				if (explicit) if (type.multi && type.representName) state.tag = type.representName(object);
				else state.tag = type.tag;
				else state.tag = "?";
				if (type.represent) {
					const style = state.styleMap[type.tag] || type.defaultStyle;
					let _result;
					if (_toString.call(type.represent) === "[object Function]") _result = type.represent(object, style);
					else if (_hasOwnProperty.call(type.represent, style)) _result = type.represent[style](object, style);
					else throw new YAMLException("!<" + type.tag + "> tag resolver accepts not \"" + style + "\" style");
					state.dump = _result;
				}
				return true;
			}
		}
		return false;
	}
	function writeNode(state, level, object, block, compact, iskey, isblockseq) {
		state.tag = null;
		state.dump = object;
		if (!detectType(state, object, false)) detectType(state, object, true);
		const type = _toString.call(state.dump);
		const inblock = block;
		if (block) block = state.flowLevel < 0 || state.flowLevel > level;
		const objectOrArray = type === "[object Object]" || type === "[object Array]";
		let duplicateIndex;
		let duplicate;
		if (objectOrArray) {
			duplicateIndex = state.duplicates.indexOf(object);
			duplicate = duplicateIndex !== -1;
		}
		if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) compact = false;
		if (duplicate && state.usedDuplicates[duplicateIndex]) state.dump = "*ref_" + duplicateIndex;
		else {
			if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) state.usedDuplicates[duplicateIndex] = true;
			if (type === "[object Object]") if (block && Object.keys(state.dump).length !== 0) {
				writeBlockMapping(state, level, state.dump, compact);
				if (duplicate) state.dump = "&ref_" + duplicateIndex + state.dump;
			} else {
				writeFlowMapping(state, level, state.dump);
				if (duplicate) state.dump = "&ref_" + duplicateIndex + " " + state.dump;
			}
			else if (type === "[object Array]") if (block && state.dump.length !== 0) {
				if (state.noArrayIndent && !isblockseq && level > 0) writeBlockSequence(state, level - 1, state.dump, compact);
				else writeBlockSequence(state, level, state.dump, compact);
				if (duplicate) state.dump = "&ref_" + duplicateIndex + state.dump;
			} else {
				writeFlowSequence(state, level, state.dump);
				if (duplicate) state.dump = "&ref_" + duplicateIndex + " " + state.dump;
			}
			else if (type === "[object String]") {
				if (state.tag !== "?") writeScalar(state, state.dump, level, iskey, inblock);
			} else if (type === "[object Undefined]") return false;
			else {
				if (state.skipInvalid) return false;
				throw new YAMLException("unacceptable kind of an object to dump " + type);
			}
			if (state.tag !== null && state.tag !== "?") {
				let tagStr = encodeURI(state.tag[0] === "!" ? state.tag.slice(1) : state.tag).replace(/!/g, "%21");
				if (state.tag[0] === "!") tagStr = "!" + tagStr;
				else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") tagStr = "!!" + tagStr.slice(18);
				else tagStr = "!<" + tagStr + ">";
				state.dump = tagStr + " " + state.dump;
			}
		}
		return true;
	}
	function getDuplicateReferences(object, state) {
		const objects = [];
		const duplicatesIndexes = [];
		inspectNode(object, objects, duplicatesIndexes);
		const length = duplicatesIndexes.length;
		for (let index = 0; index < length; index += 1) state.duplicates.push(objects[duplicatesIndexes[index]]);
		state.usedDuplicates = new Array(length);
	}
	function inspectNode(object, objects, duplicatesIndexes) {
		if (object !== null && typeof object === "object") {
			const index = objects.indexOf(object);
			if (index !== -1) {
				if (duplicatesIndexes.indexOf(index) === -1) duplicatesIndexes.push(index);
			} else {
				objects.push(object);
				if (Array.isArray(object)) for (let i = 0, length = object.length; i < length; i += 1) inspectNode(object[i], objects, duplicatesIndexes);
				else {
					const objectKeyList = Object.keys(object);
					for (let i = 0, length = objectKeyList.length; i < length; i += 1) inspectNode(object[objectKeyList[i]], objects, duplicatesIndexes);
				}
			}
		}
	}
	function dump(input, options) {
		options = options || {};
		const state = new State(options);
		if (!state.noRefs) getDuplicateReferences(input, state);
		let value = input;
		if (state.replacer) value = state.replacer.call({ "": value }, "", value);
		if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
		return "";
	}
	module.exports.dump = dump;
}));
//#endregion
//#region ../../node_modules/js-yaml/index.js
var require_js_yaml = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var loader = require_loader();
	var dumper = require_dumper();
	function renamed(from, to) {
		return function() {
			throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
		};
	}
	module.exports.Type = require_type();
	module.exports.Schema = require_schema();
	module.exports.FAILSAFE_SCHEMA = require_failsafe();
	module.exports.JSON_SCHEMA = require_json();
	module.exports.CORE_SCHEMA = require_core();
	module.exports.DEFAULT_SCHEMA = require_default();
	module.exports.load = loader.load;
	module.exports.loadAll = loader.loadAll;
	module.exports.dump = dumper.dump;
	module.exports.YAMLException = require_exception();
	module.exports.types = {
		binary: require_binary(),
		float: require_float(),
		map: require_map(),
		null: require_null(),
		pairs: require_pairs(),
		set: require_set(),
		timestamp: require_timestamp(),
		bool: require_bool(),
		int: require_int(),
		merge: require_merge(),
		omap: require_omap(),
		seq: require_seq(),
		str: require_str()
	};
	module.exports.safeLoad = renamed("safeLoad", "load");
	module.exports.safeLoadAll = renamed("safeLoadAll", "loadAll");
	module.exports.safeDump = renamed("safeDump", "dump");
}));
//#endregion
//#region ../../node_modules/lazy-val/out/main.js
var require_main$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Lazy = void 0;
	var Lazy = class {
		constructor(creator) {
			this._value = null;
			this.creator = creator;
		}
		get hasValue() {
			return this.creator == null;
		}
		get value() {
			if (this.creator == null) return this._value;
			const result = this.creator();
			this.value = result;
			return result;
		}
		set value(value) {
			this._value = value;
			this.creator = null;
		}
	};
	exports.Lazy = Lazy;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/internal/constants.js
var require_constants = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SEMVER_SPEC_VERSION = "2.0.0";
	var MAX_LENGTH = 256;
	var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
	module.exports = {
		MAX_LENGTH,
		MAX_SAFE_COMPONENT_LENGTH: 16,
		MAX_SAFE_BUILD_LENGTH: MAX_LENGTH - 6,
		MAX_SAFE_INTEGER,
		RELEASE_TYPES: [
			"major",
			"premajor",
			"minor",
			"preminor",
			"patch",
			"prepatch",
			"prerelease"
		],
		SEMVER_SPEC_VERSION,
		FLAG_INCLUDE_PRERELEASE: 1,
		FLAG_LOOSE: 2
	};
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/internal/debug.js
var require_debug = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {};
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/internal/re.js
var require_re = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { MAX_SAFE_COMPONENT_LENGTH, MAX_SAFE_BUILD_LENGTH, MAX_LENGTH } = require_constants();
	var debug = require_debug();
	exports = module.exports = {};
	var re = exports.re = [];
	var safeRe = exports.safeRe = [];
	var src = exports.src = [];
	var safeSrc = exports.safeSrc = [];
	var t = exports.t = {};
	var R = 0;
	var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
	var safeRegexReplacements = [
		["\\s", 1],
		["\\d", MAX_LENGTH],
		[LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
	];
	var makeSafeRegex = (value) => {
		for (const [token, max] of safeRegexReplacements) value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
		return value;
	};
	var createToken = (name, value, isGlobal) => {
		const safe = makeSafeRegex(value);
		const index = R++;
		debug(name, index, value);
		t[name] = index;
		src[index] = value;
		safeSrc[index] = safe;
		re[index] = new RegExp(value, isGlobal ? "g" : void 0);
		safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
	};
	createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
	createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
	createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
	createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
	createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
	createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
	createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
	createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
	createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
	createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
	createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
	createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
	createToken("FULL", `^${src[t.FULLPLAIN]}$`);
	createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
	createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
	createToken("GTLT", "((?:<|>)?=?)");
	createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
	createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
	createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
	createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
	createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
	createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("COERCEPLAIN", `(^|[^\\d])(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
	createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
	createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
	createToken("COERCERTL", src[t.COERCE], true);
	createToken("COERCERTLFULL", src[t.COERCEFULL], true);
	createToken("LONETILDE", "(?:~>?)");
	createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
	exports.tildeTrimReplace = "$1~";
	createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
	createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("LONECARET", "(?:\\^)");
	createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
	exports.caretTrimReplace = "$1^";
	createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
	createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
	createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
	createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
	exports.comparatorTrimReplace = "$1$2$3";
	createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
	createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
	createToken("STAR", "(<|>)?=?\\s*\\*");
	createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
	createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/internal/parse-options.js
var require_parse_options = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var looseOption = Object.freeze({ loose: true });
	var emptyOpts = Object.freeze({});
	var parseOptions = (options) => {
		if (!options) return emptyOpts;
		if (typeof options !== "object") return looseOption;
		return options;
	};
	module.exports = parseOptions;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/internal/identifiers.js
var require_identifiers = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var numeric = /^[0-9]+$/;
	var compareIdentifiers = (a, b) => {
		if (typeof a === "number" && typeof b === "number") return a === b ? 0 : a < b ? -1 : 1;
		const anum = numeric.test(a);
		const bnum = numeric.test(b);
		if (anum && bnum) {
			a = +a;
			b = +b;
		}
		return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
	};
	var rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
	module.exports = {
		compareIdentifiers,
		rcompareIdentifiers
	};
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/classes/semver.js
var require_semver$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var debug = require_debug();
	var { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants();
	var { safeRe: re, t } = require_re();
	var parseOptions = require_parse_options();
	var { compareIdentifiers } = require_identifiers();
	module.exports = class SemVer {
		constructor(version, options) {
			options = parseOptions(options);
			if (version instanceof SemVer) if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) return version;
			else version = version.version;
			else if (typeof version !== "string") throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
			if (version.length > MAX_LENGTH) throw new TypeError(`version is longer than ${MAX_LENGTH} characters`);
			debug("SemVer", version, options);
			this.options = options;
			this.loose = !!options.loose;
			this.includePrerelease = !!options.includePrerelease;
			const m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
			if (!m) throw new TypeError(`Invalid Version: ${version}`);
			this.raw = version;
			this.major = +m[1];
			this.minor = +m[2];
			this.patch = +m[3];
			if (this.major > MAX_SAFE_INTEGER || this.major < 0) throw new TypeError("Invalid major version");
			if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) throw new TypeError("Invalid minor version");
			if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) throw new TypeError("Invalid patch version");
			if (!m[4]) this.prerelease = [];
			else this.prerelease = m[4].split(".").map((id) => {
				if (/^[0-9]+$/.test(id)) {
					const num = +id;
					if (num >= 0 && num < MAX_SAFE_INTEGER) return num;
				}
				return id;
			});
			this.build = m[5] ? m[5].split(".") : [];
			this.format();
		}
		format() {
			this.version = `${this.major}.${this.minor}.${this.patch}`;
			if (this.prerelease.length) this.version += `-${this.prerelease.join(".")}`;
			return this.version;
		}
		toString() {
			return this.version;
		}
		compare(other) {
			debug("SemVer.compare", this.version, this.options, other);
			if (!(other instanceof SemVer)) {
				if (typeof other === "string" && other === this.version) return 0;
				other = new SemVer(other, this.options);
			}
			if (other.version === this.version) return 0;
			return this.compareMain(other) || this.comparePre(other);
		}
		compareMain(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			if (this.major < other.major) return -1;
			if (this.major > other.major) return 1;
			if (this.minor < other.minor) return -1;
			if (this.minor > other.minor) return 1;
			if (this.patch < other.patch) return -1;
			if (this.patch > other.patch) return 1;
			return 0;
		}
		comparePre(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			if (this.prerelease.length && !other.prerelease.length) return -1;
			else if (!this.prerelease.length && other.prerelease.length) return 1;
			else if (!this.prerelease.length && !other.prerelease.length) return 0;
			let i = 0;
			do {
				const a = this.prerelease[i];
				const b = other.prerelease[i];
				debug("prerelease compare", i, a, b);
				if (a === void 0 && b === void 0) return 0;
				else if (b === void 0) return 1;
				else if (a === void 0) return -1;
				else if (a === b) continue;
				else return compareIdentifiers(a, b);
			} while (++i);
		}
		compareBuild(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			let i = 0;
			do {
				const a = this.build[i];
				const b = other.build[i];
				debug("build compare", i, a, b);
				if (a === void 0 && b === void 0) return 0;
				else if (b === void 0) return 1;
				else if (a === void 0) return -1;
				else if (a === b) continue;
				else return compareIdentifiers(a, b);
			} while (++i);
		}
		inc(release, identifier, identifierBase) {
			if (release.startsWith("pre")) {
				if (!identifier && identifierBase === false) throw new Error("invalid increment argument: identifier is empty");
				if (identifier) {
					const match = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
					if (!match || match[1] !== identifier) throw new Error(`invalid identifier: ${identifier}`);
				}
			}
			switch (release) {
				case "premajor":
					this.prerelease.length = 0;
					this.patch = 0;
					this.minor = 0;
					this.major++;
					this.inc("pre", identifier, identifierBase);
					break;
				case "preminor":
					this.prerelease.length = 0;
					this.patch = 0;
					this.minor++;
					this.inc("pre", identifier, identifierBase);
					break;
				case "prepatch":
					this.prerelease.length = 0;
					this.inc("patch", identifier, identifierBase);
					this.inc("pre", identifier, identifierBase);
					break;
				case "prerelease":
					if (this.prerelease.length === 0) this.inc("patch", identifier, identifierBase);
					this.inc("pre", identifier, identifierBase);
					break;
				case "release":
					if (this.prerelease.length === 0) throw new Error(`version ${this.raw} is not a prerelease`);
					this.prerelease.length = 0;
					break;
				case "major":
					if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) this.major++;
					this.minor = 0;
					this.patch = 0;
					this.prerelease = [];
					break;
				case "minor":
					if (this.patch !== 0 || this.prerelease.length === 0) this.minor++;
					this.patch = 0;
					this.prerelease = [];
					break;
				case "patch":
					if (this.prerelease.length === 0) this.patch++;
					this.prerelease = [];
					break;
				case "pre": {
					const base = Number(identifierBase) ? 1 : 0;
					if (this.prerelease.length === 0) this.prerelease = [base];
					else {
						let i = this.prerelease.length;
						while (--i >= 0) if (typeof this.prerelease[i] === "number") {
							this.prerelease[i]++;
							i = -2;
						}
						if (i === -1) {
							if (identifier === this.prerelease.join(".") && identifierBase === false) throw new Error("invalid increment argument: identifier already exists");
							this.prerelease.push(base);
						}
					}
					if (identifier) {
						let prerelease = [identifier, base];
						if (identifierBase === false) prerelease = [identifier];
						if (compareIdentifiers(this.prerelease[0], identifier) === 0) {
							if (isNaN(this.prerelease[1])) this.prerelease = prerelease;
						} else this.prerelease = prerelease;
					}
					break;
				}
				default: throw new Error(`invalid increment argument: ${release}`);
			}
			this.raw = this.format();
			if (this.build.length) this.raw += `+${this.build.join(".")}`;
			return this;
		}
	};
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/parse.js
var require_parse = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var parse = (version, options, throwErrors = false) => {
		if (version instanceof SemVer) return version;
		try {
			return new SemVer(version, options);
		} catch (er) {
			if (!throwErrors) return null;
			throw er;
		}
	};
	module.exports = parse;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/valid.js
var require_valid$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parse = require_parse();
	var valid = (version, options) => {
		const v = parse(version, options);
		return v ? v.version : null;
	};
	module.exports = valid;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/clean.js
var require_clean = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parse = require_parse();
	var clean = (version, options) => {
		const s = parse(version.trim().replace(/^[=v]+/, ""), options);
		return s ? s.version : null;
	};
	module.exports = clean;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/inc.js
var require_inc = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var inc = (version, release, options, identifier, identifierBase) => {
		if (typeof options === "string") {
			identifierBase = identifier;
			identifier = options;
			options = void 0;
		}
		try {
			return new SemVer(version instanceof SemVer ? version.version : version, options).inc(release, identifier, identifierBase).version;
		} catch (er) {
			return null;
		}
	};
	module.exports = inc;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/diff.js
var require_diff = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parse = require_parse();
	var diff = (version1, version2) => {
		const v1 = parse(version1, null, true);
		const v2 = parse(version2, null, true);
		const comparison = v1.compare(v2);
		if (comparison === 0) return null;
		const v1Higher = comparison > 0;
		const highVersion = v1Higher ? v1 : v2;
		const lowVersion = v1Higher ? v2 : v1;
		const highHasPre = !!highVersion.prerelease.length;
		if (!!lowVersion.prerelease.length && !highHasPre) {
			if (!lowVersion.patch && !lowVersion.minor) return "major";
			if (lowVersion.compareMain(highVersion) === 0) {
				if (lowVersion.minor && !lowVersion.patch) return "minor";
				return "patch";
			}
		}
		const prefix = highHasPre ? "pre" : "";
		if (v1.major !== v2.major) return prefix + "major";
		if (v1.minor !== v2.minor) return prefix + "minor";
		if (v1.patch !== v2.patch) return prefix + "patch";
		return "prerelease";
	};
	module.exports = diff;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/major.js
var require_major = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var major = (a, loose) => new SemVer(a, loose).major;
	module.exports = major;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/minor.js
var require_minor = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var minor = (a, loose) => new SemVer(a, loose).minor;
	module.exports = minor;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/patch.js
var require_patch = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var patch = (a, loose) => new SemVer(a, loose).patch;
	module.exports = patch;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/prerelease.js
var require_prerelease = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parse = require_parse();
	var prerelease = (version, options) => {
		const parsed = parse(version, options);
		return parsed && parsed.prerelease.length ? parsed.prerelease : null;
	};
	module.exports = prerelease;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/compare.js
var require_compare = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
	module.exports = compare;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/rcompare.js
var require_rcompare = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var rcompare = (a, b, loose) => compare(b, a, loose);
	module.exports = rcompare;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/compare-loose.js
var require_compare_loose = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var compareLoose = (a, b) => compare(a, b, true);
	module.exports = compareLoose;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/compare-build.js
var require_compare_build = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var compareBuild = (a, b, loose) => {
		const versionA = new SemVer(a, loose);
		const versionB = new SemVer(b, loose);
		return versionA.compare(versionB) || versionA.compareBuild(versionB);
	};
	module.exports = compareBuild;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/sort.js
var require_sort = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compareBuild = require_compare_build();
	var sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
	module.exports = sort;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/rsort.js
var require_rsort = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compareBuild = require_compare_build();
	var rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
	module.exports = rsort;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/gt.js
var require_gt = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var gt = (a, b, loose) => compare(a, b, loose) > 0;
	module.exports = gt;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/lt.js
var require_lt = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var lt = (a, b, loose) => compare(a, b, loose) < 0;
	module.exports = lt;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/eq.js
var require_eq = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var eq = (a, b, loose) => compare(a, b, loose) === 0;
	module.exports = eq;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/neq.js
var require_neq = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var neq = (a, b, loose) => compare(a, b, loose) !== 0;
	module.exports = neq;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/gte.js
var require_gte = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var gte = (a, b, loose) => compare(a, b, loose) >= 0;
	module.exports = gte;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/lte.js
var require_lte = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var compare = require_compare();
	var lte = (a, b, loose) => compare(a, b, loose) <= 0;
	module.exports = lte;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/cmp.js
var require_cmp = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var eq = require_eq();
	var neq = require_neq();
	var gt = require_gt();
	var gte = require_gte();
	var lt = require_lt();
	var lte = require_lte();
	var cmp = (a, op, b, loose) => {
		switch (op) {
			case "===":
				if (typeof a === "object") a = a.version;
				if (typeof b === "object") b = b.version;
				return a === b;
			case "!==":
				if (typeof a === "object") a = a.version;
				if (typeof b === "object") b = b.version;
				return a !== b;
			case "":
			case "=":
			case "==": return eq(a, b, loose);
			case "!=": return neq(a, b, loose);
			case ">": return gt(a, b, loose);
			case ">=": return gte(a, b, loose);
			case "<": return lt(a, b, loose);
			case "<=": return lte(a, b, loose);
			default: throw new TypeError(`Invalid operator: ${op}`);
		}
	};
	module.exports = cmp;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/coerce.js
var require_coerce = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var parse = require_parse();
	var { safeRe: re, t } = require_re();
	var coerce = (version, options) => {
		if (version instanceof SemVer) return version;
		if (typeof version === "number") version = String(version);
		if (typeof version !== "string") return null;
		options = options || {};
		let match = null;
		if (!options.rtl) match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
		else {
			const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
			let next;
			while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
				if (!match || next.index + next[0].length !== match.index + match[0].length) match = next;
				coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
			}
			coerceRtlRegex.lastIndex = -1;
		}
		if (match === null) return null;
		const major = match[2];
		return parse(`${major}.${match[3] || "0"}.${match[4] || "0"}${options.includePrerelease && match[5] ? `-${match[5]}` : ""}${options.includePrerelease && match[6] ? `+${match[6]}` : ""}`, options);
	};
	module.exports = coerce;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/internal/lrucache.js
var require_lrucache = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var LRUCache = class {
		constructor() {
			this.max = 1e3;
			this.map = /* @__PURE__ */ new Map();
		}
		get(key) {
			const value = this.map.get(key);
			if (value === void 0) return;
			else {
				this.map.delete(key);
				this.map.set(key, value);
				return value;
			}
		}
		delete(key) {
			return this.map.delete(key);
		}
		set(key, value) {
			if (!this.delete(key) && value !== void 0) {
				if (this.map.size >= this.max) {
					const firstKey = this.map.keys().next().value;
					this.delete(firstKey);
				}
				this.map.set(key, value);
			}
			return this;
		}
	};
	module.exports = LRUCache;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/classes/range.js
var require_range = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SPACE_CHARACTERS = /\s+/g;
	module.exports = class Range {
		constructor(range, options) {
			options = parseOptions(options);
			if (range instanceof Range) if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) return range;
			else return new Range(range.raw, options);
			if (range instanceof Comparator) {
				this.raw = range.value;
				this.set = [[range]];
				this.formatted = void 0;
				return this;
			}
			this.options = options;
			this.loose = !!options.loose;
			this.includePrerelease = !!options.includePrerelease;
			this.raw = range.trim().replace(SPACE_CHARACTERS, " ");
			this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
			if (!this.set.length) throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
			if (this.set.length > 1) {
				const first = this.set[0];
				this.set = this.set.filter((c) => !isNullSet(c[0]));
				if (this.set.length === 0) this.set = [first];
				else if (this.set.length > 1) {
					for (const c of this.set) if (c.length === 1 && isAny(c[0])) {
						this.set = [c];
						break;
					}
				}
			}
			this.formatted = void 0;
		}
		get range() {
			if (this.formatted === void 0) {
				this.formatted = "";
				for (let i = 0; i < this.set.length; i++) {
					if (i > 0) this.formatted += "||";
					const comps = this.set[i];
					for (let k = 0; k < comps.length; k++) {
						if (k > 0) this.formatted += " ";
						this.formatted += comps[k].toString().trim();
					}
				}
			}
			return this.formatted;
		}
		format() {
			return this.range;
		}
		toString() {
			return this.range;
		}
		parseRange(range) {
			const memoKey = ((this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE)) + ":" + range;
			const cached = cache.get(memoKey);
			if (cached) return cached;
			const loose = this.options.loose;
			const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
			range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
			debug("hyphen replace", range);
			range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
			debug("comparator trim", range);
			range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
			debug("tilde trim", range);
			range = range.replace(re[t.CARETTRIM], caretTrimReplace);
			debug("caret trim", range);
			let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
			if (loose) rangeList = rangeList.filter((comp) => {
				debug("loose invalid filter", comp, this.options);
				return !!comp.match(re[t.COMPARATORLOOSE]);
			});
			debug("range list", rangeList);
			const rangeMap = /* @__PURE__ */ new Map();
			const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
			for (const comp of comparators) {
				if (isNullSet(comp)) return [comp];
				rangeMap.set(comp.value, comp);
			}
			if (rangeMap.size > 1 && rangeMap.has("")) rangeMap.delete("");
			const result = [...rangeMap.values()];
			cache.set(memoKey, result);
			return result;
		}
		intersects(range, options) {
			if (!(range instanceof Range)) throw new TypeError("a Range is required");
			return this.set.some((thisComparators) => {
				return isSatisfiable(thisComparators, options) && range.set.some((rangeComparators) => {
					return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
						return rangeComparators.every((rangeComparator) => {
							return thisComparator.intersects(rangeComparator, options);
						});
					});
				});
			});
		}
		test(version) {
			if (!version) return false;
			if (typeof version === "string") try {
				version = new SemVer(version, this.options);
			} catch (er) {
				return false;
			}
			for (let i = 0; i < this.set.length; i++) if (testSet(this.set[i], version, this.options)) return true;
			return false;
		}
	};
	var cache = new (require_lrucache())();
	var parseOptions = require_parse_options();
	var Comparator = require_comparator();
	var debug = require_debug();
	var SemVer = require_semver$1();
	var { safeRe: re, t, comparatorTrimReplace, tildeTrimReplace, caretTrimReplace } = require_re();
	var { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants();
	var isNullSet = (c) => c.value === "<0.0.0-0";
	var isAny = (c) => c.value === "";
	var isSatisfiable = (comparators, options) => {
		let result = true;
		const remainingComparators = comparators.slice();
		let testComparator = remainingComparators.pop();
		while (result && remainingComparators.length) {
			result = remainingComparators.every((otherComparator) => {
				return testComparator.intersects(otherComparator, options);
			});
			testComparator = remainingComparators.pop();
		}
		return result;
	};
	var parseComparator = (comp, options) => {
		comp = comp.replace(re[t.BUILD], "");
		debug("comp", comp, options);
		comp = replaceCarets(comp, options);
		debug("caret", comp);
		comp = replaceTildes(comp, options);
		debug("tildes", comp);
		comp = replaceXRanges(comp, options);
		debug("xrange", comp);
		comp = replaceStars(comp, options);
		debug("stars", comp);
		return comp;
	};
	var isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
	var replaceTildes = (comp, options) => {
		return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
	};
	var replaceTilde = (comp, options) => {
		const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
		return comp.replace(r, (_, M, m, p, pr) => {
			debug("tilde", comp, _, M, m, p, pr);
			let ret;
			if (isX(M)) ret = "";
			else if (isX(m)) ret = `>=${M}.0.0 <${+M + 1}.0.0-0`;
			else if (isX(p)) ret = `>=${M}.${m}.0 <${M}.${+m + 1}.0-0`;
			else if (pr) {
				debug("replaceTilde pr", pr);
				ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
			} else ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
			debug("tilde return", ret);
			return ret;
		});
	};
	var replaceCarets = (comp, options) => {
		return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
	};
	var replaceCaret = (comp, options) => {
		debug("caret", comp, options);
		const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
		const z = options.includePrerelease ? "-0" : "";
		return comp.replace(r, (_, M, m, p, pr) => {
			debug("caret", comp, _, M, m, p, pr);
			let ret;
			if (isX(M)) ret = "";
			else if (isX(m)) ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
			else if (isX(p)) if (M === "0") ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
			else ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
			else if (pr) {
				debug("replaceCaret pr", pr);
				if (M === "0") if (m === "0") ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
				else ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
				else ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
			} else {
				debug("no pr");
				if (M === "0") if (m === "0") ret = `>=${M}.${m}.${p}${z} <${M}.${m}.${+p + 1}-0`;
				else ret = `>=${M}.${m}.${p}${z} <${M}.${+m + 1}.0-0`;
				else ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
			}
			debug("caret return", ret);
			return ret;
		});
	};
	var replaceXRanges = (comp, options) => {
		debug("replaceXRanges", comp, options);
		return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
	};
	var replaceXRange = (comp, options) => {
		comp = comp.trim();
		const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
		return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
			debug("xRange", comp, ret, gtlt, M, m, p, pr);
			const xM = isX(M);
			const xm = xM || isX(m);
			const xp = xm || isX(p);
			const anyX = xp;
			if (gtlt === "=" && anyX) gtlt = "";
			pr = options.includePrerelease ? "-0" : "";
			if (xM) if (gtlt === ">" || gtlt === "<") ret = "<0.0.0-0";
			else ret = "*";
			else if (gtlt && anyX) {
				if (xm) m = 0;
				p = 0;
				if (gtlt === ">") {
					gtlt = ">=";
					if (xm) {
						M = +M + 1;
						m = 0;
						p = 0;
					} else {
						m = +m + 1;
						p = 0;
					}
				} else if (gtlt === "<=") {
					gtlt = "<";
					if (xm) M = +M + 1;
					else m = +m + 1;
				}
				if (gtlt === "<") pr = "-0";
				ret = `${gtlt + M}.${m}.${p}${pr}`;
			} else if (xm) ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
			else if (xp) ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
			debug("xRange return", ret);
			return ret;
		});
	};
	var replaceStars = (comp, options) => {
		debug("replaceStars", comp, options);
		return comp.trim().replace(re[t.STAR], "");
	};
	var replaceGTE0 = (comp, options) => {
		debug("replaceGTE0", comp, options);
		return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
	};
	var hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
		if (isX(fM)) from = "";
		else if (isX(fm)) from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
		else if (isX(fp)) from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
		else if (fpr) from = `>=${from}`;
		else from = `>=${from}${incPr ? "-0" : ""}`;
		if (isX(tM)) to = "";
		else if (isX(tm)) to = `<${+tM + 1}.0.0-0`;
		else if (isX(tp)) to = `<${tM}.${+tm + 1}.0-0`;
		else if (tpr) to = `<=${tM}.${tm}.${tp}-${tpr}`;
		else if (incPr) to = `<${tM}.${tm}.${+tp + 1}-0`;
		else to = `<=${to}`;
		return `${from} ${to}`.trim();
	};
	var testSet = (set, version, options) => {
		for (let i = 0; i < set.length; i++) if (!set[i].test(version)) return false;
		if (version.prerelease.length && !options.includePrerelease) {
			for (let i = 0; i < set.length; i++) {
				debug(set[i].semver);
				if (set[i].semver === Comparator.ANY) continue;
				if (set[i].semver.prerelease.length > 0) {
					const allowed = set[i].semver;
					if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) return true;
				}
			}
			return false;
		}
		return true;
	};
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/classes/comparator.js
var require_comparator = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var ANY = Symbol("SemVer ANY");
	module.exports = class Comparator {
		static get ANY() {
			return ANY;
		}
		constructor(comp, options) {
			options = parseOptions(options);
			if (comp instanceof Comparator) if (comp.loose === !!options.loose) return comp;
			else comp = comp.value;
			comp = comp.trim().split(/\s+/).join(" ");
			debug("comparator", comp, options);
			this.options = options;
			this.loose = !!options.loose;
			this.parse(comp);
			if (this.semver === ANY) this.value = "";
			else this.value = this.operator + this.semver.version;
			debug("comp", this);
		}
		parse(comp) {
			const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
			const m = comp.match(r);
			if (!m) throw new TypeError(`Invalid comparator: ${comp}`);
			this.operator = m[1] !== void 0 ? m[1] : "";
			if (this.operator === "=") this.operator = "";
			if (!m[2]) this.semver = ANY;
			else this.semver = new SemVer(m[2], this.options.loose);
		}
		toString() {
			return this.value;
		}
		test(version) {
			debug("Comparator.test", version, this.options.loose);
			if (this.semver === ANY || version === ANY) return true;
			if (typeof version === "string") try {
				version = new SemVer(version, this.options);
			} catch (er) {
				return false;
			}
			return cmp(version, this.operator, this.semver, this.options);
		}
		intersects(comp, options) {
			if (!(comp instanceof Comparator)) throw new TypeError("a Comparator is required");
			if (this.operator === "") {
				if (this.value === "") return true;
				return new Range(comp.value, options).test(this.value);
			} else if (comp.operator === "") {
				if (comp.value === "") return true;
				return new Range(this.value, options).test(comp.semver);
			}
			options = parseOptions(options);
			if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) return false;
			if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) return false;
			if (this.operator.startsWith(">") && comp.operator.startsWith(">")) return true;
			if (this.operator.startsWith("<") && comp.operator.startsWith("<")) return true;
			if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) return true;
			if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) return true;
			if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) return true;
			return false;
		}
	};
	var parseOptions = require_parse_options();
	var { safeRe: re, t } = require_re();
	var cmp = require_cmp();
	var debug = require_debug();
	var SemVer = require_semver$1();
	var Range = require_range();
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/functions/satisfies.js
var require_satisfies = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Range = require_range();
	var satisfies = (version, range, options) => {
		try {
			range = new Range(range, options);
		} catch (er) {
			return false;
		}
		return range.test(version);
	};
	module.exports = satisfies;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/ranges/to-comparators.js
var require_to_comparators = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Range = require_range();
	var toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
	module.exports = toComparators;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var Range = require_range();
	var maxSatisfying = (versions, range, options) => {
		let max = null;
		let maxSV = null;
		let rangeObj = null;
		try {
			rangeObj = new Range(range, options);
		} catch (er) {
			return null;
		}
		versions.forEach((v) => {
			if (rangeObj.test(v)) {
				if (!max || maxSV.compare(v) === -1) {
					max = v;
					maxSV = new SemVer(max, options);
				}
			}
		});
		return max;
	};
	module.exports = maxSatisfying;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var Range = require_range();
	var minSatisfying = (versions, range, options) => {
		let min = null;
		let minSV = null;
		let rangeObj = null;
		try {
			rangeObj = new Range(range, options);
		} catch (er) {
			return null;
		}
		versions.forEach((v) => {
			if (rangeObj.test(v)) {
				if (!min || minSV.compare(v) === 1) {
					min = v;
					minSV = new SemVer(min, options);
				}
			}
		});
		return min;
	};
	module.exports = minSatisfying;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/ranges/min-version.js
var require_min_version = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var Range = require_range();
	var gt = require_gt();
	var minVersion = (range, loose) => {
		range = new Range(range, loose);
		let minver = new SemVer("0.0.0");
		if (range.test(minver)) return minver;
		minver = new SemVer("0.0.0-0");
		if (range.test(minver)) return minver;
		minver = null;
		for (let i = 0; i < range.set.length; ++i) {
			const comparators = range.set[i];
			let setMin = null;
			comparators.forEach((comparator) => {
				const compver = new SemVer(comparator.semver.version);
				switch (comparator.operator) {
					case ">":
						if (compver.prerelease.length === 0) compver.patch++;
						else compver.prerelease.push(0);
						compver.raw = compver.format();
					case "":
					case ">=":
						if (!setMin || gt(compver, setMin)) setMin = compver;
						break;
					case "<":
					case "<=": break;
					/* istanbul ignore next */
					default: throw new Error(`Unexpected operation: ${comparator.operator}`);
				}
			});
			if (setMin && (!minver || gt(minver, setMin))) minver = setMin;
		}
		if (minver && range.test(minver)) return minver;
		return null;
	};
	module.exports = minVersion;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/ranges/valid.js
var require_valid = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Range = require_range();
	var validRange = (range, options) => {
		try {
			return new Range(range, options).range || "*";
		} catch (er) {
			return null;
		}
	};
	module.exports = validRange;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/ranges/outside.js
var require_outside = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var SemVer = require_semver$1();
	var Comparator = require_comparator();
	var { ANY } = Comparator;
	var Range = require_range();
	var satisfies = require_satisfies();
	var gt = require_gt();
	var lt = require_lt();
	var lte = require_lte();
	var gte = require_gte();
	var outside = (version, range, hilo, options) => {
		version = new SemVer(version, options);
		range = new Range(range, options);
		let gtfn, ltefn, ltfn, comp, ecomp;
		switch (hilo) {
			case ">":
				gtfn = gt;
				ltefn = lte;
				ltfn = lt;
				comp = ">";
				ecomp = ">=";
				break;
			case "<":
				gtfn = lt;
				ltefn = gte;
				ltfn = gt;
				comp = "<";
				ecomp = "<=";
				break;
			default: throw new TypeError("Must provide a hilo val of \"<\" or \">\"");
		}
		if (satisfies(version, range, options)) return false;
		for (let i = 0; i < range.set.length; ++i) {
			const comparators = range.set[i];
			let high = null;
			let low = null;
			comparators.forEach((comparator) => {
				if (comparator.semver === ANY) comparator = new Comparator(">=0.0.0");
				high = high || comparator;
				low = low || comparator;
				if (gtfn(comparator.semver, high.semver, options)) high = comparator;
				else if (ltfn(comparator.semver, low.semver, options)) low = comparator;
			});
			if (high.operator === comp || high.operator === ecomp) return false;
			if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) return false;
			else if (low.operator === ecomp && ltfn(version, low.semver)) return false;
		}
		return true;
	};
	module.exports = outside;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/ranges/gtr.js
var require_gtr = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var outside = require_outside();
	var gtr = (version, range, options) => outside(version, range, ">", options);
	module.exports = gtr;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/ranges/ltr.js
var require_ltr = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var outside = require_outside();
	var ltr = (version, range, options) => outside(version, range, "<", options);
	module.exports = ltr;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/ranges/intersects.js
var require_intersects = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Range = require_range();
	var intersects = (r1, r2, options) => {
		r1 = new Range(r1, options);
		r2 = new Range(r2, options);
		return r1.intersects(r2, options);
	};
	module.exports = intersects;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/ranges/simplify.js
var require_simplify = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var satisfies = require_satisfies();
	var compare = require_compare();
	module.exports = (versions, range, options) => {
		const set = [];
		let first = null;
		let prev = null;
		const v = versions.sort((a, b) => compare(a, b, options));
		for (const version of v) if (satisfies(version, range, options)) {
			prev = version;
			if (!first) first = version;
		} else {
			if (prev) set.push([first, prev]);
			prev = null;
			first = null;
		}
		if (first) set.push([first, null]);
		const ranges = [];
		for (const [min, max] of set) if (min === max) ranges.push(min);
		else if (!max && min === v[0]) ranges.push("*");
		else if (!max) ranges.push(`>=${min}`);
		else if (min === v[0]) ranges.push(`<=${max}`);
		else ranges.push(`${min} - ${max}`);
		const simplified = ranges.join(" || ");
		const original = typeof range.raw === "string" ? range.raw : String(range);
		return simplified.length < original.length ? simplified : range;
	};
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/ranges/subset.js
var require_subset = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Range = require_range();
	var Comparator = require_comparator();
	var { ANY } = Comparator;
	var satisfies = require_satisfies();
	var compare = require_compare();
	var subset = (sub, dom, options = {}) => {
		if (sub === dom) return true;
		sub = new Range(sub, options);
		dom = new Range(dom, options);
		let sawNonNull = false;
		OUTER: for (const simpleSub of sub.set) {
			for (const simpleDom of dom.set) {
				const isSub = simpleSubset(simpleSub, simpleDom, options);
				sawNonNull = sawNonNull || isSub !== null;
				if (isSub) continue OUTER;
			}
			if (sawNonNull) return false;
		}
		return true;
	};
	var minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
	var minimumVersion = [new Comparator(">=0.0.0")];
	var simpleSubset = (sub, dom, options) => {
		if (sub === dom) return true;
		if (sub.length === 1 && sub[0].semver === ANY) if (dom.length === 1 && dom[0].semver === ANY) return true;
		else if (options.includePrerelease) sub = minimumVersionWithPreRelease;
		else sub = minimumVersion;
		if (dom.length === 1 && dom[0].semver === ANY) if (options.includePrerelease) return true;
		else dom = minimumVersion;
		const eqSet = /* @__PURE__ */ new Set();
		let gt, lt;
		for (const c of sub) if (c.operator === ">" || c.operator === ">=") gt = higherGT(gt, c, options);
		else if (c.operator === "<" || c.operator === "<=") lt = lowerLT(lt, c, options);
		else eqSet.add(c.semver);
		if (eqSet.size > 1) return null;
		let gtltComp;
		if (gt && lt) {
			gtltComp = compare(gt.semver, lt.semver, options);
			if (gtltComp > 0) return null;
			else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) return null;
		}
		for (const eq of eqSet) {
			if (gt && !satisfies(eq, String(gt), options)) return null;
			if (lt && !satisfies(eq, String(lt), options)) return null;
			for (const c of dom) if (!satisfies(eq, String(c), options)) return false;
			return true;
		}
		let higher, lower;
		let hasDomLT, hasDomGT;
		let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
		let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
		if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) needDomLTPre = false;
		for (const c of dom) {
			hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
			hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
			if (gt) {
				if (needDomGTPre) {
					if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) needDomGTPre = false;
				}
				if (c.operator === ">" || c.operator === ">=") {
					higher = higherGT(gt, c, options);
					if (higher === c && higher !== gt) return false;
				} else if (gt.operator === ">=" && !satisfies(gt.semver, String(c), options)) return false;
			}
			if (lt) {
				if (needDomLTPre) {
					if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) needDomLTPre = false;
				}
				if (c.operator === "<" || c.operator === "<=") {
					lower = lowerLT(lt, c, options);
					if (lower === c && lower !== lt) return false;
				} else if (lt.operator === "<=" && !satisfies(lt.semver, String(c), options)) return false;
			}
			if (!c.operator && (lt || gt) && gtltComp !== 0) return false;
		}
		if (gt && hasDomLT && !lt && gtltComp !== 0) return false;
		if (lt && hasDomGT && !gt && gtltComp !== 0) return false;
		if (needDomGTPre || needDomLTPre) return false;
		return true;
	};
	var higherGT = (a, b, options) => {
		if (!a) return b;
		const comp = compare(a.semver, b.semver, options);
		return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
	};
	var lowerLT = (a, b, options) => {
		if (!a) return b;
		const comp = compare(a.semver, b.semver, options);
		return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
	};
	module.exports = subset;
}));
//#endregion
//#region ../../node_modules/electron-updater/node_modules/semver/index.js
var require_semver = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var internalRe = require_re();
	var constants = require_constants();
	var SemVer = require_semver$1();
	var identifiers = require_identifiers();
	module.exports = {
		parse: require_parse(),
		valid: require_valid$1(),
		clean: require_clean(),
		inc: require_inc(),
		diff: require_diff(),
		major: require_major(),
		minor: require_minor(),
		patch: require_patch(),
		prerelease: require_prerelease(),
		compare: require_compare(),
		rcompare: require_rcompare(),
		compareLoose: require_compare_loose(),
		compareBuild: require_compare_build(),
		sort: require_sort(),
		rsort: require_rsort(),
		gt: require_gt(),
		lt: require_lt(),
		eq: require_eq(),
		neq: require_neq(),
		gte: require_gte(),
		lte: require_lte(),
		cmp: require_cmp(),
		coerce: require_coerce(),
		Comparator: require_comparator(),
		Range: require_range(),
		satisfies: require_satisfies(),
		toComparators: require_to_comparators(),
		maxSatisfying: require_max_satisfying(),
		minSatisfying: require_min_satisfying(),
		minVersion: require_min_version(),
		validRange: require_valid(),
		outside: require_outside(),
		gtr: require_gtr(),
		ltr: require_ltr(),
		intersects: require_intersects(),
		simplifyRange: require_simplify(),
		subset: require_subset(),
		SemVer,
		re: internalRe.re,
		src: internalRe.src,
		tokens: internalRe.t,
		SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
		RELEASE_TYPES: constants.RELEASE_TYPES,
		compareIdentifiers: identifiers.compareIdentifiers,
		rcompareIdentifiers: identifiers.rcompareIdentifiers
	};
}));
//#endregion
//#region ../../node_modules/lodash.isequal/index.js
var require_lodash_isequal = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Lodash (Custom Build) <https://lodash.com/>
	* Build: `lodash modularize exports="npm" -o ./`
	* Copyright JS Foundation and other contributors <https://js.foundation/>
	* Released under MIT license <https://lodash.com/license>
	* Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	* Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	*/
	/** Used as the size to enable large array optimizations. */
	var LARGE_ARRAY_SIZE = 200;
	/** Used to stand-in for `undefined` hash values. */
	var HASH_UNDEFINED = "__lodash_hash_undefined__";
	/** Used to compose bitmasks for value comparisons. */
	var COMPARE_PARTIAL_FLAG = 1, COMPARE_UNORDERED_FLAG = 2;
	/** Used as references for various `Number` constants. */
	var MAX_SAFE_INTEGER = 9007199254740991;
	/** `Object#toString` result references. */
	var argsTag = "[object Arguments]", arrayTag = "[object Array]", asyncTag = "[object AsyncFunction]", boolTag = "[object Boolean]", dateTag = "[object Date]", errorTag = "[object Error]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", mapTag = "[object Map]", numberTag = "[object Number]", nullTag = "[object Null]", objectTag = "[object Object]", promiseTag = "[object Promise]", proxyTag = "[object Proxy]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", symbolTag = "[object Symbol]", undefinedTag = "[object Undefined]", weakMapTag = "[object WeakMap]";
	var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
	/**
	* Used to match `RegExp`
	* [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
	*/
	var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
	/** Used to detect host constructors (Safari). */
	var reIsHostCtor = /^\[object .+?Constructor\]$/;
	/** Used to detect unsigned integer values. */
	var reIsUint = /^(?:0|[1-9]\d*)$/;
	/** Used to identify `toStringTag` values of typed arrays. */
	var typedArrayTags = {};
	typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
	typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
	/** Detect free variable `global` from Node.js. */
	var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
	/** Detect free variable `self`. */
	var freeSelf = typeof self == "object" && self && self.Object === Object && self;
	/** Used as a reference to the global object. */
	var root = freeGlobal || freeSelf || Function("return this")();
	/** Detect free variable `exports`. */
	var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
	/** Detect free variable `module`. */
	var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
	/** Detect the popular CommonJS extension `module.exports`. */
	var moduleExports = freeModule && freeModule.exports === freeExports;
	/** Detect free variable `process` from Node.js. */
	var freeProcess = moduleExports && freeGlobal.process;
	/** Used to access faster Node.js helpers. */
	var nodeUtil = function() {
		try {
			return freeProcess && freeProcess.binding && freeProcess.binding("util");
		} catch (e) {}
	}();
	var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
	/**
	* A specialized version of `_.filter` for arrays without support for
	* iteratee shorthands.
	*
	* @private
	* @param {Array} [array] The array to iterate over.
	* @param {Function} predicate The function invoked per iteration.
	* @returns {Array} Returns the new filtered array.
	*/
	function arrayFilter(array, predicate) {
		var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
		while (++index < length) {
			var value = array[index];
			if (predicate(value, index, array)) result[resIndex++] = value;
		}
		return result;
	}
	/**
	* Appends the elements of `values` to `array`.
	*
	* @private
	* @param {Array} array The array to modify.
	* @param {Array} values The values to append.
	* @returns {Array} Returns `array`.
	*/
	function arrayPush(array, values) {
		var index = -1, length = values.length, offset = array.length;
		while (++index < length) array[offset + index] = values[index];
		return array;
	}
	/**
	* A specialized version of `_.some` for arrays without support for iteratee
	* shorthands.
	*
	* @private
	* @param {Array} [array] The array to iterate over.
	* @param {Function} predicate The function invoked per iteration.
	* @returns {boolean} Returns `true` if any element passes the predicate check,
	*  else `false`.
	*/
	function arraySome(array, predicate) {
		var index = -1, length = array == null ? 0 : array.length;
		while (++index < length) if (predicate(array[index], index, array)) return true;
		return false;
	}
	/**
	* The base implementation of `_.times` without support for iteratee shorthands
	* or max array length checks.
	*
	* @private
	* @param {number} n The number of times to invoke `iteratee`.
	* @param {Function} iteratee The function invoked per iteration.
	* @returns {Array} Returns the array of results.
	*/
	function baseTimes(n, iteratee) {
		var index = -1, result = Array(n);
		while (++index < n) result[index] = iteratee(index);
		return result;
	}
	/**
	* The base implementation of `_.unary` without support for storing metadata.
	*
	* @private
	* @param {Function} func The function to cap arguments for.
	* @returns {Function} Returns the new capped function.
	*/
	function baseUnary(func) {
		return function(value) {
			return func(value);
		};
	}
	/**
	* Checks if a `cache` value for `key` exists.
	*
	* @private
	* @param {Object} cache The cache to query.
	* @param {string} key The key of the entry to check.
	* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	*/
	function cacheHas(cache, key) {
		return cache.has(key);
	}
	/**
	* Gets the value at `key` of `object`.
	*
	* @private
	* @param {Object} [object] The object to query.
	* @param {string} key The key of the property to get.
	* @returns {*} Returns the property value.
	*/
	function getValue(object, key) {
		return object == null ? void 0 : object[key];
	}
	/**
	* Converts `map` to its key-value pairs.
	*
	* @private
	* @param {Object} map The map to convert.
	* @returns {Array} Returns the key-value pairs.
	*/
	function mapToArray(map) {
		var index = -1, result = Array(map.size);
		map.forEach(function(value, key) {
			result[++index] = [key, value];
		});
		return result;
	}
	/**
	* Creates a unary function that invokes `func` with its argument transformed.
	*
	* @private
	* @param {Function} func The function to wrap.
	* @param {Function} transform The argument transform.
	* @returns {Function} Returns the new function.
	*/
	function overArg(func, transform) {
		return function(arg) {
			return func(transform(arg));
		};
	}
	/**
	* Converts `set` to an array of its values.
	*
	* @private
	* @param {Object} set The set to convert.
	* @returns {Array} Returns the values.
	*/
	function setToArray(set) {
		var index = -1, result = Array(set.size);
		set.forEach(function(value) {
			result[++index] = value;
		});
		return result;
	}
	/** Used for built-in method references. */
	var arrayProto = Array.prototype, funcProto = Function.prototype, objectProto = Object.prototype;
	/** Used to detect overreaching core-js shims. */
	var coreJsData = root["__core-js_shared__"];
	/** Used to resolve the decompiled source of functions. */
	var funcToString = funcProto.toString;
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	/** Used to detect methods masquerading as native. */
	var maskSrcKey = function() {
		var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
		return uid ? "Symbol(src)_1." + uid : "";
	}();
	/**
	* Used to resolve the
	* [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	* of values.
	*/
	var nativeObjectToString = objectProto.toString;
	/** Used to detect if a method is native. */
	var reIsNative = RegExp("^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$");
	/** Built-in value references. */
	var Buffer = moduleExports ? root.Buffer : void 0, Symbol = root.Symbol, Uint8Array = root.Uint8Array, propertyIsEnumerable = objectProto.propertyIsEnumerable, splice = arrayProto.splice, symToStringTag = Symbol ? Symbol.toStringTag : void 0;
	var nativeGetSymbols = Object.getOwnPropertySymbols, nativeIsBuffer = Buffer ? Buffer.isBuffer : void 0, nativeKeys = overArg(Object.keys, Object);
	var DataView = getNative(root, "DataView"), Map = getNative(root, "Map"), Promise = getNative(root, "Promise"), Set = getNative(root, "Set"), WeakMap = getNative(root, "WeakMap"), nativeCreate = getNative(Object, "create");
	/** Used to detect maps, sets, and weakmaps. */
	var dataViewCtorString = toSource(DataView), mapCtorString = toSource(Map), promiseCtorString = toSource(Promise), setCtorString = toSource(Set), weakMapCtorString = toSource(WeakMap);
	/** Used to convert symbols to primitives and strings. */
	var symbolProto = Symbol ? Symbol.prototype : void 0, symbolValueOf = symbolProto ? symbolProto.valueOf : void 0;
	/**
	* Creates a hash object.
	*
	* @private
	* @constructor
	* @param {Array} [entries] The key-value pairs to cache.
	*/
	function Hash(entries) {
		var index = -1, length = entries == null ? 0 : entries.length;
		this.clear();
		while (++index < length) {
			var entry = entries[index];
			this.set(entry[0], entry[1]);
		}
	}
	/**
	* Removes all key-value entries from the hash.
	*
	* @private
	* @name clear
	* @memberOf Hash
	*/
	function hashClear() {
		this.__data__ = nativeCreate ? nativeCreate(null) : {};
		this.size = 0;
	}
	/**
	* Removes `key` and its value from the hash.
	*
	* @private
	* @name delete
	* @memberOf Hash
	* @param {Object} hash The hash to modify.
	* @param {string} key The key of the value to remove.
	* @returns {boolean} Returns `true` if the entry was removed, else `false`.
	*/
	function hashDelete(key) {
		var result = this.has(key) && delete this.__data__[key];
		this.size -= result ? 1 : 0;
		return result;
	}
	/**
	* Gets the hash value for `key`.
	*
	* @private
	* @name get
	* @memberOf Hash
	* @param {string} key The key of the value to get.
	* @returns {*} Returns the entry value.
	*/
	function hashGet(key) {
		var data = this.__data__;
		if (nativeCreate) {
			var result = data[key];
			return result === HASH_UNDEFINED ? void 0 : result;
		}
		return hasOwnProperty.call(data, key) ? data[key] : void 0;
	}
	/**
	* Checks if a hash value for `key` exists.
	*
	* @private
	* @name has
	* @memberOf Hash
	* @param {string} key The key of the entry to check.
	* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	*/
	function hashHas(key) {
		var data = this.__data__;
		return nativeCreate ? data[key] !== void 0 : hasOwnProperty.call(data, key);
	}
	/**
	* Sets the hash `key` to `value`.
	*
	* @private
	* @name set
	* @memberOf Hash
	* @param {string} key The key of the value to set.
	* @param {*} value The value to set.
	* @returns {Object} Returns the hash instance.
	*/
	function hashSet(key, value) {
		var data = this.__data__;
		this.size += this.has(key) ? 0 : 1;
		data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED : value;
		return this;
	}
	Hash.prototype.clear = hashClear;
	Hash.prototype["delete"] = hashDelete;
	Hash.prototype.get = hashGet;
	Hash.prototype.has = hashHas;
	Hash.prototype.set = hashSet;
	/**
	* Creates an list cache object.
	*
	* @private
	* @constructor
	* @param {Array} [entries] The key-value pairs to cache.
	*/
	function ListCache(entries) {
		var index = -1, length = entries == null ? 0 : entries.length;
		this.clear();
		while (++index < length) {
			var entry = entries[index];
			this.set(entry[0], entry[1]);
		}
	}
	/**
	* Removes all key-value entries from the list cache.
	*
	* @private
	* @name clear
	* @memberOf ListCache
	*/
	function listCacheClear() {
		this.__data__ = [];
		this.size = 0;
	}
	/**
	* Removes `key` and its value from the list cache.
	*
	* @private
	* @name delete
	* @memberOf ListCache
	* @param {string} key The key of the value to remove.
	* @returns {boolean} Returns `true` if the entry was removed, else `false`.
	*/
	function listCacheDelete(key) {
		var data = this.__data__, index = assocIndexOf(data, key);
		if (index < 0) return false;
		if (index == data.length - 1) data.pop();
		else splice.call(data, index, 1);
		--this.size;
		return true;
	}
	/**
	* Gets the list cache value for `key`.
	*
	* @private
	* @name get
	* @memberOf ListCache
	* @param {string} key The key of the value to get.
	* @returns {*} Returns the entry value.
	*/
	function listCacheGet(key) {
		var data = this.__data__, index = assocIndexOf(data, key);
		return index < 0 ? void 0 : data[index][1];
	}
	/**
	* Checks if a list cache value for `key` exists.
	*
	* @private
	* @name has
	* @memberOf ListCache
	* @param {string} key The key of the entry to check.
	* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	*/
	function listCacheHas(key) {
		return assocIndexOf(this.__data__, key) > -1;
	}
	/**
	* Sets the list cache `key` to `value`.
	*
	* @private
	* @name set
	* @memberOf ListCache
	* @param {string} key The key of the value to set.
	* @param {*} value The value to set.
	* @returns {Object} Returns the list cache instance.
	*/
	function listCacheSet(key, value) {
		var data = this.__data__, index = assocIndexOf(data, key);
		if (index < 0) {
			++this.size;
			data.push([key, value]);
		} else data[index][1] = value;
		return this;
	}
	ListCache.prototype.clear = listCacheClear;
	ListCache.prototype["delete"] = listCacheDelete;
	ListCache.prototype.get = listCacheGet;
	ListCache.prototype.has = listCacheHas;
	ListCache.prototype.set = listCacheSet;
	/**
	* Creates a map cache object to store key-value pairs.
	*
	* @private
	* @constructor
	* @param {Array} [entries] The key-value pairs to cache.
	*/
	function MapCache(entries) {
		var index = -1, length = entries == null ? 0 : entries.length;
		this.clear();
		while (++index < length) {
			var entry = entries[index];
			this.set(entry[0], entry[1]);
		}
	}
	/**
	* Removes all key-value entries from the map.
	*
	* @private
	* @name clear
	* @memberOf MapCache
	*/
	function mapCacheClear() {
		this.size = 0;
		this.__data__ = {
			"hash": new Hash(),
			"map": new (Map || ListCache)(),
			"string": new Hash()
		};
	}
	/**
	* Removes `key` and its value from the map.
	*
	* @private
	* @name delete
	* @memberOf MapCache
	* @param {string} key The key of the value to remove.
	* @returns {boolean} Returns `true` if the entry was removed, else `false`.
	*/
	function mapCacheDelete(key) {
		var result = getMapData(this, key)["delete"](key);
		this.size -= result ? 1 : 0;
		return result;
	}
	/**
	* Gets the map value for `key`.
	*
	* @private
	* @name get
	* @memberOf MapCache
	* @param {string} key The key of the value to get.
	* @returns {*} Returns the entry value.
	*/
	function mapCacheGet(key) {
		return getMapData(this, key).get(key);
	}
	/**
	* Checks if a map value for `key` exists.
	*
	* @private
	* @name has
	* @memberOf MapCache
	* @param {string} key The key of the entry to check.
	* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	*/
	function mapCacheHas(key) {
		return getMapData(this, key).has(key);
	}
	/**
	* Sets the map `key` to `value`.
	*
	* @private
	* @name set
	* @memberOf MapCache
	* @param {string} key The key of the value to set.
	* @param {*} value The value to set.
	* @returns {Object} Returns the map cache instance.
	*/
	function mapCacheSet(key, value) {
		var data = getMapData(this, key), size = data.size;
		data.set(key, value);
		this.size += data.size == size ? 0 : 1;
		return this;
	}
	MapCache.prototype.clear = mapCacheClear;
	MapCache.prototype["delete"] = mapCacheDelete;
	MapCache.prototype.get = mapCacheGet;
	MapCache.prototype.has = mapCacheHas;
	MapCache.prototype.set = mapCacheSet;
	/**
	*
	* Creates an array cache object to store unique values.
	*
	* @private
	* @constructor
	* @param {Array} [values] The values to cache.
	*/
	function SetCache(values) {
		var index = -1, length = values == null ? 0 : values.length;
		this.__data__ = new MapCache();
		while (++index < length) this.add(values[index]);
	}
	/**
	* Adds `value` to the array cache.
	*
	* @private
	* @name add
	* @memberOf SetCache
	* @alias push
	* @param {*} value The value to cache.
	* @returns {Object} Returns the cache instance.
	*/
	function setCacheAdd(value) {
		this.__data__.set(value, HASH_UNDEFINED);
		return this;
	}
	/**
	* Checks if `value` is in the array cache.
	*
	* @private
	* @name has
	* @memberOf SetCache
	* @param {*} value The value to search for.
	* @returns {number} Returns `true` if `value` is found, else `false`.
	*/
	function setCacheHas(value) {
		return this.__data__.has(value);
	}
	SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
	SetCache.prototype.has = setCacheHas;
	/**
	* Creates a stack cache object to store key-value pairs.
	*
	* @private
	* @constructor
	* @param {Array} [entries] The key-value pairs to cache.
	*/
	function Stack(entries) {
		var data = this.__data__ = new ListCache(entries);
		this.size = data.size;
	}
	/**
	* Removes all key-value entries from the stack.
	*
	* @private
	* @name clear
	* @memberOf Stack
	*/
	function stackClear() {
		this.__data__ = new ListCache();
		this.size = 0;
	}
	/**
	* Removes `key` and its value from the stack.
	*
	* @private
	* @name delete
	* @memberOf Stack
	* @param {string} key The key of the value to remove.
	* @returns {boolean} Returns `true` if the entry was removed, else `false`.
	*/
	function stackDelete(key) {
		var data = this.__data__, result = data["delete"](key);
		this.size = data.size;
		return result;
	}
	/**
	* Gets the stack value for `key`.
	*
	* @private
	* @name get
	* @memberOf Stack
	* @param {string} key The key of the value to get.
	* @returns {*} Returns the entry value.
	*/
	function stackGet(key) {
		return this.__data__.get(key);
	}
	/**
	* Checks if a stack value for `key` exists.
	*
	* @private
	* @name has
	* @memberOf Stack
	* @param {string} key The key of the entry to check.
	* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	*/
	function stackHas(key) {
		return this.__data__.has(key);
	}
	/**
	* Sets the stack `key` to `value`.
	*
	* @private
	* @name set
	* @memberOf Stack
	* @param {string} key The key of the value to set.
	* @param {*} value The value to set.
	* @returns {Object} Returns the stack cache instance.
	*/
	function stackSet(key, value) {
		var data = this.__data__;
		if (data instanceof ListCache) {
			var pairs = data.__data__;
			if (!Map || pairs.length < LARGE_ARRAY_SIZE - 1) {
				pairs.push([key, value]);
				this.size = ++data.size;
				return this;
			}
			data = this.__data__ = new MapCache(pairs);
		}
		data.set(key, value);
		this.size = data.size;
		return this;
	}
	Stack.prototype.clear = stackClear;
	Stack.prototype["delete"] = stackDelete;
	Stack.prototype.get = stackGet;
	Stack.prototype.has = stackHas;
	Stack.prototype.set = stackSet;
	/**
	* Creates an array of the enumerable property names of the array-like `value`.
	*
	* @private
	* @param {*} value The value to query.
	* @param {boolean} inherited Specify returning inherited property names.
	* @returns {Array} Returns the array of property names.
	*/
	function arrayLikeKeys(value, inherited) {
		var isArr = isArray(value), isArg = !isArr && isArguments(value), isBuff = !isArr && !isArg && isBuffer(value), isType = !isArr && !isArg && !isBuff && isTypedArray(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? baseTimes(value.length, String) : [], length = result.length;
		for (var key in value) if ((inherited || hasOwnProperty.call(value, key)) && !(skipIndexes && (key == "length" || isBuff && (key == "offset" || key == "parent") || isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || isIndex(key, length)))) result.push(key);
		return result;
	}
	/**
	* Gets the index at which the `key` is found in `array` of key-value pairs.
	*
	* @private
	* @param {Array} array The array to inspect.
	* @param {*} key The key to search for.
	* @returns {number} Returns the index of the matched value, else `-1`.
	*/
	function assocIndexOf(array, key) {
		var length = array.length;
		while (length--) if (eq(array[length][0], key)) return length;
		return -1;
	}
	/**
	* The base implementation of `getAllKeys` and `getAllKeysIn` which uses
	* `keysFunc` and `symbolsFunc` to get the enumerable property names and
	* symbols of `object`.
	*
	* @private
	* @param {Object} object The object to query.
	* @param {Function} keysFunc The function to get the keys of `object`.
	* @param {Function} symbolsFunc The function to get the symbols of `object`.
	* @returns {Array} Returns the array of property names and symbols.
	*/
	function baseGetAllKeys(object, keysFunc, symbolsFunc) {
		var result = keysFunc(object);
		return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
	}
	/**
	* The base implementation of `getTag` without fallbacks for buggy environments.
	*
	* @private
	* @param {*} value The value to query.
	* @returns {string} Returns the `toStringTag`.
	*/
	function baseGetTag(value) {
		if (value == null) return value === void 0 ? undefinedTag : nullTag;
		return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
	}
	/**
	* The base implementation of `_.isArguments`.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is an `arguments` object,
	*/
	function baseIsArguments(value) {
		return isObjectLike(value) && baseGetTag(value) == argsTag;
	}
	/**
	* The base implementation of `_.isEqual` which supports partial comparisons
	* and tracks traversed objects.
	*
	* @private
	* @param {*} value The value to compare.
	* @param {*} other The other value to compare.
	* @param {boolean} bitmask The bitmask flags.
	*  1 - Unordered comparison
	*  2 - Partial comparison
	* @param {Function} [customizer] The function to customize comparisons.
	* @param {Object} [stack] Tracks traversed `value` and `other` objects.
	* @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	*/
	function baseIsEqual(value, other, bitmask, customizer, stack) {
		if (value === other) return true;
		if (value == null || other == null || !isObjectLike(value) && !isObjectLike(other)) return value !== value && other !== other;
		return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
	}
	/**
	* A specialized version of `baseIsEqual` for arrays and objects which performs
	* deep comparisons and tracks traversed objects enabling objects with circular
	* references to be compared.
	*
	* @private
	* @param {Object} object The object to compare.
	* @param {Object} other The other object to compare.
	* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	* @param {Function} customizer The function to customize comparisons.
	* @param {Function} equalFunc The function to determine equivalents of values.
	* @param {Object} [stack] Tracks traversed `object` and `other` objects.
	* @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
	*/
	function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
		var objIsArr = isArray(object), othIsArr = isArray(other), objTag = objIsArr ? arrayTag : getTag(object), othTag = othIsArr ? arrayTag : getTag(other);
		objTag = objTag == argsTag ? objectTag : objTag;
		othTag = othTag == argsTag ? objectTag : othTag;
		var objIsObj = objTag == objectTag, othIsObj = othTag == objectTag, isSameTag = objTag == othTag;
		if (isSameTag && isBuffer(object)) {
			if (!isBuffer(other)) return false;
			objIsArr = true;
			objIsObj = false;
		}
		if (isSameTag && !objIsObj) {
			stack || (stack = new Stack());
			return objIsArr || isTypedArray(object) ? equalArrays(object, other, bitmask, customizer, equalFunc, stack) : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
		}
		if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
			var objIsWrapped = objIsObj && hasOwnProperty.call(object, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty.call(other, "__wrapped__");
			if (objIsWrapped || othIsWrapped) {
				var objUnwrapped = objIsWrapped ? object.value() : object, othUnwrapped = othIsWrapped ? other.value() : other;
				stack || (stack = new Stack());
				return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
			}
		}
		if (!isSameTag) return false;
		stack || (stack = new Stack());
		return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
	}
	/**
	* The base implementation of `_.isNative` without bad shim checks.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a native function,
	*  else `false`.
	*/
	function baseIsNative(value) {
		if (!isObject(value) || isMasked(value)) return false;
		return (isFunction(value) ? reIsNative : reIsHostCtor).test(toSource(value));
	}
	/**
	* The base implementation of `_.isTypedArray` without Node.js optimizations.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
	*/
	function baseIsTypedArray(value) {
		return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
	}
	/**
	* The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
	*
	* @private
	* @param {Object} object The object to query.
	* @returns {Array} Returns the array of property names.
	*/
	function baseKeys(object) {
		if (!isPrototype(object)) return nativeKeys(object);
		var result = [];
		for (var key in Object(object)) if (hasOwnProperty.call(object, key) && key != "constructor") result.push(key);
		return result;
	}
	/**
	* A specialized version of `baseIsEqualDeep` for arrays with support for
	* partial deep comparisons.
	*
	* @private
	* @param {Array} array The array to compare.
	* @param {Array} other The other array to compare.
	* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	* @param {Function} customizer The function to customize comparisons.
	* @param {Function} equalFunc The function to determine equivalents of values.
	* @param {Object} stack Tracks traversed `array` and `other` objects.
	* @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
	*/
	function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
		var isPartial = bitmask & COMPARE_PARTIAL_FLAG, arrLength = array.length, othLength = other.length;
		if (arrLength != othLength && !(isPartial && othLength > arrLength)) return false;
		var stacked = stack.get(array);
		if (stacked && stack.get(other)) return stacked == other;
		var index = -1, result = true, seen = bitmask & COMPARE_UNORDERED_FLAG ? new SetCache() : void 0;
		stack.set(array, other);
		stack.set(other, array);
		while (++index < arrLength) {
			var arrValue = array[index], othValue = other[index];
			if (customizer) var compared = isPartial ? customizer(othValue, arrValue, index, other, array, stack) : customizer(arrValue, othValue, index, array, other, stack);
			if (compared !== void 0) {
				if (compared) continue;
				result = false;
				break;
			}
			if (seen) {
				if (!arraySome(other, function(othValue, othIndex) {
					if (!cacheHas(seen, othIndex) && (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) return seen.push(othIndex);
				})) {
					result = false;
					break;
				}
			} else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
				result = false;
				break;
			}
		}
		stack["delete"](array);
		stack["delete"](other);
		return result;
	}
	/**
	* A specialized version of `baseIsEqualDeep` for comparing objects of
	* the same `toStringTag`.
	*
	* **Note:** This function only supports comparing values with tags of
	* `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
	*
	* @private
	* @param {Object} object The object to compare.
	* @param {Object} other The other object to compare.
	* @param {string} tag The `toStringTag` of the objects to compare.
	* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	* @param {Function} customizer The function to customize comparisons.
	* @param {Function} equalFunc The function to determine equivalents of values.
	* @param {Object} stack Tracks traversed `object` and `other` objects.
	* @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
	*/
	function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
		switch (tag) {
			case dataViewTag:
				if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) return false;
				object = object.buffer;
				other = other.buffer;
			case arrayBufferTag:
				if (object.byteLength != other.byteLength || !equalFunc(new Uint8Array(object), new Uint8Array(other))) return false;
				return true;
			case boolTag:
			case dateTag:
			case numberTag: return eq(+object, +other);
			case errorTag: return object.name == other.name && object.message == other.message;
			case regexpTag:
			case stringTag: return object == other + "";
			case mapTag: var convert = mapToArray;
			case setTag:
				var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
				convert || (convert = setToArray);
				if (object.size != other.size && !isPartial) return false;
				var stacked = stack.get(object);
				if (stacked) return stacked == other;
				bitmask |= COMPARE_UNORDERED_FLAG;
				stack.set(object, other);
				var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
				stack["delete"](object);
				return result;
			case symbolTag: if (symbolValueOf) return symbolValueOf.call(object) == symbolValueOf.call(other);
		}
		return false;
	}
	/**
	* A specialized version of `baseIsEqualDeep` for objects with support for
	* partial deep comparisons.
	*
	* @private
	* @param {Object} object The object to compare.
	* @param {Object} other The other object to compare.
	* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	* @param {Function} customizer The function to customize comparisons.
	* @param {Function} equalFunc The function to determine equivalents of values.
	* @param {Object} stack Tracks traversed `object` and `other` objects.
	* @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
	*/
	function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
		var isPartial = bitmask & COMPARE_PARTIAL_FLAG, objProps = getAllKeys(object), objLength = objProps.length;
		if (objLength != getAllKeys(other).length && !isPartial) return false;
		var index = objLength;
		while (index--) {
			var key = objProps[index];
			if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) return false;
		}
		var stacked = stack.get(object);
		if (stacked && stack.get(other)) return stacked == other;
		var result = true;
		stack.set(object, other);
		stack.set(other, object);
		var skipCtor = isPartial;
		while (++index < objLength) {
			key = objProps[index];
			var objValue = object[key], othValue = other[key];
			if (customizer) var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
			if (!(compared === void 0 ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
				result = false;
				break;
			}
			skipCtor || (skipCtor = key == "constructor");
		}
		if (result && !skipCtor) {
			var objCtor = object.constructor, othCtor = other.constructor;
			if (objCtor != othCtor && "constructor" in object && "constructor" in other && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) result = false;
		}
		stack["delete"](object);
		stack["delete"](other);
		return result;
	}
	/**
	* Creates an array of own enumerable property names and symbols of `object`.
	*
	* @private
	* @param {Object} object The object to query.
	* @returns {Array} Returns the array of property names and symbols.
	*/
	function getAllKeys(object) {
		return baseGetAllKeys(object, keys, getSymbols);
	}
	/**
	* Gets the data for `map`.
	*
	* @private
	* @param {Object} map The map to query.
	* @param {string} key The reference key.
	* @returns {*} Returns the map data.
	*/
	function getMapData(map, key) {
		var data = map.__data__;
		return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
	}
	/**
	* Gets the native function at `key` of `object`.
	*
	* @private
	* @param {Object} object The object to query.
	* @param {string} key The key of the method to get.
	* @returns {*} Returns the function if it's native, else `undefined`.
	*/
	function getNative(object, key) {
		var value = getValue(object, key);
		return baseIsNative(value) ? value : void 0;
	}
	/**
	* A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
	*
	* @private
	* @param {*} value The value to query.
	* @returns {string} Returns the raw `toStringTag`.
	*/
	function getRawTag(value) {
		var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
		try {
			value[symToStringTag] = void 0;
			var unmasked = true;
		} catch (e) {}
		var result = nativeObjectToString.call(value);
		if (unmasked) if (isOwn) value[symToStringTag] = tag;
		else delete value[symToStringTag];
		return result;
	}
	/**
	* Creates an array of the own enumerable symbols of `object`.
	*
	* @private
	* @param {Object} object The object to query.
	* @returns {Array} Returns the array of symbols.
	*/
	var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
		if (object == null) return [];
		object = Object(object);
		return arrayFilter(nativeGetSymbols(object), function(symbol) {
			return propertyIsEnumerable.call(object, symbol);
		});
	};
	/**
	* Gets the `toStringTag` of `value`.
	*
	* @private
	* @param {*} value The value to query.
	* @returns {string} Returns the `toStringTag`.
	*/
	var getTag = baseGetTag;
	if (DataView && getTag(new DataView(/* @__PURE__ */ new ArrayBuffer(1))) != dataViewTag || Map && getTag(new Map()) != mapTag || Promise && getTag(Promise.resolve()) != promiseTag || Set && getTag(new Set()) != setTag || WeakMap && getTag(new WeakMap()) != weakMapTag) getTag = function(value) {
		var result = baseGetTag(value), Ctor = result == objectTag ? value.constructor : void 0, ctorString = Ctor ? toSource(Ctor) : "";
		if (ctorString) switch (ctorString) {
			case dataViewCtorString: return dataViewTag;
			case mapCtorString: return mapTag;
			case promiseCtorString: return promiseTag;
			case setCtorString: return setTag;
			case weakMapCtorString: return weakMapTag;
		}
		return result;
	};
	/**
	* Checks if `value` is a valid array-like index.
	*
	* @private
	* @param {*} value The value to check.
	* @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	* @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	*/
	function isIndex(value, length) {
		length = length == null ? MAX_SAFE_INTEGER : length;
		return !!length && (typeof value == "number" || reIsUint.test(value)) && value > -1 && value % 1 == 0 && value < length;
	}
	/**
	* Checks if `value` is suitable for use as unique object key.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is suitable, else `false`.
	*/
	function isKeyable(value) {
		var type = typeof value;
		return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
	}
	/**
	* Checks if `func` has its source masked.
	*
	* @private
	* @param {Function} func The function to check.
	* @returns {boolean} Returns `true` if `func` is masked, else `false`.
	*/
	function isMasked(func) {
		return !!maskSrcKey && maskSrcKey in func;
	}
	/**
	* Checks if `value` is likely a prototype object.
	*
	* @private
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
	*/
	function isPrototype(value) {
		var Ctor = value && value.constructor;
		return value === (typeof Ctor == "function" && Ctor.prototype || objectProto);
	}
	/**
	* Converts `value` to a string using `Object.prototype.toString`.
	*
	* @private
	* @param {*} value The value to convert.
	* @returns {string} Returns the converted string.
	*/
	function objectToString(value) {
		return nativeObjectToString.call(value);
	}
	/**
	* Converts `func` to its source code.
	*
	* @private
	* @param {Function} func The function to convert.
	* @returns {string} Returns the source code.
	*/
	function toSource(func) {
		if (func != null) {
			try {
				return funcToString.call(func);
			} catch (e) {}
			try {
				return func + "";
			} catch (e) {}
		}
		return "";
	}
	/**
	* Performs a
	* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	* comparison between two values to determine if they are equivalent.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to compare.
	* @param {*} other The other value to compare.
	* @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	* @example
	*
	* var object = { 'a': 1 };
	* var other = { 'a': 1 };
	*
	* _.eq(object, object);
	* // => true
	*
	* _.eq(object, other);
	* // => false
	*
	* _.eq('a', 'a');
	* // => true
	*
	* _.eq('a', Object('a'));
	* // => false
	*
	* _.eq(NaN, NaN);
	* // => true
	*/
	function eq(value, other) {
		return value === other || value !== value && other !== other;
	}
	/**
	* Checks if `value` is likely an `arguments` object.
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is an `arguments` object,
	*  else `false`.
	* @example
	*
	* _.isArguments(function() { return arguments; }());
	* // => true
	*
	* _.isArguments([1, 2, 3]);
	* // => false
	*/
	var isArguments = baseIsArguments(function() {
		return arguments;
	}()) ? baseIsArguments : function(value) {
		return isObjectLike(value) && hasOwnProperty.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
	};
	/**
	* Checks if `value` is classified as an `Array` object.
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is an array, else `false`.
	* @example
	*
	* _.isArray([1, 2, 3]);
	* // => true
	*
	* _.isArray(document.body.children);
	* // => false
	*
	* _.isArray('abc');
	* // => false
	*
	* _.isArray(_.noop);
	* // => false
	*/
	var isArray = Array.isArray;
	/**
	* Checks if `value` is array-like. A value is considered array-like if it's
	* not a function and has a `value.length` that's an integer greater than or
	* equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	* @example
	*
	* _.isArrayLike([1, 2, 3]);
	* // => true
	*
	* _.isArrayLike(document.body.children);
	* // => true
	*
	* _.isArrayLike('abc');
	* // => true
	*
	* _.isArrayLike(_.noop);
	* // => false
	*/
	function isArrayLike(value) {
		return value != null && isLength(value.length) && !isFunction(value);
	}
	/**
	* Checks if `value` is a buffer.
	*
	* @static
	* @memberOf _
	* @since 4.3.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
	* @example
	*
	* _.isBuffer(new Buffer(2));
	* // => true
	*
	* _.isBuffer(new Uint8Array(2));
	* // => false
	*/
	var isBuffer = nativeIsBuffer || stubFalse;
	/**
	* Performs a deep comparison between two values to determine if they are
	* equivalent.
	*
	* **Note:** This method supports comparing arrays, array buffers, booleans,
	* date objects, error objects, maps, numbers, `Object` objects, regexes,
	* sets, strings, symbols, and typed arrays. `Object` objects are compared
	* by their own, not inherited, enumerable properties. Functions and DOM
	* nodes are compared by strict equality, i.e. `===`.
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Lang
	* @param {*} value The value to compare.
	* @param {*} other The other value to compare.
	* @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	* @example
	*
	* var object = { 'a': 1 };
	* var other = { 'a': 1 };
	*
	* _.isEqual(object, other);
	* // => true
	*
	* object === other;
	* // => false
	*/
	function isEqual(value, other) {
		return baseIsEqual(value, other);
	}
	/**
	* Checks if `value` is classified as a `Function` object.
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a function, else `false`.
	* @example
	*
	* _.isFunction(_);
	* // => true
	*
	* _.isFunction(/abc/);
	* // => false
	*/
	function isFunction(value) {
		if (!isObject(value)) return false;
		var tag = baseGetTag(value);
		return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
	}
	/**
	* Checks if `value` is a valid array-like length.
	*
	* **Note:** This method is loosely based on
	* [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	* @example
	*
	* _.isLength(3);
	* // => true
	*
	* _.isLength(Number.MIN_VALUE);
	* // => false
	*
	* _.isLength(Infinity);
	* // => false
	*
	* _.isLength('3');
	* // => false
	*/
	function isLength(value) {
		return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}
	/**
	* Checks if `value` is the
	* [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
	* of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	*
	* @static
	* @memberOf _
	* @since 0.1.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is an object, else `false`.
	* @example
	*
	* _.isObject({});
	* // => true
	*
	* _.isObject([1, 2, 3]);
	* // => true
	*
	* _.isObject(_.noop);
	* // => true
	*
	* _.isObject(null);
	* // => false
	*/
	function isObject(value) {
		var type = typeof value;
		return value != null && (type == "object" || type == "function");
	}
	/**
	* Checks if `value` is object-like. A value is object-like if it's not `null`
	* and has a `typeof` result of "object".
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	* @example
	*
	* _.isObjectLike({});
	* // => true
	*
	* _.isObjectLike([1, 2, 3]);
	* // => true
	*
	* _.isObjectLike(_.noop);
	* // => false
	*
	* _.isObjectLike(null);
	* // => false
	*/
	function isObjectLike(value) {
		return value != null && typeof value == "object";
	}
	/**
	* Checks if `value` is classified as a typed array.
	*
	* @static
	* @memberOf _
	* @since 3.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
	* @example
	*
	* _.isTypedArray(new Uint8Array);
	* // => true
	*
	* _.isTypedArray([]);
	* // => false
	*/
	var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
	/**
	* Creates an array of the own enumerable property names of `object`.
	*
	* **Note:** Non-object values are coerced to objects. See the
	* [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
	* for more details.
	*
	* @static
	* @since 0.1.0
	* @memberOf _
	* @category Object
	* @param {Object} object The object to query.
	* @returns {Array} Returns the array of property names.
	* @example
	*
	* function Foo() {
	*   this.a = 1;
	*   this.b = 2;
	* }
	*
	* Foo.prototype.c = 3;
	*
	* _.keys(new Foo);
	* // => ['a', 'b'] (iteration order is not guaranteed)
	*
	* _.keys('hi');
	* // => ['0', '1']
	*/
	function keys(object) {
		return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
	}
	/**
	* This method returns a new empty array.
	*
	* @static
	* @memberOf _
	* @since 4.13.0
	* @category Util
	* @returns {Array} Returns the new empty array.
	* @example
	*
	* var arrays = _.times(2, _.stubArray);
	*
	* console.log(arrays);
	* // => [[], []]
	*
	* console.log(arrays[0] === arrays[1]);
	* // => false
	*/
	function stubArray() {
		return [];
	}
	/**
	* This method returns `false`.
	*
	* @static
	* @memberOf _
	* @since 4.13.0
	* @category Util
	* @returns {boolean} Returns `false`.
	* @example
	*
	* _.times(2, _.stubFalse);
	* // => [false, false]
	*/
	function stubFalse() {
		return false;
	}
	module.exports = isEqual;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/DownloadedUpdateHelper.js
var require_DownloadedUpdateHelper = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.DownloadedUpdateHelper = void 0;
	exports.createTempUpdateFile = createTempUpdateFile;
	var crypto_1$2 = require("crypto");
	var fs_1$4 = require("fs");
	var isEqual = require_lodash_isequal();
	var fs_extra_1 = require_lib();
	var path$10 = require("path");
	/** @private **/
	var DownloadedUpdateHelper = class {
		constructor(cacheDir) {
			this.cacheDir = cacheDir;
			this._file = null;
			this._packageFile = null;
			this.versionInfo = null;
			this.fileInfo = null;
			this._downloadedFileInfo = null;
		}
		get downloadedFileInfo() {
			return this._downloadedFileInfo;
		}
		get file() {
			return this._file;
		}
		get packageFile() {
			return this._packageFile;
		}
		get cacheDirForPendingUpdate() {
			return path$10.join(this.cacheDir, "pending");
		}
		async validateDownloadedPath(updateFile, updateInfo, fileInfo, logger) {
			if (this.versionInfo != null && this.file === updateFile && this.fileInfo != null) if (isEqual(this.versionInfo, updateInfo) && isEqual(this.fileInfo.info, fileInfo.info) && await (0, fs_extra_1.pathExists)(updateFile)) return updateFile;
			else return null;
			const cachedUpdateFile = await this.getValidCachedUpdateFile(fileInfo, logger);
			if (cachedUpdateFile === null) return null;
			logger.info(`Update has already been downloaded to ${updateFile}).`);
			this._file = cachedUpdateFile;
			return cachedUpdateFile;
		}
		async setDownloadedFile(downloadedFile, packageFile, versionInfo, fileInfo, updateFileName, isSaveCache) {
			this._file = downloadedFile;
			this._packageFile = packageFile;
			this.versionInfo = versionInfo;
			this.fileInfo = fileInfo;
			this._downloadedFileInfo = {
				fileName: updateFileName,
				sha512: fileInfo.info.sha512,
				isAdminRightsRequired: fileInfo.info.isAdminRightsRequired === true
			};
			if (isSaveCache) await (0, fs_extra_1.outputJson)(this.getUpdateInfoFile(), this._downloadedFileInfo);
		}
		async clear() {
			this._file = null;
			this._packageFile = null;
			this.versionInfo = null;
			this.fileInfo = null;
			await this.cleanCacheDirForPendingUpdate();
		}
		async cleanCacheDirForPendingUpdate() {
			try {
				await (0, fs_extra_1.emptyDir)(this.cacheDirForPendingUpdate);
			} catch (_ignore) {}
		}
		/**
		* Returns "update-info.json" which is created in the update cache directory's "pending" subfolder after the first update is downloaded.  If the update file does not exist then the cache is cleared and recreated.  If the update file exists then its properties are validated.
		* @param fileInfo
		* @param logger
		*/
		async getValidCachedUpdateFile(fileInfo, logger) {
			const updateInfoFilePath = this.getUpdateInfoFile();
			if (!await (0, fs_extra_1.pathExists)(updateInfoFilePath)) return null;
			let cachedInfo;
			try {
				cachedInfo = await (0, fs_extra_1.readJson)(updateInfoFilePath);
			} catch (error) {
				let message = `No cached update info available`;
				if (error.code !== "ENOENT") {
					await this.cleanCacheDirForPendingUpdate();
					message += ` (error on read: ${error.message})`;
				}
				logger.info(message);
				return null;
			}
			if (!((cachedInfo === null || cachedInfo === void 0 ? void 0 : cachedInfo.fileName) !== null)) {
				logger.warn(`Cached update info is corrupted: no fileName, directory for cached update will be cleaned`);
				await this.cleanCacheDirForPendingUpdate();
				return null;
			}
			if (fileInfo.info.sha512 !== cachedInfo.sha512) {
				logger.info(`Cached update sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${cachedInfo.sha512}, expected: ${fileInfo.info.sha512}. Directory for cached update will be cleaned`);
				await this.cleanCacheDirForPendingUpdate();
				return null;
			}
			const updateFile = path$10.join(this.cacheDirForPendingUpdate, cachedInfo.fileName);
			if (!await (0, fs_extra_1.pathExists)(updateFile)) {
				logger.info("Cached update file doesn't exist");
				return null;
			}
			const sha512 = await hashFile(updateFile);
			if (fileInfo.info.sha512 !== sha512) {
				logger.warn(`Sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${sha512}, expected: ${fileInfo.info.sha512}`);
				await this.cleanCacheDirForPendingUpdate();
				return null;
			}
			this._downloadedFileInfo = cachedInfo;
			return updateFile;
		}
		getUpdateInfoFile() {
			return path$10.join(this.cacheDirForPendingUpdate, "update-info.json");
		}
	};
	exports.DownloadedUpdateHelper = DownloadedUpdateHelper;
	function hashFile(file, algorithm = "sha512", encoding = "base64", options) {
		return new Promise((resolve, reject) => {
			const hash = (0, crypto_1$2.createHash)(algorithm);
			hash.on("error", reject).setEncoding(encoding);
			(0, fs_1$4.createReadStream)(file, {
				...options,
				highWaterMark: 1024 * 1024
			}).on("error", reject).on("end", () => {
				hash.end();
				resolve(hash.read());
			}).pipe(hash, { end: false });
		});
	}
	async function createTempUpdateFile(name, cacheDir, log) {
		let nameCounter = 0;
		let result = path$10.join(cacheDir, name);
		for (let i = 0; i < 3; i++) try {
			await (0, fs_extra_1.unlink)(result);
			return result;
		} catch (e) {
			if (e.code === "ENOENT") return result;
			log.warn(`Error on remove temp update file: ${e}`);
			result = path$10.join(cacheDir, `${nameCounter++}-${name}`);
		}
		return result;
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/out/AppAdapter.js
var require_AppAdapter = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.getAppCacheDir = getAppCacheDir;
	var path$9 = require("path");
	var os_1$1 = require("os");
	function getAppCacheDir() {
		const homedir = (0, os_1$1.homedir)();
		let result;
		if (process.platform === "win32") result = process.env["LOCALAPPDATA"] || path$9.join(homedir, "AppData", "Local");
		else if (process.platform === "darwin") result = path$9.join(homedir, "Library", "Caches");
		else result = process.env["XDG_CACHE_HOME"] || path$9.join(homedir, ".cache");
		return result;
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/out/ElectronAppAdapter.js
var require_ElectronAppAdapter = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ElectronAppAdapter = void 0;
	var path$8 = require("path");
	var AppAdapter_1 = require_AppAdapter();
	var ElectronAppAdapter = class {
		constructor(app = require("electron").app) {
			this.app = app;
		}
		whenReady() {
			return this.app.whenReady();
		}
		get version() {
			return this.app.getVersion();
		}
		get name() {
			return this.app.getName();
		}
		get isPackaged() {
			return this.app.isPackaged === true;
		}
		get appUpdateConfigPath() {
			return this.isPackaged ? path$8.join(process.resourcesPath, "app-update.yml") : path$8.join(this.app.getAppPath(), "dev-app-update.yml");
		}
		get userDataPath() {
			return this.app.getPath("userData");
		}
		get baseCachePath() {
			return (0, AppAdapter_1.getAppCacheDir)();
		}
		quit() {
			this.app.quit();
		}
		relaunch() {
			this.app.relaunch();
		}
		onQuit(handler) {
			this.app.once("quit", (_, exitCode) => handler(exitCode));
		}
	};
	exports.ElectronAppAdapter = ElectronAppAdapter;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/electronHttpExecutor.js
var require_electronHttpExecutor = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ElectronHttpExecutor = exports.NET_SESSION_NAME = void 0;
	exports.getNetSession = getNetSession;
	var builder_util_runtime_1 = require_out();
	exports.NET_SESSION_NAME = "electron-updater";
	function getNetSession() {
		return require("electron").session.fromPartition(exports.NET_SESSION_NAME, { cache: false });
	}
	var ElectronHttpExecutor = class extends builder_util_runtime_1.HttpExecutor {
		constructor(proxyLoginCallback) {
			super();
			this.proxyLoginCallback = proxyLoginCallback;
			this.cachedSession = null;
		}
		async download(url, destination, options) {
			return await options.cancellationToken.createPromise((resolve, reject, onCancel) => {
				const requestOptions = {
					headers: options.headers || void 0,
					redirect: "manual"
				};
				(0, builder_util_runtime_1.configureRequestUrl)(url, requestOptions);
				(0, builder_util_runtime_1.configureRequestOptions)(requestOptions);
				this.doDownload(requestOptions, {
					destination,
					options,
					onCancel,
					callback: (error) => {
						if (error == null) resolve(destination);
						else reject(error);
					},
					responseHandler: null
				}, 0);
			});
		}
		createRequest(options, callback) {
			if (options.headers && options.headers.Host) {
				options.host = options.headers.Host;
				delete options.headers.Host;
			}
			if (this.cachedSession == null) this.cachedSession = getNetSession();
			const request = require("electron").net.request({
				...options,
				session: this.cachedSession
			});
			request.on("response", callback);
			if (this.proxyLoginCallback != null) request.on("login", this.proxyLoginCallback);
			return request;
		}
		addRedirectHandlers(request, options, reject, redirectCount, handler) {
			request.on("redirect", (statusCode, method, redirectUrl) => {
				request.abort();
				if (redirectCount > this.maxRedirects) reject(this.createMaxRedirectError());
				else handler(builder_util_runtime_1.HttpExecutor.prepareRedirectUrlOptions(redirectUrl, options));
			});
		}
	};
	exports.ElectronHttpExecutor = ElectronHttpExecutor;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/util.js
var require_util = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.newBaseUrl = newBaseUrl;
	exports.newUrlFromBase = newUrlFromBase;
	exports.getChannelFilename = getChannelFilename;
	var url_1$6 = require("url");
	/** @internal */
	function newBaseUrl(url) {
		const result = new url_1$6.URL(url);
		if (!result.pathname.endsWith("/")) result.pathname += "/";
		return result;
	}
	function newUrlFromBase(pathname, baseUrl, addRandomQueryToAvoidCaching = false) {
		const result = new url_1$6.URL(pathname, baseUrl);
		const search = baseUrl.search;
		if (search != null && search.length !== 0) result.search = search;
		else if (addRandomQueryToAvoidCaching) result.search = `noCache=${Date.now().toString(32)}`;
		return result;
	}
	function getChannelFilename(channel) {
		return `${channel}.yml`;
	}
}));
//#endregion
//#region ../../node_modules/lodash.escaperegexp/index.js
var require_lodash_escaperegexp = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* lodash (Custom Build) <https://lodash.com/>
	* Build: `lodash modularize exports="npm" -o ./`
	* Copyright jQuery Foundation and other contributors <https://jquery.org/>
	* Released under MIT license <https://lodash.com/license>
	* Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	* Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	*/
	/** Used as references for various `Number` constants. */
	var INFINITY = Infinity;
	/** `Object#toString` result references. */
	var symbolTag = "[object Symbol]";
	/**
	* Used to match `RegExp`
	* [syntax characters](http://ecma-international.org/ecma-262/6.0/#sec-patterns).
	*/
	var reRegExpChar = /[\\^$.*+?()[\]{}|]/g, reHasRegExpChar = RegExp(reRegExpChar.source);
	/** Detect free variable `global` from Node.js. */
	var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
	/** Detect free variable `self`. */
	var freeSelf = typeof self == "object" && self && self.Object === Object && self;
	/** Used as a reference to the global object. */
	var root = freeGlobal || freeSelf || Function("return this")();
	/**
	* Used to resolve the
	* [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	* of values.
	*/
	var objectToString = Object.prototype.toString;
	/** Built-in value references. */
	var Symbol = root.Symbol;
	/** Used to convert symbols to primitives and strings. */
	var symbolProto = Symbol ? Symbol.prototype : void 0, symbolToString = symbolProto ? symbolProto.toString : void 0;
	/**
	* The base implementation of `_.toString` which doesn't convert nullish
	* values to empty strings.
	*
	* @private
	* @param {*} value The value to process.
	* @returns {string} Returns the string.
	*/
	function baseToString(value) {
		if (typeof value == "string") return value;
		if (isSymbol(value)) return symbolToString ? symbolToString.call(value) : "";
		var result = value + "";
		return result == "0" && 1 / value == -INFINITY ? "-0" : result;
	}
	/**
	* Checks if `value` is object-like. A value is object-like if it's not `null`
	* and has a `typeof` result of "object".
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	* @example
	*
	* _.isObjectLike({});
	* // => true
	*
	* _.isObjectLike([1, 2, 3]);
	* // => true
	*
	* _.isObjectLike(_.noop);
	* // => false
	*
	* _.isObjectLike(null);
	* // => false
	*/
	function isObjectLike(value) {
		return !!value && typeof value == "object";
	}
	/**
	* Checks if `value` is classified as a `Symbol` primitive or object.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to check.
	* @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
	* @example
	*
	* _.isSymbol(Symbol.iterator);
	* // => true
	*
	* _.isSymbol('abc');
	* // => false
	*/
	function isSymbol(value) {
		return typeof value == "symbol" || isObjectLike(value) && objectToString.call(value) == symbolTag;
	}
	/**
	* Converts `value` to a string. An empty string is returned for `null`
	* and `undefined` values. The sign of `-0` is preserved.
	*
	* @static
	* @memberOf _
	* @since 4.0.0
	* @category Lang
	* @param {*} value The value to process.
	* @returns {string} Returns the string.
	* @example
	*
	* _.toString(null);
	* // => ''
	*
	* _.toString(-0);
	* // => '-0'
	*
	* _.toString([1, 2, 3]);
	* // => '1,2,3'
	*/
	function toString(value) {
		return value == null ? "" : baseToString(value);
	}
	/**
	* Escapes the `RegExp` special characters "^", "$", "\", ".", "*", "+",
	* "?", "(", ")", "[", "]", "{", "}", and "|" in `string`.
	*
	* @static
	* @memberOf _
	* @since 3.0.0
	* @category String
	* @param {string} [string=''] The string to escape.
	* @returns {string} Returns the escaped string.
	* @example
	*
	* _.escapeRegExp('[lodash](https://lodash.com/)');
	* // => '\[lodash\]\(https://lodash\.com/\)'
	*/
	function escapeRegExp(string) {
		string = toString(string);
		return string && reHasRegExpChar.test(string) ? string.replace(reRegExpChar, "\\$&") : string;
	}
	module.exports = escapeRegExp;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/providers/Provider.js
var require_Provider = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Provider = void 0;
	exports.findFile = findFile;
	exports.parseUpdateInfo = parseUpdateInfo;
	exports.getFileList = getFileList;
	exports.resolveFiles = resolveFiles;
	var builder_util_runtime_1 = require_out();
	var js_yaml_1 = require_js_yaml();
	var url_1$5 = require("url");
	var util_1 = require_util();
	var escapeRegExp = require_lodash_escaperegexp();
	var Provider = class {
		constructor(runtimeOptions) {
			this.runtimeOptions = runtimeOptions;
			this.requestHeaders = null;
			this.executor = runtimeOptions.executor;
		}
		getBlockMapFiles(baseUrl, oldVersion, newVersion, oldBlockMapFileBaseUrl = null) {
			const newBlockMapUrl = (0, util_1.newUrlFromBase)(`${baseUrl.pathname}.blockmap`, baseUrl);
			return [(0, util_1.newUrlFromBase)(`${baseUrl.pathname.replace(new RegExp(escapeRegExp(newVersion), "g"), oldVersion)}.blockmap`, oldBlockMapFileBaseUrl ? new url_1$5.URL(oldBlockMapFileBaseUrl) : baseUrl), newBlockMapUrl];
		}
		get isUseMultipleRangeRequest() {
			return this.runtimeOptions.isUseMultipleRangeRequest !== false;
		}
		getChannelFilePrefix() {
			if (this.runtimeOptions.platform === "linux") {
				const arch = process.env["TEST_UPDATER_ARCH"] || process.arch;
				return "-linux" + (arch === "x64" ? "" : `-${arch}`);
			} else return this.runtimeOptions.platform === "darwin" ? "-mac" : "";
		}
		getDefaultChannelName() {
			return this.getCustomChannelName("latest");
		}
		getCustomChannelName(channel) {
			return `${channel}${this.getChannelFilePrefix()}`;
		}
		get fileExtraDownloadHeaders() {
			return null;
		}
		setRequestHeaders(value) {
			this.requestHeaders = value;
		}
		/**
		* Method to perform API request only to resolve update info, but not to download update.
		*/
		httpRequest(url, headers, cancellationToken) {
			return this.executor.request(this.createRequestOptions(url, headers), cancellationToken);
		}
		createRequestOptions(url, headers) {
			const result = {};
			if (this.requestHeaders == null) {
				if (headers != null) result.headers = headers;
			} else result.headers = headers == null ? this.requestHeaders : {
				...this.requestHeaders,
				...headers
			};
			(0, builder_util_runtime_1.configureRequestUrl)(url, result);
			return result;
		}
	};
	exports.Provider = Provider;
	function findFile(files, extension, not) {
		var _a;
		if (files.length === 0) throw (0, builder_util_runtime_1.newError)("No files provided", "ERR_UPDATER_NO_FILES_PROVIDED");
		const filteredFiles = files.filter((it) => it.url.pathname.toLowerCase().endsWith(`.${extension.toLowerCase()}`));
		const result = (_a = filteredFiles.find((it) => [it.url.pathname, it.info.url].some((n) => n.includes(process.arch)))) !== null && _a !== void 0 ? _a : filteredFiles.shift();
		if (result) return result;
		else if (not == null) return files[0];
		else return files.find((fileInfo) => !not.some((ext) => fileInfo.url.pathname.toLowerCase().endsWith(`.${ext.toLowerCase()}`)));
	}
	function parseUpdateInfo(rawData, channelFile, channelFileUrl) {
		if (rawData == null) throw (0, builder_util_runtime_1.newError)(`Cannot parse update info from ${channelFile} in the latest release artifacts (${channelFileUrl}): rawData: null`, "ERR_UPDATER_INVALID_UPDATE_INFO");
		let result;
		try {
			result = (0, js_yaml_1.load)(rawData);
		} catch (e) {
			throw (0, builder_util_runtime_1.newError)(`Cannot parse update info from ${channelFile} in the latest release artifacts (${channelFileUrl}): ${e.stack || e.message}, rawData: ${rawData}`, "ERR_UPDATER_INVALID_UPDATE_INFO");
		}
		return result;
	}
	function getFileList(updateInfo) {
		const files = updateInfo.files;
		if (files != null && files.length > 0) return files;
		if (updateInfo.path != null) return [{
			url: updateInfo.path,
			sha2: updateInfo.sha2,
			sha512: updateInfo.sha512
		}];
		else throw (0, builder_util_runtime_1.newError)(`No files provided: ${(0, builder_util_runtime_1.safeStringifyJson)(updateInfo)}`, "ERR_UPDATER_NO_FILES_PROVIDED");
	}
	function resolveFiles(updateInfo, baseUrl, pathTransformer = (p) => p) {
		const result = getFileList(updateInfo).map((fileInfo) => {
			if (fileInfo.sha2 == null && fileInfo.sha512 == null) throw (0, builder_util_runtime_1.newError)(`Update info doesn't contain nor sha256 neither sha512 checksum: ${(0, builder_util_runtime_1.safeStringifyJson)(fileInfo)}`, "ERR_UPDATER_NO_CHECKSUM");
			return {
				url: (0, util_1.newUrlFromBase)(pathTransformer(fileInfo.url), baseUrl),
				info: fileInfo
			};
		});
		const packages = updateInfo.packages;
		const packageInfo = packages == null ? null : packages[process.arch] || packages.ia32;
		if (packageInfo != null) result[0].packageInfo = {
			...packageInfo,
			path: (0, util_1.newUrlFromBase)(pathTransformer(packageInfo.path), baseUrl).href
		};
		return result;
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/out/providers/GenericProvider.js
var require_GenericProvider = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.GenericProvider = void 0;
	var builder_util_runtime_1 = require_out();
	var util_1 = require_util();
	var Provider_1 = require_Provider();
	var GenericProvider = class extends Provider_1.Provider {
		constructor(configuration, updater, runtimeOptions) {
			super(runtimeOptions);
			this.configuration = configuration;
			this.updater = updater;
			this.baseUrl = (0, util_1.newBaseUrl)(this.configuration.url);
		}
		get channel() {
			const result = this.updater.channel || this.configuration.channel;
			return result == null ? this.getDefaultChannelName() : this.getCustomChannelName(result);
		}
		async getLatestVersion() {
			const channelFile = (0, util_1.getChannelFilename)(this.channel);
			const channelUrl = (0, util_1.newUrlFromBase)(channelFile, this.baseUrl, this.updater.isAddNoCacheQuery);
			for (let attemptNumber = 0;; attemptNumber++) try {
				return (0, Provider_1.parseUpdateInfo)(await this.httpRequest(channelUrl), channelFile, channelUrl);
			} catch (e) {
				if (e instanceof builder_util_runtime_1.HttpError && e.statusCode === 404) throw (0, builder_util_runtime_1.newError)(`Cannot find channel "${channelFile}" update info: ${e.stack || e.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
				else if (e.code === "ECONNREFUSED") {
					if (attemptNumber < 3) {
						await new Promise((resolve, reject) => {
							try {
								setTimeout(resolve, 1e3 * attemptNumber);
							} catch (e) {
								reject(e);
							}
						});
						continue;
					}
				}
				throw e;
			}
		}
		resolveFiles(updateInfo) {
			return (0, Provider_1.resolveFiles)(updateInfo, this.baseUrl);
		}
	};
	exports.GenericProvider = GenericProvider;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/providers/BitbucketProvider.js
var require_BitbucketProvider = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.BitbucketProvider = void 0;
	var builder_util_runtime_1 = require_out();
	var util_1 = require_util();
	var Provider_1 = require_Provider();
	var BitbucketProvider = class extends Provider_1.Provider {
		constructor(configuration, updater, runtimeOptions) {
			super({
				...runtimeOptions,
				isUseMultipleRangeRequest: false
			});
			this.configuration = configuration;
			this.updater = updater;
			const { owner, slug } = configuration;
			this.baseUrl = (0, util_1.newBaseUrl)(`https://api.bitbucket.org/2.0/repositories/${owner}/${slug}/downloads`);
		}
		get channel() {
			return this.updater.channel || this.configuration.channel || "latest";
		}
		async getLatestVersion() {
			const cancellationToken = new builder_util_runtime_1.CancellationToken();
			const channelFile = (0, util_1.getChannelFilename)(this.getCustomChannelName(this.channel));
			const channelUrl = (0, util_1.newUrlFromBase)(channelFile, this.baseUrl, this.updater.isAddNoCacheQuery);
			try {
				const updateInfo = await this.httpRequest(channelUrl, void 0, cancellationToken);
				return (0, Provider_1.parseUpdateInfo)(updateInfo, channelFile, channelUrl);
			} catch (e) {
				throw (0, builder_util_runtime_1.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${e.stack || e.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
			}
		}
		resolveFiles(updateInfo) {
			return (0, Provider_1.resolveFiles)(updateInfo, this.baseUrl);
		}
		toString() {
			const { owner, slug } = this.configuration;
			return `Bitbucket (owner: ${owner}, slug: ${slug}, channel: ${this.channel})`;
		}
	};
	exports.BitbucketProvider = BitbucketProvider;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/providers/GitHubProvider.js
var require_GitHubProvider = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.GitHubProvider = exports.BaseGitHubProvider = void 0;
	exports.computeReleaseNotes = computeReleaseNotes;
	var builder_util_runtime_1 = require_out();
	var semver = require_semver();
	var url_1$4 = require("url");
	var util_1 = require_util();
	var Provider_1 = require_Provider();
	var hrefRegExp = /\/tag\/(v?[^/]+)$/;
	var BaseGitHubProvider = class extends Provider_1.Provider {
		constructor(options, defaultHost, runtimeOptions) {
			super({
				...runtimeOptions,
				isUseMultipleRangeRequest: false
			});
			this.options = options;
			this.baseUrl = (0, util_1.newBaseUrl)((0, builder_util_runtime_1.githubUrl)(options, defaultHost));
			const apiHost = defaultHost === "github.com" ? "api.github.com" : defaultHost;
			this.baseApiUrl = (0, util_1.newBaseUrl)((0, builder_util_runtime_1.githubUrl)(options, apiHost));
		}
		computeGithubBasePath(result) {
			const host = this.options.host;
			return host && !["github.com", "api.github.com"].includes(host) ? `/api/v3${result}` : result;
		}
	};
	exports.BaseGitHubProvider = BaseGitHubProvider;
	var GitHubProvider = class extends BaseGitHubProvider {
		constructor(options, updater, runtimeOptions) {
			super(options, "github.com", runtimeOptions);
			this.options = options;
			this.updater = updater;
		}
		get channel() {
			const result = this.updater.channel || this.options.channel;
			return result == null ? this.getDefaultChannelName() : this.getCustomChannelName(result);
		}
		async getLatestVersion() {
			var _a, _b, _c, _d, _e;
			const cancellationToken = new builder_util_runtime_1.CancellationToken();
			const feedXml = await this.httpRequest((0, util_1.newUrlFromBase)(`${this.basePath}.atom`, this.baseUrl), { accept: "application/xml, application/atom+xml, text/xml, */*" }, cancellationToken);
			const feed = (0, builder_util_runtime_1.parseXml)(feedXml);
			let latestRelease = feed.element("entry", false, `No published versions on GitHub`);
			let tag = null;
			try {
				if (this.updater.allowPrerelease) {
					const currentChannel = ((_a = this.updater) === null || _a === void 0 ? void 0 : _a.channel) || ((_b = semver.prerelease(this.updater.currentVersion)) === null || _b === void 0 ? void 0 : _b[0]) || null;
					if (currentChannel === null) tag = hrefRegExp.exec(latestRelease.element("link").attribute("href"))[1];
					else for (const element of feed.getElements("entry")) {
						const hrefElement = hrefRegExp.exec(element.element("link").attribute("href"));
						if (hrefElement === null) continue;
						const hrefTag = hrefElement[1];
						if (!semver.valid(hrefTag)) continue;
						const hrefChannel = ((_c = semver.prerelease(hrefTag)) === null || _c === void 0 ? void 0 : _c[0]) || null;
						const shouldFetchVersion = !currentChannel || ["alpha", "beta"].includes(currentChannel);
						const isCustomChannel = hrefChannel !== null && !["alpha", "beta"].includes(String(hrefChannel));
						if (shouldFetchVersion && !isCustomChannel && !(currentChannel === "beta" && hrefChannel === "alpha")) {
							tag = hrefTag;
							latestRelease = element;
							break;
						}
						if (hrefChannel && hrefChannel === currentChannel) {
							tag = hrefTag;
							latestRelease = element;
							break;
						}
					}
				} else {
					tag = await this.getLatestTagName(cancellationToken);
					for (const element of feed.getElements("entry")) {
						const hrefMatch = hrefRegExp.exec(element.element("link").attribute("href"));
						if (hrefMatch == null) continue;
						if (hrefMatch[1] === tag) {
							latestRelease = element;
							break;
						}
					}
				}
			} catch (e) {
				throw (0, builder_util_runtime_1.newError)(`Cannot parse releases feed: ${e.stack || e.message},\nXML:\n${feedXml}`, "ERR_UPDATER_INVALID_RELEASE_FEED");
			}
			if (tag == null) throw (0, builder_util_runtime_1.newError)(`No published versions on GitHub`, "ERR_UPDATER_NO_PUBLISHED_VERSIONS");
			let rawData;
			let channelFile = "";
			let channelFileUrl = "";
			const fetchData = async (channelName) => {
				channelFile = (0, util_1.getChannelFilename)(channelName);
				channelFileUrl = (0, util_1.newUrlFromBase)(this.getBaseDownloadPath(String(tag), channelFile), this.baseUrl);
				const requestOptions = this.createRequestOptions(channelFileUrl);
				try {
					return await this.executor.request(requestOptions, cancellationToken);
				} catch (e) {
					if (e instanceof builder_util_runtime_1.HttpError && e.statusCode === 404) throw (0, builder_util_runtime_1.newError)(`Cannot find ${channelFile} in the latest release artifacts (${channelFileUrl}): ${e.stack || e.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
					throw e;
				}
			};
			try {
				let channel = this.channel;
				if (this.updater.allowPrerelease && ((_d = semver.prerelease(tag)) === null || _d === void 0 ? void 0 : _d[0])) channel = this.getCustomChannelName(String((_e = semver.prerelease(tag)) === null || _e === void 0 ? void 0 : _e[0]));
				rawData = await fetchData(channel);
			} catch (e) {
				if (this.updater.allowPrerelease) rawData = await fetchData(this.getDefaultChannelName());
				else throw e;
			}
			const result = (0, Provider_1.parseUpdateInfo)(rawData, channelFile, channelFileUrl);
			if (result.releaseName == null) result.releaseName = latestRelease.elementValueOrEmpty("title");
			if (result.releaseNotes == null) result.releaseNotes = computeReleaseNotes(this.updater.currentVersion, this.updater.fullChangelog, feed, latestRelease);
			return {
				tag,
				...result
			};
		}
		async getLatestTagName(cancellationToken) {
			const options = this.options;
			const url = options.host == null || options.host === "github.com" ? (0, util_1.newUrlFromBase)(`${this.basePath}/latest`, this.baseUrl) : new url_1$4.URL(`${this.computeGithubBasePath(`/repos/${options.owner}/${options.repo}/releases`)}/latest`, this.baseApiUrl);
			try {
				const rawData = await this.httpRequest(url, { Accept: "application/json" }, cancellationToken);
				if (rawData == null) return null;
				return JSON.parse(rawData).tag_name;
			} catch (e) {
				throw (0, builder_util_runtime_1.newError)(`Unable to find latest version on GitHub (${url}), please ensure a production release exists: ${e.stack || e.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
			}
		}
		get basePath() {
			return `/${this.options.owner}/${this.options.repo}/releases`;
		}
		resolveFiles(updateInfo) {
			return (0, Provider_1.resolveFiles)(updateInfo, this.baseUrl, (p) => this.getBaseDownloadPath(updateInfo.tag, p.replace(/ /g, "-")));
		}
		getBaseDownloadPath(tag, fileName) {
			return `${this.basePath}/download/${tag}/${fileName}`;
		}
	};
	exports.GitHubProvider = GitHubProvider;
	function getNoteValue(parent) {
		const result = parent.elementValueOrEmpty("content");
		return result === "No content." ? "" : result;
	}
	function computeReleaseNotes(currentVersion, isFullChangelog, feed, latestRelease) {
		if (!isFullChangelog) return getNoteValue(latestRelease);
		const releaseVersionRegExp = /\/tag\/v?([^/]+)$/;
		let latestVersion = void 0;
		try {
			latestVersion = releaseVersionRegExp.exec(latestRelease.element("link").attribute("href"))[1];
			latestVersion = semver.valid(latestVersion) ? latestVersion : void 0;
		} catch {}
		if (latestVersion == null) return null;
		const releaseNotes = [];
		for (const release of feed.getElements("entry")) {
			let versionRelease;
			try {
				const match = releaseVersionRegExp.exec(release.element("link").attribute("href"));
				if (!match) continue;
				versionRelease = match[1];
			} catch {
				continue;
			}
			if (!semver.valid(versionRelease)) continue;
			const isGreaterThanCurrent = semver.gt(versionRelease, currentVersion.raw);
			const isLessOrEqualThanLatest = semver.lte(versionRelease, latestVersion);
			if (isGreaterThanCurrent && isLessOrEqualThanLatest) releaseNotes.push({
				version: versionRelease,
				note: getNoteValue(release)
			});
		}
		return releaseNotes.sort((a, b) => semver.rcompare(a.version, b.version));
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/out/providers/GitLabProvider.js
var require_GitLabProvider = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.GitLabProvider = void 0;
	var builder_util_runtime_1 = require_out();
	var url_1$3 = require("url");
	var escapeRegExp = require_lodash_escaperegexp();
	var util_1 = require_util();
	var Provider_1 = require_Provider();
	var GitLabProvider = class extends Provider_1.Provider {
		/**
		* Normalizes filenames by replacing spaces and underscores with dashes.
		*
		* This is a workaround to handle filename formatting differences between tools:
		* - electron-builder formats filenames like "test file.txt" as "test-file.txt"
		* - GitLab may provide asset URLs using underscores, such as "test_file.txt"
		*
		* Because of this mismatch, we can't reliably extract the correct filename from
		* the asset path without normalization. This function ensures consistent matching
		* across different filename formats by converting all spaces and underscores to dashes.
		*
		* @param filename The filename to normalize
		* @returns The normalized filename with spaces and underscores replaced by dashes
		*/
		normalizeFilename(filename) {
			return filename.replace(/ |_/g, "-");
		}
		constructor(options, updater, runtimeOptions) {
			super({
				...runtimeOptions,
				isUseMultipleRangeRequest: false
			});
			this.options = options;
			this.updater = updater;
			this.cachedLatestVersion = null;
			const host = options.host || "gitlab.com";
			this.baseApiUrl = (0, util_1.newBaseUrl)(`https://${host}/api/v4`);
		}
		createRequestOptions(url, headers) {
			const result = super.createRequestOptions(url, headers);
			result.redirect = "manual";
			return result;
		}
		get channel() {
			const result = this.updater.channel || this.options.channel;
			return result == null ? this.getDefaultChannelName() : this.getCustomChannelName(result);
		}
		async getLatestVersion() {
			const cancellationToken = new builder_util_runtime_1.CancellationToken();
			const latestReleaseUrl = (0, util_1.newUrlFromBase)(`projects/${this.options.projectId}/releases/permalink/latest`, this.baseApiUrl);
			const header = {
				Accept: "application/json",
				...this.setAuthHeaderForToken(this.options.token || null)
			};
			let releaseResponse;
			try {
				releaseResponse = await this.httpRequest(latestReleaseUrl, header, cancellationToken);
			} catch (e) {
				throw (0, builder_util_runtime_1.newError)(`Unable to find latest release on GitLab (${latestReleaseUrl}): ${e.stack || e.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
			}
			if (!releaseResponse) throw (0, builder_util_runtime_1.newError)("No published releases on GitLab", "ERR_UPDATER_NO_PUBLISHED_VERSIONS");
			let latestRelease;
			try {
				latestRelease = JSON.parse(releaseResponse);
			} catch (e) {
				throw (0, builder_util_runtime_1.newError)(`Unable to parse latest release response from GitLab (${latestReleaseUrl}): response was not valid JSON: ${e.stack || e.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
			}
			if (latestRelease.upcoming_release) throw (0, builder_util_runtime_1.newError)("Latest GitLab release is scheduled but not yet published", "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
			const tag = latestRelease.tag_name;
			let rawData = null;
			let channelFile = "";
			let channelFileUrl = null;
			const fetchChannelData = async (channelName) => {
				channelFile = (0, util_1.getChannelFilename)(channelName);
				const channelAsset = latestRelease.assets.links.find((asset) => asset.name === channelFile);
				if (!channelAsset) throw (0, builder_util_runtime_1.newError)(`Cannot find ${channelFile} in the latest release assets`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
				channelFileUrl = new url_1$3.URL(channelAsset.direct_asset_url);
				const authHeaders = this.setAuthHeaderForToken(this.options.token || null);
				const headers = Object.keys(authHeaders).length ? authHeaders : void 0;
				try {
					const result = await this.httpRequest(channelFileUrl, headers, cancellationToken);
					if (!result) throw (0, builder_util_runtime_1.newError)(`Empty response from ${channelFileUrl}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
					return result;
				} catch (e) {
					if (e instanceof builder_util_runtime_1.HttpError && e.statusCode === 404) throw (0, builder_util_runtime_1.newError)(`Cannot find ${channelFile} in the latest release artifacts (${channelFileUrl}): ${e.stack || e.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
					throw e;
				}
			};
			try {
				rawData = await fetchChannelData(this.channel);
			} catch (e) {
				if (this.channel !== this.getDefaultChannelName()) rawData = await fetchChannelData(this.getDefaultChannelName());
				else throw e;
			}
			if (!rawData) throw (0, builder_util_runtime_1.newError)(`Unable to parse channel data from ${channelFile}`, "ERR_UPDATER_INVALID_UPDATE_INFO");
			const result = (0, Provider_1.parseUpdateInfo)(rawData, channelFile, channelFileUrl);
			if (result.releaseName == null) result.releaseName = latestRelease.name;
			if (result.releaseNotes == null) result.releaseNotes = latestRelease.description || null;
			const gitlabUpdateInfo = {
				tag,
				assets: this.convertAssetsToMap(latestRelease.assets),
				...result
			};
			this.cachedLatestVersion = gitlabUpdateInfo;
			return gitlabUpdateInfo;
		}
		/**
		* Utility function to convert GitlabReleaseAsset to Map<string, string>
		* Maps asset names to their download URLs
		*/
		convertAssetsToMap(assets) {
			const assetsMap = /* @__PURE__ */ new Map();
			for (const asset of assets.links) assetsMap.set(this.normalizeFilename(asset.name), asset.direct_asset_url);
			return assetsMap;
		}
		/**
		* Find blockmap file URL in assets map for a specific filename
		*/
		findBlockMapInAssets(assets, filename) {
			const possibleBlockMapNames = [`${filename}.blockmap`, `${this.normalizeFilename(filename)}.blockmap`];
			for (const blockMapName of possibleBlockMapNames) {
				const assetUrl = assets.get(blockMapName);
				if (assetUrl) return new url_1$3.URL(assetUrl);
			}
			return null;
		}
		async fetchReleaseInfoByVersion(version) {
			const cancellationToken = new builder_util_runtime_1.CancellationToken();
			const possibleReleaseIds = [`v${version}`, version];
			for (const releaseId of possibleReleaseIds) {
				const releaseUrl = (0, util_1.newUrlFromBase)(`projects/${this.options.projectId}/releases/${encodeURIComponent(releaseId)}`, this.baseApiUrl);
				try {
					const header = {
						Accept: "application/json",
						...this.setAuthHeaderForToken(this.options.token || null)
					};
					const releaseResponse = await this.httpRequest(releaseUrl, header, cancellationToken);
					if (releaseResponse) return JSON.parse(releaseResponse);
				} catch (e) {
					if (e instanceof builder_util_runtime_1.HttpError && e.statusCode === 404) continue;
					throw (0, builder_util_runtime_1.newError)(`Unable to find release ${releaseId} on GitLab (${releaseUrl}): ${e.stack || e.message}`, "ERR_UPDATER_RELEASE_NOT_FOUND");
				}
			}
			throw (0, builder_util_runtime_1.newError)(`Unable to find release with version ${version} (tried: ${possibleReleaseIds.join(", ")}) on GitLab`, "ERR_UPDATER_RELEASE_NOT_FOUND");
		}
		setAuthHeaderForToken(token) {
			const headers = {};
			if (token != null) if (token.startsWith("Bearer")) headers.authorization = token;
			else headers["PRIVATE-TOKEN"] = token;
			return headers;
		}
		/**
		* Get version info for blockmap files, using cache when possible
		*/
		async getVersionInfoForBlockMap(version) {
			if (this.cachedLatestVersion && this.cachedLatestVersion.version === version) return this.cachedLatestVersion.assets;
			const versionInfo = await this.fetchReleaseInfoByVersion(version);
			if (versionInfo && versionInfo.assets) return this.convertAssetsToMap(versionInfo.assets);
			return null;
		}
		/**
		* Find blockmap URLs from version assets
		*/
		async findBlockMapUrlsFromAssets(oldVersion, newVersion, baseFilename) {
			let newBlockMapUrl = null;
			let oldBlockMapUrl = null;
			const newVersionAssets = await this.getVersionInfoForBlockMap(newVersion);
			if (newVersionAssets) newBlockMapUrl = this.findBlockMapInAssets(newVersionAssets, baseFilename);
			const oldVersionAssets = await this.getVersionInfoForBlockMap(oldVersion);
			if (oldVersionAssets) {
				const oldFilename = baseFilename.replace(new RegExp(escapeRegExp(newVersion), "g"), oldVersion);
				oldBlockMapUrl = this.findBlockMapInAssets(oldVersionAssets, oldFilename);
			}
			return [oldBlockMapUrl, newBlockMapUrl];
		}
		async getBlockMapFiles(baseUrl, oldVersion, newVersion, oldBlockMapFileBaseUrl = null) {
			if (this.options.uploadTarget === "project_upload") {
				const baseFilename = baseUrl.pathname.split("/").pop() || "";
				const [oldBlockMapUrl, newBlockMapUrl] = await this.findBlockMapUrlsFromAssets(oldVersion, newVersion, baseFilename);
				if (!newBlockMapUrl) throw (0, builder_util_runtime_1.newError)(`Cannot find blockmap file for ${newVersion} in GitLab assets`, "ERR_UPDATER_BLOCKMAP_FILE_NOT_FOUND");
				if (!oldBlockMapUrl) throw (0, builder_util_runtime_1.newError)(`Cannot find blockmap file for ${oldVersion} in GitLab assets`, "ERR_UPDATER_BLOCKMAP_FILE_NOT_FOUND");
				return [oldBlockMapUrl, newBlockMapUrl];
			} else return super.getBlockMapFiles(baseUrl, oldVersion, newVersion, oldBlockMapFileBaseUrl);
		}
		resolveFiles(updateInfo) {
			return (0, Provider_1.getFileList)(updateInfo).map((fileInfo) => {
				const matchingAssetName = [fileInfo.url, this.normalizeFilename(fileInfo.url)].find((name) => updateInfo.assets.has(name));
				const assetUrl = matchingAssetName ? updateInfo.assets.get(matchingAssetName) : void 0;
				if (!assetUrl) throw (0, builder_util_runtime_1.newError)(`Cannot find asset "${fileInfo.url}" in GitLab release assets. Available assets: ${Array.from(updateInfo.assets.keys()).join(", ")}`, "ERR_UPDATER_ASSET_NOT_FOUND");
				return {
					url: new url_1$3.URL(assetUrl),
					info: fileInfo
				};
			});
		}
		toString() {
			return `GitLab (projectId: ${this.options.projectId}, channel: ${this.channel})`;
		}
	};
	exports.GitLabProvider = GitLabProvider;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/providers/KeygenProvider.js
var require_KeygenProvider = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.KeygenProvider = void 0;
	var builder_util_runtime_1 = require_out();
	var util_1 = require_util();
	var Provider_1 = require_Provider();
	var KeygenProvider = class extends Provider_1.Provider {
		constructor(configuration, updater, runtimeOptions) {
			super({
				...runtimeOptions,
				isUseMultipleRangeRequest: false
			});
			this.configuration = configuration;
			this.updater = updater;
			this.defaultHostname = "api.keygen.sh";
			const host = this.configuration.host || this.defaultHostname;
			this.baseUrl = (0, util_1.newBaseUrl)(`https://${host}/v1/accounts/${this.configuration.account}/artifacts?product=${this.configuration.product}`);
		}
		get channel() {
			return this.updater.channel || this.configuration.channel || "stable";
		}
		async getLatestVersion() {
			const cancellationToken = new builder_util_runtime_1.CancellationToken();
			const channelFile = (0, util_1.getChannelFilename)(this.getCustomChannelName(this.channel));
			const channelUrl = (0, util_1.newUrlFromBase)(channelFile, this.baseUrl, this.updater.isAddNoCacheQuery);
			try {
				const updateInfo = await this.httpRequest(channelUrl, {
					Accept: "application/vnd.api+json",
					"Keygen-Version": "1.1"
				}, cancellationToken);
				return (0, Provider_1.parseUpdateInfo)(updateInfo, channelFile, channelUrl);
			} catch (e) {
				throw (0, builder_util_runtime_1.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${e.stack || e.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
			}
		}
		resolveFiles(updateInfo) {
			return (0, Provider_1.resolveFiles)(updateInfo, this.baseUrl);
		}
		toString() {
			const { account, product, platform } = this.configuration;
			return `Keygen (account: ${account}, product: ${product}, platform: ${platform}, channel: ${this.channel})`;
		}
	};
	exports.KeygenProvider = KeygenProvider;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/providers/PrivateGitHubProvider.js
var require_PrivateGitHubProvider = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.PrivateGitHubProvider = void 0;
	var builder_util_runtime_1 = require_out();
	var js_yaml_1 = require_js_yaml();
	var path$7 = require("path");
	var url_1$2 = require("url");
	var util_1 = require_util();
	var GitHubProvider_1 = require_GitHubProvider();
	var Provider_1 = require_Provider();
	var PrivateGitHubProvider = class extends GitHubProvider_1.BaseGitHubProvider {
		constructor(options, updater, token, runtimeOptions) {
			super(options, "api.github.com", runtimeOptions);
			this.updater = updater;
			this.token = token;
		}
		createRequestOptions(url, headers) {
			const result = super.createRequestOptions(url, headers);
			result.redirect = "manual";
			return result;
		}
		async getLatestVersion() {
			const cancellationToken = new builder_util_runtime_1.CancellationToken();
			const channelFile = (0, util_1.getChannelFilename)(this.getDefaultChannelName());
			const releaseInfo = await this.getLatestVersionInfo(cancellationToken);
			const asset = releaseInfo.assets.find((it) => it.name === channelFile);
			if (asset == null) throw (0, builder_util_runtime_1.newError)(`Cannot find ${channelFile} in the release ${releaseInfo.html_url || releaseInfo.name}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
			const url = new url_1$2.URL(asset.url);
			let result;
			try {
				result = (0, js_yaml_1.load)(await this.httpRequest(url, this.configureHeaders("application/octet-stream"), cancellationToken));
			} catch (e) {
				if (e instanceof builder_util_runtime_1.HttpError && e.statusCode === 404) throw (0, builder_util_runtime_1.newError)(`Cannot find ${channelFile} in the latest release artifacts (${url}): ${e.stack || e.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
				throw e;
			}
			result.assets = releaseInfo.assets;
			return result;
		}
		get fileExtraDownloadHeaders() {
			return this.configureHeaders("application/octet-stream");
		}
		configureHeaders(accept) {
			return {
				accept,
				authorization: `token ${this.token}`
			};
		}
		async getLatestVersionInfo(cancellationToken) {
			const allowPrerelease = this.updater.allowPrerelease;
			let basePath = this.basePath;
			if (!allowPrerelease) basePath = `${basePath}/latest`;
			const url = (0, util_1.newUrlFromBase)(basePath, this.baseUrl);
			try {
				const version = JSON.parse(await this.httpRequest(url, this.configureHeaders("application/vnd.github.v3+json"), cancellationToken));
				if (allowPrerelease) {
					const candidates = version.filter((it) => !it.draft);
					return candidates.find((it) => it.prerelease) || candidates[0];
				} else return version;
			} catch (e) {
				throw (0, builder_util_runtime_1.newError)(`Unable to find latest version on GitHub (${url}), please ensure a production release exists: ${e.stack || e.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
			}
		}
		get basePath() {
			return this.computeGithubBasePath(`/repos/${this.options.owner}/${this.options.repo}/releases`);
		}
		resolveFiles(updateInfo) {
			return (0, Provider_1.getFileList)(updateInfo).map((it) => {
				const name = path$7.posix.basename(it.url).replace(/ /g, "-");
				const asset = updateInfo.assets.find((it) => it != null && it.name === name);
				if (asset == null) throw (0, builder_util_runtime_1.newError)(`Cannot find asset "${name}" in: ${JSON.stringify(updateInfo.assets, null, 2)}`, "ERR_UPDATER_ASSET_NOT_FOUND");
				return {
					url: new url_1$2.URL(asset.url),
					info: it
				};
			});
		}
	};
	exports.PrivateGitHubProvider = PrivateGitHubProvider;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/providerFactory.js
var require_providerFactory = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.isUrlProbablySupportMultiRangeRequests = isUrlProbablySupportMultiRangeRequests;
	exports.createClient = createClient;
	var builder_util_runtime_1 = require_out();
	var BitbucketProvider_1 = require_BitbucketProvider();
	var GenericProvider_1 = require_GenericProvider();
	var GitHubProvider_1 = require_GitHubProvider();
	var GitLabProvider_1 = require_GitLabProvider();
	var KeygenProvider_1 = require_KeygenProvider();
	var PrivateGitHubProvider_1 = require_PrivateGitHubProvider();
	function isUrlProbablySupportMultiRangeRequests(url) {
		return !url.includes("s3.amazonaws.com");
	}
	function createClient(data, updater, runtimeOptions) {
		if (typeof data === "string") throw (0, builder_util_runtime_1.newError)("Please pass PublishConfiguration object", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
		const provider = data.provider;
		switch (provider) {
			case "github": {
				const githubOptions = data;
				const token = (githubOptions.private ? process.env["GH_TOKEN"] || process.env["GITHUB_TOKEN"] : null) || githubOptions.token;
				if (token == null) return new GitHubProvider_1.GitHubProvider(githubOptions, updater, runtimeOptions);
				else return new PrivateGitHubProvider_1.PrivateGitHubProvider(githubOptions, updater, token, runtimeOptions);
			}
			case "bitbucket": return new BitbucketProvider_1.BitbucketProvider(data, updater, runtimeOptions);
			case "gitlab": return new GitLabProvider_1.GitLabProvider(data, updater, runtimeOptions);
			case "keygen": return new KeygenProvider_1.KeygenProvider(data, updater, runtimeOptions);
			case "s3":
			case "spaces": return new GenericProvider_1.GenericProvider({
				provider: "generic",
				url: (0, builder_util_runtime_1.getS3LikeProviderBaseUrl)(data),
				channel: data.channel || null
			}, updater, {
				...runtimeOptions,
				isUseMultipleRangeRequest: false
			});
			case "generic": {
				const options = data;
				return new GenericProvider_1.GenericProvider(options, updater, {
					...runtimeOptions,
					isUseMultipleRangeRequest: options.useMultipleRangeRequest !== false && isUrlProbablySupportMultiRangeRequests(options.url)
				});
			}
			case "custom": {
				const options = data;
				const constructor = options.updateProvider;
				if (!constructor) throw (0, builder_util_runtime_1.newError)("Custom provider not specified", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
				return new constructor(options, updater, runtimeOptions);
			}
			default: throw (0, builder_util_runtime_1.newError)(`Unsupported provider: ${provider}`, "ERR_UPDATER_UNSUPPORTED_PROVIDER");
		}
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/out/differentialDownloader/downloadPlanBuilder.js
var require_downloadPlanBuilder = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.OperationKind = void 0;
	exports.computeOperations = computeOperations;
	var OperationKind;
	(function(OperationKind) {
		OperationKind[OperationKind["COPY"] = 0] = "COPY";
		OperationKind[OperationKind["DOWNLOAD"] = 1] = "DOWNLOAD";
	})(OperationKind || (exports.OperationKind = OperationKind = {}));
	function computeOperations(oldBlockMap, newBlockMap, logger) {
		const nameToOldBlocks = buildBlockFileMap(oldBlockMap.files);
		const nameToNewBlocks = buildBlockFileMap(newBlockMap.files);
		let lastOperation = null;
		const blockMapFile = newBlockMap.files[0];
		const operations = [];
		const name = blockMapFile.name;
		const oldEntry = nameToOldBlocks.get(name);
		if (oldEntry == null) throw new Error(`no file ${name} in old blockmap`);
		const newFile = nameToNewBlocks.get(name);
		let changedBlockCount = 0;
		const { checksumToOffset: checksumToOldOffset, checksumToOldSize } = buildChecksumMap(nameToOldBlocks.get(name), oldEntry.offset, logger);
		let newOffset = blockMapFile.offset;
		for (let i = 0; i < newFile.checksums.length; newOffset += newFile.sizes[i], i++) {
			const blockSize = newFile.sizes[i];
			const checksum = newFile.checksums[i];
			let oldOffset = checksumToOldOffset.get(checksum);
			if (oldOffset != null && checksumToOldSize.get(checksum) !== blockSize) {
				logger.warn(`Checksum ("${checksum}") matches, but size differs (old: ${checksumToOldSize.get(checksum)}, new: ${blockSize})`);
				oldOffset = void 0;
			}
			if (oldOffset === void 0) {
				changedBlockCount++;
				if (lastOperation != null && lastOperation.kind === OperationKind.DOWNLOAD && lastOperation.end === newOffset) lastOperation.end += blockSize;
				else {
					lastOperation = {
						kind: OperationKind.DOWNLOAD,
						start: newOffset,
						end: newOffset + blockSize
					};
					validateAndAdd(lastOperation, operations, checksum, i);
				}
			} else if (lastOperation != null && lastOperation.kind === OperationKind.COPY && lastOperation.end === oldOffset) lastOperation.end += blockSize;
			else {
				lastOperation = {
					kind: OperationKind.COPY,
					start: oldOffset,
					end: oldOffset + blockSize
				};
				validateAndAdd(lastOperation, operations, checksum, i);
			}
		}
		if (changedBlockCount > 0) logger.info(`File${blockMapFile.name === "file" ? "" : " " + blockMapFile.name} has ${changedBlockCount} changed blocks`);
		return operations;
	}
	var isValidateOperationRange = process.env["DIFFERENTIAL_DOWNLOAD_PLAN_BUILDER_VALIDATE_RANGES"] === "true";
	function validateAndAdd(operation, operations, checksum, index) {
		if (isValidateOperationRange && operations.length !== 0) {
			const lastOperation = operations[operations.length - 1];
			if (lastOperation.kind === operation.kind && operation.start < lastOperation.end && operation.start > lastOperation.start) {
				const min = [
					lastOperation.start,
					lastOperation.end,
					operation.start,
					operation.end
				].reduce((p, v) => p < v ? p : v);
				throw new Error(`operation (block index: ${index}, checksum: ${checksum}, kind: ${OperationKind[operation.kind]}) overlaps previous operation (checksum: ${checksum}):\nabs: ${lastOperation.start} until ${lastOperation.end} and ${operation.start} until ${operation.end}\nrel: ${lastOperation.start - min} until ${lastOperation.end - min} and ${operation.start - min} until ${operation.end - min}`);
			}
		}
		operations.push(operation);
	}
	function buildChecksumMap(file, fileOffset, logger) {
		const checksumToOffset = /* @__PURE__ */ new Map();
		const checksumToSize = /* @__PURE__ */ new Map();
		let offset = fileOffset;
		for (let i = 0; i < file.checksums.length; i++) {
			const checksum = file.checksums[i];
			const size = file.sizes[i];
			const existing = checksumToSize.get(checksum);
			if (existing === void 0) {
				checksumToOffset.set(checksum, offset);
				checksumToSize.set(checksum, size);
			} else if (logger.debug != null) {
				const sizeExplanation = existing === size ? "(same size)" : `(size: ${existing}, this size: ${size})`;
				logger.debug(`${checksum} duplicated in blockmap ${sizeExplanation}, it doesn't lead to broken differential downloader, just corresponding block will be skipped)`);
			}
			offset += size;
		}
		return {
			checksumToOffset,
			checksumToOldSize: checksumToSize
		};
	}
	function buildBlockFileMap(list) {
		const result = /* @__PURE__ */ new Map();
		for (const item of list) result.set(item.name, item);
		return result;
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/out/differentialDownloader/DataSplitter.js
var require_DataSplitter = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.DataSplitter = void 0;
	exports.copyData = copyData;
	var builder_util_runtime_1 = require_out();
	var fs_1$3 = require("fs");
	var stream_1$1 = require("stream");
	var downloadPlanBuilder_1 = require_downloadPlanBuilder();
	var DOUBLE_CRLF = Buffer.from("\r\n\r\n");
	var ReadState;
	(function(ReadState) {
		ReadState[ReadState["INIT"] = 0] = "INIT";
		ReadState[ReadState["HEADER"] = 1] = "HEADER";
		ReadState[ReadState["BODY"] = 2] = "BODY";
	})(ReadState || (ReadState = {}));
	function copyData(task, out, oldFileFd, reject, resolve) {
		const readStream = (0, fs_1$3.createReadStream)("", {
			fd: oldFileFd,
			autoClose: false,
			start: task.start,
			end: task.end - 1
		});
		readStream.on("error", reject);
		readStream.once("end", resolve);
		readStream.pipe(out, { end: false });
	}
	var DataSplitter = class extends stream_1$1.Writable {
		constructor(out, options, partIndexToTaskIndex, boundary, partIndexToLength, finishHandler, grandTotalBytes, onProgress) {
			super();
			this.out = out;
			this.options = options;
			this.partIndexToTaskIndex = partIndexToTaskIndex;
			this.partIndexToLength = partIndexToLength;
			this.finishHandler = finishHandler;
			this.grandTotalBytes = grandTotalBytes;
			this.onProgress = onProgress;
			this.start = Date.now();
			this.nextUpdate = this.start + 1e3;
			this.transferred = 0;
			this.delta = 0;
			this.partIndex = -1;
			this.headerListBuffer = null;
			this.readState = ReadState.INIT;
			this.ignoreByteCount = 0;
			this.remainingPartDataCount = 0;
			this.actualPartLength = 0;
			this.boundaryLength = boundary.length + 4;
			this.ignoreByteCount = this.boundaryLength - 2;
		}
		get isFinished() {
			return this.partIndex === this.partIndexToLength.length;
		}
		_write(data, encoding, callback) {
			if (this.isFinished) {
				console.error(`Trailing ignored data: ${data.length} bytes`);
				return;
			}
			this.handleData(data).then(() => {
				if (this.onProgress) {
					const now = Date.now();
					if ((now >= this.nextUpdate || this.transferred === this.grandTotalBytes) && this.grandTotalBytes && (now - this.start) / 1e3) {
						this.nextUpdate = now + 1e3;
						this.onProgress({
							total: this.grandTotalBytes,
							delta: this.delta,
							transferred: this.transferred,
							percent: this.transferred / this.grandTotalBytes * 100,
							bytesPerSecond: Math.round(this.transferred / ((now - this.start) / 1e3))
						});
						this.delta = 0;
					}
				}
				callback();
			}).catch(callback);
		}
		async handleData(chunk) {
			let start = 0;
			if (this.ignoreByteCount !== 0 && this.remainingPartDataCount !== 0) throw (0, builder_util_runtime_1.newError)("Internal error", "ERR_DATA_SPLITTER_BYTE_COUNT_MISMATCH");
			if (this.ignoreByteCount > 0) {
				const toIgnore = Math.min(this.ignoreByteCount, chunk.length);
				this.ignoreByteCount -= toIgnore;
				start = toIgnore;
			} else if (this.remainingPartDataCount > 0) {
				const toRead = Math.min(this.remainingPartDataCount, chunk.length);
				this.remainingPartDataCount -= toRead;
				await this.processPartData(chunk, 0, toRead);
				start = toRead;
			}
			if (start === chunk.length) return;
			if (this.readState === ReadState.HEADER) {
				const headerListEnd = this.searchHeaderListEnd(chunk, start);
				if (headerListEnd === -1) return;
				start = headerListEnd;
				this.readState = ReadState.BODY;
				this.headerListBuffer = null;
			}
			while (true) {
				if (this.readState === ReadState.BODY) this.readState = ReadState.INIT;
				else {
					this.partIndex++;
					let taskIndex = this.partIndexToTaskIndex.get(this.partIndex);
					if (taskIndex == null) if (this.isFinished) taskIndex = this.options.end;
					else throw (0, builder_util_runtime_1.newError)("taskIndex is null", "ERR_DATA_SPLITTER_TASK_INDEX_IS_NULL");
					const prevTaskIndex = this.partIndex === 0 ? this.options.start : this.partIndexToTaskIndex.get(this.partIndex - 1) + 1;
					if (prevTaskIndex < taskIndex) await this.copyExistingData(prevTaskIndex, taskIndex);
					else if (prevTaskIndex > taskIndex) throw (0, builder_util_runtime_1.newError)("prevTaskIndex must be < taskIndex", "ERR_DATA_SPLITTER_TASK_INDEX_ASSERT_FAILED");
					if (this.isFinished) {
						this.onPartEnd();
						this.finishHandler();
						return;
					}
					start = this.searchHeaderListEnd(chunk, start);
					if (start === -1) {
						this.readState = ReadState.HEADER;
						return;
					}
				}
				const partLength = this.partIndexToLength[this.partIndex];
				const end = start + partLength;
				const effectiveEnd = Math.min(end, chunk.length);
				await this.processPartStarted(chunk, start, effectiveEnd);
				this.remainingPartDataCount = partLength - (effectiveEnd - start);
				if (this.remainingPartDataCount > 0) return;
				start = end + this.boundaryLength;
				if (start >= chunk.length) {
					this.ignoreByteCount = this.boundaryLength - (chunk.length - end);
					return;
				}
			}
		}
		copyExistingData(index, end) {
			return new Promise((resolve, reject) => {
				const w = () => {
					if (index === end) {
						resolve();
						return;
					}
					const task = this.options.tasks[index];
					if (task.kind !== downloadPlanBuilder_1.OperationKind.COPY) {
						reject(/* @__PURE__ */ new Error("Task kind must be COPY"));
						return;
					}
					copyData(task, this.out, this.options.oldFileFd, reject, () => {
						index++;
						w();
					});
				};
				w();
			});
		}
		searchHeaderListEnd(chunk, readOffset) {
			const headerListEnd = chunk.indexOf(DOUBLE_CRLF, readOffset);
			if (headerListEnd !== -1) return headerListEnd + DOUBLE_CRLF.length;
			const partialChunk = readOffset === 0 ? chunk : chunk.slice(readOffset);
			if (this.headerListBuffer == null) this.headerListBuffer = partialChunk;
			else this.headerListBuffer = Buffer.concat([this.headerListBuffer, partialChunk]);
			return -1;
		}
		onPartEnd() {
			const expectedLength = this.partIndexToLength[this.partIndex - 1];
			if (this.actualPartLength !== expectedLength) throw (0, builder_util_runtime_1.newError)(`Expected length: ${expectedLength} differs from actual: ${this.actualPartLength}`, "ERR_DATA_SPLITTER_LENGTH_MISMATCH");
			this.actualPartLength = 0;
		}
		processPartStarted(data, start, end) {
			if (this.partIndex !== 0) this.onPartEnd();
			return this.processPartData(data, start, end);
		}
		processPartData(data, start, end) {
			this.actualPartLength += end - start;
			this.transferred += end - start;
			this.delta += end - start;
			const out = this.out;
			if (out.write(start === 0 && data.length === end ? data : data.slice(start, end))) return Promise.resolve();
			else return new Promise((resolve, reject) => {
				out.on("error", reject);
				out.once("drain", () => {
					out.removeListener("error", reject);
					resolve();
				});
			});
		}
	};
	exports.DataSplitter = DataSplitter;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/differentialDownloader/multipleRangeDownloader.js
var require_multipleRangeDownloader = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.executeTasksUsingMultipleRangeRequests = executeTasksUsingMultipleRangeRequests;
	exports.checkIsRangesSupported = checkIsRangesSupported;
	var builder_util_runtime_1 = require_out();
	var DataSplitter_1 = require_DataSplitter();
	var downloadPlanBuilder_1 = require_downloadPlanBuilder();
	function executeTasksUsingMultipleRangeRequests(differentialDownloader, tasks, out, oldFileFd, reject) {
		const w = (taskOffset) => {
			if (taskOffset >= tasks.length) {
				if (differentialDownloader.fileMetadataBuffer != null) out.write(differentialDownloader.fileMetadataBuffer);
				out.end();
				return;
			}
			const nextOffset = taskOffset + 1e3;
			doExecuteTasks(differentialDownloader, {
				tasks,
				start: taskOffset,
				end: Math.min(tasks.length, nextOffset),
				oldFileFd
			}, out, () => w(nextOffset), reject);
		};
		return w;
	}
	function doExecuteTasks(differentialDownloader, options, out, resolve, reject) {
		let ranges = "bytes=";
		let partCount = 0;
		let grandTotalBytes = 0;
		const partIndexToTaskIndex = /* @__PURE__ */ new Map();
		const partIndexToLength = [];
		for (let i = options.start; i < options.end; i++) {
			const task = options.tasks[i];
			if (task.kind === downloadPlanBuilder_1.OperationKind.DOWNLOAD) {
				ranges += `${task.start}-${task.end - 1}, `;
				partIndexToTaskIndex.set(partCount, i);
				partCount++;
				partIndexToLength.push(task.end - task.start);
				grandTotalBytes += task.end - task.start;
			}
		}
		if (partCount <= 1) {
			const w = (index) => {
				if (index >= options.end) {
					resolve();
					return;
				}
				const task = options.tasks[index++];
				if (task.kind === downloadPlanBuilder_1.OperationKind.COPY) (0, DataSplitter_1.copyData)(task, out, options.oldFileFd, reject, () => w(index));
				else {
					const requestOptions = differentialDownloader.createRequestOptions();
					requestOptions.headers.Range = `bytes=${task.start}-${task.end - 1}`;
					const request = differentialDownloader.httpExecutor.createRequest(requestOptions, (response) => {
						response.on("error", reject);
						if (!checkIsRangesSupported(response, reject)) return;
						response.pipe(out, { end: false });
						response.once("end", () => w(index));
					});
					differentialDownloader.httpExecutor.addErrorAndTimeoutHandlers(request, reject);
					request.end();
				}
			};
			w(options.start);
			return;
		}
		const requestOptions = differentialDownloader.createRequestOptions();
		requestOptions.headers.Range = ranges.substring(0, ranges.length - 2);
		const request = differentialDownloader.httpExecutor.createRequest(requestOptions, (response) => {
			if (!checkIsRangesSupported(response, reject)) return;
			const contentType = (0, builder_util_runtime_1.safeGetHeader)(response, "content-type");
			const m = /^multipart\/.+?\s*;\s*boundary=(?:"([^"]+)"|([^\s";]+))\s*$/i.exec(contentType);
			if (m == null) {
				reject(/* @__PURE__ */ new Error(`Content-Type "multipart/byteranges" is expected, but got "${contentType}"`));
				return;
			}
			const dicer = new DataSplitter_1.DataSplitter(out, options, partIndexToTaskIndex, m[1] || m[2], partIndexToLength, resolve, grandTotalBytes, differentialDownloader.options.onProgress);
			dicer.on("error", reject);
			response.pipe(dicer);
			response.on("end", () => {
				setTimeout(() => {
					request.abort();
					reject(/* @__PURE__ */ new Error("Response ends without calling any handlers"));
				}, 1e4);
			});
		});
		differentialDownloader.httpExecutor.addErrorAndTimeoutHandlers(request, reject);
		request.end();
	}
	function checkIsRangesSupported(response, reject) {
		if (response.statusCode >= 400) {
			reject((0, builder_util_runtime_1.createHttpError)(response));
			return false;
		}
		if (response.statusCode !== 206) {
			const acceptRanges = (0, builder_util_runtime_1.safeGetHeader)(response, "accept-ranges");
			if (acceptRanges == null || acceptRanges === "none") {
				reject(/* @__PURE__ */ new Error(`Server doesn't support Accept-Ranges (response code ${response.statusCode})`));
				return false;
			}
		}
		return true;
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/out/differentialDownloader/ProgressDifferentialDownloadCallbackTransform.js
var require_ProgressDifferentialDownloadCallbackTransform = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ProgressDifferentialDownloadCallbackTransform = void 0;
	var stream_1 = require("stream");
	var OperationKind;
	(function(OperationKind) {
		OperationKind[OperationKind["COPY"] = 0] = "COPY";
		OperationKind[OperationKind["DOWNLOAD"] = 1] = "DOWNLOAD";
	})(OperationKind || (OperationKind = {}));
	var ProgressDifferentialDownloadCallbackTransform = class extends stream_1.Transform {
		constructor(progressDifferentialDownloadInfo, cancellationToken, onProgress) {
			super();
			this.progressDifferentialDownloadInfo = progressDifferentialDownloadInfo;
			this.cancellationToken = cancellationToken;
			this.onProgress = onProgress;
			this.start = Date.now();
			this.transferred = 0;
			this.delta = 0;
			this.expectedBytes = 0;
			this.index = 0;
			this.operationType = OperationKind.COPY;
			this.nextUpdate = this.start + 1e3;
		}
		_transform(chunk, encoding, callback) {
			if (this.cancellationToken.cancelled) {
				callback(/* @__PURE__ */ new Error("cancelled"), null);
				return;
			}
			if (this.operationType == OperationKind.COPY) {
				callback(null, chunk);
				return;
			}
			this.transferred += chunk.length;
			this.delta += chunk.length;
			const now = Date.now();
			if (now >= this.nextUpdate && this.transferred !== this.expectedBytes && this.transferred !== this.progressDifferentialDownloadInfo.grandTotal) {
				this.nextUpdate = now + 1e3;
				this.onProgress({
					total: this.progressDifferentialDownloadInfo.grandTotal,
					delta: this.delta,
					transferred: this.transferred,
					percent: this.transferred / this.progressDifferentialDownloadInfo.grandTotal * 100,
					bytesPerSecond: Math.round(this.transferred / ((now - this.start) / 1e3))
				});
				this.delta = 0;
			}
			callback(null, chunk);
		}
		beginFileCopy() {
			this.operationType = OperationKind.COPY;
		}
		beginRangeDownload() {
			this.operationType = OperationKind.DOWNLOAD;
			this.expectedBytes += this.progressDifferentialDownloadInfo.expectedByteCounts[this.index++];
		}
		endRangeDownload() {
			if (this.transferred !== this.progressDifferentialDownloadInfo.grandTotal) this.onProgress({
				total: this.progressDifferentialDownloadInfo.grandTotal,
				delta: this.delta,
				transferred: this.transferred,
				percent: this.transferred / this.progressDifferentialDownloadInfo.grandTotal * 100,
				bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1e3))
			});
		}
		_flush(callback) {
			if (this.cancellationToken.cancelled) {
				callback(/* @__PURE__ */ new Error("cancelled"));
				return;
			}
			this.onProgress({
				total: this.progressDifferentialDownloadInfo.grandTotal,
				delta: this.delta,
				transferred: this.transferred,
				percent: 100,
				bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1e3))
			});
			this.delta = 0;
			this.transferred = 0;
			callback(null);
		}
	};
	exports.ProgressDifferentialDownloadCallbackTransform = ProgressDifferentialDownloadCallbackTransform;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/differentialDownloader/DifferentialDownloader.js
var require_DifferentialDownloader = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.DifferentialDownloader = void 0;
	var builder_util_runtime_1 = require_out();
	var fs_extra_1 = require_lib();
	var fs_1$2 = require("fs");
	var DataSplitter_1 = require_DataSplitter();
	var url_1$1 = require("url");
	var downloadPlanBuilder_1 = require_downloadPlanBuilder();
	var multipleRangeDownloader_1 = require_multipleRangeDownloader();
	var ProgressDifferentialDownloadCallbackTransform_1 = require_ProgressDifferentialDownloadCallbackTransform();
	var DifferentialDownloader = class {
		constructor(blockAwareFileInfo, httpExecutor, options) {
			this.blockAwareFileInfo = blockAwareFileInfo;
			this.httpExecutor = httpExecutor;
			this.options = options;
			this.fileMetadataBuffer = null;
			this.logger = options.logger;
		}
		createRequestOptions() {
			const result = { headers: {
				...this.options.requestHeaders,
				accept: "*/*"
			} };
			(0, builder_util_runtime_1.configureRequestUrl)(this.options.newUrl, result);
			(0, builder_util_runtime_1.configureRequestOptions)(result);
			return result;
		}
		doDownload(oldBlockMap, newBlockMap) {
			if (oldBlockMap.version !== newBlockMap.version) throw new Error(`version is different (${oldBlockMap.version} - ${newBlockMap.version}), full download is required`);
			const logger = this.logger;
			const operations = (0, downloadPlanBuilder_1.computeOperations)(oldBlockMap, newBlockMap, logger);
			if (logger.debug != null) logger.debug(JSON.stringify(operations, null, 2));
			let downloadSize = 0;
			let copySize = 0;
			for (const operation of operations) {
				const length = operation.end - operation.start;
				if (operation.kind === downloadPlanBuilder_1.OperationKind.DOWNLOAD) downloadSize += length;
				else copySize += length;
			}
			const newSize = this.blockAwareFileInfo.size;
			if (downloadSize + copySize + (this.fileMetadataBuffer == null ? 0 : this.fileMetadataBuffer.length) !== newSize) throw new Error(`Internal error, size mismatch: downloadSize: ${downloadSize}, copySize: ${copySize}, newSize: ${newSize}`);
			logger.info(`Full: ${formatBytes(newSize)}, To download: ${formatBytes(downloadSize)} (${Math.round(downloadSize / (newSize / 100))}%)`);
			return this.downloadFile(operations);
		}
		downloadFile(tasks) {
			const fdList = [];
			const closeFiles = () => {
				return Promise.all(fdList.map((openedFile) => {
					return (0, fs_extra_1.close)(openedFile.descriptor).catch((e) => {
						this.logger.error(`cannot close file "${openedFile.path}": ${e}`);
					});
				}));
			};
			return this.doDownloadFile(tasks, fdList).then(closeFiles).catch((e) => {
				return closeFiles().catch((closeFilesError) => {
					try {
						this.logger.error(`cannot close files: ${closeFilesError}`);
					} catch (errorOnLog) {
						try {
							console.error(errorOnLog);
						} catch (_ignored) {}
					}
					throw e;
				}).then(() => {
					throw e;
				});
			});
		}
		async doDownloadFile(tasks, fdList) {
			const oldFileFd = await (0, fs_extra_1.open)(this.options.oldFile, "r");
			fdList.push({
				descriptor: oldFileFd,
				path: this.options.oldFile
			});
			const newFileFd = await (0, fs_extra_1.open)(this.options.newFile, "w");
			fdList.push({
				descriptor: newFileFd,
				path: this.options.newFile
			});
			const fileOut = (0, fs_1$2.createWriteStream)(this.options.newFile, { fd: newFileFd });
			await new Promise((resolve, reject) => {
				const streams = [];
				let downloadInfoTransform = void 0;
				if (!this.options.isUseMultipleRangeRequest && this.options.onProgress) {
					const expectedByteCounts = [];
					let grandTotalBytes = 0;
					for (const task of tasks) if (task.kind === downloadPlanBuilder_1.OperationKind.DOWNLOAD) {
						expectedByteCounts.push(task.end - task.start);
						grandTotalBytes += task.end - task.start;
					}
					const progressDifferentialDownloadInfo = {
						expectedByteCounts,
						grandTotal: grandTotalBytes
					};
					downloadInfoTransform = new ProgressDifferentialDownloadCallbackTransform_1.ProgressDifferentialDownloadCallbackTransform(progressDifferentialDownloadInfo, this.options.cancellationToken, this.options.onProgress);
					streams.push(downloadInfoTransform);
				}
				const digestTransform = new builder_util_runtime_1.DigestTransform(this.blockAwareFileInfo.sha512);
				digestTransform.isValidateOnEnd = false;
				streams.push(digestTransform);
				fileOut.on("finish", () => {
					fileOut.close(() => {
						fdList.splice(1, 1);
						try {
							digestTransform.validate();
						} catch (e) {
							reject(e);
							return;
						}
						resolve(void 0);
					});
				});
				streams.push(fileOut);
				let lastStream = null;
				for (const stream of streams) {
					stream.on("error", reject);
					if (lastStream == null) lastStream = stream;
					else lastStream = lastStream.pipe(stream);
				}
				const firstStream = streams[0];
				let w;
				if (this.options.isUseMultipleRangeRequest) {
					w = (0, multipleRangeDownloader_1.executeTasksUsingMultipleRangeRequests)(this, tasks, firstStream, oldFileFd, reject);
					w(0);
					return;
				}
				let downloadOperationCount = 0;
				let actualUrl = null;
				this.logger.info(`Differential download: ${this.options.newUrl}`);
				const requestOptions = this.createRequestOptions();
				requestOptions.redirect = "manual";
				w = (index) => {
					var _a, _b;
					if (index >= tasks.length) {
						if (this.fileMetadataBuffer != null) firstStream.write(this.fileMetadataBuffer);
						firstStream.end();
						return;
					}
					const operation = tasks[index++];
					if (operation.kind === downloadPlanBuilder_1.OperationKind.COPY) {
						if (downloadInfoTransform) downloadInfoTransform.beginFileCopy();
						(0, DataSplitter_1.copyData)(operation, firstStream, oldFileFd, reject, () => w(index));
						return;
					}
					const range = `bytes=${operation.start}-${operation.end - 1}`;
					requestOptions.headers.range = range;
					(_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 || _b.call(_a, `download range: ${range}`);
					if (downloadInfoTransform) downloadInfoTransform.beginRangeDownload();
					const request = this.httpExecutor.createRequest(requestOptions, (response) => {
						response.on("error", reject);
						response.on("aborted", () => {
							reject(/* @__PURE__ */ new Error("response has been aborted by the server"));
						});
						if (response.statusCode >= 400) reject((0, builder_util_runtime_1.createHttpError)(response));
						response.pipe(firstStream, { end: false });
						response.once("end", () => {
							if (downloadInfoTransform) downloadInfoTransform.endRangeDownload();
							if (++downloadOperationCount === 100) {
								downloadOperationCount = 0;
								setTimeout(() => w(index), 1e3);
							} else w(index);
						});
					});
					request.on("redirect", (statusCode, method, redirectUrl) => {
						this.logger.info(`Redirect to ${removeQuery(redirectUrl)}`);
						actualUrl = redirectUrl;
						(0, builder_util_runtime_1.configureRequestUrl)(new url_1$1.URL(actualUrl), requestOptions);
						request.followRedirect();
					});
					this.httpExecutor.addErrorAndTimeoutHandlers(request, reject);
					request.end();
				};
				w(0);
			});
		}
		async readRemoteBytes(start, endInclusive) {
			const buffer = Buffer.allocUnsafe(endInclusive + 1 - start);
			const requestOptions = this.createRequestOptions();
			requestOptions.headers.range = `bytes=${start}-${endInclusive}`;
			let position = 0;
			await this.request(requestOptions, (chunk) => {
				chunk.copy(buffer, position);
				position += chunk.length;
			});
			if (position !== buffer.length) throw new Error(`Received data length ${position} is not equal to expected ${buffer.length}`);
			return buffer;
		}
		request(requestOptions, dataHandler) {
			return new Promise((resolve, reject) => {
				const request = this.httpExecutor.createRequest(requestOptions, (response) => {
					if (!(0, multipleRangeDownloader_1.checkIsRangesSupported)(response, reject)) return;
					response.on("error", reject);
					response.on("aborted", () => {
						reject(/* @__PURE__ */ new Error("response has been aborted by the server"));
					});
					response.on("data", dataHandler);
					response.on("end", () => resolve());
				});
				this.httpExecutor.addErrorAndTimeoutHandlers(request, reject);
				request.end();
			});
		}
	};
	exports.DifferentialDownloader = DifferentialDownloader;
	function formatBytes(value, symbol = " KB") {
		return new Intl.NumberFormat("en").format((value / 1024).toFixed(2)) + symbol;
	}
	function removeQuery(url) {
		const index = url.indexOf("?");
		return index < 0 ? url : url.substring(0, index);
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/out/differentialDownloader/GenericDifferentialDownloader.js
var require_GenericDifferentialDownloader = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.GenericDifferentialDownloader = void 0;
	var DifferentialDownloader_1 = require_DifferentialDownloader();
	var GenericDifferentialDownloader = class extends DifferentialDownloader_1.DifferentialDownloader {
		download(oldBlockMap, newBlockMap) {
			return this.doDownload(oldBlockMap, newBlockMap);
		}
	};
	exports.GenericDifferentialDownloader = GenericDifferentialDownloader;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/types.js
var require_types = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.UpdaterSignal = exports.UPDATE_DOWNLOADED = exports.DOWNLOAD_PROGRESS = exports.CancellationToken = void 0;
	exports.addHandler = addHandler;
	var builder_util_runtime_1 = require_out();
	Object.defineProperty(exports, "CancellationToken", {
		enumerable: true,
		get: function() {
			return builder_util_runtime_1.CancellationToken;
		}
	});
	exports.DOWNLOAD_PROGRESS = "download-progress";
	exports.UPDATE_DOWNLOADED = "update-downloaded";
	var UpdaterSignal = class {
		constructor(emitter) {
			this.emitter = emitter;
		}
		/**
		* Emitted when an authenticating proxy is [asking for user credentials](https://github.com/electron/electron/blob/master/docs/api/client-request.md#event-login).
		*/
		login(handler) {
			addHandler(this.emitter, "login", handler);
		}
		progress(handler) {
			addHandler(this.emitter, exports.DOWNLOAD_PROGRESS, handler);
		}
		updateDownloaded(handler) {
			addHandler(this.emitter, exports.UPDATE_DOWNLOADED, handler);
		}
		updateCancelled(handler) {
			addHandler(this.emitter, "update-cancelled", handler);
		}
	};
	exports.UpdaterSignal = UpdaterSignal;
	function addHandler(emitter, event, handler) {
		emitter.on(event, handler);
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/out/AppUpdater.js
var require_AppUpdater = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.NoOpLogger = exports.AppUpdater = void 0;
	var builder_util_runtime_1 = require_out();
	var crypto_1$1 = require("crypto");
	var os_1 = require("os");
	var events_1 = require("events");
	var fs_extra_1 = require_lib();
	var js_yaml_1 = require_js_yaml();
	var lazy_val_1 = require_main$1();
	var path$6 = require("path");
	var semver_1 = require_semver();
	var DownloadedUpdateHelper_1 = require_DownloadedUpdateHelper();
	var ElectronAppAdapter_1 = require_ElectronAppAdapter();
	var electronHttpExecutor_1 = require_electronHttpExecutor();
	var GenericProvider_1 = require_GenericProvider();
	var providerFactory_1 = require_providerFactory();
	var zlib_1$1 = require("zlib");
	var GenericDifferentialDownloader_1 = require_GenericDifferentialDownloader();
	var types_1 = require_types();
	exports.AppUpdater = class AppUpdater extends events_1.EventEmitter {
		/**
		* Get the update channel. Doesn't return `channel` from the update configuration, only if was previously set.
		*/
		get channel() {
			return this._channel;
		}
		/**
		* Set the update channel. Overrides `channel` in the update configuration.
		*
		* `allowDowngrade` will be automatically set to `true`. If this behavior is not suitable for you, simple set `allowDowngrade` explicitly after.
		*/
		set channel(value) {
			if (this._channel != null) {
				if (typeof value !== "string") throw (0, builder_util_runtime_1.newError)(`Channel must be a string, but got: ${value}`, "ERR_UPDATER_INVALID_CHANNEL");
				else if (value.length === 0) throw (0, builder_util_runtime_1.newError)(`Channel must be not an empty string`, "ERR_UPDATER_INVALID_CHANNEL");
			}
			this._channel = value;
			this.allowDowngrade = true;
		}
		/**
		*  Shortcut for explicitly adding auth tokens to request headers
		*/
		addAuthHeader(token) {
			this.requestHeaders = Object.assign({}, this.requestHeaders, { authorization: token });
		}
		get netSession() {
			return (0, electronHttpExecutor_1.getNetSession)();
		}
		/**
		* The logger. You can pass [electron-log](https://github.com/megahertz/electron-log), [winston](https://github.com/winstonjs/winston) or another logger with the following interface: `{ info(), warn(), error() }`.
		* Set it to `null` if you would like to disable a logging feature.
		*/
		get logger() {
			return this._logger;
		}
		set logger(value) {
			this._logger = value == null ? new NoOpLogger() : value;
		}
		/**
		* test only
		* @private
		*/
		set updateConfigPath(value) {
			this.clientPromise = null;
			this._appUpdateConfigPath = value;
			this.configOnDisk = new lazy_val_1.Lazy(() => this.loadUpdateConfig());
		}
		/**
		* Allows developer to override default logic for determining if an update is supported.
		* The default logic compares the `UpdateInfo` minimum system version against the `os.release()` with `semver` package
		*/
		get isUpdateSupported() {
			return this._isUpdateSupported;
		}
		set isUpdateSupported(value) {
			if (value) this._isUpdateSupported = value;
		}
		/**
		* Allows developer to override default logic for determining if the user is below the rollout threshold.
		* The default logic compares the staging percentage with numerical representation of user ID.
		* An override can define custom logic, or bypass it if needed.
		*/
		get isUserWithinRollout() {
			return this._isUserWithinRollout;
		}
		set isUserWithinRollout(value) {
			if (value) this._isUserWithinRollout = value;
		}
		constructor(options, app) {
			super();
			/**
			* Whether to automatically download an update when it is found.
			* @default true
			*/
			this.autoDownload = true;
			/**
			* Whether to automatically install a downloaded update on app quit (if `quitAndInstall` was not called before).
			* @default true
			*/
			this.autoInstallOnAppQuit = true;
			/**
			* Whether to run the app after finish install when run the installer is NOT in silent mode.
			* @default true
			*/
			this.autoRunAppAfterInstall = true;
			/**
			* *GitHub provider only.* Whether to allow update to pre-release versions. Defaults to `true` if application version contains prerelease components (e.g. `0.12.1-alpha.1`, here `alpha` is a prerelease component), otherwise `false`.
			*
			* If `true`, downgrade will be allowed (`allowDowngrade` will be set to `true`).
			*/
			this.allowPrerelease = false;
			/**
			* *GitHub provider only.* Get all release notes (from current version to latest), not just the latest.
			* @default false
			*/
			this.fullChangelog = false;
			/**
			* Whether to allow version downgrade (when a user from the beta channel wants to go back to the stable channel).
			*
			* Taken in account only if channel differs (pre-release version component in terms of semantic versioning).
			*
			* @default false
			*/
			this.allowDowngrade = false;
			/**
			* Web installer files might not have signature verification, this switch prevents to load them unless it is needed.
			*
			* Currently false to prevent breaking the current API, but it should be changed to default true at some point that
			* breaking changes are allowed.
			*
			* @default false
			*/
			this.disableWebInstaller = false;
			/**
			* *NSIS only* Disable differential downloads and always perform full download of installer.
			*
			* @default false
			*/
			this.disableDifferentialDownload = false;
			/**
			* Allows developer to force the updater to work in "dev" mode, looking for "dev-app-update.yml" instead of "app-update.yml"
			* Dev: `path.join(this.app.getAppPath(), "dev-app-update.yml")`
			* Prod: `path.join(process.resourcesPath!, "app-update.yml")`
			*
			* @default false
			*/
			this.forceDevUpdateConfig = false;
			/**
			* The base URL of the old block map file.
			*
			* When null, the updater will use the base URL of the update file to download the update.
			* When set, the updater will use this string as the base URL of the old block map file.
			* Some servers like github cannot download the old block map file from latest release,
			* so you need to compute the old block map file base URL manually.
			*
			* @default null
			*/
			this.previousBlockmapBaseUrlOverride = null;
			this._channel = null;
			this.downloadedUpdateHelper = null;
			/**
			*  The request headers.
			*/
			this.requestHeaders = null;
			this._logger = console;
			/**
			* For type safety you can use signals, e.g. `autoUpdater.signals.updateDownloaded(() => {})` instead of `autoUpdater.on('update-available', () => {})`
			*/
			this.signals = new types_1.UpdaterSignal(this);
			this._appUpdateConfigPath = null;
			this._isUpdateSupported = (updateInfo) => this.checkIfUpdateSupported(updateInfo);
			this._isUserWithinRollout = (updateInfo) => this.isStagingMatch(updateInfo);
			this.clientPromise = null;
			this.stagingUserIdPromise = new lazy_val_1.Lazy(() => this.getOrCreateStagingUserId());
			/** @internal */
			this.configOnDisk = new lazy_val_1.Lazy(() => this.loadUpdateConfig());
			this.checkForUpdatesPromise = null;
			this.downloadPromise = null;
			this.updateInfoAndProvider = null;
			/**
			* @private
			* @internal
			*/
			this._testOnlyOptions = null;
			this.on("error", (error) => {
				this._logger.error(`Error: ${error.stack || error.message}`);
			});
			if (app == null) {
				this.app = new ElectronAppAdapter_1.ElectronAppAdapter();
				this.httpExecutor = new electronHttpExecutor_1.ElectronHttpExecutor((authInfo, callback) => this.emit("login", authInfo, callback));
			} else {
				this.app = app;
				this.httpExecutor = null;
			}
			const currentVersionString = this.app.version;
			const currentVersion = (0, semver_1.parse)(currentVersionString);
			if (currentVersion == null) throw (0, builder_util_runtime_1.newError)(`App version is not a valid semver version: "${currentVersionString}"`, "ERR_UPDATER_INVALID_VERSION");
			this.currentVersion = currentVersion;
			this.allowPrerelease = hasPrereleaseComponents(currentVersion);
			if (options != null) {
				this.setFeedURL(options);
				if (typeof options !== "string" && options.requestHeaders) this.requestHeaders = options.requestHeaders;
			}
		}
		getFeedURL() {
			return "Deprecated. Do not use it.";
		}
		/**
		* Configure update provider. If value is `string`, [GenericServerOptions](https://www.electron.build/publish#genericserveroptions) will be set with value as `url`.
		* @param options If you want to override configuration in the `app-update.yml`.
		*/
		setFeedURL(options) {
			const runtimeOptions = this.createProviderRuntimeOptions();
			let provider;
			if (typeof options === "string") provider = new GenericProvider_1.GenericProvider({
				provider: "generic",
				url: options
			}, this, {
				...runtimeOptions,
				isUseMultipleRangeRequest: (0, providerFactory_1.isUrlProbablySupportMultiRangeRequests)(options)
			});
			else provider = (0, providerFactory_1.createClient)(options, this, runtimeOptions);
			this.clientPromise = Promise.resolve(provider);
		}
		/**
		* Asks the server whether there is an update.
		* @returns null if the updater is disabled, otherwise info about the latest version
		*/
		checkForUpdates() {
			if (!this.isUpdaterActive()) return Promise.resolve(null);
			let checkForUpdatesPromise = this.checkForUpdatesPromise;
			if (checkForUpdatesPromise != null) {
				this._logger.info("Checking for update (already in progress)");
				return checkForUpdatesPromise;
			}
			const nullizePromise = () => this.checkForUpdatesPromise = null;
			this._logger.info("Checking for update");
			checkForUpdatesPromise = this.doCheckForUpdates().then((it) => {
				nullizePromise();
				return it;
			}).catch((e) => {
				nullizePromise();
				this.emit("error", e, `Cannot check for updates: ${(e.stack || e).toString()}`);
				throw e;
			});
			this.checkForUpdatesPromise = checkForUpdatesPromise;
			return checkForUpdatesPromise;
		}
		isUpdaterActive() {
			if (!(this.app.isPackaged || this.forceDevUpdateConfig)) {
				this._logger.info("Skip checkForUpdates because application is not packed and dev update config is not forced");
				return false;
			}
			return true;
		}
		checkForUpdatesAndNotify(downloadNotification) {
			return this.checkForUpdates().then((it) => {
				if (!(it === null || it === void 0 ? void 0 : it.downloadPromise)) {
					if (this._logger.debug != null) this._logger.debug("checkForUpdatesAndNotify called, downloadPromise is null");
					return it;
				}
				it.downloadPromise.then(() => {
					const notificationContent = AppUpdater.formatDownloadNotification(it.updateInfo.version, this.app.name, downloadNotification);
					new (require("electron")).Notification(notificationContent).show();
				});
				return it;
			});
		}
		static formatDownloadNotification(version, appName, downloadNotification) {
			if (downloadNotification == null) downloadNotification = {
				title: "A new update is ready to install",
				body: `{appName} version {version} has been downloaded and will be automatically installed on exit`
			};
			downloadNotification = {
				title: downloadNotification.title.replace("{appName}", appName).replace("{version}", version),
				body: downloadNotification.body.replace("{appName}", appName).replace("{version}", version)
			};
			return downloadNotification;
		}
		async isStagingMatch(updateInfo) {
			const rawStagingPercentage = updateInfo.stagingPercentage;
			let stagingPercentage = rawStagingPercentage;
			if (stagingPercentage == null) return true;
			stagingPercentage = parseInt(stagingPercentage, 10);
			if (isNaN(stagingPercentage)) {
				this._logger.warn(`Staging percentage is NaN: ${rawStagingPercentage}`);
				return true;
			}
			stagingPercentage = stagingPercentage / 100;
			const stagingUserId = await this.stagingUserIdPromise.value;
			const percentage = builder_util_runtime_1.UUID.parse(stagingUserId).readUInt32BE(12) / 4294967295;
			this._logger.info(`Staging percentage: ${stagingPercentage}, percentage: ${percentage}, user id: ${stagingUserId}`);
			return percentage < stagingPercentage;
		}
		computeFinalHeaders(headers) {
			if (this.requestHeaders != null) Object.assign(headers, this.requestHeaders);
			return headers;
		}
		async isUpdateAvailable(updateInfo) {
			const latestVersion = (0, semver_1.parse)(updateInfo.version);
			if (latestVersion == null) throw (0, builder_util_runtime_1.newError)(`This file could not be downloaded, or the latest version (from update server) does not have a valid semver version: "${updateInfo.version}"`, "ERR_UPDATER_INVALID_VERSION");
			const currentVersion = this.currentVersion;
			if ((0, semver_1.eq)(latestVersion, currentVersion)) return false;
			if (!await Promise.resolve(this.isUpdateSupported(updateInfo))) return false;
			if (!await Promise.resolve(this.isUserWithinRollout(updateInfo))) return false;
			const isLatestVersionNewer = (0, semver_1.gt)(latestVersion, currentVersion);
			const isLatestVersionOlder = (0, semver_1.lt)(latestVersion, currentVersion);
			if (isLatestVersionNewer) return true;
			return this.allowDowngrade && isLatestVersionOlder;
		}
		checkIfUpdateSupported(updateInfo) {
			const minimumSystemVersion = updateInfo === null || updateInfo === void 0 ? void 0 : updateInfo.minimumSystemVersion;
			const currentOSVersion = (0, os_1.release)();
			if (minimumSystemVersion) try {
				if ((0, semver_1.lt)(currentOSVersion, minimumSystemVersion)) {
					this._logger.info(`Current OS version ${currentOSVersion} is less than the minimum OS version required ${minimumSystemVersion} for version ${currentOSVersion}`);
					return false;
				}
			} catch (e) {
				this._logger.warn(`Failed to compare current OS version(${currentOSVersion}) with minimum OS version(${minimumSystemVersion}): ${(e.message || e).toString()}`);
			}
			return true;
		}
		async getUpdateInfoAndProvider() {
			await this.app.whenReady();
			if (this.clientPromise == null) this.clientPromise = this.configOnDisk.value.then((it) => (0, providerFactory_1.createClient)(it, this, this.createProviderRuntimeOptions()));
			const client = await this.clientPromise;
			const stagingUserId = await this.stagingUserIdPromise.value;
			client.setRequestHeaders(this.computeFinalHeaders({ "x-user-staging-id": stagingUserId }));
			return {
				info: await client.getLatestVersion(),
				provider: client
			};
		}
		createProviderRuntimeOptions() {
			return {
				isUseMultipleRangeRequest: true,
				platform: this._testOnlyOptions == null ? process.platform : this._testOnlyOptions.platform,
				executor: this.httpExecutor
			};
		}
		async doCheckForUpdates() {
			this.emit("checking-for-update");
			const result = await this.getUpdateInfoAndProvider();
			const updateInfo = result.info;
			if (!await this.isUpdateAvailable(updateInfo)) {
				this._logger.info(`Update for version ${this.currentVersion.format()} is not available (latest version: ${updateInfo.version}, downgrade is ${this.allowDowngrade ? "allowed" : "disallowed"}).`);
				this.emit("update-not-available", updateInfo);
				return {
					isUpdateAvailable: false,
					versionInfo: updateInfo,
					updateInfo
				};
			}
			this.updateInfoAndProvider = result;
			this.onUpdateAvailable(updateInfo);
			const cancellationToken = new builder_util_runtime_1.CancellationToken();
			return {
				isUpdateAvailable: true,
				versionInfo: updateInfo,
				updateInfo,
				cancellationToken,
				downloadPromise: this.autoDownload ? this.downloadUpdate(cancellationToken) : null
			};
		}
		onUpdateAvailable(updateInfo) {
			this._logger.info(`Found version ${updateInfo.version} (url: ${(0, builder_util_runtime_1.asArray)(updateInfo.files).map((it) => it.url).join(", ")})`);
			this.emit("update-available", updateInfo);
		}
		/**
		* Start downloading update manually. You can use this method if `autoDownload` option is set to `false`.
		* @returns {Promise<Array<string>>} Paths to downloaded files.
		*/
		downloadUpdate(cancellationToken = new builder_util_runtime_1.CancellationToken()) {
			const updateInfoAndProvider = this.updateInfoAndProvider;
			if (updateInfoAndProvider == null) {
				const error = /* @__PURE__ */ new Error("Please check update first");
				this.dispatchError(error);
				return Promise.reject(error);
			}
			if (this.downloadPromise != null) {
				this._logger.info("Downloading update (already in progress)");
				return this.downloadPromise;
			}
			this._logger.info(`Downloading update from ${(0, builder_util_runtime_1.asArray)(updateInfoAndProvider.info.files).map((it) => it.url).join(", ")}`);
			const errorHandler = (e) => {
				if (!(e instanceof builder_util_runtime_1.CancellationError)) try {
					this.dispatchError(e);
				} catch (nestedError) {
					this._logger.warn(`Cannot dispatch error event: ${nestedError.stack || nestedError}`);
				}
				return e;
			};
			this.downloadPromise = this.doDownloadUpdate({
				updateInfoAndProvider,
				requestHeaders: this.computeRequestHeaders(updateInfoAndProvider.provider),
				cancellationToken,
				disableWebInstaller: this.disableWebInstaller,
				disableDifferentialDownload: this.disableDifferentialDownload
			}).catch((e) => {
				throw errorHandler(e);
			}).finally(() => {
				this.downloadPromise = null;
			});
			return this.downloadPromise;
		}
		dispatchError(e) {
			this.emit("error", e, (e.stack || e).toString());
		}
		dispatchUpdateDownloaded(event) {
			this.emit(types_1.UPDATE_DOWNLOADED, event);
		}
		async loadUpdateConfig() {
			if (this._appUpdateConfigPath == null) this._appUpdateConfigPath = this.app.appUpdateConfigPath;
			return (0, js_yaml_1.load)(await (0, fs_extra_1.readFile)(this._appUpdateConfigPath, "utf-8"));
		}
		computeRequestHeaders(provider) {
			const fileExtraDownloadHeaders = provider.fileExtraDownloadHeaders;
			if (fileExtraDownloadHeaders != null) {
				const requestHeaders = this.requestHeaders;
				return requestHeaders == null ? fileExtraDownloadHeaders : {
					...fileExtraDownloadHeaders,
					...requestHeaders
				};
			}
			return this.computeFinalHeaders({ accept: "*/*" });
		}
		async getOrCreateStagingUserId() {
			const file = path$6.join(this.app.userDataPath, ".updaterId");
			try {
				const id = await (0, fs_extra_1.readFile)(file, "utf-8");
				if (builder_util_runtime_1.UUID.check(id)) return id;
				else this._logger.warn(`Staging user id file exists, but content was invalid: ${id}`);
			} catch (e) {
				if (e.code !== "ENOENT") this._logger.warn(`Couldn't read staging user ID, creating a blank one: ${e}`);
			}
			const id = builder_util_runtime_1.UUID.v5((0, crypto_1$1.randomBytes)(4096), builder_util_runtime_1.UUID.OID);
			this._logger.info(`Generated new staging user ID: ${id}`);
			try {
				await (0, fs_extra_1.outputFile)(file, id);
			} catch (e) {
				this._logger.warn(`Couldn't write out staging user ID: ${e}`);
			}
			return id;
		}
		/** @internal */
		get isAddNoCacheQuery() {
			const headers = this.requestHeaders;
			if (headers == null) return true;
			for (const headerName of Object.keys(headers)) {
				const s = headerName.toLowerCase();
				if (s === "authorization" || s === "private-token") return false;
			}
			return true;
		}
		async getOrCreateDownloadHelper() {
			let result = this.downloadedUpdateHelper;
			if (result == null) {
				const dirName = (await this.configOnDisk.value).updaterCacheDirName;
				const logger = this._logger;
				if (dirName == null) logger.error("updaterCacheDirName is not specified in app-update.yml Was app build using at least electron-builder 20.34.0?");
				const cacheDir = path$6.join(this.app.baseCachePath, dirName || this.app.name);
				if (logger.debug != null) logger.debug(`updater cache dir: ${cacheDir}`);
				result = new DownloadedUpdateHelper_1.DownloadedUpdateHelper(cacheDir);
				this.downloadedUpdateHelper = result;
			}
			return result;
		}
		async executeDownload(taskOptions) {
			const fileInfo = taskOptions.fileInfo;
			const downloadOptions = {
				headers: taskOptions.downloadUpdateOptions.requestHeaders,
				cancellationToken: taskOptions.downloadUpdateOptions.cancellationToken,
				sha2: fileInfo.info.sha2,
				sha512: fileInfo.info.sha512
			};
			if (this.listenerCount(types_1.DOWNLOAD_PROGRESS) > 0) downloadOptions.onProgress = (it) => this.emit(types_1.DOWNLOAD_PROGRESS, it);
			const updateInfo = taskOptions.downloadUpdateOptions.updateInfoAndProvider.info;
			const version = updateInfo.version;
			const packageInfo = fileInfo.packageInfo;
			function getCacheUpdateFileName() {
				const urlPath = decodeURIComponent(taskOptions.fileInfo.url.pathname);
				if (urlPath.toLowerCase().endsWith(`.${taskOptions.fileExtension.toLowerCase()}`)) return path$6.basename(urlPath);
				else return path$6.basename(taskOptions.fileInfo.info.url);
			}
			const downloadedUpdateHelper = await this.getOrCreateDownloadHelper();
			const cacheDir = downloadedUpdateHelper.cacheDirForPendingUpdate;
			await (0, fs_extra_1.mkdir)(cacheDir, { recursive: true });
			const updateFileName = getCacheUpdateFileName();
			let updateFile = path$6.join(cacheDir, updateFileName);
			const packageFile = packageInfo == null ? null : path$6.join(cacheDir, `package-${version}${path$6.extname(packageInfo.path) || ".7z"}`);
			const done = async (isSaveCache) => {
				await downloadedUpdateHelper.setDownloadedFile(updateFile, packageFile, updateInfo, fileInfo, updateFileName, isSaveCache);
				await taskOptions.done({
					...updateInfo,
					downloadedFile: updateFile
				});
				const currentBlockMapFile = path$6.join(cacheDir, "current.blockmap");
				if (await (0, fs_extra_1.pathExists)(currentBlockMapFile)) await (0, fs_extra_1.copyFile)(currentBlockMapFile, path$6.join(downloadedUpdateHelper.cacheDir, "current.blockmap"));
				return packageFile == null ? [updateFile] : [updateFile, packageFile];
			};
			const log = this._logger;
			const cachedUpdateFile = await downloadedUpdateHelper.validateDownloadedPath(updateFile, updateInfo, fileInfo, log);
			if (cachedUpdateFile != null) {
				updateFile = cachedUpdateFile;
				return await done(false);
			}
			const removeFileIfAny = async () => {
				await downloadedUpdateHelper.clear().catch(() => {});
				return await (0, fs_extra_1.unlink)(updateFile).catch(() => {});
			};
			const tempUpdateFile = await (0, DownloadedUpdateHelper_1.createTempUpdateFile)(`temp-${updateFileName}`, cacheDir, log);
			try {
				await taskOptions.task(tempUpdateFile, downloadOptions, packageFile, removeFileIfAny);
				await (0, builder_util_runtime_1.retry)(() => (0, fs_extra_1.rename)(tempUpdateFile, updateFile), {
					retries: 60,
					interval: 500,
					shouldRetry: (error) => {
						if (error instanceof Error && /^EBUSY:/.test(error.message)) return true;
						log.warn(`Cannot rename temp file to final file: ${error.message || error.stack}`);
						return false;
					}
				});
			} catch (e) {
				await removeFileIfAny();
				if (e instanceof builder_util_runtime_1.CancellationError) {
					log.info("cancelled");
					this.emit("update-cancelled", updateInfo);
				}
				throw e;
			}
			log.info(`New version ${version} has been downloaded to ${updateFile}`);
			return await done(true);
		}
		async differentialDownloadInstaller(fileInfo, downloadUpdateOptions, installerPath, provider, oldInstallerFileName) {
			try {
				if (this._testOnlyOptions != null && !this._testOnlyOptions.isUseDifferentialDownload) return true;
				const provider = downloadUpdateOptions.updateInfoAndProvider.provider;
				const blockmapFileUrls = await provider.getBlockMapFiles(fileInfo.url, this.app.version, downloadUpdateOptions.updateInfoAndProvider.info.version, this.previousBlockmapBaseUrlOverride);
				this._logger.info(`Download block maps (old: "${blockmapFileUrls[0]}", new: ${blockmapFileUrls[1]})`);
				const downloadBlockMap = async (url) => {
					const data = await this.httpExecutor.downloadToBuffer(url, {
						headers: downloadUpdateOptions.requestHeaders,
						cancellationToken: downloadUpdateOptions.cancellationToken
					});
					if (data == null || data.length === 0) throw new Error(`Blockmap "${url.href}" is empty`);
					try {
						return JSON.parse((0, zlib_1$1.gunzipSync)(data).toString());
					} catch (e) {
						throw new Error(`Cannot parse blockmap "${url.href}", error: ${e}`);
					}
				};
				const downloadOptions = {
					newUrl: fileInfo.url,
					oldFile: path$6.join(this.downloadedUpdateHelper.cacheDir, oldInstallerFileName),
					logger: this._logger,
					newFile: installerPath,
					isUseMultipleRangeRequest: provider.isUseMultipleRangeRequest,
					requestHeaders: downloadUpdateOptions.requestHeaders,
					cancellationToken: downloadUpdateOptions.cancellationToken
				};
				if (this.listenerCount(types_1.DOWNLOAD_PROGRESS) > 0) downloadOptions.onProgress = (it) => this.emit(types_1.DOWNLOAD_PROGRESS, it);
				const saveBlockMapToCacheDir = async (blockMapData, cacheDir) => {
					const blockMapFile = path$6.join(cacheDir, "current.blockmap");
					await (0, fs_extra_1.outputFile)(blockMapFile, (0, zlib_1$1.gzipSync)(JSON.stringify(blockMapData)));
				};
				const getBlockMapFromCacheDir = async (cacheDir) => {
					const blockMapFile = path$6.join(cacheDir, "current.blockmap");
					try {
						if (await (0, fs_extra_1.pathExists)(blockMapFile)) return JSON.parse((0, zlib_1$1.gunzipSync)(await (0, fs_extra_1.readFile)(blockMapFile)).toString());
					} catch (e) {
						this._logger.warn(`Cannot parse blockmap "${blockMapFile}", error: ${e}`);
					}
					return null;
				};
				const newBlockMapData = await downloadBlockMap(blockmapFileUrls[1]);
				await saveBlockMapToCacheDir(newBlockMapData, this.downloadedUpdateHelper.cacheDirForPendingUpdate);
				let oldBlockMapData = await getBlockMapFromCacheDir(this.downloadedUpdateHelper.cacheDir);
				if (oldBlockMapData == null) oldBlockMapData = await downloadBlockMap(blockmapFileUrls[0]);
				await new GenericDifferentialDownloader_1.GenericDifferentialDownloader(fileInfo.info, this.httpExecutor, downloadOptions).download(oldBlockMapData, newBlockMapData);
				return false;
			} catch (e) {
				this._logger.error(`Cannot download differentially, fallback to full download: ${e.stack || e}`);
				if (this._testOnlyOptions != null) throw e;
				return true;
			}
		}
	};
	function hasPrereleaseComponents(version) {
		const versionPrereleaseComponent = (0, semver_1.prerelease)(version);
		return versionPrereleaseComponent != null && versionPrereleaseComponent.length > 0;
	}
	/** @private */
	var NoOpLogger = class {
		info(message) {}
		warn(message) {}
		error(message) {}
	};
	exports.NoOpLogger = NoOpLogger;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/BaseUpdater.js
var require_BaseUpdater = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.BaseUpdater = void 0;
	var child_process_1$3 = require("child_process");
	var path$5 = require("path");
	var AppUpdater_1 = require_AppUpdater();
	var BaseUpdater = class extends AppUpdater_1.AppUpdater {
		constructor(options, app) {
			super(options, app);
			this.quitAndInstallCalled = false;
			this.quitHandlerAdded = false;
		}
		quitAndInstall(isSilent = false, isForceRunAfter = false) {
			this._logger.info(`Install on explicit quitAndInstall`);
			if (this.install(isSilent, isSilent ? isForceRunAfter : this.autoRunAppAfterInstall)) setImmediate(() => {
				require("electron").autoUpdater.emit("before-quit-for-update");
				this.app.quit();
			});
			else this.quitAndInstallCalled = false;
		}
		executeDownload(taskOptions) {
			return super.executeDownload({
				...taskOptions,
				done: (event) => {
					this.dispatchUpdateDownloaded(event);
					this.addQuitHandler();
					return Promise.resolve();
				}
			});
		}
		get installerPath() {
			return this.downloadedUpdateHelper == null ? null : this.downloadedUpdateHelper.file;
		}
		install(isSilent = false, isForceRunAfter = false) {
			if (this.quitAndInstallCalled) {
				this._logger.warn("install call ignored: quitAndInstallCalled is set to true");
				return false;
			}
			const downloadedUpdateHelper = this.downloadedUpdateHelper;
			const installerPath = this.installerPath;
			const downloadedFileInfo = downloadedUpdateHelper == null ? null : downloadedUpdateHelper.downloadedFileInfo;
			if (installerPath == null || downloadedFileInfo == null) {
				this.dispatchError(/* @__PURE__ */ new Error("No update filepath provided, can't quit and install"));
				return false;
			}
			this.quitAndInstallCalled = true;
			try {
				this._logger.info(`Install: isSilent: ${isSilent}, isForceRunAfter: ${isForceRunAfter}`);
				return this.doInstall({
					isSilent,
					isForceRunAfter,
					isAdminRightsRequired: downloadedFileInfo.isAdminRightsRequired
				});
			} catch (e) {
				this.dispatchError(e);
				return false;
			}
		}
		addQuitHandler() {
			if (this.quitHandlerAdded || !this.autoInstallOnAppQuit) return;
			this.quitHandlerAdded = true;
			this.app.onQuit((exitCode) => {
				if (this.quitAndInstallCalled) {
					this._logger.info("Update installer has already been triggered. Quitting application.");
					return;
				}
				if (!this.autoInstallOnAppQuit) {
					this._logger.info("Update will not be installed on quit because autoInstallOnAppQuit is set to false.");
					return;
				}
				if (exitCode !== 0) {
					this._logger.info(`Update will be not installed on quit because application is quitting with exit code ${exitCode}`);
					return;
				}
				this._logger.info("Auto install update on quit");
				this.install(true, false);
			});
		}
		/**
		* Strips relative-path entries from a PATH string.
		* Prevents PATH-poisoning where a writable directory earlier in PATH shadows
		* a trusted package manager binary.
		*/
		sanitizeEnvPath(envPath) {
			return envPath.split(path$5.delimiter).filter((dir) => path$5.isAbsolute(dir)).join(path$5.delimiter);
		}
		spawnSyncLog(cmd, args = [], env = {}) {
			var _a;
			this._logger.info(`Executing: ${cmd} with args: ${args}`);
			const mergedEnv = {
				...process.env,
				...env
			};
			const { error, status, stdout, stderr } = (0, child_process_1$3.spawnSync)(cmd, args, {
				env: {
					...mergedEnv,
					PATH: this.sanitizeEnvPath((_a = mergedEnv.PATH) !== null && _a !== void 0 ? _a : "")
				},
				encoding: "utf-8",
				shell: true
			});
			if (error != null) {
				this._logger.error(stderr);
				throw error;
			} else if (status != null && status !== 0) {
				this._logger.error(stderr);
				throw new Error(`Command ${cmd} exited with code ${status}`);
			}
			return stdout.trim();
		}
		/**
		* This handles both node 8 and node 10 way of emitting error when spawning a process
		*   - node 8: Throws the error
		*   - node 10: Emit the error(Need to listen with on)
		*/
		async spawnLog(cmd, args = [], env = void 0, stdio = "ignore") {
			this._logger.info(`Executing: ${cmd} with args: ${args}`);
			return new Promise((resolve, reject) => {
				try {
					const params = {
						stdio,
						env,
						detached: true
					};
					const p = (0, child_process_1$3.spawn)(cmd, args, params);
					p.on("error", (error) => {
						reject(error);
					});
					p.unref();
					if (p.pid !== void 0) resolve(true);
				} catch (error) {
					reject(error);
				}
			});
		}
	};
	exports.BaseUpdater = BaseUpdater;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/differentialDownloader/FileWithEmbeddedBlockMapDifferentialDownloader.js
var require_FileWithEmbeddedBlockMapDifferentialDownloader = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.FileWithEmbeddedBlockMapDifferentialDownloader = void 0;
	var fs_extra_1 = require_lib();
	var DifferentialDownloader_1 = require_DifferentialDownloader();
	var zlib_1 = require("zlib");
	var FileWithEmbeddedBlockMapDifferentialDownloader = class extends DifferentialDownloader_1.DifferentialDownloader {
		async download() {
			const packageInfo = this.blockAwareFileInfo;
			const fileSize = packageInfo.size;
			const offset = fileSize - (packageInfo.blockMapSize + 4);
			this.fileMetadataBuffer = await this.readRemoteBytes(offset, fileSize - 1);
			const newBlockMap = readBlockMap(this.fileMetadataBuffer.slice(0, this.fileMetadataBuffer.length - 4));
			await this.doDownload(await readEmbeddedBlockMapData(this.options.oldFile), newBlockMap);
		}
	};
	exports.FileWithEmbeddedBlockMapDifferentialDownloader = FileWithEmbeddedBlockMapDifferentialDownloader;
	function readBlockMap(data) {
		return JSON.parse((0, zlib_1.inflateRawSync)(data).toString());
	}
	async function readEmbeddedBlockMapData(file) {
		const fd = await (0, fs_extra_1.open)(file, "r");
		try {
			const fileSize = (await (0, fs_extra_1.fstat)(fd)).size;
			const sizeBuffer = Buffer.allocUnsafe(4);
			await (0, fs_extra_1.read)(fd, sizeBuffer, 0, sizeBuffer.length, fileSize - sizeBuffer.length);
			const dataBuffer = Buffer.allocUnsafe(sizeBuffer.readUInt32BE(0));
			await (0, fs_extra_1.read)(fd, dataBuffer, 0, dataBuffer.length, fileSize - sizeBuffer.length - dataBuffer.length);
			await (0, fs_extra_1.close)(fd);
			return readBlockMap(dataBuffer);
		} catch (e) {
			await (0, fs_extra_1.close)(fd);
			throw e;
		}
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/out/AppImageUpdater.js
var require_AppImageUpdater = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.AppImageUpdater = void 0;
	var builder_util_runtime_1 = require_out();
	var child_process_1$2 = require("child_process");
	var fs_extra_1 = require_lib();
	var fs_1$1 = require("fs");
	var path$4 = require("path");
	var BaseUpdater_1 = require_BaseUpdater();
	var FileWithEmbeddedBlockMapDifferentialDownloader_1 = require_FileWithEmbeddedBlockMapDifferentialDownloader();
	var Provider_1 = require_Provider();
	var types_1 = require_types();
	var AppImageUpdater = class extends BaseUpdater_1.BaseUpdater {
		constructor(options, app) {
			super(options, app);
		}
		isUpdaterActive() {
			if (process.env["APPIMAGE"] == null && !this.forceDevUpdateConfig) {
				if (process.env["SNAP"] == null) this._logger.warn("APPIMAGE env is not defined, current application is not an AppImage");
				else this._logger.info("SNAP env is defined, updater is disabled");
				return false;
			}
			return super.isUpdaterActive();
		}
		/*** @private */
		doDownloadUpdate(downloadUpdateOptions) {
			const provider = downloadUpdateOptions.updateInfoAndProvider.provider;
			const fileInfo = (0, Provider_1.findFile)(provider.resolveFiles(downloadUpdateOptions.updateInfoAndProvider.info), "AppImage", [
				"rpm",
				"deb",
				"pacman"
			]);
			return this.executeDownload({
				fileExtension: "AppImage",
				fileInfo,
				downloadUpdateOptions,
				task: async (updateFile, downloadOptions) => {
					const oldFile = process.env["APPIMAGE"];
					if (oldFile == null) throw (0, builder_util_runtime_1.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
					if (downloadUpdateOptions.disableDifferentialDownload || await this.downloadDifferential(fileInfo, oldFile, updateFile, provider, downloadUpdateOptions)) await this.httpExecutor.download(fileInfo.url, updateFile, downloadOptions);
					await (0, fs_extra_1.chmod)(updateFile, 493);
				}
			});
		}
		async downloadDifferential(fileInfo, oldFile, updateFile, provider, downloadUpdateOptions) {
			try {
				const downloadOptions = {
					newUrl: fileInfo.url,
					oldFile,
					logger: this._logger,
					newFile: updateFile,
					isUseMultipleRangeRequest: provider.isUseMultipleRangeRequest,
					requestHeaders: downloadUpdateOptions.requestHeaders,
					cancellationToken: downloadUpdateOptions.cancellationToken
				};
				if (this.listenerCount(types_1.DOWNLOAD_PROGRESS) > 0) downloadOptions.onProgress = (it) => this.emit(types_1.DOWNLOAD_PROGRESS, it);
				await new FileWithEmbeddedBlockMapDifferentialDownloader_1.FileWithEmbeddedBlockMapDifferentialDownloader(fileInfo.info, this.httpExecutor, downloadOptions).download();
				return false;
			} catch (e) {
				this._logger.error(`Cannot download differentially, fallback to full download: ${e.stack || e}`);
				return process.platform === "linux";
			}
		}
		doInstall(options) {
			const appImageFile = process.env["APPIMAGE"];
			if (appImageFile == null) throw (0, builder_util_runtime_1.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
			if (!path$4.isAbsolute(appImageFile) || appImageFile.includes("\0")) throw (0, builder_util_runtime_1.newError)(`APPIMAGE env is not a valid absolute path: "${appImageFile}"`, "ERR_UPDATER_OLD_FILE_NOT_FOUND");
			(0, fs_1$1.unlinkSync)(appImageFile);
			let destination;
			const existingBaseName = path$4.basename(appImageFile);
			const installerPath = this.installerPath;
			if (installerPath == null) {
				this.dispatchError(/* @__PURE__ */ new Error("No update filepath provided, can't quit and install"));
				return false;
			}
			if (path$4.basename(installerPath) === existingBaseName || !/\d+\.\d+\.\d+/.test(existingBaseName)) destination = appImageFile;
			else destination = path$4.join(path$4.dirname(appImageFile), path$4.basename(installerPath));
			(0, child_process_1$2.execFileSync)("mv", [
				"-f",
				installerPath,
				destination
			]);
			if (destination !== appImageFile) this.emit("appimage-filename-updated", destination);
			const env = {
				...process.env,
				APPIMAGE_SILENT_INSTALL: "true"
			};
			if (options.isForceRunAfter) this.spawnLog(destination, [], env);
			else {
				env.APPIMAGE_EXIT_AFTER_INSTALL = "true";
				(0, child_process_1$2.execFileSync)(destination, [], { env });
			}
			return true;
		}
	};
	exports.AppImageUpdater = AppImageUpdater;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/LinuxUpdater.js
var require_LinuxUpdater = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.LinuxUpdater = void 0;
	var BaseUpdater_1 = require_BaseUpdater();
	var SAFE_PM_REGEX = /^[a-zA-Z0-9_-]+$/;
	var LinuxUpdater = class extends BaseUpdater_1.BaseUpdater {
		constructor(options, app) {
			super(options, app);
		}
		/**
		* Returns true if the current process is running as root.
		*/
		isRunningAsRoot() {
			var _a;
			return ((_a = process.getuid) === null || _a === void 0 ? void 0 : _a.call(process)) === 0;
		}
		/**
		* Sanitizes the installer path for use with shell:true spawn calls.
		* Backslash-escapes metacharacters that have special meaning in POSIX shell.
		* Note: paths containing single-quotes (') are not supported.
		*/
		get installerPath() {
			const raw = super.installerPath;
			if (raw == null) return null;
			return raw.replace(/\\/g, "\\\\").replace(/([`$!" ;|&()<>])/g, "\\$1").replace(/[\n\r]/g, "");
		}
		runCommandWithSudoIfNeeded(commandWithArgs) {
			if (this.isRunningAsRoot()) {
				this._logger.info("Running as root, no need to use sudo");
				return this.spawnSyncLog(commandWithArgs[0], commandWithArgs.slice(1));
			}
			const { name } = this.app;
			const installComment = `"${name.replace(/["`$\\!\n\r;|&<>(){}*?[\]#~]/g, "")} would like to update"`;
			const sudo = this.sudoWithArgs(installComment);
			this._logger.info(`Running as non-root user, using sudo to install: ${sudo}`);
			let wrapper = `"`;
			if (/pkexec/i.test(sudo[0]) || sudo[0] === "sudo") wrapper = "";
			return this.spawnSyncLog(sudo[0], [
				...sudo.length > 1 ? sudo.slice(1) : [],
				`${wrapper}/bin/bash`,
				"-c",
				`'${commandWithArgs.join(" ")}'${wrapper}`
			]);
		}
		sudoWithArgs(installComment) {
			const sudo = this.determineSudoCommand();
			const command = [sudo];
			if (/kdesudo/i.test(sudo)) {
				command.push("--comment", installComment);
				command.push("-c");
			} else if (/gksudo/i.test(sudo)) command.push("--message", installComment);
			else if (/pkexec/i.test(sudo)) command.push("--disable-internal-agent");
			return command;
		}
		hasCommand(cmd) {
			try {
				this.spawnSyncLog(`command`, ["-v", cmd]);
				return true;
			} catch {
				return false;
			}
		}
		determineSudoCommand() {
			for (const sudo of [
				"gksudo",
				"kdesudo",
				"pkexec",
				"beesu"
			]) if (this.hasCommand(sudo)) return sudo;
			return "sudo";
		}
		/**
		* Detects the package manager to use based on the available commands.
		* Allows overriding the default behavior by setting the ELECTRON_BUILDER_LINUX_PACKAGE_MANAGER environment variable.
		* If the environment variable is set, it will be used directly. (This is useful for testing each package manager logic path.)
		* Otherwise, it checks for the presence of the specified package manager commands in the order provided.
		* @param pms - An array of package manager commands to check for, in priority order.
		* @returns The detected package manager command or "unknown" if none are found.
		*/
		detectPackageManager(pms) {
			var _a;
			let availablePMs = pms;
			const pmOverride = (_a = process.env.ELECTRON_BUILDER_LINUX_PACKAGE_MANAGER) === null || _a === void 0 ? void 0 : _a.trim();
			if (pmOverride) if (!SAFE_PM_REGEX.test(pmOverride)) this._logger.warn(`ELECTRON_BUILDER_LINUX_PACKAGE_MANAGER "${pmOverride}" contains unsafe characters. Ignoring override.`);
			else availablePMs = [pmOverride];
			for (const pm of availablePMs) if (this.hasCommand(pm)) return pm;
			const searchList = pmOverride ? `ELECTRON_BUILDER_LINUX_PACKAGE_MANAGER override "${pmOverride}", ` : "";
			const defaultPM = pms[0];
			this._logger.warn(`No package manager found in the list: ${searchList}${pms.join(", ")}. Utilizing default: ${defaultPM}`);
			return defaultPM;
		}
	};
	exports.LinuxUpdater = LinuxUpdater;
}));
//#endregion
//#region ../../node_modules/electron-updater/out/DebUpdater.js
var require_DebUpdater = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.DebUpdater = void 0;
	var Provider_1 = require_Provider();
	var types_1 = require_types();
	var LinuxUpdater_1 = require_LinuxUpdater();
	exports.DebUpdater = class DebUpdater extends LinuxUpdater_1.LinuxUpdater {
		constructor(options, app) {
			super(options, app);
		}
		/*** @private */
		doDownloadUpdate(downloadUpdateOptions) {
			const provider = downloadUpdateOptions.updateInfoAndProvider.provider;
			const fileInfo = (0, Provider_1.findFile)(provider.resolveFiles(downloadUpdateOptions.updateInfoAndProvider.info), "deb", [
				"AppImage",
				"rpm",
				"pacman"
			]);
			return this.executeDownload({
				fileExtension: "deb",
				fileInfo,
				downloadUpdateOptions,
				task: async (updateFile, downloadOptions) => {
					if (this.listenerCount(types_1.DOWNLOAD_PROGRESS) > 0) downloadOptions.onProgress = (it) => this.emit(types_1.DOWNLOAD_PROGRESS, it);
					await this.httpExecutor.download(fileInfo.url, updateFile, downloadOptions);
				}
			});
		}
		doInstall(options) {
			const installerPath = this.installerPath;
			if (installerPath == null) {
				this.dispatchError(/* @__PURE__ */ new Error("No update filepath provided, can't quit and install"));
				return false;
			}
			if (!this.hasCommand("dpkg") && !this.hasCommand("apt")) {
				this.dispatchError(/* @__PURE__ */ new Error("Neither dpkg nor apt command found. Cannot install .deb package."));
				return false;
			}
			const packageManager = this.detectPackageManager(["dpkg", "apt"]);
			try {
				DebUpdater.installWithCommandRunner(packageManager, installerPath, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
			} catch (error) {
				this.dispatchError(error);
				return false;
			}
			if (options.isForceRunAfter) this.app.relaunch();
			return true;
		}
		static installWithCommandRunner(packageManager, installerPath, commandRunner, logger) {
			var _a;
			if (packageManager === "dpkg") try {
				commandRunner([
					"dpkg",
					"-i",
					installerPath
				]);
			} catch (error) {
				logger.warn((_a = error.message) !== null && _a !== void 0 ? _a : error);
				logger.warn("dpkg installation failed, trying to fix broken dependencies with apt-get");
				commandRunner([
					"apt-get",
					"install",
					"-f",
					"-y"
				]);
			}
			else if (packageManager === "apt") {
				logger.warn("Using apt to install a local .deb. This may fail for unsigned packages unless properly configured.");
				commandRunner([
					"apt",
					"install",
					"-y",
					"--allow-unauthenticated",
					"--allow-downgrades",
					"--allow-change-held-packages",
					installerPath
				]);
			} else throw new Error(`Package manager ${packageManager} not supported`);
		}
	};
}));
//#endregion
//#region ../../node_modules/electron-updater/out/PacmanUpdater.js
var require_PacmanUpdater = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.PacmanUpdater = void 0;
	var types_1 = require_types();
	var Provider_1 = require_Provider();
	var LinuxUpdater_1 = require_LinuxUpdater();
	exports.PacmanUpdater = class PacmanUpdater extends LinuxUpdater_1.LinuxUpdater {
		constructor(options, app) {
			super(options, app);
		}
		/*** @private */
		doDownloadUpdate(downloadUpdateOptions) {
			const provider = downloadUpdateOptions.updateInfoAndProvider.provider;
			const fileInfo = (0, Provider_1.findFile)(provider.resolveFiles(downloadUpdateOptions.updateInfoAndProvider.info), "pacman", [
				"AppImage",
				"deb",
				"rpm"
			]);
			return this.executeDownload({
				fileExtension: "pacman",
				fileInfo,
				downloadUpdateOptions,
				task: async (updateFile, downloadOptions) => {
					if (this.listenerCount(types_1.DOWNLOAD_PROGRESS) > 0) downloadOptions.onProgress = (it) => this.emit(types_1.DOWNLOAD_PROGRESS, it);
					await this.httpExecutor.download(fileInfo.url, updateFile, downloadOptions);
				}
			});
		}
		doInstall(options) {
			const installerPath = this.installerPath;
			if (installerPath == null) {
				this.dispatchError(/* @__PURE__ */ new Error("No update filepath provided, can't quit and install"));
				return false;
			}
			try {
				PacmanUpdater.installWithCommandRunner(installerPath, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
			} catch (error) {
				this.dispatchError(error);
				return false;
			}
			if (options.isForceRunAfter) this.app.relaunch();
			return true;
		}
		static installWithCommandRunner(installerPath, commandRunner, logger) {
			var _a;
			try {
				commandRunner([
					"pacman",
					"-U",
					"--noconfirm",
					installerPath
				]);
			} catch (error) {
				logger.warn((_a = error.message) !== null && _a !== void 0 ? _a : error);
				logger.warn("pacman installation failed, attempting to update package database and retry");
				try {
					commandRunner([
						"pacman",
						"-Sy",
						"--noconfirm"
					]);
					commandRunner([
						"pacman",
						"-U",
						"--noconfirm",
						installerPath
					]);
				} catch (retryError) {
					logger.error("Retry after pacman -Sy failed");
					throw retryError;
				}
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/electron-updater/out/RpmUpdater.js
var require_RpmUpdater = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.RpmUpdater = void 0;
	var types_1 = require_types();
	var Provider_1 = require_Provider();
	var LinuxUpdater_1 = require_LinuxUpdater();
	exports.RpmUpdater = class RpmUpdater extends LinuxUpdater_1.LinuxUpdater {
		constructor(options, app) {
			super(options, app);
		}
		/*** @private */
		doDownloadUpdate(downloadUpdateOptions) {
			const provider = downloadUpdateOptions.updateInfoAndProvider.provider;
			const fileInfo = (0, Provider_1.findFile)(provider.resolveFiles(downloadUpdateOptions.updateInfoAndProvider.info), "rpm", [
				"AppImage",
				"deb",
				"pacman"
			]);
			return this.executeDownload({
				fileExtension: "rpm",
				fileInfo,
				downloadUpdateOptions,
				task: async (updateFile, downloadOptions) => {
					if (this.listenerCount(types_1.DOWNLOAD_PROGRESS) > 0) downloadOptions.onProgress = (it) => this.emit(types_1.DOWNLOAD_PROGRESS, it);
					await this.httpExecutor.download(fileInfo.url, updateFile, downloadOptions);
				}
			});
		}
		doInstall(options) {
			const installerPath = this.installerPath;
			if (installerPath == null) {
				this.dispatchError(/* @__PURE__ */ new Error("No update filepath provided, can't quit and install"));
				return false;
			}
			const packageManager = this.detectPackageManager([
				"zypper",
				"dnf",
				"yum",
				"rpm"
			]);
			try {
				RpmUpdater.installWithCommandRunner(packageManager, installerPath, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
			} catch (error) {
				this.dispatchError(error);
				return false;
			}
			if (options.isForceRunAfter) this.app.relaunch();
			return true;
		}
		static installWithCommandRunner(packageManager, installerPath, commandRunner, logger) {
			if (packageManager === "zypper") return commandRunner([
				"zypper",
				"--non-interactive",
				"--no-refresh",
				"install",
				"--allow-unsigned-rpm",
				"-f",
				installerPath
			]);
			if (packageManager === "dnf") return commandRunner([
				"dnf",
				"install",
				"--nogpgcheck",
				"-y",
				installerPath
			]);
			if (packageManager === "yum") return commandRunner([
				"yum",
				"install",
				"--nogpgcheck",
				"-y",
				installerPath
			]);
			if (packageManager === "rpm") {
				logger.warn("Installing with rpm only (no dependency resolution).");
				return commandRunner([
					"rpm",
					"-Uvh",
					"--replacepkgs",
					"--replacefiles",
					"--nodeps",
					installerPath
				]);
			}
			throw new Error(`Package manager ${packageManager} not supported`);
		}
	};
}));
//#endregion
//#region ../../node_modules/electron-updater/out/MacUpdater.js
var require_MacUpdater = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.MacUpdater = void 0;
	var builder_util_runtime_1 = require_out();
	var fs_extra_1 = require_lib();
	var fs_1 = require("fs");
	var path$3 = require("path");
	var http_1 = require("http");
	var AppUpdater_1 = require_AppUpdater();
	var Provider_1 = require_Provider();
	var child_process_1$1 = require("child_process");
	var crypto_1 = require("crypto");
	exports.MacUpdater = class MacUpdater extends AppUpdater_1.AppUpdater {
		constructor(options, app) {
			super(options, app);
			this.nativeUpdater = require("electron").autoUpdater;
			this.squirrelDownloadedUpdate = false;
			this.nativeUpdater.on("error", (it) => {
				this._logger.warn(it);
				this.emit("error", it);
			});
			this.nativeUpdater.on("update-downloaded", () => {
				this.squirrelDownloadedUpdate = true;
				this.debug("nativeUpdater.update-downloaded");
			});
		}
		/** Filters update files to the appropriate architecture.
		* On arm64 Macs (including Rosetta), arm64 files are preferred when available.
		* On x64 Macs, arm64 files are excluded. */
		static filterFilesForArch(files, isArm64Mac) {
			const isArm64File = (file) => {
				var _a;
				return file.url.pathname.includes("arm64") || ((_a = file.info.url) === null || _a === void 0 ? void 0 : _a.includes("arm64"));
			};
			if (isArm64Mac && files.some(isArm64File)) return files.filter((file) => isArm64Mac === isArm64File(file));
			return files.filter((file) => !isArm64File(file));
		}
		debug(message) {
			if (this._logger.debug != null) this._logger.debug(message);
		}
		closeServerIfExists() {
			if (this.server) {
				this.debug("Closing proxy server");
				this.server.close((err) => {
					if (err) this.debug("proxy server wasn't already open, probably attempted closing again as a safety check before quit");
				});
			}
		}
		async doDownloadUpdate(downloadUpdateOptions) {
			let files = downloadUpdateOptions.updateInfoAndProvider.provider.resolveFiles(downloadUpdateOptions.updateInfoAndProvider.info);
			const log = this._logger;
			const sysctlRosettaInfoKey = "sysctl.proc_translated";
			let isRosetta = false;
			try {
				this.debug("Checking for macOS Rosetta environment");
				isRosetta = (0, child_process_1$1.execFileSync)("sysctl", [sysctlRosettaInfoKey], { encoding: "utf8" }).includes(`${sysctlRosettaInfoKey}: 1`);
				log.info(`Checked for macOS Rosetta environment (isRosetta=${isRosetta})`);
			} catch (e) {
				log.warn(`sysctl shell command to check for macOS Rosetta environment failed: ${e}`);
			}
			let isArm64Mac = false;
			try {
				this.debug("Checking for arm64 in uname");
				const isArm = (0, child_process_1$1.execFileSync)("uname", ["-a"], { encoding: "utf8" }).includes("ARM");
				log.info(`Checked 'uname -a': arm64=${isArm}`);
				isArm64Mac = isArm64Mac || isArm;
			} catch (e) {
				log.warn(`uname shell command to check for arm64 failed: ${e}`);
			}
			isArm64Mac = isArm64Mac || process.arch === "arm64" || isRosetta;
			files = MacUpdater.filterFilesForArch(files, isArm64Mac);
			const zipFileInfo = (0, Provider_1.findFile)(files, "zip", ["pkg", "dmg"]);
			if (zipFileInfo == null) throw (0, builder_util_runtime_1.newError)(`ZIP file not provided: ${(0, builder_util_runtime_1.safeStringifyJson)(files)}`, "ERR_UPDATER_ZIP_FILE_NOT_FOUND");
			const provider = downloadUpdateOptions.updateInfoAndProvider.provider;
			const CURRENT_MAC_APP_ZIP_FILE_NAME = "update.zip";
			return this.executeDownload({
				fileExtension: "zip",
				fileInfo: zipFileInfo,
				downloadUpdateOptions,
				task: async (destinationFile, downloadOptions) => {
					const cachedUpdateFilePath = path$3.join(this.downloadedUpdateHelper.cacheDir, CURRENT_MAC_APP_ZIP_FILE_NAME);
					const canDifferentialDownload = () => {
						if (!(0, fs_extra_1.pathExistsSync)(cachedUpdateFilePath)) {
							log.info("Unable to locate previous update.zip for differential download (is this first install?), falling back to full download");
							return false;
						}
						return !downloadUpdateOptions.disableDifferentialDownload;
					};
					let differentialDownloadFailed = true;
					if (canDifferentialDownload()) differentialDownloadFailed = await this.differentialDownloadInstaller(zipFileInfo, downloadUpdateOptions, destinationFile, provider, CURRENT_MAC_APP_ZIP_FILE_NAME);
					if (differentialDownloadFailed) await this.httpExecutor.download(zipFileInfo.url, destinationFile, downloadOptions);
				},
				done: async (event) => {
					if (!downloadUpdateOptions.disableDifferentialDownload) try {
						const cachedUpdateFilePath = path$3.join(this.downloadedUpdateHelper.cacheDir, CURRENT_MAC_APP_ZIP_FILE_NAME);
						await (0, fs_extra_1.copyFile)(event.downloadedFile, cachedUpdateFilePath);
					} catch (error) {
						this._logger.warn(`Unable to copy file for caching for future differential downloads: ${error.message}`);
					}
					return this.updateDownloaded(zipFileInfo, event);
				}
			});
		}
		async updateDownloaded(zipFileInfo, event) {
			var _a;
			const downloadedFile = event.downloadedFile;
			const updateFileSize = (_a = zipFileInfo.info.size) !== null && _a !== void 0 ? _a : (await (0, fs_extra_1.stat)(downloadedFile)).size;
			const log = this._logger;
			const logContext = `fileToProxy=${zipFileInfo.url.href}`;
			this.closeServerIfExists();
			this.debug(`Creating proxy server for native Squirrel.Mac (${logContext})`);
			this.server = (0, http_1.createServer)();
			this.debug(`Proxy server for native Squirrel.Mac is created (${logContext})`);
			this.server.on("close", () => {
				log.info(`Proxy server for native Squirrel.Mac is closed (${logContext})`);
			});
			const getServerUrl = (s) => {
				const address = s.address();
				if (typeof address === "string") return address;
				return `http://127.0.0.1:${address === null || address === void 0 ? void 0 : address.port}`;
			};
			return await new Promise((resolve, reject) => {
				const pass = (0, crypto_1.randomBytes)(64).toString("base64").replace(/\//g, "_").replace(/\+/g, "-");
				const authInfo = Buffer.from(`autoupdater:${pass}`, "ascii");
				const fileUrl = `/${(0, crypto_1.randomBytes)(64).toString("hex")}.zip`;
				this.server.on("request", (request, response) => {
					const requestUrl = request.url;
					log.info(`${requestUrl} requested`);
					if (requestUrl === "/") {
						if (!request.headers.authorization || request.headers.authorization.indexOf("Basic ") === -1) {
							response.statusCode = 401;
							response.statusMessage = "Invalid Authentication Credentials";
							response.end();
							log.warn("No authenthication info");
							return;
						}
						const base64Credentials = request.headers.authorization.split(" ")[1];
						const [username, password] = Buffer.from(base64Credentials, "base64").toString("ascii").split(":");
						if (username !== "autoupdater" || password !== pass) {
							response.statusCode = 401;
							response.statusMessage = "Invalid Authentication Credentials";
							response.end();
							log.warn("Invalid authenthication credentials");
							return;
						}
						const data = Buffer.from(`{ "url": "${getServerUrl(this.server)}${fileUrl}" }`);
						response.writeHead(200, {
							"Content-Type": "application/json",
							"Content-Length": data.length
						});
						response.end(data);
						return;
					}
					if (!requestUrl.startsWith(fileUrl)) {
						log.warn(`${requestUrl} requested, but not supported`);
						response.writeHead(404);
						response.end();
						return;
					}
					log.info(`${fileUrl} requested by Squirrel.Mac, pipe ${downloadedFile}`);
					let errorOccurred = false;
					response.on("finish", () => {
						if (!errorOccurred) {
							this.nativeUpdater.removeListener("error", reject);
							resolve([]);
						}
					});
					const readStream = (0, fs_1.createReadStream)(downloadedFile);
					readStream.on("error", (error) => {
						try {
							response.end();
						} catch (e) {
							log.warn(`cannot end response: ${e}`);
						}
						errorOccurred = true;
						this.nativeUpdater.removeListener("error", reject);
						reject(/* @__PURE__ */ new Error(`Cannot pipe "${downloadedFile}": ${error}`));
					});
					response.writeHead(200, {
						"Content-Type": "application/zip",
						"Content-Length": updateFileSize
					});
					readStream.pipe(response);
				});
				this.debug(`Proxy server for native Squirrel.Mac is starting to listen (${logContext})`);
				this.server.listen(0, "127.0.0.1", () => {
					this.debug(`Proxy server for native Squirrel.Mac is listening (address=${getServerUrl(this.server)}, ${logContext})`);
					this.nativeUpdater.setFeedURL({
						url: getServerUrl(this.server),
						headers: {
							"Cache-Control": "no-cache",
							Authorization: `Basic ${authInfo.toString("base64")}`
						}
					});
					this.dispatchUpdateDownloaded(event);
					if (this.autoInstallOnAppQuit) {
						this.nativeUpdater.once("error", reject);
						this.nativeUpdater.checkForUpdates();
					} else resolve([]);
				});
			});
		}
		handleUpdateDownloaded() {
			if (this.autoRunAppAfterInstall) this.nativeUpdater.quitAndInstall();
			else this.app.quit();
			this.closeServerIfExists();
		}
		quitAndInstall() {
			if (this.squirrelDownloadedUpdate) this.handleUpdateDownloaded();
			else {
				this.nativeUpdater.on("update-downloaded", () => this.handleUpdateDownloaded());
				if (!this.autoInstallOnAppQuit)
 /**
				* If this was not `true` previously then MacUpdater.doDownloadUpdate()
				* would not actually initiate the downloading by electron's autoUpdater
				*/
				this.nativeUpdater.checkForUpdates();
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/electron-updater/out/windowsExecutableCodeSignatureVerifier.js
var require_windowsExecutableCodeSignatureVerifier = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.verifySignature = verifySignature;
	var builder_util_runtime_1 = require_out();
	var child_process_1 = require("child_process");
	var os = require("os");
	var path$2 = require("path");
	function preparePowerShellExec(command, timeout) {
		return [
			`set "PSModulePath=" & chcp 65001 >NUL & powershell.exe`,
			[
				"-NoProfile",
				"-NonInteractive",
				"-InputFormat",
				"None",
				"-Command",
				command
			],
			{
				shell: true,
				timeout
			}
		];
	}
	function verifySignature(publisherNames, unescapedTempUpdateFile, logger) {
		return new Promise((resolve, reject) => {
			const tempUpdateFile = unescapedTempUpdateFile.replace(/'/g, "''");
			logger.info(`Verifying signature ${tempUpdateFile}`);
			(0, child_process_1.execFile)(...preparePowerShellExec(`"Get-AuthenticodeSignature -LiteralPath '${tempUpdateFile}' | ConvertTo-Json -Compress"`, 20 * 1e3), (error, stdout, stderr) => {
				var _a;
				try {
					if (error != null || stderr) {
						handleError(logger, error, stderr, reject);
						resolve(null);
						return;
					}
					const data = parseOut(stdout);
					if (data.Status === 0) {
						try {
							const normlaizedUpdateFilePath = path$2.normalize(data.Path);
							const normalizedTempUpdateFile = path$2.normalize(unescapedTempUpdateFile);
							logger.info(`LiteralPath: ${normlaizedUpdateFilePath}. Update Path: ${normalizedTempUpdateFile}`);
							if (normlaizedUpdateFilePath !== normalizedTempUpdateFile) {
								handleError(logger, /* @__PURE__ */ new Error(`LiteralPath of ${normlaizedUpdateFilePath} is different than ${normalizedTempUpdateFile}`), stderr, reject);
								resolve(null);
								return;
							}
						} catch (error) {
							logger.warn(`Unable to verify LiteralPath of update asset due to missing data.Path. Skipping this step of validation. Message: ${(_a = error.message) !== null && _a !== void 0 ? _a : error.stack}`);
						}
						const subject = (0, builder_util_runtime_1.parseDn)(data.SignerCertificate.Subject);
						let match = false;
						for (const name of publisherNames) {
							const dn = (0, builder_util_runtime_1.parseDn)(name);
							if (dn.size) match = Array.from(dn.keys()).every((key) => {
								return dn.get(key) === subject.get(key);
							});
							else if (name === subject.get("CN")) {
								logger.warn(`Signature validated using only CN ${name}. Please add your full Distinguished Name (DN) to publisherNames configuration`);
								match = true;
							}
							if (match) {
								resolve(null);
								return;
							}
						}
					}
					const result = `publisherNames: ${publisherNames.join(" | ")}, raw info: ` + JSON.stringify(data, (name, value) => name === "RawData" ? void 0 : value, 2);
					logger.warn(`Sign verification failed, installer signed with incorrect certificate: ${result}`);
					resolve(result);
				} catch (e) {
					handleError(logger, e, null, reject);
					resolve(null);
					return;
				}
			});
		});
	}
	function parseOut(out) {
		const data = JSON.parse(out);
		delete data.PrivateKey;
		delete data.IsOSBinary;
		delete data.SignatureType;
		const signerCertificate = data.SignerCertificate;
		if (signerCertificate != null) {
			delete signerCertificate.Archived;
			delete signerCertificate.Extensions;
			delete signerCertificate.Handle;
			delete signerCertificate.HasPrivateKey;
			delete signerCertificate.SubjectName;
		}
		return data;
	}
	function handleError(logger, error, stderr, reject) {
		if (isOldWin6()) {
			logger.warn(`Cannot execute Get-AuthenticodeSignature: ${error || stderr}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
			return;
		}
		try {
			(0, child_process_1.execFileSync)(...preparePowerShellExec("ConvertTo-Json test", 10 * 1e3));
		} catch (testError) {
			logger.warn(`Cannot execute ConvertTo-Json: ${testError.message}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
			return;
		}
		if (error != null) reject(error);
		if (stderr) reject(/* @__PURE__ */ new Error(`Cannot execute Get-AuthenticodeSignature, stderr: ${stderr}. Failing signature validation due to unknown stderr.`));
	}
	function isOldWin6() {
		const winVersion = os.release();
		return winVersion.startsWith("6.") && !winVersion.startsWith("6.3");
	}
}));
//#endregion
//#region ../../node_modules/electron-updater/out/NsisUpdater.js
var require_NsisUpdater = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.NsisUpdater = void 0;
	var builder_util_runtime_1 = require_out();
	var path$1 = require("path");
	var BaseUpdater_1 = require_BaseUpdater();
	var FileWithEmbeddedBlockMapDifferentialDownloader_1 = require_FileWithEmbeddedBlockMapDifferentialDownloader();
	var types_1 = require_types();
	var Provider_1 = require_Provider();
	var fs_extra_1 = require_lib();
	var windowsExecutableCodeSignatureVerifier_1 = require_windowsExecutableCodeSignatureVerifier();
	var url_1 = require("url");
	var NsisUpdater = class extends BaseUpdater_1.BaseUpdater {
		constructor(options, app) {
			super(options, app);
			this._verifyUpdateCodeSignature = (publisherNames, unescapedTempUpdateFile) => (0, windowsExecutableCodeSignatureVerifier_1.verifySignature)(publisherNames, unescapedTempUpdateFile, this._logger);
		}
		/**
		* The verifyUpdateCodeSignature. You can pass [win-verify-signature](https://github.com/beyondkmp/win-verify-trust) or another custom verify function: ` (publisherName: string[], path: string) => Promise<string | null>`.
		* The default verify function uses [windowsExecutableCodeSignatureVerifier](https://github.com/electron-userland/electron-builder/blob/master/packages/electron-updater/src/windowsExecutableCodeSignatureVerifier.ts)
		*/
		get verifyUpdateCodeSignature() {
			return this._verifyUpdateCodeSignature;
		}
		set verifyUpdateCodeSignature(value) {
			if (value) this._verifyUpdateCodeSignature = value;
		}
		/*** @private */
		doDownloadUpdate(downloadUpdateOptions) {
			const provider = downloadUpdateOptions.updateInfoAndProvider.provider;
			const fileInfo = (0, Provider_1.findFile)(provider.resolveFiles(downloadUpdateOptions.updateInfoAndProvider.info), "exe");
			return this.executeDownload({
				fileExtension: "exe",
				downloadUpdateOptions,
				fileInfo,
				task: async (destinationFile, downloadOptions, packageFile, removeTempDirIfAny) => {
					const packageInfo = fileInfo.packageInfo;
					const isWebInstaller = packageInfo != null && packageFile != null;
					if (isWebInstaller && downloadUpdateOptions.disableWebInstaller) throw (0, builder_util_runtime_1.newError)(`Unable to download new version ${downloadUpdateOptions.updateInfoAndProvider.info.version}. Web Installers are disabled`, "ERR_UPDATER_WEB_INSTALLER_DISABLED");
					if (!isWebInstaller && !downloadUpdateOptions.disableWebInstaller) this._logger.warn("disableWebInstaller is set to false, you should set it to true if you do not plan on using a web installer. This will default to true in a future version.");
					if (isWebInstaller || downloadUpdateOptions.disableDifferentialDownload || await this.differentialDownloadInstaller(fileInfo, downloadUpdateOptions, destinationFile, provider, builder_util_runtime_1.CURRENT_APP_INSTALLER_FILE_NAME)) await this.httpExecutor.download(fileInfo.url, destinationFile, downloadOptions);
					const signatureVerificationStatus = await this.verifySignature(destinationFile);
					if (signatureVerificationStatus != null) {
						await removeTempDirIfAny();
						throw (0, builder_util_runtime_1.newError)(`New version ${downloadUpdateOptions.updateInfoAndProvider.info.version} is not signed by the application owner: ${signatureVerificationStatus}`, "ERR_UPDATER_INVALID_SIGNATURE");
					}
					if (isWebInstaller) {
						if (await this.differentialDownloadWebPackage(downloadUpdateOptions, packageInfo, packageFile, provider)) try {
							await this.httpExecutor.download(new url_1.URL(packageInfo.path), packageFile, {
								headers: downloadUpdateOptions.requestHeaders,
								cancellationToken: downloadUpdateOptions.cancellationToken,
								sha512: packageInfo.sha512
							});
						} catch (e) {
							try {
								await (0, fs_extra_1.unlink)(packageFile);
							} catch (_ignored) {}
							throw e;
						}
					}
				}
			});
		}
		async verifySignature(tempUpdateFile) {
			let publisherName;
			try {
				publisherName = (await this.configOnDisk.value).publisherName;
				if (publisherName == null) return null;
			} catch (e) {
				if (e.code === "ENOENT") return null;
				throw e;
			}
			return await this._verifyUpdateCodeSignature(Array.isArray(publisherName) ? publisherName : [publisherName], tempUpdateFile);
		}
		doInstall(options) {
			const installerPath = this.installerPath;
			if (installerPath == null) {
				this.dispatchError(/* @__PURE__ */ new Error("No update filepath provided, can't quit and install"));
				return false;
			}
			const args = ["--updated"];
			if (options.isSilent) args.push("/S");
			if (options.isForceRunAfter) args.push("--force-run");
			if (this.installDirectory) args.push(`/D=${this.installDirectory}`);
			const packagePath = this.downloadedUpdateHelper == null ? null : this.downloadedUpdateHelper.packageFile;
			if (packagePath != null) args.push(`--package-file=${packagePath}`);
			const callUsingElevation = () => {
				this.spawnLog(path$1.join(process.resourcesPath, "elevate.exe"), [installerPath].concat(args)).catch((e) => this.dispatchError(e));
			};
			if (options.isAdminRightsRequired) {
				this._logger.info("isAdminRightsRequired is set to true, run installer using elevate.exe");
				callUsingElevation();
				return true;
			}
			this.spawnLog(installerPath, args).catch((e) => {
				const errorCode = e.code;
				this._logger.info(`Cannot run installer: error code: ${errorCode}, error message: "${e.message}", will be executed again using elevate if EACCES, and will try to use electron.shell.openItem if ENOENT`);
				if (errorCode === "UNKNOWN" || errorCode === "EACCES") callUsingElevation();
				else if (errorCode === "ENOENT") require("electron").shell.openPath(installerPath).catch((err) => this.dispatchError(err));
				else this.dispatchError(e);
			});
			return true;
		}
		async differentialDownloadWebPackage(downloadUpdateOptions, packageInfo, packagePath, provider) {
			if (packageInfo.blockMapSize == null) return true;
			try {
				const downloadOptions = {
					newUrl: new url_1.URL(packageInfo.path),
					oldFile: path$1.join(this.downloadedUpdateHelper.cacheDir, builder_util_runtime_1.CURRENT_APP_PACKAGE_FILE_NAME),
					logger: this._logger,
					newFile: packagePath,
					requestHeaders: this.requestHeaders,
					isUseMultipleRangeRequest: provider.isUseMultipleRangeRequest,
					cancellationToken: downloadUpdateOptions.cancellationToken
				};
				if (this.listenerCount(types_1.DOWNLOAD_PROGRESS) > 0) downloadOptions.onProgress = (it) => this.emit(types_1.DOWNLOAD_PROGRESS, it);
				await new FileWithEmbeddedBlockMapDifferentialDownloader_1.FileWithEmbeddedBlockMapDifferentialDownloader(packageInfo, this.httpExecutor, downloadOptions).download();
			} catch (e) {
				this._logger.error(`Cannot download differentially, fallback to full download: ${e.stack || e}`);
				return process.platform === "win32";
			}
			return false;
		}
	};
	exports.NsisUpdater = NsisUpdater;
}));
//#endregion
//#region src/main/updater.ts
var import_main = (/* @__PURE__ */ __commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$1) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$1, p)) __createBinding(exports$1, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.NsisUpdater = exports.MacUpdater = exports.RpmUpdater = exports.PacmanUpdater = exports.DebUpdater = exports.AppImageUpdater = exports.Provider = exports.NoOpLogger = exports.AppUpdater = exports.BaseUpdater = void 0;
	var fs_extra_1 = require_lib();
	var path = require("path");
	var BaseUpdater_1 = require_BaseUpdater();
	Object.defineProperty(exports, "BaseUpdater", {
		enumerable: true,
		get: function() {
			return BaseUpdater_1.BaseUpdater;
		}
	});
	var AppUpdater_1 = require_AppUpdater();
	Object.defineProperty(exports, "AppUpdater", {
		enumerable: true,
		get: function() {
			return AppUpdater_1.AppUpdater;
		}
	});
	Object.defineProperty(exports, "NoOpLogger", {
		enumerable: true,
		get: function() {
			return AppUpdater_1.NoOpLogger;
		}
	});
	var Provider_1 = require_Provider();
	Object.defineProperty(exports, "Provider", {
		enumerable: true,
		get: function() {
			return Provider_1.Provider;
		}
	});
	var AppImageUpdater_1 = require_AppImageUpdater();
	Object.defineProperty(exports, "AppImageUpdater", {
		enumerable: true,
		get: function() {
			return AppImageUpdater_1.AppImageUpdater;
		}
	});
	var DebUpdater_1 = require_DebUpdater();
	Object.defineProperty(exports, "DebUpdater", {
		enumerable: true,
		get: function() {
			return DebUpdater_1.DebUpdater;
		}
	});
	var PacmanUpdater_1 = require_PacmanUpdater();
	Object.defineProperty(exports, "PacmanUpdater", {
		enumerable: true,
		get: function() {
			return PacmanUpdater_1.PacmanUpdater;
		}
	});
	var RpmUpdater_1 = require_RpmUpdater();
	Object.defineProperty(exports, "RpmUpdater", {
		enumerable: true,
		get: function() {
			return RpmUpdater_1.RpmUpdater;
		}
	});
	var MacUpdater_1 = require_MacUpdater();
	Object.defineProperty(exports, "MacUpdater", {
		enumerable: true,
		get: function() {
			return MacUpdater_1.MacUpdater;
		}
	});
	var NsisUpdater_1 = require_NsisUpdater();
	Object.defineProperty(exports, "NsisUpdater", {
		enumerable: true,
		get: function() {
			return NsisUpdater_1.NsisUpdater;
		}
	});
	__exportStar(require_types(), exports);
	var _autoUpdater;
	function doLoadAutoUpdater() {
		if (process.platform === "win32") _autoUpdater = new (require_NsisUpdater()).NsisUpdater();
		else if (process.platform === "darwin") _autoUpdater = new (require_MacUpdater()).MacUpdater();
		else {
			_autoUpdater = new (require_AppImageUpdater()).AppImageUpdater();
			try {
				const identity = path.join(process.resourcesPath, "package-type");
				if (!(0, fs_extra_1.existsSync)(identity)) return _autoUpdater;
				switch ((0, fs_extra_1.readFileSync)(identity).toString().trim()) {
					case "deb":
						_autoUpdater = new (require_DebUpdater()).DebUpdater();
						break;
					case "rpm":
						_autoUpdater = new (require_RpmUpdater()).RpmUpdater();
						break;
					case "pacman":
						_autoUpdater = new (require_PacmanUpdater()).PacmanUpdater();
						break;
					default: break;
				}
			} catch (error) {
				console.warn("Unable to detect 'package-type' for autoUpdater (rpm/deb/pacman support). If you'd like to expand support, please consider contributing to electron-builder", error.message);
			}
		}
		return _autoUpdater;
	}
	Object.defineProperty(exports, "autoUpdater", {
		enumerable: true,
		get: () => {
			return _autoUpdater || doLoadAutoUpdater();
		}
	});
})))();
/**
* 设置自动更新
*/
function setupAutoUpdater(mainWindow) {
	import_main.autoUpdater.autoDownload = true;
	import_main.autoUpdater.autoInstallOnAppQuit = true;
	import_main.autoUpdater.logger = import_src.default;
	/**
	* 检查更新时
	*/
	import_main.autoUpdater.on("checking-for-update", () => {
		import_src.default.info("正在检查更新...");
		mainWindow.webContents.send("update:checking");
	});
	/**
	* 发现新版本时
	*/
	import_main.autoUpdater.on("update-available", (info) => {
		import_src.default.info("发现新版本:", info.version);
		mainWindow.webContents.send("update:available", {
			version: info.version,
			releaseDate: info.releaseDate,
			releaseNotes: info.releaseNotes
		});
		electron.dialog.showMessageBox(mainWindow, {
			type: "info",
			title: "发现新版本",
			message: `发现新版本 ${info.version}`,
			detail: "新版本正在下载中，下载完成后将自动安装。",
			buttons: ["确定"]
		});
	});
	/**
	* 没有可用更新时
	*/
	import_main.autoUpdater.on("update-not-available", (info) => {
		import_src.default.info("当前已是最新版本:", info.version);
		mainWindow.webContents.send("update:not-available", { version: info.version });
	});
	/**
	* 下载进度
	*/
	import_main.autoUpdater.on("download-progress", (progress) => {
		const message = `下载速度: ${progress.bytesPerSecond} - 已下载: ${progress.percent.toFixed(2)}%`;
		import_src.default.info(message);
		mainWindow.webContents.send("update:progress", {
			percent: progress.percent,
			bytesPerSecond: progress.bytesPerSecond,
			transferred: progress.transferred,
			total: progress.total
		});
	});
	/**
	* 下载完成
	*/
	import_main.autoUpdater.on("update-downloaded", (info) => {
		import_src.default.info("更新下载完成:", info.version);
		mainWindow.webContents.send("update:downloaded", { version: info.version });
		electron.dialog.showMessageBox(mainWindow, {
			type: "info",
			title: "更新已就绪",
			message: "新版本已下载完成",
			detail: "点击\"立即重启\"以完成更新，或稍后手动重启应用。",
			buttons: ["立即重启", "稍后"],
			defaultId: 0,
			cancelId: 1
		}).then(({ response }) => {
			if (response === 0) import_main.autoUpdater.quitAndInstall();
		});
	});
	/**
	* 更新错误
	*/
	import_main.autoUpdater.on("error", (error) => {
		import_src.default.error("更新错误:", error);
		mainWindow.webContents.send("update:error", { message: error.message });
	});
	/**
	* 监听渲染进程的更新请求
	*/
	electron.ipcMain.handle("update:check", async () => {
		try {
			return { updateInfo: (await import_main.autoUpdater.checkForUpdates())?.updateInfo ?? null };
		} catch (error) {
			import_src.default.error("检查更新失败:", error);
			return { error: error.message };
		}
	});
	electron.ipcMain.handle("update:download", async () => {
		try {
			await import_main.autoUpdater.downloadUpdate();
			return { success: true };
		} catch (error) {
			import_src.default.error("下载更新失败:", error);
			return { error: error.message };
		}
	});
	electron.ipcMain.handle("update:install", () => {
		import_main.autoUpdater.quitAndInstall();
		return { success: true };
	});
	import_src.default.info("自动更新已配置");
}
//#endregion
//#region src/main/index.ts
import_src.default.transports.file.level = "info";
import_src.default.info("应用启动");
if (process.platform === "win32") electron.app.setAppUserModelId("com.githubstars.desktop");
var mainWindow = null;
/**
* 应用准备就绪时初始化
*/
electron.app.whenReady().then(() => {
	electronApp.setAppUserModelId("com.githubstars.desktop");
	if (is.dev) electron.app.on("browser-window-created", (_, window) => {
		optimizer.watchWindowShortcuts(window);
	});
	mainWindow = createMainWindow();
	setupIpcHandlers(mainWindow);
	createTray(mainWindow);
	setupAutoUpdater(mainWindow);
	electron.app.on("activate", () => {
		if (electron.BrowserWindow.getAllWindows().length === 0) {
			mainWindow = createMainWindow();
			setupIpcHandlers(mainWindow);
			createTray(mainWindow);
			setupAutoUpdater(mainWindow);
		}
	});
	import_src.default.info("应用初始化完成");
});
/**
* 所有窗口关闭时退出应用（macOS除外）
*/
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
/**
* 处理未捕获的异常
*/
process.on("uncaughtException", (error) => {
	import_src.default.error("未捕获的异常:", error);
});
process.on("unhandledRejection", (reason) => {
	import_src.default.error("未处理的Promise拒绝:", reason);
});
//#endregion
