import type { Preview } from '@storybook/nextjs';
import React from 'react';
import { withAppContext } from './withAppContext';
import '../src/styles/global.css';

const preview: Preview = {
  parameters: {
    // Enable out-of-the-box App Router mocking via the official @storybook/nextjs framework.
    // To override the router behavior in individual stories, use parameters.nextjs.router:
    //   `parameters: { nextjs: { router: { pathname: '/profile', query: { id: '123' } } } }`
    nextjs: {
      appDirectory: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [withAppContext],
};

export default preview;
