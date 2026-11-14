self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'ระบบแจ้งซ่อม', {
      body: data.body,
      data: { url: data.url || '/notifications' },
      icon: '/icon.svg',
      lang: 'th',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data.url, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      return open ? open.navigate(url).then((w) => (w || open).focus()) : self.clients.openWindow(url);
    }),
  );
});
