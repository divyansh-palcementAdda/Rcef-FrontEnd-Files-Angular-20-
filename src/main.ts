import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './app/environment/environment';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
  if (environment.production) {
  console.log = function () {};
  console.warn = function () {};
  console.info = function () {};
  }
