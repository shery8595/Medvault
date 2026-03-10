import { Buffer } from 'buffer';
import process from 'process';
import * as util from 'util';
import { EventEmitter } from 'events';

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

export { };
