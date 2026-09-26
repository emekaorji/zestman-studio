/**
 * Where the studio keeps things in localStorage.
 *
 * Its own module with no React in it, because the website's root page reads
 * these keys from a Server Component to decide whether this browser already
 * belongs to a daemon — importing them from a file that also exports a hook
 * drags client-only APIs into the server build.
 */
export const STORAGE_VERSION = 1;

/** Chrome + preferences, global to the install. */
export const UI_KEY = `zestman:ui:v${STORAGE_VERSION}`;

/** Workspace position, per project. */
export const wsKey = (projectId: string) => `zestman:ws:${projectId}:v${STORAGE_VERSION}`;

/** The daemon this browser is paired with: port + token. */
export const CONN_KEY = "zestman:conn:v1";

/** Projects from the last time we were connected. */
export const PROJECTS_KEY = "zestman:projects:v1";
