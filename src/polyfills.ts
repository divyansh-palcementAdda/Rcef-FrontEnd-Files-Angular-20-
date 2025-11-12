// src/polyfills.ts

/*** 
 * FIX: sockjs-client requires 'global' in browser
 * Error: "Uncaught ReferenceError: global is not defined"
 ***/
(window as any).global = window;
/*** END FIX ***/

// === Angular Default Polyfills (KEEP THESE) ===
import 'zone.js';  // Required for Angular
// import 'zone.js/dist/zone'; // Older versions