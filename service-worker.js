"use strict";

const CACHE_PREFIX = "forex001-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./auth-config.js",
  "./mountain-chart.jpg",
  "./manifest.webmanifest",
  "./service-worker.js",
  "./icons/forex001.svg",
  "./icons/forex001-180.png",
  "./icons/forex001-192.png",
  "./icons/forex001-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  const isNavigation = request.mode === "navigate";
  const isAppAsset = isNavigation || APP_SHELL.some((path) =>
    new URL(path, self.registration.scope).pathname === url.pathname
  );
  if (!isAppAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
        if (isNavigation) {
          await cache.put(new URL("./index.html", self.registration.scope), response.clone());
        }
      }
      return response;
    } catch (error) {
      const cachedResponse = await cache.match(request) ||
        (isNavigation ? await cache.match(new URL("./index.html", self.registration.scope)) : null);
      if (cachedResponse) return cachedResponse;
      throw error;
    }
  })());
});
