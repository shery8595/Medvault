import { Buffer } from 'buffer';
import process from 'process';
import * as util from 'util';

// @ts-ignore
window.Buffer = Buffer;
// @ts-ignore
window.process = process;
// @ts-ignore
window.global = window;
// @ts-ignore
window.util = util;

export { };
