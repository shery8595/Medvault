// @ts-ignore
if (window.LOG_DEBUG) window.LOG_DEBUG('polyfills.ts: Initializing Gold Standard Polyfills...');

import { Buffer } from 'buffer';
import process from 'process';
import util from 'util';
import { EventEmitter } from 'events';
import Stream from 'stream-browserify';
import inherits from 'inherits';

// @ts-ignore
if (window.LOG_DEBUG) window.LOG_DEBUG('polyfills.ts: Assigning global dependencies...');

// @ts-ignore
window.Buffer = Buffer;
// @ts-ignore
window.process = process;
// @ts-ignore
window.global = window;
// @ts-ignore
window.util = util;
// @ts-ignore
window.EventEmitter = EventEmitter;
// @ts-ignore
window.Stream = Stream;
// @ts-ignore
window.inherits = inherits;

// Sub-components of Stream for some libraries
// @ts-ignore
window.Readable = Stream.Readable;
// @ts-ignore
window.Writable = Stream.Writable;
// @ts-ignore
window.Transform = Stream.Transform;

// @ts-ignore
if (window.LOG_DEBUG) window.LOG_DEBUG('polyfills.ts: Gold Standard Complete.');

export { };
