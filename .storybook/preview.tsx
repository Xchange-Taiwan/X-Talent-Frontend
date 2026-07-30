import type { Preview } from '@storybook/nextjs';
import '../src/styles/global.css';
import { withAppContext } from './withAppContext';

const preview: Preview = {
  parameters: {
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
